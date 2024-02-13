"use strict";

// Import or require module text from memory, rather than disk.  Runs
// in a node vm, very similar to how node loads modules.
//
// Ideas taken from the "module-from-string" and "eval" modules, neither of
// which were situated correctly to be used as-is.

const vm = require("vm");
const { Module } = require("module");
const path = require("path");
const url = require("url");

// These already exist in a new, blank VM.  Date, JSON, NaN, etc.
// Things from the core language.
const vmGlobals = new vm
  .Script("Object.getOwnPropertyNames(globalThis)")
  .runInNewContext()
  .sort();
vmGlobals.push("global", "globalThis", "sys");

// These are the things that are normally in the environment, that vm doesn't
// make available.  This that you expect to be available in a node environment
// that aren't in the laguage itself.
const neededKeys = Object
  .getOwnPropertyNames(global)
  .filter(k => !vmGlobals.includes(k))
  .sort();
const globalContext = Object.fromEntries(
  neededKeys.map(k => [k, global[k]])
);

// In node <15, console is in vmGlobals.
globalContext.console = console;

/**
 * Options for how to process code.
 *
 * @typedef {object} FromMemOptions
 * @property {"amd"|"bare"|"commonjs"|"es"|"globals"|"umd"} [format="commonjs"]
 *   What format does the code have?  Throws an error if the format is not
 *   "commonjs", "es", "umd", or "bare".
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
  m.require = Module.createRequire(options.filename);
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

  const [maj, min] = process.version
    .match(/^v(\d+)\.(\d+)\.(\d+)/)
    .slice(1)
    .map(x => parseInt(x, 10));
  if ((maj < 20) || ((maj === 20) && (min < 8))) {
    throw new Error("Requires node.js 20.8+ or 21.");
  }

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
    const exports = Object.keys(targetModule);

    // DO NOT change function to () =>, or `this` will be wrong.
    return new vm.SyntheticModule(exports, function() {
      for (const e of exports) {
        this.setExport(e, targetModule[e]);
      }
    }, {
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
    filename: `${__filename}-string`,
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
  options.context.global = options.context;
  options.context.globalThis = options.context;

  options.filename = path.resolve(options.filename);
  const dirname = path.dirname(options.filename);

  switch (options.format) {
    case "bare":
    case "commonjs":
    case "umd":
      return requireString(code, dirname, options);
    case "es":
      // Returns promise
      return importString(code, dirname, options);
    // I don't care enough about amd and globals to figure out how to load them.
    default:
      throw new Error(`Unsupported output format: "${options.format}"`);
  }
};
