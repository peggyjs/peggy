// Based on PEG.js Type Definitions by: vvakame <https://github.com/vvakame>, Tobias Kahlert <https://github.com/SrTobi>, C.J. Bell <https://github.com/siegebell>

/** Current Peggy version in semver format. */
export const VERSION: string;

/**
 * The entry that maps object in the `source` property of error locations
 * to the actual source text of a grammar. That entries is necessary for
 * formatting errors.
 */
export interface SourceText {
  /**
   * Identifier of a grammar that stored in the `location().source` property
   * of error and diagnostic messages.
   *
   * This one should be the same object that used in the `location().source`,
   * because their compared using `===`.
   */
  source: any;
  /** Source text of a grammar. */
  text: string;
}

export interface DiagnosticNote {
  message: string;
  location: LocationRange;
}

export interface PeggyError extends Error {
  name: string;
  message: string;
  location?: LocationRange;
  diagnostics: DiagnosticNote[];
  found?: any;
  expected?: ExpectedItem[];
  stack?: any;

  /**
   * Format the error with associated sources.  The `location.source` should have
   * a `toString()` representation in order the result to look nice. If source
   * is `null` or `undefined`, it is skipped from the output
   *
   * Sample output:
   * ```
   * Error: Label "head" is already defined
   *  --> examples/arithmetics.pegjs:15:17
   *    |
   * 15 |   = head:Factor head:(_ ("*" / "/") _ Factor)* {
   *    |                 ^^^^
   * note: Original label location
   *  --> examples/arithmetics.pegjs:15:5
   *    |
   * 15 |   = head:Factor head:(_ ("*" / "/") _ Factor)* {
   *    |     ^^^^
   * ```
   *
   * @param sources mapping from location source to source text
   *
   * @returns the formatted error
   */
  format(sources: SourceText[]): string;
  toString(): string;
}

// for backwards compatibility with PEGjs
export type PegjsError = PeggyError;

export type GrammarError = PeggyError;
export var GrammarError: any;

export namespace parser {
  function parse(input: string): any;

  interface Location {
    line: number;
    column: number;
    offset: number;
  }

  interface LocationRange {
    /** Any object that was supplied to the `parse()` call as the `grammarSource` option. */
    source: any;
    start: Location;
    end: Location;
  }

  class SyntaxError {
    name: string;
    message: string;
    location: LocationRange;
    expected: any[];
    found: any;
  }
}

export type Location = parser.Location;
export type LocationRange = parser.LocationRange;

export interface ExpectedItem {
  type: string;
  value?: string;
  description: string;
}

export interface ParserOptions {
  /**
   * Object that will be attached to the each `LocationRange` object created by
   * the parser. For example, this can be path to the parsed file or even the
   * File object.
   */
  grammarSource?: any;
  startRule?: string;
  tracer?: ParserTracer;
  [key: string]: any;
}

export interface Parser {
  parse(input: string, options?: ParserOptions): any;

  SyntaxError: any;
}

export interface ParserTracer {
  trace(event: ParserTracerEvent): void;
}

export type ParserTracerEvent =
  | { type: "rule.enter"; rule: string; location: LocationRange }
  | { type: "rule.match"; rule: string; result: any; location: LocationRange }
  | { type: "rule.fail"; rule: string; location: LocationRange };

export interface BuildOptionsBase {
  /** rules the parser will be allowed to start parsing from (default: the first rule in the grammar) */
  allowedStartRules?: string[];
  /** if `true`, makes the parser cache results, avoiding exponential parsing time in pathological cases but making the parser slower (default: `false`) */
  cache?: boolean;
  /**
   * Object that will be attached to the each `LocationRange` object created by
   * the parser. For example, this can be path to the parsed file or even the
   * File object.
   */
  grammarSource?: any;
  /**
   * Selects between optimizing the generated parser for parsing speed (`"speed"`)
   * or code size (`"size"`) (default: `"speed"`)
   *
   * @deprecated This feature was deleted in 1.2.0 release and has no effect anymore.
   *             It will be deleted in 2.0.
   *             Parser is always generated in the former `"speed"` mode
   */
  optimize?: "speed" | "size";
  /** plugins to use */
  plugins?: any[];
  /** makes the parser trace its progress (default: `false`) */
  trace?: boolean;
}

export interface ParserBuildOptions extends BuildOptionsBase {
  /** if set to `"parser"`, the method will return generated parser object; if set to `"source"`, it will return parser source code as a string (default: `"parser"`) */
  output?: "parser";
}

export interface OutputFormatAmdCommonjsEs extends BuildOptionsBase {
  /** if set to `"parser"`, the method will return generated parser object; if set to `"source"`, it will return parser source code as a string (default: `"parser"`) */
  output: "source";
  /** format of the generated parser (`"amd"`, `"bare"`, `"commonjs"`, `"es"`, `"globals"`, or `"umd"`); valid only when `output` is set to `"source"` (default: `"bare"`) */
  format: "amd" | "commonjs" | "es";
  /** parser dependencies, the value is an object which maps variables used to access the dependencies in the parser to module IDs used to load them; valid only when `format` is set to `"amd"`, `"commonjs"`, `"es"`, or `"umd"` (default: `{}`) */
  dependencies?: any;
}

export interface OutputFormatUmd extends BuildOptionsBase {
  /** if set to `"parser"`, the method will return generated parser object; if set to `"source"`, it will return parser source code as a string (default: `"parser"`) */
  output: "source";
  /** format of the generated parser (`"amd"`, `"bare"`, `"commonjs"`, `"es"`, `"globals"`, or `"umd"`); valid only when `output` is set to `"source"` (default: `"bare"`) */
  format: "umd";
  /** parser dependencies, the value is an object which maps variables used to access the dependencies in the parser to module IDs used to load them; valid only when `format` is set to `"amd"`, `"commonjs"`, `"es"`, or `"umd"` (default: `{}`) */
  dependencies?: any;
  /** name of a global variable into which the parser object is assigned to when no module loader is detected; valid only when `format` is set to `"globals"` or `"umd"` (default: `null`) */
  exportVar?: any;
}

export interface OutputFormatGlobals extends BuildOptionsBase {
  /** if set to `"parser"`, the method will return generated parser object; if set to `"source"`, it will return parser source code as a string (default: `"parser"`) */
  output: "source";
  /** format of the generated parser (`"amd"`, `"bare"`, `"commonjs"`, `"es"`, `"globals"`, or `"umd"`); valid only when `output` is set to `"source"` (default: `"bare"`) */
  format: "globals";
  /** name of a global variable into which the parser object is assigned to when no module loader is detected; valid only when `format` is set to `"globals"` or `"umd"` (default: `null`) */
  exportVar?: any;
}

export interface OutputFormatBare extends BuildOptionsBase {
  /** if set to `"parser"`, the method will return generated parser object; if set to `"source"`, it will return parser source code as a string (default: `"parser"`) */
  output: "source";
  /** format of the generated parser (`"amd"`, `"bare"`, `"commonjs"`, `"es"`, `"globals"`, or `"umd"`); valid only when `output` is set to `"source"` (default: `"bare"`) */
  format?: "bare";
}

/** Options for generating source code of the parser. */
export type SourceBuildOptions
  = OutputFormatUmd
  | OutputFormatBare
  | OutputFormatGlobals
  | OutputFormatAmdCommonjsEs;

/**
 * Returns a generated parser object.
 *
 * @param grammar String in the format described by the meta-grammar in the
 *        `parser.pegjs` file
 * @param options Options that allow you to customize returned parser object
 *
 * @throws {SyntaxError}  If the grammar contains a syntax error, for example,
 *         an unclosed brace
 * @throws {GrammarError} If the grammar contains a semantic error, for example,
 *         duplicated labels
 */
export function generate(grammar: string, options?: ParserBuildOptions): Parser;

/**
 * Returns the generated source code as a `string` in the specified module format.
 *
 * @param grammar String in the format described by the meta-grammar in the
 *        `parser.pegjs` file
 * @param options Options that allow you to customize returned parser object
 *
 * @throws {SyntaxError}  If the grammar contains a syntax error, for example,
 *         an unclosed brace
 * @throws {GrammarError} If the grammar contains a semantic error, for example,
 *         duplicated labels
 */
export function generate(grammar: string, options: SourceBuildOptions): string;

// Export all exported stuff under a global variable PEG in non-module environments
export as namespace PEG;
