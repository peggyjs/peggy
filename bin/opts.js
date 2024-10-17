"use strict";

/**
 * @fileoverview Functions for extended processing of command line options,
 * converting them to the correct types for the Peggy API, etc.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { InvalidArgumentError } = require("commander");
const { isErrno, isER, replaceExt, select } = require("./utils.js");
const { pathToFileURL } = require("url");

const MODULE_FORMATS_WITH_DEPS = ["amd", "commonjs", "es", "umd"];
const MODULE_FORMATS_WITH_GLOBAL = ["globals", "umd"];

// Options that aren't for the API directly:
const PROG_OPTIONS = [
  "ast",
  "dependency",
  "dts",
  "extraOptionsFile",
  "input",
  "library",
  "output",
  "plugin",
  "returnTypes",
  "sourceMap",
  "test",
  "testFile",
  "verbose",
  "watch",
];

/**
 * @typedef {object} ProgOptions
 * @property {boolean} [ast]
 * @property {string[]} [dependency]
 * @property {string} [dts]
 * @property {string} [dtsFile]
 * @property {string[]} [extraOptionsFile]
 * @property {string|string[]} [input]
 * @property {string[]} inputFiles
 * @property {boolean} [library]
 * @property {string} [output]
 * @property {string[]} [plugin]
 * @property {string} [returnTypes]
 * @property {boolean|string} [sourceMap]
 * @property {string} [test]
 * @property {string} [testFile]
 * @property {string} [testGrammarSource]
 * @property {string} [testText]
 * @property {string} [outputFile]
 * @property {string} [outputJS]
 * @property {boolean} [verbose]
 * @property {boolean} [watch]
 */

/*
Leave these in for the API without change:
allowedStartRules
exportVar
format
startRule
trace
(anything for plugins)
*/

/**
 * @typedef {import("../lib/peg.js").SourceOptionsBase<"ast">} AstOptions
 */

/**
 * @typedef {AstOptions & ProgOptions} CliOptions
 */

/**
 * @typedef {import('./peggy-cli.js').PeggyCLI} Command
 */

/**
 * Add extra options from a config file, if they haven't already been
 * set on the command line.  Exception: multi-value options like plugins
 * are additive.
 *
 * @param {Command} cmd
 * @param {CliOptions} extraOptions
 * @param {string} source
 * @returns {null}
 */
function addExtraOptions(cmd, extraOptions, source) {
  if ((extraOptions === null)
      || (typeof extraOptions !== "object")
      || Array.isArray(extraOptions)) {
    throw new InvalidArgumentError(
      "The JSON with extra options has to represent an object."
    );
  }
  for (const [k, v] of Object.entries(extraOptions)) {
    const prev = cmd.getOptionValue(k);
    const src = cmd.getOptionValueSource(k);
    if (!src || (src === "default")) {
      // Overwrite
      cmd.setOptionValueWithSource(k, v, source);
    } else if (Array.isArray(prev)) {
      // Combine with previous
      prev.push(...v);
    } else if (typeof prev === "object") {
      Object.assign(prev, v);
    }
  }
  return null;
}

/**
 * Get options from a JSON string.
 *
 * @param {Command} cmd
 * @param {string} json JSON as text
 * @param {string} source Name of option that was the source of the JSON.
 * @returns {null}
 */
function addExtraOptionsJSON(cmd, json, source) {
  try {
    const extraOptions = JSON.parse(json);
    return addExtraOptions(cmd, extraOptions, source);
  } catch (e) {
    isER(e);
    throw new InvalidArgumentError(`Error parsing JSON: ${e.message}`);
  }
}

/**
 * Load a config file.
 *
 * @param {Command} cmd
 * @param {string} val
 * @return {Promise<void>}
 */
async function loadConfig(cmd, val) {
  if (/\.[cm]?js$/.test(val)) {
    try {
      const configURL = pathToFileURL(path.resolve(val)).toString();
      const eOpts = await import(configURL);
      addExtraOptions(cmd, eOpts.default, "extra-options-file");
    } catch (error) {
      isER(error);
      cmd.error(`Error importing config "${val}"`, { error });
    }
  } else {
    try {
      const json = await fs.promises.readFile(val, "utf8");
      addExtraOptionsJSON(cmd, json, "extra-options-file");
    } catch (error) {
      isER(error);
      cmd.error(`Error reading "${val}"`, { error });
    }
  }
}

/**
 * Load a plugin module, if needed.
 *
 * @param {Command} cmd
 * @param {string | PEG.Plugin} val
 * @returns {Promise<PEG.Plugin>}
 */
async function loadPlugin(cmd, val) {
  if (typeof val !== "string") {
    return val;
  }

  // If this is an absolute or relative path (not a module name)
  const id = (path.isAbsolute(val) || /^\.\.?[/\\]/.test(val))
    ? pathToFileURL(path.resolve(val)).toString()
    : val; // Otherwise, it's an NPM module

  /** @type {PEG.Plugin=} */
  let plugin = undefined;
  try {
    const mod = await import(id);
    plugin = (typeof mod.use === "function") ? mod : mod.default;
    if (typeof plugin?.use !== "function") {
      cmd.error(`Invalid plugin "${id}", no \`use()\` function`);
    }
  } catch (error) {
    if (isErrno(error)
        && ((error.code === "ERR_MODULE_NOT_FOUND")
            || (error.code === "MODULE_NOT_FOUND"))) {
      cmd.error(`importing "${id}"`, { error });
    } else {
      isER(error);
      cmd.error(`importing "${id}":\n${error.stack}`);
    }
  }
  assert(plugin);
  return plugin;
}

/**
 * Refine the options given in the CLI into options for `generate` and other
 * options that are used for processing outside of grammar generation.
 *
 * @param {Command} cmd
 * @param {string[]} inputFiles
 * @param {CliOptions} cliOptions
 * @returns {Promise<{parserOptions: AstOptions, progOptions: ProgOptions}>}
 */
async function refineOptions(cmd, inputFiles, cliOptions) {
  if (cliOptions.extraOptionsFile) {
    // Can't load options from node_modules
    for (const val of cliOptions.extraOptionsFile) {
      await loadConfig(cmd, val);
    }
  }

  /** @type {ProgOptions} */
  const progOptions = {
    inputFiles,
    ...select(cliOptions, PROG_OPTIONS),
  };

  // If files are specified on the command line, they take preference over
  // addedOptions with name input.
  if (progOptions.input && (
    (inputFiles.length === 0) || ((inputFiles.length) === 1 && (inputFiles[0] === "-"))
  )) {
    progOptions.inputFiles
      = /** @type {string[]} */([]).concat(progOptions.input);
    delete progOptions.input; // Don't leave it around to be confusing
  }

  if ((typeof cliOptions.startRule === "string")
    && cliOptions.allowedStartRules
    && !cliOptions.allowedStartRules.includes(cliOptions.startRule)) {
    cliOptions.allowedStartRules.push(cliOptions.startRule);
  }

  if (cliOptions.allowedStartRules
    && (cliOptions.allowedStartRules.length === 0)) {
    // [] is an invalid input, as is null
    // undefined doesn't work as a default in commander
    delete cliOptions.allowedStartRules;
  }

  /** @type {AstOptions} */
  const parserOptions = {
    format: "commonjs",
    ...cliOptions,
    output: "ast",
  };
  assert(parserOptions.format);

  // Combine plugin/plugins
  parserOptions.plugins = await Promise.all([
    ...(parserOptions.plugins || []), // Only from extraOptions file
    ...(progOptions.plugin || []), // Mostly from command line
  ].map(val => loadPlugin(cmd, val)));

  // Combine dependency/dependencies
  parserOptions.dependencies
    = /** @type {import("../lib/peg.js").Dependencies} */(
      parserOptions.dependencies || Object.create(null)
    );
  if (progOptions.dependency) {
    for (const dep of progOptions.dependency) {
      const [name, val] = dep.split(":");
      parserOptions.dependencies[name] = val ? val : name;
    }
  }

  if ((Object.keys(parserOptions.dependencies).length > 0)
      && !MODULE_FORMATS_WITH_DEPS.includes(parserOptions.format)) {
    cmd.error(`Can't use the -d/--dependency or -D/--dependencies options with the "${parserOptions.format}" module format.`);
  }

  if (parserOptions.exportVar
      && !MODULE_FORMATS_WITH_GLOBAL.includes(parserOptions.format)) {
    cmd.error(`Can't use the -e/--export-var option with the "${parserOptions.format}" module format.`);
  }

  progOptions.outputFile = progOptions.output;
  progOptions.outputJS = progOptions.output;

  if (progOptions.inputFiles.includes("-") && progOptions.watch) {
    cmd.error("Can't watch stdin");
  }

  if (!progOptions.outputFile) {
    if (!progOptions.inputFiles.includes("-")) {
      let inFile = progOptions.inputFiles[0];
      // You might just want to run a fragment grammar as-is,
      // particularly with a specified start rule.
      const m = inFile.match(/^npm:.*\/([^/]+)$/);
      if (m) {
        inFile = m[1];
      }
      progOptions.outputJS = replaceExt(inFile, ".js");
      progOptions.outputFile = ((typeof progOptions.test !== "string")
          && !progOptions.testFile)
        ? progOptions.outputJS
        : "-";
    } else {
      progOptions.outputFile = "-";
      // Synthetic
      progOptions.outputJS = path.join(process.cwd(), "stdout.js");
    }
  }

  if (progOptions.dts) {
    if (progOptions.outputFile === "-") {
      cmd.error("Must supply output file with --dts");
    }
    progOptions.dtsFile = replaceExt(progOptions.outputFile, ".d.ts");
  }

  // If CLI parameter was defined, enable source map generation
  if (progOptions.sourceMap !== undefined) {
    if (!progOptions.output
        && (progOptions.test || progOptions.testFile)) {
      cmd.error("Generation of the source map is not useful if you don't output a parser file, perhaps you forgot to add an `-o/--output` option?");
    }

    // If source map name is not specified, calculate it
    if (progOptions.sourceMap === true) {
      progOptions.sourceMap = (progOptions.outputFile === "-")
        ? "source.map"
        : progOptions.outputFile + ".map";
    }

    if (progOptions.sourceMap === "hidden:inline") {
      cmd.error("hidden + inline sourceMap makes no sense.");
    }
  }

  // Empty string is a valid test input.  Don't just test for falsy.
  if (typeof progOptions.test === "string") {
    progOptions.testText = progOptions.test;
    progOptions.testGrammarSource = "command line";
  }
  if (progOptions.testFile) {
    progOptions.testGrammarSource = progOptions.testFile;
  }

  return {
    parserOptions,
    progOptions,
  };
}

module.exports = {
  addExtraOptions,
  addExtraOptionsJSON,
  refineOptions,
};

