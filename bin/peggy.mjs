import fs from "fs";
import path from "path";
import { default as peg } from "../lib/peg.js";

// Helpers

function printVersion() {
  console.log("Peggy " + peg.VERSION);
}

function printHelp() {
  console.log("Usage: peggy [options] [--] [<input_file>]");
  console.log("");
  console.log("Options:");
  console.log("      --allowed-start-rules <rules>  comma-separated list of rules the generated");
  console.log("                                     parser will be allowed to start parsing");
  console.log("                                     from (default: the first rule in the");
  console.log("                                     grammar)");
  console.log("      --cache                        make generated parser cache results");
  console.log("  -d, --dependency <dependency>      use specified dependency (can be specified");
  console.log("                                     multiple times)");
  console.log("  -e, --export-var <variable>        name of a global variable into which the");
  console.log("                                     parser object is assigned to when no module");
  console.log("                                     loader is detected");
  console.log("      --extra-options <options>      additional options (in JSON format) to pass");
  console.log("                                     to peg.generate");
  console.log("      --extra-options-file <file>    file with additional options (in JSON");
  console.log("                                     format) to pass to peg.generate");
  console.log("      --format <format>              format of the generated parser: amd,");
  console.log("                                     commonjs, globals, umd (default: commonjs)");
  console.log("  -h, --help                         print help and exit");
  console.log("  -o, --output <file>                output file");
  console.log("      --plugin <plugin>              use a specified plugin (can be specified");
  console.log("                                     multiple times)");
  console.log("      --trace                        enable tracing in generated parser");
  console.log("  -v, --version                      print version information and exit");
}

function exitSuccess() {
  process.exit(0);
}

function exitFailure() {
  process.exit(1);
}

function abort(message) {
  console.error(message);
  exitFailure();
}

function addExtraOptions(options, json) {
  let extraOptions;

  try {
    extraOptions = JSON.parse(json);
  } catch (e) {
    if (!(e instanceof SyntaxError)) { throw e; }

    abort("Error parsing JSON: " + e.message);
  }
  if (typeof extraOptions !== "object") {
    abort("The JSON with extra options has to represent an object.");
  }

  Object.keys(extraOptions).forEach(key => {
    options[key] = extraOptions[key];
  });
}

// Extracted into a function just to silence JSHint complaining about creating
// functions in a loop.
function trim(s) {
  return s.trim();
}

// Arguments

const args = process.argv.slice(2); // Trim "node" and the script path.

function isOption(arg) {
  return (/^-.+/).test(arg);
}

function nextArg() {
  args.shift();
}

// Files

function readStream(inputStream, callback) {
  let input = "";
  inputStream.on("data", data => { input += data; });
  inputStream.on("end", () => { callback(input); });
}

// Main

let inputFile = null;
let outputFile = null;

const options = {
  // Path to the grammar file
  grammarSource: null,
  cache: false,
  dependencies: {},
  exportVar: null,
  format: "commonjs",
  output: "source",
  plugins: [],
  trace: false,
};

const MODULE_FORMATS = ["amd", "commonjs", "es", "globals", "umd"];
const MODULE_FORMATS_WITH_DEPS = ["amd", "commonjs", "es", "umd"];

outer:
while (args.length > 0 && isOption(args[0])) {
  let json, id, mod;

  switch (args[0]) {
    case "--allowed-start-rules":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the --allowed-start-rules option.");
      }
      options.allowedStartRules = args[0]
        .split(",")
        .map(trim);
      break;

    case "--cache":
      options.cache = true;
      break;

    case "-d":
    case "--dependency":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the -d/--dependency option.");
      }
      if (args[0].indexOf(":") !== -1) {
        const parts = args[0].split(":");
        options.dependencies[parts[0]] = parts[1];
      } else {
        options.dependencies[args[0]] = args[0];
      }
      break;

    case "-e":
    case "--export-var":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the -e/--export-var option.");
      }
      options.exportVar = args[0];
      break;

    case "--extra-options":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the --extra-options option.");
      }
      addExtraOptions(options, args[0]);
      break;

    case "--extra-options-file":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the --extra-options-file option.");
      }
      try {
        json = fs.readFileSync(args[0]);
      } catch (e) {
        abort("Can't read from file \"" + args[0] + "\".");
      }
      addExtraOptions(options, json);
      break;

    case "--format":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the --format option.");
      }
      if (MODULE_FORMATS.indexOf(args[0]) === -1) {
        abort("Module format must be one of " + MODULE_FORMATS.map(format => `"${format}"`).join(", ") + ".");
      }
      options.format = args[0];
      break;

    case "-h":
    case "--help":
      printHelp();
      exitSuccess();
      break;

    case "-O":
    case "--optimize":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the -O/--optimize option.");
      }
      console.error("Option --optimize is deprecated from 1.2.0 and has no effect anymore.");
      console.error("It will be deleted in 2.0.");
      console.error("Parser will be generated in the former \"speed\" mode.");
      break;

    case "-o":
    case "--output":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the -o/--output option.");
      }
      outputFile = args[0];
      break;

    case "--plugin":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the --plugin option.");
      }
      id = /^(\.\/|\.\.\/)/.test(args[0]) ? path.resolve(args[0]) : args[0];
      try {
        mod = require(id);
      } catch (e) {
        if (e.code !== "MODULE_NOT_FOUND") { throw e; }

        abort("Can't load module \"" + id + "\".");
      }
      options.plugins.push(mod);
      break;

    case "--trace":
      options.trace = true;
      break;

    case "-v":
    case "--version":
      printVersion();
      exitSuccess();
      break;

    case "--":
      nextArg();
      break outer;

    default:
      abort("Unknown option: " + args[0] + ".");
  }
  nextArg();
}

if (Object.keys(options.dependencies).length > 0) {
  if (MODULE_FORMATS_WITH_DEPS.indexOf(options.format) === -1) {
    abort("Can't use the -d/--dependency option with the \"" + options.format + "\" module format.");
  }
}

if (options.exportVar !== null) {
  if (options.format !== "globals" && options.format !== "umd") {
    abort("Can't use the -e/--export-var option with the \"" + options.format + "\" module format.");
  }
}

let inputStream, outputStream;

switch (args.length) {
  case 0:
    inputFile = "-";
    break;

  case 1:
    inputFile = args[0];
    break;

  default:
    abort("Too many arguments.");
}

if (outputFile === null) {
  if (inputFile === "-") {
    outputFile = "-";
  } else {
    outputFile = inputFile.substr(0, inputFile.length - path.extname(inputFile).length) + ".js";
  }
}

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
    if (typeof e.format === "function") {
      abort(e.format([{
        source: options.grammarSource,
        text: input,
      }]));
    } else {
      abort(e.message);
    }
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