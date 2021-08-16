import { Command, Option } from "commander";
import fs from "fs";
import path from "path";
import { default as peggy } from "../lib/peg.js";
import util from "util";

const MODULE_FORMATS = ["amd", "bare", "commonjs", "es", "globals", "umd"];
const MODULE_FORMATS_WITH_DEPS = ["amd", "commonjs", "es", "umd"];
let verbose = false;

// Helpers

function abort(message) {
  console.error(message);
  process.exit(1);
}

function abortError(msg, error) {
  console.error(msg);
  if (typeof error.format === "function") {
    abort(error.format([{
      source: testGrammarSource,
      text: testText,
    }]));
  } else {
    if (verbose) {
      abort(error);
    } else {
      abort(`Error: ${error.message}`);
    }
  }
}

function addExtraOptions(json, options) {
  let extraOptions;

  try {
    extraOptions = JSON.parse(json);
  } catch (e) {
    abortError("Error parsing JSON:", e);
  }
  if ((extraOptions === null)
      || (typeof extraOptions !== "object")
      || Array.isArray(extraOptions)) {
    abort("The JSON with extra options has to represent an object.");
  }
  return Object.assign({}, options, extraOptions);
}

function commaArg(val, prev) {
  return (prev || []).concat(val.split(",").map(x => x.trim()));
}

// Files

function readStream(inputStream, callback) {
  let input = "";
  inputStream.on("data", data => { input += data; });
  inputStream.on("end", () => { callback(input); });
}

function readFile(name) {
  let f = null;
  try {
    f = fs.readFileSync(name, "utf8");
  } catch (e) {
    abortError(`Can't read from file "${name}".`, e);
  }
  return f;
}

// Command line processing

const program = new Command();
const cliOptions = program
  .version(peggy.VERSION, "-v, --version")
  .arguments("[input_file]")
  .addOption(
    new Option(
      "--allowed-start-rules <rules>",
      "Comma-separated list of rules the generated parser will be allowed to start parsing from.  (Can be specified multiple times)"
    )
      .default(null, "the first rule in the grammar")
      .argParser(commaArg)
  )
  .option(
    "--cache",
    "Make generated parser cache results"
  )
  .option(
    "-d, --dependency <dependency>",
    "Comma-separated list of dependencies, either as a module name, or as `variable:module`. (Can be specified multiple times)",
    commaArg
  )
  .option(
    "-e, --export-var <variable>",
    "Name of a global variable into which the parser object is assigned to when no module loader is detected."
  )
  .option(
    "--extra-options <options>",
    "Additional options (in JSON format as an object) to pass to peggy.generate",
    addExtraOptions
  )
  .option(
    "-c, --extra-options-file <file>",
    "File with additional options (in JSON as an object or commonjs module format) to pass to peggy.generate",
    (val, prev) => {
      if (/\.c?js$/.test(val)) {
        return Object.assign({}, prev, require(path.resolve(val)));
      } else {
        return addExtraOptions(readFile(val), prev);
      }
    }
  )
  .addOption(
    new Option(
      "--format <format>",
      "Format of the generated parser"
    )
      .choices(MODULE_FORMATS)
      .default(null, '"commonjs"')
  )
  .option("-o, --output <file>", "Output file for generated parser. Use '-' for stdout (the default, unless a test is specified, in which case no parser is output without this option)")
  .option(
    "--plugin <module>",
    "Comma-separated list of plugins. (can be specified multiple times)",
    commaArg
  )
  .option(
    "-t, --test <text>",
    "Test the parser with the given text, outputting the result of running the parser instead of the parser itself"
  )
  .option(
    "-T, --test-file <filename>",
    "Test the parser with the contents of the given file, outputting the result of running the parser instead of the parser itself"
  )
  .option("--trace", "Enable tracing in generated parser")
  .addOption(
    // Not interesting yet.  If it becomes so, unhide the help.
    new Option("--verbose", "Enable verbose logging")
      .hideHelp()
      .default(false)
  )
  .addOption(
    new Option("-O, --optimize <style>")
      .hideHelp()
      .argParser(() => {
        console.error("Option --optimize is deprecated from 1.2.0 and has no effect anymore.");
        console.error("It will be deleted in 2.0.");
        console.error("Parser will be generated in the former \"speed\" mode.");
        return "speed";
      })
  )
  .parse()
  .opts();

const PARSER_DEFAULTS = {
  allowedStartRules: [],
  cache: false,
  dependency: [],
  dependencies: {}, // Parsed form; might be set in extraOptions
  exportVar: undefined,
  format: "commonjs",
  plugin: [],
  plugins: [], // Might be set in extraOptions
  trace: false,
};

const PROG_DEFAULTS = {
  input: undefined,
  output: undefined,
  test: undefined,
  testFile: undefined,
  verbose: false,
};

const options = Object.assign({}, PARSER_DEFAULTS);
const progOptions = Object.assign({}, PROG_DEFAULTS);

function combineOpts(...source) {
  for (const s of source) {
    if (!s) {
      continue;
    }
    // Partition into progOptions and parser options.
    for (const [k, val] of Object.entries(s)) {
      const opts = (k in PROG_DEFAULTS) ? progOptions : options;

      // Arrays and objects are additive
      if ((k !== "extraOptions") && (k !== "extraOptionsFile")
          && (val !== null) && (val !== undefined)) {
        if (Array.isArray(opts[k])) {
          opts[k] = opts[k].concat(val);
        } else if (typeof opts[k] === "object") {
          // Such as dependencies
          Object.assign(opts[k], val);
        } else {
          opts[k] = val;
        }
      }
    }
  }
}

combineOpts(
  cliOptions.extraOptionsFile,
  cliOptions.extraOptions,
  cliOptions
);
options.output = "source";

if (options.allowedStartRules.length === 0) {
  // [] is an invalid input, as is null
  // undefined doesn't work as a default in commander
  delete options.allowedStartRules;
}

// Combine plugin/plugins
if ((options.plugin.length > 0) || (options.plugins.length > 0)) {
  options.plugins = (options.plugins.concat(options.plugin)).map(val => {
    if (typeof val !== "string") {
      return val;
    }
    // If this is an absolute or relative path (not a module name)
    const id = (path.isAbsolute(val) || /^\.\.?[/\\]/.test(val))
      ? path.resolve(val)
      : val;
    let mod = null;
    try {
      mod = require(id);
    } catch (e) {
      if (e.code !== "MODULE_NOT_FOUND") { throw e; }
      abortError(`Can't load module "${id}".`, e);
    }
    return mod;
  });
}
delete options.plugin;

// Combine dependency/dependencies
if (options.dependency.length > 0) {
  for (const dep of options.dependency) {
    const [name, val] = dep.split(":");
    options.dependencies[name] = val ? val : name;
  }
}
delete options.dependency;
if ((Object.keys(options.dependencies).length > 0)
    && (MODULE_FORMATS_WITH_DEPS.indexOf(options.format) === -1)) {
  abort(`Can't use the -d/--dependency option with the "${options.format}" module format.`);
}

if (options.exportVar !== undefined) {
  if ((options.format !== "globals") && (options.format !== "umd")) {
    abort(`Can't use the -e/--export-var option with the "${options.format}" module format.`);
  }
}

verbose = progOptions.verbose;
let inputFile = progOptions.input;
if (verbose) {
  console.error("NON-OPTION ARGS:", program.args);
}
switch (program.args.length) {
  case 0:
    inputFile = inputFile ? inputFile : "-";
    break;

  case 1:
    if (inputFile) {
      abort("Do not specify input both on command line and in config file.");
    }
    inputFile = program.args[0];
    break;

  default:
    abort("Too many arguments.");
}

let outputFile = progOptions.output;
if (!outputFile) {
  if ((inputFile !== "-")
    && !progOptions.test
    && !progOptions.testFile) {
    outputFile = inputFile.substr(0, inputFile.length - path.extname(inputFile).length) + ".js";
  } else {
    outputFile = "-";
  }
}

if (progOptions.test && progOptions.testFile) {
  abort("The -t/--test and -T/--test-file options are mutually exclusive.");
}

let testText = null;
let testGrammarSource = null;
let testFile = null;
if (progOptions.test) {
  testText = progOptions.test;
  testGrammarSource = "command line";
}
if (progOptions.testFile) {
  testFile = progOptions.testFile;
  testGrammarSource = progOptions.testFile;
}

if (verbose) {
  console.error("PARSER OPTIONS:", util.inspect(options, {
    depth: Infinity,
    colors: process.stdout.isTTY,
    maxArrayLength: Infinity,
    maxStringLength: Infinity,
  }));
  console.error("PROGRAM OPTIONS:", util.inspect(progOptions, {
    depth: Infinity,
    colors: process.stdout.isTTY,
    maxArrayLength: Infinity,
    maxStringLength: Infinity,
  }));
  console.error(`INPUT: "${inputFile}"`);
  console.error(`OUTPUT: "${outputFile}"`);
}

// Main

let inputStream;

if (inputFile === "-") {
  process.stdin.resume();
  inputStream = process.stdin;
  inputStream.on("error", () => {
    abort("Can't read from stdin.");
  });
  options.grammarSource = "stdin";
} else {
  options.grammarSource = inputFile;
  inputStream = fs.createReadStream(inputFile);
}

readStream(inputStream, input => {
  let source;

  try {
    source = peggy.generate(input, options);
  } catch (e) {
    abortError("Error parsing grammar:", e);
  }

  // If there is a valid outputFile, write the parser to it.  Otherwise,
  // if no test and no outputFile, write to stdout.
  let outputStream = null;
  if (outputFile === "-") {
    if (!testFile && !testText) {
      outputStream = process.stdout;
    }
  } else {
    outputStream = fs.createWriteStream(outputFile);
    outputStream.on("error", () => {
      abort(`Can't write to file "${outputFile}".`);
    });
  }

  if (outputStream) {
    outputStream.write(source);
    if (outputStream !== process.stdout) {
      outputStream.end();
    }
  }

  if (testFile) {
    testText = readFile(testFile);
  }
  if (testText) {
    if (verbose) {
      console.error("TEST TEXT:", testText);
    }
    try {
      const exec = eval(source);
      const results = exec.parse(testText, {
        grammarSource: testGrammarSource,
      });
      console.log(util.inspect(results, {
        depth: Infinity,
        colors: process.stdout.isTTY,
        maxArrayLength: Infinity,
        maxStringLength: Infinity,
      }));
    } catch (e) {
      abortError("Error parsing test:", e);
    }
  }
});
