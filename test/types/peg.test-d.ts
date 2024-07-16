import * as peggy from "../..";
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

function expectExact<T>() {
  return function<U extends T>(
    tValue: U
  ): [T] extends [U] ? () => U : ["Argument of type", U, "does not match", T] {
    // @ts-expect-error Just for type checking
    return () => tValue;
  };
}

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
    expectExact<string>()(src)();
    expect(src.length).toBeGreaterThan(0);

    const parser = peggy.generate(src);
    expectExact<peggy.Parser>()(parser)();

    let res = parser.parse("1\n");
    expectExact<any>()(res)();
    expect(res).toStrictEqual([1]);

    res = parser.parse("buzz\n11\nfizz\n", { start: 10 });
    expect(res).toStrictEqual(["buzz", 11, "fizz"]);

    peggy.generate("foo='a'", { unknown: { more: 12 } });
    expectExact<peggy.Parser>()(parser)();
  });

  it("types SyntaxError correctly", () => {
    const parser = peggy.generate(src);

    expectExact<peggy.parser.SyntaxErrorConstructor>()(parser.SyntaxError)();
    expectExact<peggy.parser.SyntaxError>()(new parser.SyntaxError("", null, null, {
      source: null,
      start: { line: 0, column: 0, offset: 0 },
      end: { line: 0, column: 0, offset: 0 },
    }))();

    expectExact<string>()(parser.SyntaxError.buildMessage([], ""))();
  });

  it("takes a valid tracer", () => {
    const parser = peggy.generate(src, {
      trace: true,
      error,
      info,
      warning,
    });
    expectExact<peggy.Parser>()(parser)();

    parser.parse(" /**/ 1\n", {
      startRule: "top",
      tracer: {
        trace(event) {
          expectExact<peggy.ParserTracerEvent>()(event)();
          expectExact<"rule.enter" | "rule.fail" | "rule.match">()(event.type)();
          expectExact<string>()(event.rule)();
          expectExact<peggy.LocationRange>()(event.location)();
          if (event.type === "rule.match") {
            expectExact<any>()(event.result)();
          }
        },
      },
    });
  });

  it("takes an output and grammarSource", () => {
    const p1 = peggy.generate(src, { output: "parser", grammarSource: "src" });
    expectExact<peggy.Parser>()(p1)();

    const p2 = peggy.generate(src, { output: "source", grammarSource: { foo: "src" } });
    expectExact<string>()(p2)();

    const p3 = peggy.generate(src, { output: "ast", grammarSource: { foo: "src" } });
    expectExact<peggy.ast.Grammar>()(p3)();
  });

  it("generates a source map", () => {
    const p1 = peggy.generate(src, { output: "source" });
    expectExact<string>()(p1)();

    const p2 = peggy.generate(src, {
      output: "source-and-map",
      grammarSource: "src.peggy",
    });
    expectExact<SourceNode>()(p2)();

    const p3 = peggy.generate(src, {
      output: true as boolean ? "source-and-map" : "source",
      grammarSource: "src.peggy",
    });
    expectExact<SourceNode | string>()(p3)();

    const p4 = peggy.generate(src, {
      output: "source-with-inline-map",
      grammarSource: "src.peggy",
    });
    expectExact<string>()(p4)();
  });

  it("compiles with source map", () => {
    const ast = peggy.parser.parse(src);
    expectExact<peggy.ast.Grammar>()(ast)();

    const p1 = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      { output: "source" }
    );
    expectExact<string>()(p1)();

    const p2 = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      { output: "source-and-map", grammarSource: "src.peggy" }
    );
    expectExact<SourceNode>()(p2)();

    const p3 = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      {
        output: true as boolean ? "source-and-map" : "source",
        grammarSource: "src.peggy",
      }
    );
    expectExact<SourceNode | string>()(p3)();

    const p4 = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      {
        output: "source-with-inline-map",
        grammarSource: "src.peggy",
      }
    );
    expectExact<string>()(p4)();
  });

  it("creates an AST", () => {
    const grammar = peggy.parser.parse(src);

    // Make due until everything is working.
    grammar.imports.push({
      type: "grammar_import",
      what: [],
      from: {
        type: "import_module_specifier",
        module: "foo",
        location: grammar.location,
      },
      location: grammar.location,
    });
    grammar.rules.push({
      type: "rule",
      name: "bar",
      nameLocation: grammar.location,
      expression: {
        type: "library_ref",
        name: "bar",
        library: "foo",
        libraryNumber: 0,
        location: grammar.location,
      },
      location: grammar.location,
    });

    expectExact<peggy.ast.Grammar>()(grammar)();
    type AstTypes = peggy.ast.AllNodes["type"];
    const visited: { [typ in AstTypes]?: number } = {};
    function add(typ: AstTypes): void {
      const v = visited[typ] || 0;
      visited[typ] = v + 1;
    }

    const visit = peggy.compiler.visitor.build({
      grammar(node) {
        add(node.type);
        expectExact<peggy.ast.Grammar>()(node)();
        expectExact<"grammar">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<peggy.ast.GrammarImport[]>()(node.imports)();
        expectExact<
          | peggy.ast.TopLevelInitializer
          | peggy.ast.TopLevelInitializer[]
          | undefined>()(node.topLevelInitializer)();
        expectExact<
          | peggy.ast.Initializer
          | peggy.ast.Initializer[]
          | undefined>()(node.initializer)();
        expectExact<peggy.ast.Rule[]>()(node.rules)();
        expectExact<string[] | undefined>()(node.literals)();
        expectExact<peggy.ast.GrammarCharacterClass[] | undefined>()(
          node.classes
        )();
        expectExact<peggy.ast.GrammarExpectation[] | undefined>()(
          node.expectations
        )();
        expectExact<peggy.ast.FunctionConst[] | undefined>()(
          node.functions
        )();
        expectExact<peggy.LocationRange[] | undefined>()(
          node.locations
        )();

        for (const imp of node.imports) {
          visit(imp);
        }

        if (node.topLevelInitializer) {
          if (Array.isArray(node.topLevelInitializer)) {
            for (const tli of node.topLevelInitializer) {
              visit(tli);
            }
          } else {
            visit(node.topLevelInitializer);
          }
        }
        if (node.initializer) {
          if (Array.isArray(node.initializer)) {
            for (const init of node.initializer) {
              visit(init);
            }
          } else {
            visit(node.initializer);
          }
        }
        node.rules.forEach(visit);
      },
      grammar_import(node) {
        add(node.type);
        expectExact<peggy.ast.GrammarImport>()(node)();
        expectExact<"grammar_import">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<peggy.ast.GrammarImportWhat[]>()(node.what)();
        expectExact<peggy.ast.GrammarImportFrom>()(node.from)();
      },
      top_level_initializer(node) {
        add(node.type);
        expectExact<peggy.ast.TopLevelInitializer>()(node)();
        expectExact<"top_level_initializer">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<string>()(node.code)();
        expectExact<peggy.LocationRange>()(node.codeLocation)();
      },
      initializer(node) {
        add(node.type);
        expectExact<peggy.ast.Initializer>()(node)();
        expectExact<"initializer">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<string>()(node.code)();
        expectExact<peggy.LocationRange>()(node.codeLocation)();
      },
      rule(node) {
        add(node.type);
        expectExact<peggy.ast.Rule>()(node)();
        expectExact<"rule">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<string>()(node.name)();
        expectExact<peggy.LocationRange>()(node.nameLocation)();
        expectExact<peggy.ast.Expression | peggy.ast.Named>()(
          node.expression
        )();
        visit(node.expression);
      },
      named(node) {
        add(node.type);
        expectExact<peggy.ast.Named>()(node)();
        expectExact<"named">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<string>()(node.name)();
        expectExact<peggy.ast.Expression>()(node.expression)();
        visit(node.expression);
      },
      choice(node) {
        add(node.type);
        expectExact<peggy.ast.Choice>()(node)();
        expectExact<"choice">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<peggy.ast.Alternative[]>()(node.alternatives)();
        node.alternatives.forEach(visit);
      },
      action(node) {
        add(node.type);
        expectExact<peggy.ast.Action>()(node)();
        expectExact<"action">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<string>()(node.code)();
        expectExact<peggy.LocationRange>()(node.codeLocation)();
        expectExact<
          peggy.ast.Labeled |
          peggy.ast.Prefixed |
          peggy.ast.Primary |
          peggy.ast.Repeated |
          peggy.ast.Sequence |
          peggy.ast.Suffixed>()(node.expression)();
        visit(node.expression);
      },
      sequence(node) {
        add(node.type);
        expectExact<peggy.ast.Sequence>()(node)();
        expectExact<"sequence">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<peggy.ast.Element[]>()(node.elements)();
        node.elements.forEach(visit);
      },
      labeled(node) {
        add(node.type);
        expectExact<peggy.ast.Labeled>()(node)();
        expectExact<"labeled">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<true | undefined>()(node.pick)();
        expectExact<string | null>()(node.label)();
        expectExact<peggy.LocationRange>()(node.labelLocation)();
        expectExact<
          peggy.ast.Prefixed |
          peggy.ast.Primary |
          peggy.ast.Repeated |
          peggy.ast.Suffixed>()(node.expression)();
        visit(node.expression);
      },
      text(node) {
        add(node.type);
        expectExact<peggy.ast.Prefixed>()(node)();
        expectExact<"simple_and" | "simple_not" | "text">()(node.type)();
        expect(node.type).toBe("text");
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<
          peggy.ast.Primary |
          peggy.ast.Repeated |
          peggy.ast.Suffixed>()(node.expression)();
        visit(node.expression);
      },
      simple_and(node) {
        add(node.type);
        expectExact<peggy.ast.Prefixed>()(node)();
        expectExact<"simple_and" | "simple_not" | "text">()(node.type)();
        expect(node.type).toBe("simple_and");
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<
          peggy.ast.Primary |
          peggy.ast.Repeated |
          peggy.ast.Suffixed>()(node.expression)();
        visit(node.expression);
      },
      simple_not(node) {
        add(node.type);
        expectExact<peggy.ast.Prefixed>()(node)();
        expectExact<"simple_and" | "simple_not" | "text">()(node.type)();
        expect(node.type).toBe("simple_not");
        expectExact<
          peggy.ast.Primary |
          peggy.ast.Repeated |
          peggy.ast.Suffixed>()(node.expression)();
        visit(node.expression);
      },
      optional(node) {
        add(node.type);
        expectExact<peggy.ast.Suffixed>()(node)();
        expectExact<"one_or_more" | "optional" | "zero_or_more">()(node.type)();
        expect(node.type).toBe("optional");
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<peggy.ast.Primary>()(node.expression)();
        visit(node.expression);
      },
      zero_or_more(node) {
        add(node.type);
        expectExact<peggy.ast.Suffixed>()(node)();
        expectExact<"one_or_more" | "optional" | "zero_or_more">()(node.type)();
        expect(node.type).toBe("zero_or_more");
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<peggy.ast.Primary>()(node.expression)();
        visit(node.expression);
      },
      one_or_more(node) {
        add(node.type);
        expectExact<peggy.ast.Suffixed>()(node)();
        expectExact<"one_or_more" | "optional" | "zero_or_more">()(node.type)();
        expect(node.type).toBe("one_or_more");
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<peggy.ast.Primary>()(node.expression)();
        visit(node.expression);
      },
      repeated(node) {
        add(node.type);
        expectExact<peggy.ast.Repeated>()(node)();
        expectExact<"repeated">()(node.type)();
        expect(node.type).toBe("repeated");
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<peggy.ast.RepeatedBoundary | null>()(node.min)();
        expectExact<peggy.ast.RepeatedBoundary>()(node.max)();
        expectExact<peggy.ast.Expression | null>()(node.delimiter)();
        expectExact<peggy.ast.Primary>()(node.expression)();
        visit(node.expression);
      },
      group(node) {
        add(node.type);
        expectExact<peggy.ast.Group>()(node)();
        expectExact<"group">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<peggy.ast.Labeled | peggy.ast.Sequence>()(
          node.expression
        )();
        visit(node.expression);
      },
      semantic_and(node) {
        add(node.type);
        expectExact<peggy.ast.SemanticPredicate>()(node)();
        expectExact<"semantic_and" | "semantic_not">()(node.type)();
        expect(node.type).toBe("semantic_and");
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<string>()(node.code)();
        expectExact<peggy.LocationRange>()(node.codeLocation)();
      },
      semantic_not(node) {
        add(node.type);
        expectExact<peggy.ast.SemanticPredicate>()(node)();
        expectExact<"semantic_and" | "semantic_not">()(node.type)();
        expect(node.type).toBe("semantic_not");
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<string>()(node.code)();
        expectExact<peggy.LocationRange>()(node.codeLocation)();
      },
      rule_ref(node) {
        add(node.type);
        expectExact<peggy.ast.RuleReference>()(node)();
        expectExact<"rule_ref">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<string>()(node.name)();
      },
      library_ref(node) {
        add(node.type);
        expectExact<peggy.ast.LibraryReference>()(node)();
        expectExact<"library_ref">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<string | undefined>()(node.name)();
        expectExact<string>()(node.library)();
      },
      literal(node) {
        add(node.type);
        expectExact<peggy.ast.Literal>()(node)();
        expectExact<"literal">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<string>()(node.value)();
        expectExact<boolean>()(node.ignoreCase)();
      },
      class(node) {
        add(node.type);
        expectExact<peggy.ast.CharacterClass>()(node)();
        expectExact<"class">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
        expectExact<boolean>()(node.inverted)();
        expectExact<boolean>()(node.ignoreCase)();
        expectExact<(string[] | string)[]>()(node.parts)();
      },
      any(node) {
        add(node.type);
        expectExact<peggy.ast.Any>()(node)();
        expectExact<"any">()(node.type)();
        expectExact<peggy.LocationRange>()(node.location)();
      },
    });

    // Extract the keys from the visitor object
    type DefinedKeys
      = typeof visit extends peggy.compiler.visitor.Visitor<infer U>
        ? keyof U : never;

    visit(grammar);

    const astKeys = [
      "action",
      "any",
      "choice",
      "class",
      "grammar",
      "grammar_import",
      "group",
      "initializer",
      "labeled",
      "library_ref",
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
    ] satisfies AstTypes[] satisfies DefinedKeys[];

    expect(Object.keys(visited).sort()).toStrictEqual(astKeys);
    expectExact<AstTypes[]>()(astKeys)();
    expectExact<DefinedKeys[]>()(astKeys)();
  });

  it("compiles", () => {
    const ast = peggy.parser.parse("start = 'foo'", {
      grammarSource: "it compiles",
      reservedWords: peggy.RESERVED_WORDS.slice(),
    });
    expectExact<peggy.ast.Grammar>()(ast)();
    const parser = peggy.compiler.compile(
      ast,
      peggy.compiler.passes,
      {
        error,
        info,
        warning,
      }
    );
    expectExact<peggy.Parser>()(parser)();
    expectExact<peggy.ast.MatchResult | undefined>()(ast.rules[0].match)();
    expect(ast.rules[0].match).toBe(0);
  });
});
