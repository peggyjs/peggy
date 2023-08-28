// Based on PEG.js Type Definitions by: vvakame <https://github.com/vvakame>, Tobias Kahlert <https://github.com/SrTobi>, C.J. Bell <https://github.com/siegebell>

import type { SourceNode } from "source-map-generator";

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

  enum MatchResult {
    ALWAYS = 1,
    SOMETIMES = 0,
    NEVER = -1,
  }

  /**
   * Base interface for all nodes that forming a rule expression.
   *
   * @template {T} Type of the node
   */
  interface Expr<T> extends Node<T> {
    /**
     * The estimated result of matching this node against any input:
     *
     * - `-1`: negative result, matching of that node always fails
     * -  `0`: neutral result, may be fail, may be match
     * -  `1`: positive result, always match
     *
     * This property is created by the `inferenceMatchResult` pass.
     */
    match?: MatchResult;
  }

  /** A function implementing an action */
  interface FunctionConst {
    predicate: boolean;
    params: string[];
    body: string;
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

    /**
     * Added by the `generateJs` pass and contains the JS code and the source
     * map for it.
     */
    code?: SourceNode;

    /**
     * Added by the `generateBytecode` pass and contain data for
     * bytecodes to refer back to via index.
     */
     literals?: string[];
     classes?: CharacterClass[];
     expectations?: parser.Expectation[];
     functions?: FunctionConst[];
     locations?: LocationRange[];
   }

  /**
   * Base interface for all initializer nodes with the code.
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
   * Base interface for all expression nodes with the code.
   *
   * @template {T} Type of the node
   */
  interface CodeBlockExpr<T> extends Expr<T> {
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

  interface Rule extends Expr<"rule"> {
    /** Identifier of the rule. Should be unique in the grammar. */
    name: string;
    /**
     * Span of the identifier of the rule. Used for pointing to the rule
     * in error messages.
     */
    nameLocation: LocationRange;
    /** Parsing expression of this rule. */
    expression: Expression | Named;

    /** Added by the `generateBytecode` pass. */
    bytecode?: number[];
  }

  /** Represents rule body if it has a name. */
  interface Named extends Expr<"named"> {
    /** Name of the rule that will appear in the error messages. */
    name: string;
    expression: Expression;
  }

  /** Arbitrary expression of the grammar. */
  type Expression
    = Action
    | Choice
    | Labeled
    | Prefixed
    | Primary
    | Repeated
    | Sequence
    | Suffixed;

  /** One element of the choice node. */
  type Alternative
    = Action
    | Labeled
    | Prefixed
    | Primary
    | Repeated
    | Sequence
    | Suffixed;

  interface Choice extends Expr<"choice"> {
    /**
     * List of expressions to match. Only one of them could match the input,
     * the first one that matched is used as a result of the `choice` node.
     */
    alternatives: Alternative[];
  }

  interface Action extends CodeBlockExpr<"action"> {
    expression: (
        Labeled
      | Prefixed
      | Primary
      | Repeated
      | Sequence
      | Suffixed
    );
  }

  /** One element of the sequence node. */
  type Element
    = Labeled
    | Prefixed
    | Primary
    | Repeated
    | Suffixed;

  interface Sequence extends Expr<"sequence"> {
    /** List of expressions each of them should match in order to match the sequence. */
    elements: Element[];
  }

  interface Labeled extends Expr<"labeled"> {
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
    expression: Prefixed | Primary | Repeated | Suffixed;
  }

  /** Expression with a preceding operator. */
  interface Prefixed extends Expr<"simple_and" | "simple_not" | "text"> {
    expression: Primary | Repeated | Suffixed;
  }

  /** Expression with a following operator. */
  interface Suffixed extends Expr<"one_or_more" | "optional" | "zero_or_more"> {
    expression: Primary;
  }

  interface Boundary<T> {
    type: T;
    location: LocationRange;
  }

  interface ConstantBoundary extends Boundary<"constant"> {
    /** Repetition count. Always a positive integer. */
    value: number;
  }

  interface VariableBoundary extends Boundary<"variable"> {
    /** Repetition count - name of the label of the one of preceding expressions. */
    value: string;
  }

  interface FunctionBoundary extends Boundary<"function"> {
    /** The code from the grammar. */
    value: string;
    /** Span that covers all code between `{` and `}`. */
    codeLocation: LocationRange;
  }

  type RepeatedBoundary
    = ConstantBoundary
    | FunctionBoundary
    | VariableBoundary;

  /** Expression repeated from `min` to `max` times. */
  interface Repeated extends Expr<"repeated"> {
    /**
     * Minimum count of repetitions. If `null` then exact repetition
     * is used and minimum the same as maximum.
     */
    min: RepeatedBoundary | null;
    /** Maximum count of repetitions. */
    max: RepeatedBoundary;
    /**
     * An expression that should appear between occurrences of the `expression`.
     * Matched parts of input skipped and do not included to the result array.
     */
    delimiter: Expression | null;
    expression: Primary;
  }

  type Primary
    = Any
    | CharacterClass
    | Group
    | Literal
    | RuleReference
    | SemanticPredicate;

  interface RuleReference extends Expr<"rule_ref"> {
    /** Name of the rule to refer. */
    name: string;
  }

  interface SemanticPredicate extends CodeBlockExpr<"semantic_and" | "semantic_not"> {}

  /** Group node introduces new scope for labels. */
  interface Group extends Expr<"group"> {
    expression: Labeled | Sequence;
  }

  /** Matches continuous sequence of symbols. */
  interface Literal extends Expr<"literal"> {
    /** Sequence of symbols to match. */
    value: string;
    /** If `true`, symbols matches even if they case do not match case in the `value`. */
    ignoreCase: boolean;
  }

  /** Matches single UTF-16 character. */
  interface CharacterClass extends Expr<"class"> {
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

  /** Matches any UTF-16 code unit in the input, but doesn't match the empty string. */
  interface Any extends Expr<"any"> {}
}

/** Current Peggy version in semver format. */
export const VERSION: string;

/** Default list of reserved words. Contains list of JavaScript reserved words */
export const RESERVED_WORDS: string[];

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

/** Possible compilation stage name. */
type Stage = keyof Stages;
/** Severity level of problems that can be registered in compilation session. */
type Severity = "error" | "info" | "warning";

type Problem = [
  /** Problem severity. */
  Severity,
  /** Diagnostic message. */
  string,
  /** Location where message is generated, if applicable. */
  LocationRange?,
  /** List of additional messages with their locations, if applicable. */
  DiagnosticNote[]?,
];

/** Thrown if the grammar contains a semantic error. */
export class GrammarError extends Error {
  /** Location of the error in the source. */
  public location?: LocationRange;

  /** Additional messages with context information. */
  public diagnostics: DiagnosticNote[];

  /** Compilation stage during which error was generated. */
  public stage: Stage | null;

  /**
   * List of diagnostics containing all errors, warnings and information
   * messages generated during compilation stage `stage`.
   */
  public problems: Problem[];

  public constructor(
    message: string,
    location?: LocationRange,
    diagnostics?: DiagnosticNote[]
  );

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
  public format(sources: SourceText[]): string;

  public toString(): string;
}

/**
 * When used as a grammarSource, allows grammars embedded in larger files to
 * specify their offset.  The start location is the first character in the
 * grammar.  The first line is often moved to the right by some number of
 * columns, but subsequent lines all start at the first column.
 */
export class GrammarLocation {
  /**
   * The original grammarSource.  Should be a string or have a toString()
   * method.
   */
  public source: any;

  /**
   * The starting offset for the grammar in the larger file.
   */
  public start: Location;

  public constructor(source: unknown, start: Location);

  /**
   * If the range has a grammarSource that is a GrammarLocation, offset the
   * start of that range by the GrammarLocation.
   *
   * @param range The range to extract from.
   * @returns The offset start if possible, or the original start.
   */
  public static offsetStart(range: LocationRange): Location;

  /**
    * If the range has a grammarSource that is a GrammarLocation, offset the
    * end of that range by the GrammarLocation.
    *
    * @param range The range to extract from.
    * @returns The offset end if possible, or the original end.
    */
  public static offsetEnd(range: LocationRange): Location;

  public toString(): string;

  /**
   * Return a new Location offset from the given location by the start of the
   * grammar.
   *
   * @param loc The location as if the start of the grammar was the start of
   *   the file.
   * @returns The offset location.
   */
  public offset(loc: Location): Location;
}

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
    /**
     * List of words that won't be allowed as label names. Using such word will
     * produce a syntax error.
     */
    reservedWords: string[];
    /** The only acceptable rule is `"Grammar"`, all other values leads to the exception */
    startRule?: "Grammar";
  }

  /** Specific sequence of symbols is expected in the parsed source. */
  interface LiteralExpectation {
    type: "literal";
    /** Expected sequence of symbols. */
    text: string;
    /** If `true`, symbols of any case is expected. `text` in that case in lower case */
    ignoreCase: boolean;
  }

  /** One of the specified symbols is expected in the parse position. */
  interface ClassExpectation {
    type: "class";
    /** List of symbols and symbol ranges expected in the parse position. */
    parts: (string[] | string)[];
    /**
     * If `true`, meaning of `parts` is inverted: symbols that NOT expected in
     * the parse position.
     */
    inverted: boolean;
    /** If `true`, symbols of any case is expected. `text` in that case in lower case */
    ignoreCase: boolean;
  }

  /** Any symbol is expected in the parse position. */
  interface AnyExpectation {
    type: "any";
  }

  /** EOF is expected in the parse position. */
  interface EndExpectation {
    type: "end";
  }

  /**
   * Something other is expected in the parse position. That expectation is
   * generated by call of the `expected()` function in the parser code, as
   * well as rules with human-readable names.
   */
  interface OtherExpectation {
    type: "other";
    /**
     * Depending on the origin of this expectation, can be:
     * - text, supplied to the `expected()` function
     * - human-readable name of the rule
     */
    description: string;
  }

  type Expectation
    = AnyExpectation
    | ClassExpectation
    | EndExpectation
    | LiteralExpectation
    | OtherExpectation;

  interface SyntaxErrorConstructor {
    readonly prototype: SyntaxError;

    new (
      message: string,
      expected: Expectation[] | null,
      found: string | null,
      location: LocationRange
    ): SyntaxError;

    // Static methods
    /**
     * Constructs the human-readable message from the machine representation.
     *
     * @param expected Array of expected items, generated by the parser
     * @param found Any text that will appear as found in the input instead of expected
     */
    buildMessage(expected: Expectation[], found: string): string;
  }

  /** Thrown if the grammar contains a syntax error. */
  class SyntaxError extends Error {
    /** Location where error was originated. */
    public location: LocationRange;

    /**
     * List of possible tokens in the parse position, or `null` if error was
     * created by the `error()` call.
     */
    public expected: Expectation[] | null;

    /**
     * Character in the current parse position, or `null` if error was created
     * by the `error()` call.
     */
    public found: string | null;

    /**
     * Format the error with associated sources.  The `location.source` should have
     * a `toString()` representation in order the result to look nice. If source
     * is `null` or `undefined`, it is skipped from the output
     *
     * Sample output:
     * ```
     * Error: Expected "!", "$", "&", "(", ".", "@", character class, comment, end of line, identifier, literal, or whitespace but "#" found.
     *  --> my grammar:3:9
     *   |
     * 3 | start = # 'a';
     *   |         ^
     * ```
     *
     * @param sources mapping from location source to source text
     *
     * @returns the formatted error
     */
    public format(sources: SourceText[]): string;
  }
}

export namespace compiler {
  namespace visitor {
    /** List of possible visitors of AST nodes. */
    interface NodeTypes {
      /**
       * Default behavior: run visitor:
       * - on the top level initializer, if it is defined
       * - on the initializer, if it is defined
       * - on each element in `rules`
       *
       * At the end return `undefined`
       *
       * @param node Reference to the whole AST
       * @param args Any arguments passed to the `Visitor`
       */
      grammar?(node: ast.Grammar, ...args: any[]): any;

      /**
       * Default behavior: do nothing
       *
       * @param node Node, representing user-defined code that executed only once
       *        when initializing the generated parser (during importing generated
       *        code)
       * @param args Any arguments passed to the `Visitor`
       */
      top_level_initializer?(
        node: ast.TopLevelInitializer,
        ...args: any[]
      ): any;

      /**
       * Default behavior: do nothing
       *
       * @param node Node, representing user-defined code that executed on each
       *        run of the `parse()` method of the generated parser
       * @param args Any arguments passed to the `Visitor`
       */
      initializer?(node: ast.Initializer, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, representing one structural element of the grammar
       * @param args Any arguments passed to the `Visitor`
       */
      rule?(node: ast.Rule, ...args: any[]): any;

      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, representing assigning a human-readable name to
       *        the rule
       * @param args Any arguments passed to the `Visitor`
       */
      named?(node: ast.Named, ...args: any[]): any;
      /**
       * Default behavior: run visitor on each element in `alternatives`,
       * return `undefined`
       *
       * @param node Node, representing ordered choice of the one expression
       *        to match
       * @param args Any arguments passed to the `Visitor`
       */
      choice?(node: ast.Choice, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, representing execution of the user-defined action
       *        in the grammar
       * @param args Any arguments passed to the `Visitor`
       */
      action?(node: ast.Action, ...args: any[]): any;
      /**
       * Default behavior: run visitor on each element in `elements`,
       * return `undefined`
       *
       * @param node Node, representing ordered sequence of expressions to match
       * @param args Any arguments passed to the `Visitor`
       */
      sequence?(node: ast.Sequence, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, representing labeling of the `expression` result
       * @param args Any arguments passed to the `Visitor`
       */
      labeled?(node: ast.Labeled, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, representing usage of part of matched input
       * @param args Any arguments passed to the `Visitor`
       */
      text?(node: ast.Prefixed, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, representing positive lookahead check
       * @param args Any arguments passed to the `Visitor`
       */
      simple_and?(node: ast.Prefixed, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, representing negative lookahead check
       * @param args Any arguments passed to the `Visitor`
       */
      simple_not?(node: ast.Prefixed, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, representing optional presenting of the `expression`
       * @param args Any arguments passed to the `Visitor`
       */
      optional?(node: ast.Suffixed, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, representing repetition of the `expression` any number of times
       * @param args Any arguments passed to the `Visitor`
       */
      zero_or_more?(node: ast.Suffixed, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, representing repetition of the `expression` at least once
       * @param args Any arguments passed to the `Visitor`
       */
      one_or_more?(node: ast.Suffixed, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `delimiter` if it is defined then
       * run visitor on `expression` and return it result
       *
       * @param node Node, representing repetition of the `expression` specified number of times
       * @param args Any arguments passed to the `Visitor`
       */
      repeated?(node: ast.Repeated, ...args: any[]): any;
      /**
       * Default behavior: run visitor on `expression` and return it result
       *
       * @param node Node, introducing new scope for the labels
       * @param args Any arguments passed to the `Visitor`
       */
      group?(node: ast.Group, ...args: any[]): any;
      /**
       * Default behavior: do nothing
       *
       * @param node Leaf node, representing positive lookahead check
       * @param args Any arguments passed to the `Visitor`
       */
      semantic_and?(node: ast.SemanticPredicate, ...args: any[]): any;
      /**
       * Default behavior: do nothing
       *
       * @param node Leaf node, representing negative lookahead check
       * @param args Any arguments passed to the `Visitor`
       */
      semantic_not?(node: ast.SemanticPredicate,   ...args: any[]): any;
      /**
       * Default behavior: do nothing
       *
       * @param node Leaf node, representing using of the another rule
       * @param args Any arguments passed to the `Visitor`
       */
      rule_ref?(node: ast.RuleReference,       ...args: any[]): any;

      /**
       * Default behavior: do nothing
       *
       * @param node Leaf node, representing match of a continuous sequence of symbols
       * @param args Any arguments passed to the `Visitor`
       */
      literal?(node: ast.Literal,             ...args: any[]): any;
      /**
       * Default behavior: do nothing
       *
       * @param node Leaf node, representing match of a characters range
       * @param args Any arguments passed to the `Visitor`
       */
      class?(node: ast.CharacterClass,      ...args: any[]): any;
      /**
       * Default behavior: do nothing
       *
       * @param node Leaf node, representing match of an any character
       * @param args Any arguments passed to the `Visitor`
       */
      any?(node: ast.Any,                 ...args: any[]): any;
    }

    type AnyFunction = (...args: any[]) => any;

    /**
     * Callable object that runs traversal of the AST starting from the node
     * `node` by calling corresponding visitor function. All additional
     * arguments of the call will be forwarded to the visitor function.
     *
     * Visitors are created by calling `build()` with object, containing all
     * necessary visit functions. All functions, not defined explicitly, will
     * receive appropriate default. See the function definitions in the type
     * `Nodes` for description of the default behavior.
     *
     * @template {F} Object with visitors of AST nodes
     */
    interface Visitor<F extends NodeTypes> {
      /**
       * Runs visitor function registered for the specified node type.
       * Returns value from the visitor function for the node.
       *
       * @param node Reference to the AST node
       * @param args Extra arguments that will be forwarded to the corresponding
       *        visitor function, associated with `T`
       *
       * @template {T} Type of the AST node
       */
      <T extends keyof NodeTypes>(
        node: ast.Node<T>,
        ...args: any[]
      ): ReturnType<AnyFunction & F[T]>;
    }

    /**
     * Creates visitor object for traversing the AST.
     *
     * @param functions Object with visitor functions
     */
    function build<F extends NodeTypes>(functions: F): Visitor<F>;
  }

  /**
   * Mapping from the stage name to the default pass suite.
   * Plugins can extend or replace the list of passes during configuration.
   */
  interface Stages {
    /** Any additional stages that can be added in the future. */
    [key: string]: Pass[];

    /**
     * Pack of passes that performing checks on the AST. This bunch of passes
     * executed in the very beginning of the compilation stage.
     */
    check: Pass[];
    /**
     * Pack of passes that performing transformation of the AST.
     * Various types of optimizations are performed here.
     */
    transform: Pass[];
    /** Pack of passes that generates the code. */
    generate: Pass[];
  }

  /** List of the compilation stages. */
  let passes: Stages;

  /**
   * Generates a parser from a specified grammar AST.
   *
   * Note that not all errors are detected during the generation and some may
   * protrude to the generated parser and cause its malfunction.
   *
   * @param ast Abstract syntax tree of the grammar from a parser
   * @param stages List of compilation stages
   * @param options Compilation options
   *
   * @return A parser object
   *
   * @throws {GrammarError} If the AST contains a semantic error, for example,
   *         duplicated labels
   */
  function compile(
    ast: ast.Grammar,
    stages: Stages,
    options?: ParserBuildOptions
  ): Parser;

  /**
   * Generates a parser source from a specified grammar AST.
   *
   * Note that not all errors are detected during the generation and some may
   * protrude to the generated parser and cause its malfunction.
   *
   * @param ast Abstract syntax tree of the grammar from a parser
   * @param stages List of compilation stages
   * @param options Compilation options
   *
   * @return A parser source code
   *
   * @throws {GrammarError} If the AST contains a semantic error, for example,
   *         duplicated labels
   */
  function compile(
    ast: ast.Grammar,
    stages: Stages,
    options: SourceBuildOptions<"source">
  ): string;

  function compile(
    ast: ast.Grammar,
    stages: Stages,
    options: SourceBuildOptions<"source-with-inline-map">
  ): string;

  /**
   * Generates a parser source and source map from a specified grammar AST.
   *
   * Note that not all errors are detected during the generation and some may
   * protrude to the generated parser and cause its malfunction.
   *
   * @param ast Abstract syntax tree of the grammar from a parser
   * @param stages List of compilation stages
   * @param options Compilation options
   *
   * @return An object used to obtain a parser source code and source map
   *
   * @throws {GrammarError} If the AST contains a semantic error, for example,
   *         duplicated labels
   */
  function compile(
    ast: ast.Grammar,
    stages: Stages,
    options: SourceBuildOptions<"source-and-map">
  ): SourceNode;

  function compile(
    ast: ast.Grammar,
    stages: Stages,
    options: SourceBuildOptions<SourceOutputs>
  ): SourceNode | string;
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

export interface ParserOptions {
  [key: string]: any;
  /**
   * Object that will be attached to the each `LocationRange` object created by
   * the parser. For example, this can be path to the parsed file or even the
   * File object.
   */
  grammarSource?: any;
  startRule?: string;
  tracer?: ParserTracer;
}

export interface Parser {
  SyntaxError: parser.SyntaxErrorConstructor;

  parse(input: string, options?: ParserOptions): any;
}

export interface ParserTracer {
  trace(event: ParserTracerEvent): void;
}

export type ParserTracerEvent
  = { type: "rule.enter"; rule: string; location: LocationRange }
  | { type: "rule.fail"; rule: string; location: LocationRange }
  | { type: "rule.match"; rule: string; result: any; location: LocationRange };

/**
 * Function that performs checking, transformation or analysis of the AST.
 *
 * @param ast Reference to the parsed grammar. Pass can change it
 * @param options Options that was supplied to the `PEG.generate()` call.
 *        All passes shared the same options object
 * @param session An object that stores information about current compilation
 *        session and allows passes to report errors, warnings, and information
 *        messages. All passes shares the same session object
 */
export type Pass = (
  ast: ast.Grammar,
  options: ParserBuildOptions,
  session: Session
) => void;

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
  /**
   * List of words that won't be allowed as label names. Using such word will
   * produce a syntax error. This property can be replaced by the plugin if
   * it want to change list of reserved words. By default this list is equals
   * to `RESERVED_WORDS`.
   */
  reservedWords: string[];
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

/**
 * Compiler session, that allow a pass to register an error, warning or
 * an informational message.
 *
 * A new session is created for the each `PEG.generate()` call.
 * All passes, involved in the compilation, shares the one session object.
 *
 * Passes should use that object to reporting errors instead of throwing
 * exceptions, because reporting via this object allows report multiply
 * errors from different passes. Throwing `GrammarError` are also allowed
 * for backward compatibility.
 *
 * Errors will be reported after completion of each compilation stage where
 * each of them can have multiply passes. Plugins can register as many
 * stages as they want, but it is recommended to register pass in the
 * one of default stages, if possible:
 * - `check`
 * - `transform`
 * - `generate`
 */
export interface Session {
  /**
   * The issues that have been registered during the compilation.
   */
  problems: Problem[];
  /**
   * Reports an error. Pass shouldn't assume that after reporting error it
   * will be interrupted by throwing exception or in the other way. Therefore,
   * if after reporting error further execution of the pass is impossible, it
   * should use control flow statements, such as `break`, `continue`, `return`
   * to stop their execution.
   *
   * @param message Main message, which should describe error objectives
   * @param location If defined, this is location described in the `message`
   * @param notes Additional messages with context information
   */
  error(
    message: string,
    location?: LocationRange,
    notes?: DiagnosticNote[]
  ): void;
  /**
   * Reports a warning. Warning is a diagnostic, that doesn't prevent further
   * execution of a pass, but possible points to the some mistake, that should
   * be fixed.
   *
   * @param message Main message, which should describe warning objectives
   * @param location If defined, this is location described in the `message`
   * @param notes Additional messages with context information
   */
  warning(
    message: string,
    location?: LocationRange,
    notes?: DiagnosticNote[]
  ): void;
  /**
   * Reports an informational message. such messages can report some important
   * details of pass execution that could be useful for the user, for example,
   * performed transformations over the AST.
   *
   * @param message Main message, which gives information about an event
   * @param location If defined, this is location described in the `message`
   * @param notes Additional messages with context information
   */
  info(
    message: string,
    location?: LocationRange,
    notes?: DiagnosticNote[]
  ): void;
}

/**
 * Called when compiler reports an error, warning, or info.
 *
 * @param stage Stage in which this diagnostic was originated
 * @param message Main message, which should describe error objectives
 * @param location If defined, this is location described in the `message`
 * @param notes Additional messages with context information
 */
export type DiagnosticCallback = (
  stage: Stage,
  message: string,
  location?: LocationRange,
  notes?: DiagnosticNote[]
) => void;

/**
 * Parser dependencies, is an object which maps variables used to access the
 * dependencies in the parser to module IDs used to load them
 */
export interface Dependencies {
  [variable: string]: string;
}

export interface BuildOptionsBase {
  /** Rules the parser will be allowed to start parsing from (default: the first rule in the grammar) */
  allowedStartRules?: string[];

  /** If `true`, makes the parser cache results, avoiding exponential parsing time in pathological cases but making the parser slower (default: `false`) */
  cache?: boolean;

  /**
   * Object that will be attached to the each `LocationRange` object created by
   * the parser. For example, this can be path to the parsed file or even the
   * File object.
   */
  grammarSource?: any;

  /** Plugins to use */
  plugins?: Plugin[];

  /** Makes the parser trace its progress (default: `false`) */
  trace?: boolean;

  /** Called when a semantic error during build was detected. */
  error?: DiagnosticCallback;
  /** Called when a warning during build was registered. */
  warning?: DiagnosticCallback;
  /** Called when an informational message during build was registered. */
  info?: DiagnosticCallback;
}

export interface ParserBuildOptions extends BuildOptionsBase {
  /**
   * Extensions may need to the caller to pass in otherwise-unknown options.
   * ts-pegjs has an example in its README.md.
   */
  [extensionOpts: string]: any;

  /**
   * If set to `"parser"`, the method will return generated parser object;
   * if set to `"source"`, it will return parser source code as a string;
   * if set to `"source-and-map"`, it will return a `SourceNode` object
   *   which can give a parser source code as a string and a source map;
   * if set to `"source-with-inline-map"`, it will return the parser source
   *   along with an embedded source map as a `data:` URI;
   * (default: `"parser"`)
   */
  output?: "parser";
}

/** Possible kinds of source output generators. */
export type SourceOutputs
  = "parser"
  | "source-and-map"
  | "source-with-inline-map"
  | "source";

/** Base options for all source-generating formats. */
interface SourceOptionsBase<Output>
  extends BuildOptionsBase {
  /**
   * If set to `"parser"`, the method will return generated parser object;
   * if set to `"source"`, it will return parser source code as a string;
   * if set to `"source-and-map"`, it will return a `SourceNode` object
   *   which can give a parser source code as a string and a source map;
   * if set to `"source-with-inline-map"`, it will return the parser source
   *   along with an embedded source map as a `data:` URI;
   * (default: `"parser"`)
   */
  output: Output;
}

export interface OutputFormatAmdCommonjsEs<Output extends SourceOutputs = "source">
  extends SourceOptionsBase<Output> {
  /** Format of the generated parser (`"amd"`, `"bare"`, `"commonjs"`, `"es"`, `"globals"`, or `"umd"`); valid only when `output` is set to `"source"` (default: `"bare"`) */
  format: "amd" | "commonjs" | "es";
  /**
   * Parser dependencies, the value is an object which maps variables used to
   * access the dependencies in the parser to module IDs used to load them;
   * valid only when `format` is set to `"amd"`, `"commonjs"`, `"es"`, or `"umd"`
   * (default: `{}`)
   */
  dependencies?: Dependencies;
}

export interface OutputFormatUmd<Output extends SourceOutputs = "source">
  extends SourceOptionsBase<Output> {
  /** Format of the generated parser (`"amd"`, `"bare"`, `"commonjs"`, `"es"`, `"globals"`, or `"umd"`); valid only when `output` is set to `"source"` (default: `"bare"`) */
  format: "umd";
  /**
   * Parser dependencies, the value is an object which maps variables used to
   * access the dependencies in the parser to module IDs used to load them;
   * valid only when `format` is set to `"amd"`, `"commonjs"`, `"es"`, or `"umd"`
   * (default: `{}`)
   */
  dependencies?: Dependencies;
  /**
   * Name of a global variable into which the parser object is assigned to when
   * no module loader is detected; valid only when `format` is set to `"globals"`
   * (and in that case it should be defined) or `"umd"` (default: `null`)
   */
  exportVar?: string;
}

export interface OutputFormatGlobals<Output extends SourceOutputs = "source">
  extends SourceOptionsBase<Output> {
  /** Format of the generated parser (`"amd"`, `"bare"`, `"commonjs"`, `"es"`, `"globals"`, or `"umd"`); valid only when `output` is set to `"source"` (default: `"bare"`) */
  format: "globals";
  /**
   * Name of a global variable into which the parser object is assigned to when
   * no module loader is detected; valid only when `format` is set to `"globals"`
   * (and in that case it should be defined) or `"umd"` (default: `null`)
   */
  exportVar: string;
}

export interface OutputFormatBare<Output extends SourceOutputs = "source">
  extends SourceOptionsBase<Output> {
  /** Format of the generated parser (`"amd"`, `"bare"`, `"commonjs"`, `"es"`, `"globals"`, or `"umd"`); valid only when `output` is set to `"source"` (default: `"bare"`) */
  format?: "bare";
}

/** Options for generating source code of the parser. */
export type SourceBuildOptions<Output extends SourceOutputs = "source">
  = OutputFormatAmdCommonjsEs<Output>
  | OutputFormatBare<Output>
  | OutputFormatGlobals<Output>
  | OutputFormatUmd<Output>;

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
export function generate(
  grammar: string,
  options: SourceBuildOptions<"source">
): string;

/**
 * Returns the generated source code as a string appended with a source map as
 * a `data:` URI.
 *
 * Note, `options.grammarSource` MUST contain a string that is a path relative
 * to the location the generated source will be written to, as no further path
 * processing will be performed.
 *
 * @param grammar String in the format described by the meta-grammar in the
 *        `parser.pegjs` file
 * @param options Options that allow you to customize returned parser object
 *
 * @throws {SyntaxError}  If the grammar contains a syntax error, for example,
 *         an unclosed brace
 * @throws {GrammarError} If the grammar contains a semantic error, for
 *         example, duplicated labels
 */
export function generate(
  grammar: string,
  options: SourceBuildOptions<"source-with-inline-map">
): string;

/**
 * Returns the generated source code and its source map as a `SourceNode`
 * object. You can get the generated code and the source map by using a
 * `SourceNode` API. Generated code will be in the specified module format.
 *
 * Note, that `SourceNode.source`s of the generated source map will depend
 * on the `options.grammarSource` value. Therefore, value `options.grammarSource`
 * will propagate to the `sources` array of the source map. That array MUST
 * contains absolute paths or paths, relative to the source map location.
 *
 * Because at that level we don't known location of the source map, you probably
 * will need to fix locations:
 *
 * ```ts
 * const mapDir = path.dirname(generatedParserJsMap);
 * const source = peggy.generate(...).toStringWithSourceMap({
 *   file: path.relative(mapDir, generatedParserJs),
 * });
 * const json = source.map.toJSON();
 * json.sources = json.sources.map(src => {
 *   return src === null ? null : path.relative(mapDir, src);
 * });
 * ```
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
export function generate(
  grammar: string,
  options: SourceBuildOptions<"source-and-map">
): SourceNode;

export function generate(
  grammar: string,
  options: SourceBuildOptions<SourceOutputs>
): SourceNode | string;

/**
 * Returns the generated AST for the grammar. Unlike result of the
 * `peggy.compiler.compile(...)` an AST returned by this method is augmented
 * with data from passes. In other words, the compiler gives you the raw AST,
 * and this method provides the final AST after all optimizations and
 * transformations.
 *
 * @param grammar String in the format described by the meta-grammar in the
 *        `parser.pegjs` file
 * @param options Options that allow you to customize returned AST
 *
 * @throws {SyntaxError}  If the grammar contains a syntax error, for example,
 *         an unclosed brace
 * @throws {GrammarError} If the grammar contains a semantic error, for example,
 *         duplicated labels
 */
export function generate(
  grammar: string,
  options: SourceOptionsBase<"ast">
): ast.Grammar;

// Export all exported stuff under a global variable PEG in non-module environments
export as namespace PEG;
