
"use strict";

/* eslint-env node */

const fs = require("fs");
const chalk = require("chalk");
const Runner = require("./runner.js");
const benchmarks = require("./benchmarks.js");

// Results Table Manipulation

function dup(text, count) {
  let result = "";

  for (let i = 1; i <= count; i++) {
    result += text;
  }

  return result;
}

function padLeft(text, length) {
  return dup(" ", length - text.length) + text;
}

function padRight(text, length) {
  return text + dup(" ", length - text.length);
}

function center(text, length) {
  const padLength = (length - text.length) / 2;

  return dup(" ", Math.floor(padLength))
    + text
    + dup(" ", Math.ceil(padLength));
}

function boxcolor(text) {
  return chalk.cyan(text);
}

function head(text) {
  return chalk.white(text);
}

function bhead(text) {
  return chalk.yellowBright(text);
}

function writeTableHeader() {
  console.log( boxcolor( "┌─────────────────────────────────────┬───────────┬────────────┬──────────────┐") );
  console.log( boxcolor( `│                ${head("Test")}                 │ ${head("Inp. size")} │ ${head("Avg. time")}  │  ${head("Avg. speed")}  │`) );
}

function writeHeading(heading) {
  console.log( boxcolor( "├─────────────────────────────────────┴───────────┴────────────┴──────────────┤") );
  console.log( boxcolor( `│ ${bhead(center(heading, 75))} │`) );
  console.log( boxcolor( "├─────────────────────────────────────┬───────────┬────────────┬──────────────┤") );
}

function writeResult(title, inputSize, parseTime, isRegression=false, isImprovement=false) {

  const KB = 1024;
  const MS_IN_S = 1000;

  const bar = boxcolor("│");

  let fg = chalk.white;
  let bg = chalk.bgBlack;

  if (isRegression && isImprovement) {
    throw new Error(`Regressions are slowdowns; improvements are speedups.  ${title} was marked as both.`)
  }

  if (isImprovement) {
    fg = chalk.yellowBright;
    bg = chalk.bgGreen;
  }

  if (isRegression) {
    fg = chalk.whiteBright;
    bg = chalk.bgRed;
  }

  // columns have the left padding space but not the right
  const col1 = ` ${ fg( padRight(title, 35) ) } ${bar}`;
  const col2 = ` ${ fg( padLeft((inputSize / KB).toFixed(2), 6) ) } kb ${bar}`;
  const col3 = ` ${ fg( padLeft(parseTime.toFixed(2), 7) ) } ms ${bar}`;
  const col4 = ` ${ fg( padLeft(((inputSize / KB) / (parseTime / MS_IN_S)).toFixed(2), 7) ) } kB/s`;

  // the row has the last trailing right space
  const row = `${col1}${col2}${col3}${col4} `;

  console.log( `${bar}${ bg(row) }${bar}` );

}

function writeSeparator() {
  console.log( boxcolor( "├─────────────────────────────────────┼───────────┼────────────┼──────────────┤") );
}

function writeTableFooter() {
  console.log( boxcolor( "└─────────────────────────────────────┴───────────┴────────────┴──────────────┘") );
}

// Helpers

function printHelp() {
  console.log("Usage: run [options]");
  console.log("");
  console.log("Runs Peggy benchmark suite.");
  console.log("");
  console.log("Options:");
  console.log("  -n, --run-count <n>          number of runs (default: 10)");
  console.log("      --cache                  make tested parsers cache results");
  console.log("  -o, --optimize <goal>        select optimization for speed or size (default:");
  console.log("                               speed)");
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

// Arguments

const args = process.argv.slice(2); // Trim "node" and the script path.

function isOption(arg) {
  return (/^-/).test(arg);
}

function nextArg() {
  args.shift();
}

// Main

const options = {
  cache: false,
  optimize: "speed"
};

let runCount = 10;

while (args.length > 0 && isOption(args[0])) {
  switch (args[0]) {
    case "-n":
    case "--run-count":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the -n/--run-count option.");
      }
      runCount = parseInt(args[0], 10);
      if (isNaN(runCount) || runCount <= 0) {
        abort("Number of runs must be a positive integer.");
      }
      break;

    case "--cache":
      options.cache = true;
      break;

    case "-o":
    case "--optimize":
      nextArg();
      if (args.length === 0) {
        abort("Missing parameter of the -o/--optimize option.");
      }
      if (args[0] !== "speed" && args[0] !== "size") {
        abort("Optimization goal must be either \"speed\" or \"size\".");
      }
      options.optimize = args[0];
      break;

    case "-h":
    case "--help":
      printHelp();
      exitSuccess();
      break;

    default:
      abort("Unknown option: " + args[0] + ".");
  }
  nextArg();
}

if (args.length > 0) {
  abort("No arguments are allowed.");
}

Runner.run(benchmarks, runCount, options, {
  readFile(file) {
    return fs.readFileSync(__dirname + "/" + file, "utf8");
  },

  testStart() {
    // Nothing to do.
  },

  testFinish(benchmark, test, inputSize, parseTime) {
    writeResult(test.title, inputSize, parseTime);
  },

  benchmarkStart(benchmark) {
    writeHeading(benchmark.title);
  },

  benchmarkFinish(benchmark, inputSize, parseTime) {
    writeSeparator();
    writeResult(benchmark.title + " total", inputSize, parseTime);
  },

  start() {
    writeTableHeader();
  },

  finish(inputSize, parseTime) {
    writeSeparator();
    writeResult("Total", inputSize, parseTime);
    writeTableFooter();
  }
});
