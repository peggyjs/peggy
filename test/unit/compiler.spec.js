"use strict";

const chai = require("chai");
const parser = require("../../lib/parser");
const compiler = require("../../lib/compiler/index");

const expect = chai.expect;

describe("Peggy compiler", () => {
  it("checks start rules", () => {
    const ast = parser.parse("foo='1'");
    expect(compiler.compile(ast, compiler.passes)).to.be.an("object");
    expect(compiler.compile(ast, compiler.passes, {
      allowedStartRules: null,
    })).to.be.an("object");
    expect(compiler.compile(ast, compiler.passes, {
      allowedStartRules: undefined,
    })).to.be.an("object");
    expect(compiler.compile(ast, compiler.passes, {
      allowedStartRules: [],
    })).to.be.an("object");
    expect(() => compiler.compile(ast, compiler.passes, {
      allowedStartRules: {},
    })).to.throw("allowedStartRules must be an array");
    expect(() => compiler.compile(ast, compiler.passes, {
      allowedStartRules: ["bar"],
    })).to.throw('Unknown start rule "bar"');
  });

  it("checks output type", () => {
    const ast = parser.parse("foo='1'");
    expect(compiler.compile(ast, compiler.passes, {
      output: "source",
    })).to.be.a("string");
    expect(() => compiler.compile(ast, compiler.passes, {
      output: "INVALID OUTPUT TYPE",
    })).to.throw("Invalid output format: INVALID OUTPUT TYPE.");
  });

  it("generates inline sourceMappingURL", () => {
    const ast = parser.parse("foo='1'");
    expect(ast).to.be.an("object");

    // Don't run on old IE
    if (typeof TextEncoder === "function") {
      expect(compiler.compile(ast, compiler.passes, {
        output: "source-with-inline-map",
        grammarSource: "src.peggy",
      })).to.match(
        /^\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,/m
      );
      // I *think* everywhere that has TextEncoder also has globalThis, but
      // I'm not positive.
      if (typeof globalThis === "object") {
        const TE = globalThis.TextEncoder;
        delete globalThis.TextEncoder;
        expect(() => compiler.compile(ast, compiler.passes, {
          output: "source-with-inline-map",
          grammarSource: "src.peggy",
        })).to.throw("TextEncoder is not supported by this platform");
        globalThis.TextEncoder = TE;
      }
    }
  });

  it("requires grammarSource with source-map", () => {
    const ast = parser.parse("foo='1'");
    expect(ast).to.be.an("object");
    expect(() => compiler.compile(ast, compiler.passes, {
      output: "source-and-map",
    })).to.throw("Must provide grammarSource (as a string or GrammarLocation) in order to generate source maps");
    expect(() => compiler.compile(ast, compiler.passes, {
      output: "source-and-map",
      grammarSource: "",
    })).to.throw("Must provide grammarSource (as a string or GrammarLocation) in order to generate source maps");
    // Don't run on old IE
    if (typeof TextEncoder === "function") {
      expect(() => compiler.compile(ast, compiler.passes, {
        output: "source-with-inline-map",
        grammarSource: { toString() { return ""; } },
      })).to.throw("Must provide grammarSource (as a string or GrammarLocation) in order to generate source maps");
    }
  });

  it("generates correct bytecode for always-match alternatives", () => {
    // This is here, in the wrong place, because it needs both
    // inference-match-result and generate-bytecode to be in the plugin chain.
    const ast = parser.parse("start = 'a'? / 'b'");
    const warnings = [];
    compiler.compile(ast, compiler.passes, {
      output: "ast",
      warning(...args) { warnings.push(args); },
    });

    // Note there is no attempt to match string 1 ('b') here.
    expect(ast.rules[0].bytecode).to.eql([
      18, 0,  2, 2, // MATCH_STRING
      22, 0,        //   ACCEPT_STRING
      23, 0,        //   FAIL
      14, 2,  0,    // IF_ERROR
      6,            //   POP
      2,            //   PUSH_NULL
    ]);

    expect(warnings).to.eql([
      [
        "semantic",
        "Always matches.  Following alternatives may not be reachable.",
        {
          "start": { "column": 9, "line": 1, "offset": 8 },
          "end": { "column": 13, "line": 1, "offset": 12 },
          "source": undefined,
        },
      ],
    ]);
  });

  it("detects unreachable code", () => {
    const ast = parser.parse("start = &('f'*) &[] !('f'*) ![] 'b'");
    const warnings = [];
    compiler.compile(ast, compiler.passes, {
      output: "ast",
      warning(...args) { warnings.push(args); },
    });
    expect(warnings).to.eql([
      [
        "semantic",
        "Always matches, making the & predicate redundant.",
        {
          "start": { "column": 11, "line": 1, "offset": 10 },
          "end": { "column": 15, "line": 1, "offset": 14 },
          "source": undefined,
        },
      ],
      [
        "semantic",
        "Never matches, making the & predicate always fail.",
        {
          "start": { "column": 18, "line": 1, "offset": 17 },
          "end": { "column": 20, "line": 1, "offset": 19 },
          "source": undefined,
        },
      ],
      [
        "semantic",
        "Always matches, making the ! predicate always fail.",
        {
          "start": { "column": 23, "line": 1, "offset": 22 },
          "end": { "column": 27, "line": 1, "offset": 26 },
          "source": undefined,
        },
      ],
      [
        "semantic",
        "Never matches, making the ! predicate redundant.",
        {
          "start": { "column": 30, "line": 1, "offset": 29 },
          "end": { "column": 32, "line": 1, "offset": 31 },
          "source": undefined,
        },
      ],
    ]);
  });

  it("detects deeper unreachable code", () => {
    const ast = parser.parse("start = &('a'? / 'b') !('a'? / 'b') &('a'? / 'b')");
    const warnings = [];
    compiler.compile(ast, compiler.passes, {
      output: "ast",
      warning(...args) { warnings.push(args); },
    });
    expect(warnings).to.eql([
      [
        "semantic",
        "Always matches.  Following alternatives may not be reachable.",
        {
          "start": { "column": 11, "line": 1, "offset": 10 },
          "end": { "column": 15, "line": 1, "offset": 14 },
          "source": undefined,
        },
      ],
      [
        "semantic",
        "Always matches.  Following alternatives may not be reachable.",
        {
          "start": { "column": 25, "line": 1, "offset": 24 },
          "end": { "column": 29, "line": 1, "offset": 28 },
          "source": undefined,
        },
      ], [
        "semantic",
        "Always matches.  Following alternatives may not be reachable.",
        {
          "start": { "column": 39, "line": 1, "offset": 38 },
          "end": { "column": 43, "line": 1, "offset": 42 },
          "source": undefined,
        },
      ],
    ]);
  });
});
