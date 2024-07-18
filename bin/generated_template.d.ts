export interface FilePosition {
  offset: number;
  line: number;
  column: number;
}
export interface FileRange {
  start: FilePosition;
  end: FilePosition;
  source: string;
}
export interface LiteralExpectation {
  type: "literal";
  text: string;
  ignoreCase: boolean;
}
export interface ClassParts extends Array<string | ClassParts> {
}
export interface ClassExpectation {
  type: "class";
  parts: ClassParts;
  inverted: boolean;
  ignoreCase: boolean;
}
export interface AnyExpectation {
  type: "any";
}
export interface EndExpectation {
  type: "end";
}
export interface OtherExpectation {
  type: "other";
  description: string;
}
export type Expectation =
  | AnyExpectation
  | ClassExpectation
  | EndExpectation
  | LiteralExpectation
  | OtherExpectation;

declare class _PeggySyntaxError extends Error {
  static buildMessage(expected: Expectation[], found: string | null): string;
  message: string;
  expected: Expectation[];
  found: string | null;
  location: FileRange;
  name: string;
  constructor(
    message: string,
    expected: Expectation[],
    found: string | null,
    location: FileRange,
  );
  format(sources: {
    source?: any;
    text: string;
  }[]): string;
}
export interface TraceEvent {
  type: string;
  rule: string;
  result?: any;
  location: FileRange;
}
export interface ParserTracer {
  trace(event: TraceEvent): void;
}

export type StartRules = $$$StartRules$$$;
export interface ParseOptions<T extends  StartRules = $$$DefaultStartRule$$$> {
  grammarSource?: any;
  startRule?: T;
  tracer?: ParserTracer;
  peg$library?: boolean;
  peg$currPos?: number;
  peg$silentFails?: number;
  peg$maxFailExpected?: Expectation[];
  [key: string]: any;
}

export declare const parse: typeof ParseFunction;
export declare const SyntaxError: typeof _PeggySyntaxError;
export type SyntaxError = _PeggySyntaxError;
