"use strict";

const generateBytecode = require("./passes/generate-bytecode");
const generateJS = require("./passes/generate-js");
const inferenceMatchResult = require("./passes/inference-match-result");
const removeProxyRules = require("./passes/remove-proxy-rules");
const reportDuplicateLabels = require("./passes/report-duplicate-labels");
const reportDuplicateRules = require("./passes/report-duplicate-rules");
const reportInfiniteRecursion = require("./passes/report-infinite-recursion");
const reportInfiniteRepetition = require("./passes/report-infinite-repetition");
const reportUndefinedRules = require("./passes/report-undefined-rules");
const reportIncorrectPlucking = require("./passes/report-incorrect-plucking");
const Session = require("./session");
const visitor = require("./visitor");

function processOptions(options, defaults) {
  const processedOptions = {};

  Object.keys(options).forEach(name => {
    processedOptions[name] = options[name];
  });

  Object.keys(defaults).forEach(name => {
    if (!Object.prototype.hasOwnProperty.call(processedOptions, name)) {
      processedOptions[name] = defaults[name];
    }
  });

  return processedOptions;
}

const compiler = {
  // AST node visitor builder. Useful mainly for plugins which manipulate the
  // AST.
  visitor,

  // Compiler passes.
  //
  // Each pass is a function that is passed the AST. It can perform checks on it
  // or modify it as needed. If the pass encounters a semantic error, it throws
  // |peg.GrammarError|.
  passes: {
    check: [
      reportUndefinedRules,
      reportDuplicateRules,
      reportDuplicateLabels,
      reportInfiniteRecursion,
      reportInfiniteRepetition,
      reportIncorrectPlucking,
    ],
    transform: [
      removeProxyRules,
      inferenceMatchResult,
    ],
    generate: [
      generateBytecode,
      generateJS,
    ],
  },

  // Generates a parser from a specified grammar AST. Throws |peg.GrammarError|
  // if the AST contains a semantic error. Note that not all errors are detected
  // during the generation and some may protrude to the generated parser and
  // cause its malfunction.
  compile(ast, passes, options) {
    options = options !== undefined ? options : {};

    options = processOptions(options, {
      allowedStartRules: [ast.rules[0].name],
      cache: false,
      dependencies: {},
      exportVar: null,
      format: "bare",
      output: "parser",
      trace: false,
    });

    if (!Array.isArray(options.allowedStartRules)) {
      throw new Error("allowedStartRules must be an array");
    }
    if (options.allowedStartRules.length === 0) {
      throw new Error("Must have at least one start rule");
    }
    const allRules = ast.rules.map(r => r.name);
    for (const rule of options.allowedStartRules) {
      if (allRules.indexOf(rule) === -1) {
        throw new Error(`Unknown start rule "${rule}"`);
      }
    }

    const session = new Session(options);
    Object.keys(passes).forEach(stage => {
      session.stage = stage;
      session.info(`Process stage ${stage}`);

      passes[stage].forEach(pass => {
        session.info(`Process pass ${stage}.${pass.name}`);

        pass(ast, options, session);
      });

      // Collect all errors by stage
      session.checkErrors();
    });

    switch (options.output) {
      case "parser":
        return eval(ast.code.toString());

      case "source":
        return ast.code.toString();

      case "source-and-map":
        return ast.code;

      default:
        throw new Error("Invalid output format: " + options.output + ".");
    }
  },
};

module.exports = compiler;
