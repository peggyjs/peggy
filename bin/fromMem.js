"use strict";

// Import or require module text from memory, rather than disk.  Runs
// in a light sandbox that is likely easily escapable, but protects against
// slight oopsies like polluting the global namespace.
//
// Ideas taken from the "module-from-string" and "eval" modules, neither of
// which were situated correctly to be used as-is.

const vm = require("vm");
const { Module } = require("module");
const path = require("path");
const url = require("url");

const IMPORTS = "___PEGGY___IMPORTS___";

// These already exist in a new, blank VM.  Date, JSON, NaN, etc.
const vmGlobals = new vm
  .Script("Object.getOwnPropertyNames(globalThis)")
  .runInNewContext()
  .sort();
vmGlobals.push("global", "globalThis", "sys");

// These are the things that are normally in the environment, that vm doesn't
// make available.
const neededKeys = Object
  .getOwnPropertyNames(global)
  .filter(k => vmGlobals.indexOf(k) < 0)
  .sort();
const globalContext = {};
for (const k of neededKeys) {
  globalContext[k] = global[k];
}
// In node <15, console is in vmGlobals.
globalContext.console = console;

/**
 * Options for how to process code.
 *
 * @typedef {object} FromMemOptions
 * @property {"amd"|"bare"|"commonjs"|"es"|"globals"|"umd"} [format="commonjs"]
 *   What format does the code have?
 * @property {string} [filename=__filename] What is the fully-qualified synthetic
 *   filename for the code?  Most important is the directory, which is used to
 *   find modules that the code import's or require's.
 * @property {object} [context={}] Variables to make availble in the global
 *   scope while code is being evaluated.
 * @property {boolean} [includeGlobals=true] Include the typical global
 *   properties that node gives to all modules.  (e.g. Buffer, process).
 * @property {string} [globalExport=null] For type "globals", what name is
 *   exported from the module?
 */

/**
 * Treat the given code as a node module as if require() had been called
 * on a file containing the code.
 *
 * @param {string} code Source code in commonjs format.
 * @param {string} dirname Used for __dirname.
 * @param {FromMemOptions} options
 * @returns {object} The module exports from code
 */
function requireString(code, dirname, options) {
  const m = new Module(options.filename, module); // Current module is parent.
  // This is the function that will be called by `require()` in the parser.
  m.require = (
    // In node 12+, createRequire is documented.
    // In node 10, createRequireFromPath is the least-undocumented approach.
    Module.createRequire || Module.createRequireFromPath
  )(options.filename);
  const script = new vm.Script(code, { filename: options.filename });
  return script.runInNewContext({
    module: m,
    exports: m.exports,
    require: m.require,
    __dirname: dirname,
    __filename: options.filename,
    ...options.context,
  });
}

/**
 * If the given specifier starts with a ".", path.resolve it to the given
 * directory.  Otherwise, it's a fully-qualified path, a node internal
 * module name, an npm-provided module name, or a URL.
 *
 * @param {string} dirname Owning directory
 * @param {string} specifier String from the rightmost side of an import statement
 * @returns {string} Resolved path name or original string
 */
function resolveIfNeeded(dirname, specifier) {
  if (specifier.startsWith(".")) {
    specifier = path.resolve(dirname, specifier);
  }
  return specifier;
}

/**
 * Treat the given code as a node module as if import had been called
 * on a file containing the code.
 *
 * @param {string} code Source code in es6 format.
 * @param {string} dirname Where the synthetic file would have lived.
 * @param {FromMemOptions} options
 * @returns {object} The module exports from code
 */
async function importString(code, dirname, options) {
  if (!vm.SourceTextModule) {
    throw new Error("Start node with --experimental-vm-modules for this to work");
  }
  options.context[IMPORTS] = {};
  const mod = new vm.SourceTextModule(code, {
    identifier: options.filename,
    context: vm.createContext(options.context),
    initializeImportMeta(meta) {
      meta.url = String(url.pathToFileURL(options.filename));
    },
    importModuleDynamically(specifier) {
      return import(resolveIfNeeded(dirname, specifier));
    },
  });

  await mod.link(async(specifier, referencingModule) => {
    const resolvedSpecifier = resolveIfNeeded(dirname, specifier);
    const targetModule = await import(resolvedSpecifier);

    // All of the below is to create a Module wrapper around the imported code
    options.context[IMPORTS][specifier] = targetModule;

    const stringifiedSpecifier = JSON.stringify(specifier);
    const exportedNames = Object.keys(targetModule);
    let targetModuleContent = "";
    if (exportedNames.includes("default")) {
      targetModuleContent += `export default ${IMPORTS}[${stringifiedSpecifier}].default;\n`;
    }
    const nonDefault = exportedNames.filter(n => n !== "default");
    if (nonDefault.length > 0) {
      targetModuleContent += `export const {${nonDefault.join(", ")}} = ${IMPORTS}[${stringifiedSpecifier}];`;
    }

    // @ts-expect-error: experimental
    return new vm.SourceTextModule(targetModuleContent, {
      identifier: resolvedSpecifier,
      context: referencingModule.context,
    });
  });
  await mod.evaluate();
  return mod.namespace;
}

/**
 * Import or require the given code from memory.  Knows about the different
 * Peggy output formats.  Returns the exports of the module.
 *
 * @param {string} code Code to import
 * @param {FromMemOptions} [options] Options.  Most important is filename.
 * @returns {Promise<object>} The evaluated code.
 */
// eslint-disable-next-line require-await -- Always want to return a Promise
module.exports = async function fromMem(code, options) {
  options = {
    format: "commonjs",
    filename: __filename,
    context: {},
    includeGlobals: true,
    globalExport: null,
    ...options,
  };

  if (options.includeGlobals) {
    options.context = {
      ...globalContext,
      ...options.context,
    };
  }
  options.filename = path.resolve(options.filename);
  const dirname = path.dirname(options.filename);

  switch (options.format) {
    case "bare":
    case "commonjs":
    case "umd":
      return requireString(code, dirname, options);
    case "globals": {
      const mod = requireString(code, dirname, options);
      return mod[options.globalExport];
    }
    case "es":
      // Returns promise
      return importString(code, dirname, options);
    default:
      throw new Error(`Unsupported output format: "${options.format}"`);
  }
};
