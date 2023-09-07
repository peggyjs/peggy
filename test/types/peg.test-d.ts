import * as peggy from "../..";
import tsd, { expectType } from "tsd";
import type { SourceNode } from "source-map-generator";
import { join } from "path";
import { readFileSync } from "fs";

// The goals of these tests are:
// - Check that the current types are valid
// - The current types work as expected
// - If we break backward-compatibility on an interface, we'll notice

const src = readFileSync(
  join(__dirname, "..", "..", "examples", "fizzbuzz.peggy"),
  "utf8"
);

const problems: peggy.Problem[] = [];

function error(
  stage: peggy.Stage,
  message: string,
  location?: peggy.LocationRange,
  notes?: peggy.DiagnosticNote[]
): void {
  problems.push(["error", message, location, notes]);
}

function info(
  stage: peggy.Stage,
  message: string,
  location?: peggy.LocationRange,
  notes?: peggy.DiagnosticNote[]
): void {
  problems.push(["info", message, location, notes]);
}

function warning(
  stage: peggy.Stage,
  message: string,
  location?: peggy.LocationRange,
  notes?: peggy.DiagnosticNote[]
): void {
  problems.push(["warning", message, location, notes]);
}

describe("peg.d.ts", () => {
  it("executes a grammar", () => {
    expectType<string>(src);
    expect(src.length).toBeGreaterThan(0);

    const parser = peggy.generate(src);
    expectType<peggy.Parser>(parser);

    let res = parser.parse("1\n");
    expectType<any>(res);
    expect(res).toStrictEqual([1]);

    res = parser.parse("buzz\n11\nfizz\n", { start: 10 });
    expect(res).toStrictEqual(["buzz", 11, "fizz"]);

    res = peggy.generate("foo='a'", { unknown: { more: 12 } });
    expectType<peggy.Parser>(parser);
  });

  it("types SyntaxError correctly", () => {
    const parser = peggy.generate(src);

    expectType<peggy.parser.SyntaxErrorConstructor>(parser.SyntaxError);
    expectType<peggy.parser.SyntaxError>(new parser.SyntaxError("", null, null, {
      source: null,
      start: { line: 0, column: 0, offset: 0 },
      end: { line: 0, column: 0, offset: 0 },
    }));

    expectType<string>(parser.SyntaxError.buildMessage([], ""));
  });

  it("takes a valid tracer", () => {
    const parser = peggy.generate(src, {
      trace: true,
      error,
      info,
      warning,
    });
    expectType<peggy.Parser>(parser);

    parser.parse(" /**/ 1\n", {
      startRule: "top",
      tracer: {
        trace(event) {
          expectType<peggy.ParserTracerEvent>(event);
          expectType<"rule.enter" | "rule.fail" | "rule.match">(event.type);
          expectType<string>(event.rule);
          expectType<peggy.LocationRange>(event.location);
          if (event.type === "rule.match") {
            expectType<any>(event.result);
          }
        },
      },
    });
  });

  it("takes an output and grammarSource", () => {
    const p1 = peggy.generate(src, { output: "parser", grammarSource: "src" });
    expectType<peggy.Parser>(p1);

    const p2 = peggy.generate(src, { output: "source", grammarSource: { foo: "src" } });
    expectType<string>(p2);

    const p3 = peggy.generate(src, { output: "ast", grammarSource: { foo: "src" } });
    expectType<peggy.ast.Grammar>(p3);
  });

  it("generates a source map", () => {
    const p1 = peggy.generate(src, { output: "source" });
    expectType<string>(p1);

    const p2 = peggy.generate(src, {
      output: "source-and-map",
      grammarSource: "src.peggy",
    });
    expectType<SourceNode>(p2);

    const p3 = peggy.generate(src, {
      output: true as boolean ? "source-and-map" : "source",
      grammarSource: "src.peggy",
    });
    expectType<SourceNode | string>(p3);

    const p4 = peggy.generate(src, {
      output: "source-with-inline-map",
      grammarSource: "src.peggy",
    });
    expectType<string>(p4);
  });

  it("compiles with source map", () => {
    const ast = peggy.parser.parse(src);
    expectType<peggy.ast.Grammar>(ast);

    const p1 = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      { output: "source" }
    );
    expectType<string>(p1);

    const p2 = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      { output: "source-and-map", grammarSource: "src.peggy" }
    );
    expectType<SourceNode>(p2);

    const p3 = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      {
        output: true as boolean ? "source-and-map" : "source",
        grammarSource: "src.peggy",
      }
    );
    expectType<SourceNode | string>(p3);

    const p4 = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      {
        output: "source-with-inline-map",
        grammarSource: "src.peggy",
      }
    );
    expectType<string>(p4);
  });

  it("creates an AST", () => {
    const grammar = peggy.parser.parse(src);
    expectType<peggy.ast.Grammar>(grammar);
    const visited: { [typ: string]: number } = {};
    function add(typ: string): void {
      if (!visited[typ]) {
        visited[typ] = 1;
      } else {
        visited[typ]++;
      }
    }

    const visit = peggy.compiler.visitor.build({
      grammar(node) {
        add(node.type);
        expectType<peggy.ast.Grammar>(node);
        expectType<"grammar">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.TopLevelInitializer | undefined>(
          node.topLevelInitializer
        );
        expectType<peggy.ast.Initializer | undefined>(node.initializer);
        expectType<peggy.ast.Rule[]>(node.rules);
        expectType<string[] | undefined>(node.literals);
        expectType<peggy.ast.GrammarCharacterClass[] | undefined>(node.classes);
        expectType<peggy.ast.GrammarExpectation[] | undefined>(
          node.expectations
        );
        expectType<peggy.ast.FunctionConst[] | undefined>(
          node.functions
        );
        expectType<peggy.LocationRange[] | undefined>(
          node.locations
        );

        if (node.topLevelInitializer) {
          visit(node.topLevelInitializer);
        }
        if (node.initializer) {
          visit(node.initializer);
        }
        node.rules.forEach(visit);
      },
      top_level_initializer(node) {
        add(node.type);
        expectType<peggy.ast.TopLevelInitializer>(node);
        expectType<"top_level_initializer">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<string>(node.code);
        expectType<peggy.LocationRange>(node.codeLocation);
      },
      initializer(node) {
        add(node.type);
        expectType<peggy.ast.Initializer>(node);
        expectType<"initializer">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<string>(node.code);
        expectType<peggy.LocationRange>(node.codeLocation);
      },
      rule(node) {
        add(node.type);
        expectType<peggy.ast.Rule>(node);
        expectType<"rule">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<string>(node.name);
        expectType<peggy.LocationRange>(node.nameLocation);
        expectType<peggy.ast.Expression | peggy.ast.Named>(node.expression);
        visit(node.expression);
      },
      named(node) {
        add(node.type);
        expectType<peggy.ast.Named>(node);
        expectType<"named">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<string>(node.name);
        expectType<peggy.ast.Expression>(node.expression);
        visit(node.expression);
      },
      choice(node) {
        add(node.type);
        expectType<peggy.ast.Choice>(node);
        expectType<"choice">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.Alternative[]>(node.alternatives);
        node.alternatives.forEach(visit);
      },
      action(node) {
        add(node.type);
        expectType<peggy.ast.Action>(node);
        expectType<"action">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<string>(node.code);
        expectType<peggy.LocationRange>(node.codeLocation);
        expectType<
          peggy.ast.Labeled |
          peggy.ast.Prefixed |
          peggy.ast.Primary |
          peggy.ast.Repeated |
          peggy.ast.Sequence |
          peggy.ast.Suffixed>(node.expression);
        visit(node.expression);
      },
      sequence(node) {
        add(node.type);
        expectType<peggy.ast.Sequence>(node);
        expectType<"sequence">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.Element[]>(node.elements);
        node.elements.forEach(visit);
      },
      labeled(node) {
        add(node.type);
        expectType<peggy.ast.Labeled>(node);
        expectType<"labeled">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<true | undefined>(node.pick);
        expectType<string | null>(node.label);
        expectType<peggy.LocationRange>(node.labelLocation);
        expectType<
          peggy.ast.Prefixed |
          peggy.ast.Primary |
          peggy.ast.Repeated |
          peggy.ast.Suffixed>(node.expression);
        visit(node.expression);
      },
      text(node) {
        add(node.type);
        expectType<peggy.ast.Prefixed>(node);
        expectType<"simple_and" | "simple_not" | "text">(node.type);
        expect(node.type).toBe("text");
        expectType<peggy.LocationRange>(node.location);
        expectType<
          peggy.ast.Primary |
          peggy.ast.Repeated |
          peggy.ast.Suffixed>(node.expression);
        visit(node.expression);
      },
      simple_and(node) {
        add(node.type);
        expectType<peggy.ast.Prefixed>(node);
        expectType<"simple_and" | "simple_not" | "text">(node.type);
        expect(node.type).toBe("simple_and");
        expectType<peggy.LocationRange>(node.location);
        expectType<
          peggy.ast.Primary |
          peggy.ast.Repeated |
          peggy.ast.Suffixed>(node.expression);
        visit(node.expression);
      },
      simple_not(node) {
        add(node.type);
        expectType<peggy.ast.Prefixed>(node);
        expectType<"simple_and" | "simple_not" | "text">(node.type);
        expect(node.type).toBe("simple_not");
        expectType<
          peggy.ast.Primary |
          peggy.ast.Repeated |
          peggy.ast.Suffixed>(node.expression);
        visit(node.expression);
      },
      optional(node) {
        add(node.type);
        expectType<peggy.ast.Suffixed>(node);
        expectType<"one_or_more" | "optional" | "zero_or_more">(node.type);
        expect(node.type).toBe("optional");
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.Primary>(node.expression);
        visit(node.expression);
      },
      zero_or_more(node) {
        add(node.type);
        expectType<peggy.ast.Suffixed>(node);
        expectType<"one_or_more" | "optional" | "zero_or_more">(node.type);
        expect(node.type).toBe("zero_or_more");
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.Primary>(node.expression);
        visit(node.expression);
      },
      one_or_more(node) {
        add(node.type);
        expectType<peggy.ast.Suffixed>(node);
        expectType<"one_or_more" | "optional" | "zero_or_more">(node.type);
        expect(node.type).toBe("one_or_more");
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.Primary>(node.expression);
        visit(node.expression);
      },
      repeated(node) {
        add(node.type);
        expectType<peggy.ast.Repeated>(node);
        expectType<"repeated">(node.type);
        expect(node.type).toBe("repeated");
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.RepeatedBoundary | null>(node.min);
        expectType<peggy.ast.RepeatedBoundary>(node.max);
        expectType<peggy.ast.Expression | null>(node.delimiter);
        expectType<peggy.ast.Primary>(node.expression);
        visit(node.expression);
      },
      group(node) {
        add(node.type);
        expectType<peggy.ast.Group>(node);
        expectType<"group">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.Labeled | peggy.ast.Sequence>(node.expression);
        visit(node.expression);
      },
      semantic_and(node) {
        add(node.type);
        expectType<peggy.ast.SemanticPredicate>(node);
        expectType<"semantic_and" | "semantic_not">(node.type);
        expect(node.type).toBe("semantic_and");
        expectType<peggy.LocationRange>(node.location);
        expectType<string>(node.code);
        expectType<peggy.LocationRange>(node.codeLocation);
      },
      semantic_not(node) {
        add(node.type);
        expectType<peggy.ast.SemanticPredicate>(node);
        expectType<"semantic_and" | "semantic_not">(node.type);
        expect(node.type).toBe("semantic_not");
        expectType<peggy.LocationRange>(node.location);
        expectType<string>(node.code);
        expectType<peggy.LocationRange>(node.codeLocation);
      },
      rule_ref(node) {
        add(node.type);
        expectType<peggy.ast.RuleReference>(node);
        expectType<"rule_ref">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<string>(node.name);
      },
      literal(node) {
        add(node.type);
        expectType<peggy.ast.Literal>(node);
        expectType<"literal">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<string>(node.value);
        expectType<boolean>(node.ignoreCase);
      },
      class(node) {
        add(node.type);
        expectType<peggy.ast.CharacterClass>(node);
        expectType<"class">(node.type);
        expectType<peggy.LocationRange>(node.location);
        expectType<boolean>(node.inverted);
        expectType<boolean>(node.ignoreCase);
        expectType<(string[] | string)[]>(node.parts);
      },
      any(node) {
        add(node.type);
        expectType<peggy.ast.Any>(node);
        expectType<"any">(node.type);
        expectType<peggy.LocationRange>(node.location);
      },
    });

    visit(grammar);

    expect(Object.keys(visited).sort()).toStrictEqual([
      "action",
      "any",
      "choice",
      "class",
      "grammar",
      "group",
      "initializer",
      "labeled",
      "literal",
      "named",
      "one_or_more",
      "optional",
      "repeated",
      "rule",
      "rule_ref",
      "semantic_and",
      "semantic_not",
      "sequence",
      "simple_and",
      "simple_not",
      "text",
      "top_level_initializer",
      "zero_or_more",
    ]);
  });

  it("compiles", () => {
    const ast = peggy.parser.parse("start = 'foo'", {
      grammarSource: "it compiles",
      reservedWords: peggy.RESERVED_WORDS.slice(),
    });
    expectType<peggy.ast.Grammar>(ast);
    const parser = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      {
        error,
        info,
        warning,
      }
    );
    expectType<peggy.Parser>(parser);
    expectType<peggy.ast.MatchResult | undefined>(ast.rules[0].match);
    expect(ast.rules[0].match).toBe(0);
  });
});

describe("run tsd", () => {
  it("has no strict diagnostic warnings", async() => {
    // This is slow because it causes another typescript compilation, but
    // tsd catches things like ensuring string types are narrowed to their
    // set of correct choices.  It could be that setting a few more flags in
    // tsconfig.json would also catch these.
    //
    // To check, change this line:
    // expectType<"text" | "simple_and" | "simple_not">(node.type);
    // to:
    // expectType<string>(node.type);
    const diagnostics = await tsd();
    if (diagnostics.length > 0) {
      throw new Error(JSON.stringify(diagnostics));
    }
  });
});
