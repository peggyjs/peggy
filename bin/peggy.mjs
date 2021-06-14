import { Command, Option } from "commander";
import fs from "fs";
import path from "path";
import { default as peg } from "../lib/peg.js";
import util from "util";

const MODULE_FORMATS = ["amd", "commonjs", "es", "globals", "umd"];
const MODULE_FORMATS_WITH_DEPS = ["amd", "commonjs", "es", "umd"];
const DEFAULT_FORMAT = "COMMON_JS";
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

function addExtraOptions(options, json) {
  let extraOptions;

  try {
    extraOptions = JSON.parse(json);
  } catch (e) {
    if (!(e instanceof SyntaxError)) { throw e; }

    abortError("Error parsing JSON:", e);
  }
  if ((extraOptions === null)
      || (typeof extraOptions !== "object")
      || Array.isArray(extraOptions)) {
    abort("The JSON with extra options has to represent an object.");
  }
  return Object.assign({}, options, extraOptions);
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
let options = program
  .version(peg.VERSION, "-v, --version")
  .arguments("[input_file]")
  .addOption(
    new Option(
      "--allowed-start-rules <rules>",
      "comma-separated list of rules the generated parser will be allowed to start parsing from"
    )
      .default([], "the first rule in the grammar")
      .argParser((val, prev) => prev.concat(val.split(",").map(x => x.trim())))
  )
  .option(
    "--cache",
    "make generated parser cache results"
  )
  .option(
    "-d, --dependency <dependency>",
    "use specified dependency (can be specified multiple times)",
    (val, prev) => (prev || []).concat([val])
  )
  .option(
    "-e, --export-var <variable>",
    "name of a global variable into which the parser object is assigned to when no module loader is detected"
  )
  .option(
    "--extra-options <options>",
    "additional options (in JSON format as an object) to pass to peg.generate",
    (val, prev) => addExtraOptions(prev, val)
  )
  .option(
    "-c, --extra-options-file <file>",
    "file with additional options (in JSON or commonjs module format as an object) to pass to peg.generate",
    (val, prev) => {
      if (/\.c?js$/.test(val)) {
        return Object.assign({}, prev, require(path.resolve(val)));
      } else {
        return addExtraOptions(prev, readFile(val));
      }
    }
  )
  .addOption(
    new Option(
      "--format <format>",
      "format of the generated parser"
    )
      .choices(MODULE_FORMATS)
      .default(DEFAULT_FORMAT, '"commonjs"')
  )
  .option("-o, --output <file>", "output file")
  .option(
    "--plugin <module>",
    "use a specified plugin (can be specified multiple times)",
    (val, prev) => (prev || []).concat([val])
  )
  .option(
    "-t, --test <text>",
    "Test the parser with the given text, outputting the result of running the parser instead of the parser itself"
  )
  .option(
    "-T, --test-file <filename>",
    "Test the parser with the contents of the given file, outputting the result of running the parser instead of the parser itself"
  )
  .option("--trace", "enable tracing in generated parser")
  .addOption(
    // Not interesting yet.  If it becomes so, unhide the help.
    new Option("--verbose", "enable verbose logging")
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

if (options.extraOptions) {
  Object.assign(options, options.extraOptions);
  delete options.extraOptions;
}

// Ensure defaults do not clobber config file
if (options.allowedStartRules.length === 0) {
  // [] is an invalid input, as is null
  // undefined doesn't work as a default in commander
  delete options.allowedStartRules;
}

if (options.extraOptionsFile) {
  // Ensure defaults do not clobber config file
  const fmt = options.format;
  delete options.format;

  // Command line overwrites config file
  options = Object.assign({}, options.extraOptionsFile, options);
  delete options.extraOptionsFile;

  if (fmt !== DEFAULT_FORMAT) {
    options.format = fmt;
  }
}
if (!options.format || (options.format === DEFAULT_FORMAT)) {
  options.format = "commonjs";
}

verbose = Boolean(options.verbose);
delete options.verbose;

if (options.plugin) {
  options.plugins = (options.plugins || []).concat(options.plugin.map(val => {
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
  }));
  delete options.plugin;
}

if (options.dependency) {
  if (MODULE_FORMATS_WITH_DEPS.indexOf(options.format) === -1) {
    abort(`Can't use the -d/--dependency option with the "${options.format}" module format.`);
  }

  const deps = {};
  for (const dep of options.dependency) {
    const [name, val] = dep.split(":");
    deps[name] = val ? val : name;
  }
  options.dependencies = deps;
  delete options.dependency;
}

if (options.exportVar !== undefined) {
  if ((options.format !== "globals") && (options.format !== "umd")) {
    abort(`Can't use the -e/--export-var option with the "${options.format}" module format.`);
  }
}

let inputFile = options.input;
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

let outputFile = options.output;
if (!outputFile) {
  outputFile = ((inputFile === "-") || options.test || options.testFile)
    ? outputFile = "-"
    : inputFile.substr(0, inputFile.length - path.extname(inputFile).length) + ".js";
}

if (options.test && options.testFile) {
  abort("The -t/--test and -T/--test-file options are mutually exclusive.");
}

options.output = (options.test || options.testFile) ? "parser" : "source";
let testText = null;
let testGrammarSource = null;
if (options.test) {
  testText = options.test;
  testGrammarSource = "command line";
  delete options.test;
}
if (options.testFile) {
  testText = readFile(options.testFile);
  testGrammarSource = options.testFile;
  delete options.testFile;
}

if (verbose) {
  console.error("OPTIONS:", util.inspect(options, {
    depth: Infinity,
    colors: process.stdout.isTTY,
  }));
  console.error("INPUT:", inputFile);
  console.error("OUTPUT:", outputFile);
  console.error("TEST TEXT:", testText);
}

// Main

let inputStream, outputStream;

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
    source = peg.generate(input, options);
  } catch (e) {
    abortError("Error parsing grammar:", e);
  }

  if (testText) {
    try {
      source = source.parse(testText, {
        grammarSource: testGrammarSource,
      });
    } catch (e) {
      abortError("Error parsing test:", e);
    }
    source = util.inspect(source, {
      depth: Infinity,
      colors: (outputFile === "-") && process.stdout.isTTY,
    }) + "\n";
  }

  // Don't create output until processing succeeds
  if (outputFile === "-") {
    outputStream = process.stdout;
  } else {
    outputStream = fs.createWriteStream(outputFile);
    outputStream.on("error", () => {
      abort("Can't write to file \"" + outputFile + "\".");
    });
  }

  outputStream.write(source);
  if (outputStream !== process.stdout) {
    outputStream.end();
  }
});
