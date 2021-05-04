"use strict";

const GrammarError = require("./grammar-error");
const compiler = require("./compiler");
const parser = require("./parser");
const VERSION = require("./version");

const RESERVED_WORDS = [
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "instanceof",
  "in",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with"
];

const peg = {
  // Peggy version (filled in by /tools/release).
  VERSION,
  /**
   * Default list of reserved words.
   */
  RESERVED_WORDS,
  GrammarError,
  parser,
  compiler,

  // Generates a parser from a specified grammar and returns it.
  //
  // The grammar must be a string in the format described by the meta-grammar in
  // the parser.pegjs file.
  //
  // Throws |peg.parser.SyntaxError| if the grammar contains a syntax error or
  // |peg.GrammarError| if it contains a semantic error. Note that not all
  // errors are detected during the generation and some may protrude to the
  // generated parser and cause its malfunction.
  generate(grammar, options) {
    options = options !== undefined ? options : {};

    function convertPasses(passes) {
      const converted = {};

      Object.keys(passes).forEach(stage => {
        converted[stage] = Object.keys(passes[stage])
          .map(name => passes[stage][name]);
      });

      return converted;
    }

    const plugins = "plugins" in options ? options.plugins : [];
    const config = {
      parser: peg.parser,
      passes: convertPasses(peg.compiler.passes),
      reservedWords: peg.RESERVED_WORDS.slice(),
    };

    plugins.forEach(p => { p.use(config, options); });

    return peg.compiler.compile(
      config.parser.parse(grammar, {
        grammarSource: options.grammarSource,
        reservedWords: config.reservedWords,
      }),
      config.passes,
      options
    );
  }
};

module.exports = peg;
