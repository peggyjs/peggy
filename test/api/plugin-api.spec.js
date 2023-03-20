"use strict";

const chai = require("chai");
const { SourceNode } = require("source-map");
const peg = require("../../lib/peg");

const expect = chai.expect;

describe("plugin API", () => {
  describe("use", () => {
    const grammar = "start = 'a'";

    it("is called for each plugin", () => {
      const pluginsUsed = [false, false, false];
      const plugins = [
        { use() { pluginsUsed[0] = true; } },
        { use() { pluginsUsed[1] = true; } },
        { use() { pluginsUsed[2] = true; } },
      ];

      peg.generate(grammar, { plugins });

      expect(pluginsUsed).to.deep.equal([true, true, true]);
    });

    it("receives configuration", () => {
      const plugin = {
        use(config) {
          expect(config).to.be.an("object");

          expect(config.parser).to.be.an("object");
          expect(config.parser.parse("start = 'a'")).to.be.an("object");

          expect(config.passes).to.be.an("object");

          expect(config.passes.check).to.be.an("array");
          config.passes.check.forEach(pass => {
            expect(pass).to.be.a("function");
          });

          expect(config.passes.transform).to.be.an("array");
          config.passes.transform.forEach(pass => {
            expect(pass).to.be.a("function");
          });

          expect(config.passes.generate).to.be.an("array");
          config.passes.generate.forEach(pass => {
            expect(pass).to.be.a("function");
          });

          expect(config.reservedWords).to.be.an("array");
          config.reservedWords.forEach(word => {
            expect(word).to.be.a("string");
          });
        },
      };

      peg.generate(grammar, { plugins: [plugin] });
    });

    it("receives options", () => {
      const plugin = {
        use(config, options) {
          // eslint-disable-next-line no-use-before-define -- Mutal recursion
          expect(options).to.equal(generateOptions);
        },
      };
      const generateOptions = { plugins: [plugin], foo: 42 };

      peg.generate(grammar, generateOptions);
    });

    it("can replace parser", () => {
      const plugin = {
        use(config) {
          const parser = peg.generate([
            "start = .* {",
            "  return {",
            "    type: 'grammar',",
            "    initializer: {",
            "      type: 'initializer',",
            "      code: ['/* included for cover ast2SourceNode in the generate-js pass */'],",
            "    },",
            "    rules: [",
            "      {",
            "        type: 'rule',",
            "        name: 'start',",
            "        expression: { type: 'literal',  value: text(), ignoreCase: false }",
            "      }",
            "    ]",
            "  };",
            "}",
          ].join("\n"));

          config.parser = parser;
        },
      };
      const parser = peg.generate("a", { plugins: [plugin] });

      expect(parser.parse("a")).to.equal("a");
    });

    it("can change compiler passes", () => {
      const plugin = {
        use(config) {
          function pass(ast) {
            ast.code = new SourceNode(
              1, 0, "plugin", "({ parse: function() { return 42; } })"
            );
          }

          config.passes.generate = [pass];
        },
      };
      const parser = peg.generate(grammar, { plugins: [plugin] });

      expect(parser.parse("a")).to.equal(42);
    });

    it("can change list of reserved words", () => {
      const plugin = {
        use(config) {
          config.reservedWords = [];
        },
      };

      expect(() => {
        peg.generate(
          "start = " + peg.RESERVED_WORDS[0] + ":'a'",
          { plugins: [plugin], output: "source" }
        );
      }).to.not.throw();
    });

    it("can change options", () => {
      const grammar = [
        "a = 'x'",
        "b = 'x'",
        "c = 'x'",
      ].join("\n");
      const plugin = {
        use(config, options) {
          options.allowedStartRules = ["b", "c"];
        },
      };
      const parser = peg.generate(grammar, {
        allowedStartRules: ["a"],
        plugins: [plugin],
      });

      expect(() => { parser.parse("x", { startRule: "a" }); }).to.throw();
      expect(parser.parse("x", { startRule: "b" })).to.equal("x");
      expect(parser.parse("x", { startRule: "c" })).to.equal("x");
    });

    it("can use star for start rules", () => {
      const grammar = [
        "a = 'x'",
        "b = 'x'",
        "c = 'x'",
      ].join("\n");
      const parser = peg.generate(grammar, {
        allowedStartRules: ["*"],
      });
      expect(parser.parse("x", { startRule: "a" })).to.equal("x");
      expect(parser.parse("x", { startRule: "b" })).to.equal("x");
      expect(parser.parse("x", { startRule: "c" })).to.equal("x");
    });
  });
});
