// Based on PEG.js Type Definitions by: vvakame <https://github.com/vvakame>, Tobias Kahlert <https://github.com/SrTobi>, C.J. Bell <https://github.com/siegebell>

/** Interfaces that describe the abstract syntax tree used by Peggy. */
declare namespace ast {
  /**
   * Base type for all nodes that represent grammar AST.
   *
   * @template {T} Type of the node
   */
  interface Node<T> {
    /** Defines type of each node */
    type: T;
    /**
     * Location in the source grammar where node is located. Locations of all
     * child nodes always inside location of their parent node.
     */
    location: LocationRange;
  }

  /** The main Peggy AST class returned by the parser. */
  interface Grammar extends Node<"grammar"> {
    /** Initializer that run once when importing generated parser module. */
    topLevelInitializer?: TopLevelInitializer;
    /** Initializer that run each time when `parser.parse()` method in invoked. */
    initializer?: Initializer;
    /** List of all rules in that grammar. */
    rules: Rule[];

    /** Added by the `generateJs` pass and contains the JS code. */
    code?: string;
  }

  /**
   * Base interface for all nodes with the code.
   *
   * @template {T} Type of the node
   */
  interface CodeBlock<T> extends Node<T> {
    /** The code from the grammar. */
    code: string;
    /** Span that covers all code between `{` and `}`. */
    codeLocation: LocationRange;
  }

  /**
   * Code that runs one-time on import generated parser or right after
   * `generate(..., { output: "parser" })` returns.
   */
  interface TopLevelInitializer extends CodeBlock<"top_level_initializer"> {}

  /** Code that runs on each `parse()` call of the generated parser. */
  interface Initializer extends CodeBlock<"initializer"> {}

  interface Rule extends Node<"rule"> {
    /** Identifier of the rule. Should be unique in the grammar. */
    name: string;
    /**
     * Span of the identifier of the rule. Used for pointing to the rule
     * in error messages.
     */
    nameLocation: LocationRange;
    /** Parsing expression of this rule. */
    expression: Named | Expression;

    /** Added by the `generateBytecode` pass. */
    bytecode?: number[];
  }

  /** Represents rule body if it has a name. */
  interface Named extends Node<"named"> {
    /** Name of the rule that will appear in the error messages. */
    name: string;
    expression: Expression;
  }

  /** Arbitrary expression of the grammar. */
  type Expression
    = Choice
    | Action
    | Sequence
    | Labeled
    | Prefixed
    | Suffixed
    | Primary;

  /** One element of the choice node. */
  type Alternative
    = Action
    | Sequence
    | Labeled
    | Prefixed
    | Suffixed
    | Primary;

  interface Choice extends Node<"choice"> {
    /**
     * List of expressions to match. Only one of them could match the input,
     * the first one that matched is used as a result of the `choice` node.
     */
    alternatives: Alternative[];
  }

  interface Action extends CodeBlock<"action"> {
    expression: (
        Sequence
      | Labeled
      | Prefixed
      | Suffixed
      | Primary
    );
  }

  /** One element of the sequence node. */
  type Element
    = Labeled
    | Prefixed
    | Suffixed
    | Primary;

  interface Sequence extends Node<"sequence"> {
    /** List of expressions each of them should match in order to match the sequence. */
    elements: Element[];
  }

  interface Labeled extends Node<"labeled"> {
    /** If `true`, labeled expression is one of automatically returned. */
    pick?: true;
    /**
     * Name of the variable under that result of `expression` will be available
     * in the user code.
     */
    label: string | null;
    /**
     * Span of the identifier of the label. Used for pointing to the label
     * in error messages. If `label` is `null` then this location pointed
     * to the `@` symbol (pick symbol).
     */
    labelLocation: LocationRange;
    /** Expression which result will be available in the user code under name `label`. */
    expression: Prefixed | Suffixed | Primary;
  }

  /** Expression with a preceding operator. */
  interface Prefixed extends Node<"text" | "simple_and" | "simple_not"> {
    expression: Suffixed | Primary;
  }

  /** Expression with a following operator. */
  interface Suffixed extends Node<"optional" | "zero_or_more" | "one_or_more"> {
    expression: Primary;
  }

  type Primary
    = RuleReference
    | SemanticPredicate
    | Group
    | Literal
    | CharacterClass
    | Any;

  interface RuleReference extends Node<"rule_ref"> {
    /** Name of the rule to refer. */
    name: string;
  }

  interface SemanticPredicate extends CodeBlock<"semantic_and" | "semantic_not"> {}

  /** Group node introduces new scope for labels. */
  interface Group extends Node<"group"> {
    expression: Labeled | Sequence;
  }

  /** Matches continuous sequence of symbols. */
  interface Literal extends Node<"literal"> {
    /** Sequence of symbols to match. */
    value: string;
    /** If `true`, symbols matches even if they case do not match case in the `value`. */
    ignoreCase: boolean;
  }

  /** Matches single UTF-16 character. */
  interface CharacterClass extends Node<"class"> {
    /**
     * Each part represents either symbol range or single symbol.
     * If empty, such character class never matches anything, even end-of-stream marker.
     */
    parts: (string[] | string)[];
    /**
     * If `true`, matcher will match, if symbol from input doesn't contains
     * in the `parts`.
     */
    inverted: boolean;
    /**
     * If `true`, symbol matches even if it case do not match case of `string` parts,
     * or it case-paired symbol in the one of ranges of `string[]` parts.
     */
    ignoreCase: boolean;
  }

  /** Matches any UTF-16 character in the input, but doesn't match the empty string. */
  interface Any extends Node<"any"> {}
}

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
  /**
   * Parses grammar and returns the grammar AST.
   *
   * @param grammar Source text of the grammar
   * @param options Parser options
   *
   * @throws {SyntaxError} If `grammar` has an incorrect format
   */
  function parse(grammar: string, options?: Options): ast.Grammar;

  /** Options, accepted by the parser of PEG grammar. */
  interface Options {
    /**
     * Object that will be attached to the each `LocationRange` object created by
     * the parser. For example, this can be path to the parsed file or even the
     * File object.
     */
    grammarSource?: any;
    /** The only acceptable rule is `"Grammar"`, all other values leads to the exception */
    startRule?: "Grammar";
  }

  /** Thrown if the grammar contains a syntax error. */
  class SyntaxError {
    name: string;
    message: string;
    /** Location where error was originated. */
    location: LocationRange;
    /**
     * List of possible tokens in the parse position, or `null` if error was
     * created by the `error()` call.
     */
    expected: any[];
    /**
     * Character in the current parse position, or `null` if error was created
     * by the `error()` call.
     */
    found: any;
  }
}

/** Provides information pointing to a location within a source. */
export interface Location {
  /** Line in the parsed source (1-based). */
  line: number;
  /** Column in the parsed source (1-based). */
  column: number;
  /** Offset in the parsed source (0-based). */
  offset: number;
}

/** The `start` and `end` position's of an object within the source. */
export interface LocationRange {
  /** Any object that was supplied to the `parse()` call as the `grammarSource` option. */
  source: any;
  /** Position at the beginning of the expression. */
  start: Location;
  /** Position after the end of the expression. */
  end: Location;
}

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

/**
 * Function that performs checking, transformation or analysis of the AST.
 *
 * @param ast Reference to the parsed grammar. Pass can change it
 * @param options Options that was supplied to the `PEG.generate()` call.
 *        All passes shared the same options object
 */
export type Pass = (ast: ast.Grammar, options: ParserBuildOptions) => void;

/**
 * List of possible compilation stages. Each stage consist of the one or
 * several passes. Three default stage are defined, but plugins can insert
 * as many new stages as they want. But keep in mind, that order of stages
 * execution is defined by the insertion order (or declaration order in case
 * of the object literal) properties with stage names.
 */
export interface Stages {
  /**
   * Passes that should check correctness of the parser AST. Passes in that
   * stage shouldn't modify the ast, if modification is required, use the
   * `transform` stage. This is the first stage executed.
   */
  check: Pass[];
  /**
   * Passes that should transform initial AST. They could add or remove some
   * nodes from the AST, or calculate some properties on nodes. That stage is
   * executed after the `check` stage but before the `generate` stage.
   */
  transform: Pass[];
  /**
   * Passes that should generate the final code. This is the last stage executed
   */
  generate: Pass[];
}

/**
 * Object that will be passed to the each plugin during their setup.
 * Plugins can replace `parser` and add new pass(es) to the `passes` array.
 */
export interface Config {
  /**
   * Parser object that will be used to parse grammar source. Plugin can replace it.
   */
  parser: Parser;
  /**
   * List of stages with compilation passes that plugin usually should modify
   * to add their own pass.
   */
  passes: Stages;
}

/** Interface for the Peggy extenders. */
export interface Plugin {
  /**
   * This method is called at start of the `generate()` call, before even parser
   * of the supplied grammar will be invoked. All plugins invoked in the order in
   * which their registered in the `options.plugins` array.
   *
   * @param config Object that can be modified by plugin to enhance generated parser
   * @param options Options that was supplied to the `generate()` call. Plugin
   *        can find their own parameters there. It is recommended to store all
   *        options in the object with name of plugin to reduce possible clashes
   */
  use(config: Config, options: ParserBuildOptions): void;
}

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
  plugins?: Plugin[];
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
