"use strict";

const chai = require("chai");
const peg = require("../../lib/peg");
const sinon = require("sinon");
const pkg = require("../../package.json");

const expect = chai.expect;

describe("Peggy API", () => {
  it("has the correct VERSION", () => {
    expect(peg.VERSION).to.equal(pkg.version);
  });

  describe("generate", () => {
    it("generates a parser", () => {
      const parser = peg.generate("start = 'a'");

      expect(parser).to.be.an("object");
      expect(parser.parse("a")).to.equal("a");
    });

    it("throws an exception on syntax error", () => {
      expect(() => { peg.generate("start = @"); }).to.throw();
    });

    it("throws an exception on semantic error", () => {
      expect(() => { peg.generate("start = undefined"); }).to.throw();
    });

    describe("allowed start rules", () => {
      const grammar = [
        "a = 'x'",
        "b = 'x'",
        "c = 'x'",
      ].join("\n");

      describe("when |allowedStartRules| is not set", () => {
        it("generated parser can start only from the first rule", () => {
          const parser = peg.generate(grammar);

          expect(parser.parse("x", { startRule: "a" })).to.equal("x");
          expect(() => { parser.parse("x", { startRule: "b" }); }).to.throw();
          expect(() => { parser.parse("x", { startRule: "c" }); }).to.throw();
        });
      });

      describe("when |allowedStartRules| is set", () => {
        it("generated parser can start only from specified rules", () => {
          const parser = peg.generate(grammar, {
            allowedStartRules: ["b", "c"],
          });

          expect(() => { parser.parse("x", { startRule: "a" }); }).to.throw();
          expect(parser.parse("x", { startRule: "b" })).to.equal("x");
          expect(parser.parse("x", { startRule: "c" })).to.equal("x");
        });
      });
    });

    describe("intermediate results caching", () => {
      const grammar = [
        "{ var n = 0; }",
        "start = (a 'b') / (a 'c') { return n; }",
        "a = 'a' { n++; }",
      ].join("\n");

      describe("when |cache| is not set", () => {
        it("generated parser doesn't cache intermediate parse results", () => {
          const parser = peg.generate(grammar);

          expect(parser.parse("ac")).to.equal(2);
        });
      });

      describe("when |cache| is set to |false|", () => {
        it("generated parser doesn't cache intermediate parse results", () => {
          const parser = peg.generate(grammar, { cache: false });

          expect(parser.parse("ac")).to.equal(2);
        });
      });

      describe("when |cache| is set to |true|", () => {
        it("generated parser caches intermediate parse results", () => {
          const parser = peg.generate(grammar, { cache: true });

          expect(parser.parse("ac")).to.equal(1);
        });
      });
    });

    describe("tracing", () => {
      const grammar = "start = 'a'";

      describe("when |trace| is not set", () => {
        it("generated parser doesn't trace", () => {
          const parser = peg.generate(grammar);
          const tracer = { trace: sinon.spy() };

          parser.parse("a", { tracer });

          expect(tracer.trace.called).to.equal(false);
        });
      });

      describe("when |trace| is set to |false|", () => {
        it("generated parser doesn't trace", () => {
          const parser = peg.generate(grammar, { trace: false });
          const tracer = { trace: sinon.spy() };

          parser.parse("a", { tracer });

          expect(tracer.trace.called).to.equal(false);
        });
      });

      describe("when |trace| is set to |true|", () => {
        it("generated parser traces", () => {
          const parser = peg.generate(grammar, { trace: true });
          const tracer = { trace: sinon.spy() };

          parser.parse("a", { tracer });

          expect(tracer.trace.called).to.equal(true);
        });
      });
    });

    describe("output", () => {
      const grammar = "start = 'a'";

      describe("when |output| is not set", () => {
        it("returns generated parser object", () => {
          const parser = peg.generate(grammar);

          expect(parser).to.be.an("object");
          expect(parser.parse("a")).to.equal("a");
        });
      });

      describe("when |output| is set to |\"parser\"|", () => {
        it("returns generated parser object", () => {
          const parser = peg.generate(grammar, { output: "parser" });

          expect(parser).to.be.an("object");
          expect(parser.parse("a")).to.equal("a");
        });
      });

      describe("when |output| is set to |\"source\"|", () => {
        it("returns generated parser source code", () => {
          const source = peg.generate(grammar, { output: "source" });

          expect(source).to.be.a("string");
          expect(eval(source).parse("a")).to.equal("a");
        });
      });
    });

    // The |format|, |exportVars|, and |dependencies| options are not tested
    // because there is no meaningful way to test their effects without turning
    // this into an integration test.

    // The |plugins| option is tested in plugin API tests.

    describe("reserved words", () => {
      describe("throws an exception on reserved JS words used as a label", () => {
        for (const label of peg.RESERVED_WORDS) {
          it(label, () => {
            expect(() => {
              peg.generate([
                "start = " + label + ":end",
                "end = 'a'",
              ].join("\n"), { output: "source" });
            }).to.throw(peg.parser.SyntaxError);
          });
        }
      });

      describe("does not throws an exception on reserved JS words used as a rule name", () => {
        for (const rule of peg.RESERVED_WORDS) {
          it(rule, () => {
            expect(() => {
              peg.generate([
                "start = " + rule,
                rule + " = 'a'",
              ].join("\n"), { output: "source" });
            }).to.not.throw(peg.parser.SyntaxError);
          });
        }
      });
    });

    it("accepts custom options", () => {
      peg.generate("start = 'a'", { grammarSource: 42 });
    });
  });
});
