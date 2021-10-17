import * as peggy from "../..";
import tsd, { expectType } from "tsd";
import { SourceNode } from "source-map-generator";
import formatter from "tsd/dist/lib/formatter";
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
  });

  it("takes a valid tracer", () => {
    const parser = peggy.generate(src, { trace: true });
    expectType<peggy.Parser>(parser);

    parser.parse(" /**/ 1\n", {
      startRule: "top",
      tracer: {
        trace(event) {
          expectType<peggy.ParserTracerEvent>(event);
          expectType<"rule.enter" | "rule.match" | "rule.fail">(event.type);
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
  });

  it("generates a source map", () => {
    const p1 = peggy.generate(src, { output: "source" });
    expectType<string>(p1);

    const p2 = peggy.generate(src, { output: "source-and-map" });
    expectType<SourceNode>(p2);

    const p3 = peggy.generate(src, { output: true as boolean ? "source-and-map" : "source" });
    expectType<string | SourceNode>(p3);
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
      { output: "source-and-map" }
    );
    expectType<SourceNode>(p2);

    const p3 = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      { output: true as boolean ? "source-and-map" : "source" }
    );
    expectType<string | SourceNode>(p3);
  });

  it("creates an AST", () => {
    const grammar = peggy.parser.parse(src);
    expectType<peggy.ast.Grammar>(grammar);

    const visited: Record<string, number> = {};
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
          peggy.ast.Sequence |
          peggy.ast.Labeled |
          peggy.ast.Prefixed |
          peggy.ast.Suffixed |
          peggy.ast.Primary>(node.expression);
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
          peggy.ast.Suffixed |
          peggy.ast.Primary>(node.expression);
        visit(node.expression);
      },
      text(node) {
        add(node.type);
        expectType<peggy.ast.Prefixed>(node);
        expectType<"text" | "simple_and" | "simple_not">(node.type);
        expect(node.type).toBe("text");
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.Suffixed | peggy.ast.Primary>(node.expression);
        visit(node.expression);
      },
      simple_and(node) {
        add(node.type);
        expectType<peggy.ast.Prefixed>(node);
        expectType<"text" | "simple_and" | "simple_not">(node.type);
        expect(node.type).toBe("simple_and");
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.Suffixed | peggy.ast.Primary>(node.expression);
        visit(node.expression);
      },
      simple_not(node) {
        add(node.type);
        expectType<peggy.ast.Prefixed>(node);
        expectType<"text" | "simple_and" | "simple_not">(node.type);
        expect(node.type).toBe("simple_not");
        expectType<peggy.ast.Suffixed | peggy.ast.Primary>(node.expression);
        visit(node.expression);
      },
      optional(node) {
        add(node.type);
        expectType<peggy.ast.Suffixed>(node);
        expectType<"optional" | "zero_or_more" | "one_or_more">(node.type);
        expect(node.type).toBe("optional");
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.Primary>(node.expression);
        visit(node.expression);
      },
      zero_or_more(node) {
        add(node.type);
        expectType<peggy.ast.Suffixed>(node);
        expectType<"optional" | "zero_or_more" | "one_or_more">(node.type);
        expect(node.type).toBe("zero_or_more");
        expectType<peggy.LocationRange>(node.location);
        expectType<peggy.ast.Primary>(node.expression);
        visit(node.expression);
      },
      one_or_more(node) {
        add(node.type);
        expectType<peggy.ast.Suffixed>(node);
        expectType<"optional" | "zero_or_more" | "one_or_more">(node.type);
        expect(node.type).toBe("one_or_more");
        expectType<peggy.LocationRange>(node.location);
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
        expectType<(string | string[])[]>(node.parts);
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
      peggy.compiler.passes
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
      throw new Error(formatter(diagnostics));
    }
  });
});
