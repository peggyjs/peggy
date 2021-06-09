"use strict";

const GrammarError = require("./grammar-error");
const compiler = require("./compiler");
const parser = require("./parser");
const VERSION = require("./version");

const RESERVED_WORDS = [
  // Reserved keywords as of ECMAScript 2015
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
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  // "yield", // encountered twice on the web page

  // Special constants
  "null",
  "true",
  "false",

  // These are always reserved:
  "enum",

  // The following are only reserved when they are found in strict mode code
  // Peggy generates code in strictly mode, so it applicable to it
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "yield",

  // The following are only reserved when they are found in module code:
  "await",
];

const peg = {
  // Peggy version (filled in by /tools/release).
  VERSION,
  /**
   * Default list of reserved words. Contains list of currently and future
   * JavaScript (ECMAScript 2015) reserved words.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_keywords_as_of_ecmascript_2015
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

    function copyPasses(passes) {
      const converted = {};
      Object.keys(passes).forEach(stage => {
        converted[stage] = passes[stage].slice();
      });

      return converted;
    }

    const plugins = "plugins" in options ? options.plugins : [];
    const config = {
      parser: peg.parser,
      passes: copyPasses(peg.compiler.passes),
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
  },
};

module.exports = peg;
