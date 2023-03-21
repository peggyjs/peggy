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
const { base64 } = require("./utils");

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

function isSourceMapCapable(target) {
  if (typeof target === "string") {
    return target.length > 0;
  }
  return target && (typeof target.offset === "function");
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
    // "*" means all rules are start rules.  "*" is not a valid rule name.
    if (options.allowedStartRules.some(r => r === "*")) {
      options.allowedStartRules = allRules;
    } else {
      for (const rule of options.allowedStartRules) {
        if (allRules.indexOf(rule) === -1) {
          throw new Error(`Unknown start rule "${rule}"`);
        }
      }
    }
    // Due to https://github.com/mozilla/source-map/issues/444
    // grammarSource is required
    if (((options.output === "source-and-map")
         || (options.output === "source-with-inline-map"))
        && !isSourceMapCapable(options.grammarSource)) {
      throw new Error("Must provide grammarSource (as a string or GrammarLocation) in order to generate source maps");
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
        // eslint-disable-next-line no-eval -- Required
        return eval(ast.code.toString());

      case "source":
        return ast.code.toString();

      case "source-and-map":
        return ast.code;

      case "source-with-inline-map": {
        if (typeof TextEncoder === "undefined") {
          throw new Error("TextEncoder is not supported by this platform");
        }
        const sourceMap = ast.code.toStringWithSourceMap();
        const encoder = new TextEncoder();
        const b64 = base64(
          encoder.encode(JSON.stringify(sourceMap.map.toJSON()))
        );
        return sourceMap.code + `\
//\x23 sourceMappingURL=data:application/json;charset=utf-8;base64,${b64}
`;
      }

      case "ast":
        return ast;

      default:
        throw new Error("Invalid output format: " + options.output + ".");
    }
  },
};

module.exports = compiler;
