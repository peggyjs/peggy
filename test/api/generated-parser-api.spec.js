"use strict";

const chai = require("chai");
const peg = require("../../lib/peg");
const process = require("node:process");
const { spy, stub } = require("../utils.js");
const expect = chai.expect;

describe("generated parser API", () => {
  describe("parse", () => {
    it("parses input", () => {
      const parser = peg.generate("start = 'a'");

      expect(parser.parse("a")).to.equal("a");
    });

    it("parses input in library mode", () => {
      const parser = peg.generate("start = 'a'");

      const result = parser.parse("a", { peg$library: true });
      expect(result.peg$result).to.equal("a");
      expect(result.peg$success).to.equal(true);
      expect(result.peg$throw).to.equal(undefined);
    });

    it("throws an exception on syntax error", () => {
      const parser = peg.generate("start = 'a'");

      expect(() => { parser.parse("b"); }).to.throw();
    });

    it("gives partial result on syntax error in library mode", () => {
      const parser = peg.generate("start = 'a'+");

      const result = parser.parse("aab", { peg$library: true });
      expect(result.peg$result).to.deep.equal(["a", "a"]);
      expect(result.peg$success).to.equal(false);
      expect(result.peg$throw).to.throw('Expected "a" or end of input but "b" found.');
    });

    // Regression: https://github.com/peggyjs/peggy/pull/197
    it("correctly describe character class in syntax error", () => {
      const parser = peg.generate("start = [123-5]");

      expect(() => { parser.parse("0"); }).to.throw("[123-5]");
    });

    describe("start rule", () => {
      const parser = peg.generate([
        "a = 'x' { return 'a'; }",
        "b = 'x' { return 'b'; }",
        "c = 'x' { return 'c'; }",
      ].join("\n"), { allowedStartRules: ["b", "c"] });

      describe("when |startRule| is not set", () => {
        it("starts parsing from the first allowed rule", () => {
          expect(parser.parse("x")).to.equal("b");
        });
      });

      describe("when |startRule| is set to an allowed rule", () => {
        it("starts parsing from specified rule", () => {
          expect(parser.parse("x", { startRule: "b" })).to.equal("b");
          expect(parser.parse("x", { startRule: "c" })).to.equal("c");
        });
      });

      describe("when |startRule| is set to a disallowed start rule", () => {
        it("throws an exception", () => {
          expect(() => { parser.parse("x", { startRule: "a" }); }).to.throw();
        });
      });
    });

    describe("tracing", () => {
      const parser = peg.generate([
        "start = a / b",
        "a = 'a'i",
        "b = 'b'",
      ].join("\n"), { trace: true });

      describe("default tracer", () => {
        const { env, stdout } = process;
        const isTTY = Object.getOwnPropertyDescriptor(stdout, "isTTY");
        let savedEnv = null;

        beforeEach(() => {
          savedEnv = { ...env };
          delete env.FORCE_COLOR;
          delete env.NO_COLOR;
          stdout.isTTY = false;
        });

        afterEach(() => {
          for (const k of ["FORCE_COLOR", "NO_COLOR"]) {
            if (k in savedEnv) {
              env[k] = savedEnv[k];
            } else {
              delete env[k];
            }
          }
          if (isTTY) {
            Object.defineProperty(stdout, "isTTY", isTTY);
          } else {
            delete stdout.isTTY;
          }
        });

        function traceLines(input) {
          stub(console, "log");
          try {
            parser.parse(input);
            return console.log.calls.map(c => c.args);
          } finally {
            console.log.restore();
          }
        }

        const RED = "\x1b[31m";
        const GREEN = "\x1b[32m";
        const CYAN = "\x1b[36m";
        const RESET = "\x1b[0m";
        const colored = [
          [`1:1-1:1 ${CYAN}rule.enter${RESET} start`],
          [`1:1-1:1 ${CYAN}rule.enter${RESET}   a`],
          [`1:1-1:1 ${RED}rule.fail ${RESET}   a`],
          [`1:1-1:1 ${CYAN}rule.enter${RESET}   b`],
          [`1:1-1:2 ${GREEN}rule.match${RESET}   b`],
          [`1:1-1:2 ${GREEN}rule.match${RESET} start`],
        ];
        const plain = [
          ["1:1-1:1 rule.enter start"],
          ["1:1-1:1 rule.enter   a"],
          ["1:1-1:1 rule.fail    a"],
          ["1:1-1:1 rule.enter   b"],
          ["1:1-1:2 rule.match   b"],
          ["1:1-1:2 rule.match start"],
        ];

        it("colorizes output when stdout is a TTY", () => {
          stdout.isTTY = true;
          expect(traceLines("b")).to.deep.equal(colored);
        });

        it("does not colorize when NO_COLOR is set", () => {
          stdout.isTTY = true;
          env.NO_COLOR = "1";
          expect(traceLines("b")).to.deep.equal(plain);
        });

        it("colorizes when FORCE_COLOR is set", () => {
          env.FORCE_COLOR = "1";
          expect(traceLines("b")).to.deep.equal(colored);
        });

        it("does not colorize when FORCE_COLOR is 0", () => {
          stdout.isTTY = true;
          env.FORCE_COLOR = "0";
          expect(traceLines("b")).to.deep.equal(plain);
        });

        it("does not colorize when process is not defined", () => {
          stdout.isTTY = true;
          env.FORCE_COLOR = "1";
          const source = peg.generate([
            "start = a / b",
            "a = 'a'i",
            "b = 'b'",
          ].join("\n"), { trace: true, output: "source", format: "bare" });
          // eslint-disable-next-line no-new-func
          const browserParser = new Function("process", `return (\n${source}\n);`)();
          stub(console, "log");
          try {
            browserParser.parse("b");
            expect(console.log.calls.map(c => c.args)).to.deep.equal(plain);
          } finally {
            console.log.restore();
          }
        });

        it("traces using console.log (if console is defined)", () => {
          const messages = [
            "1:1-1:1 rule.enter start",
            "1:1-1:1 rule.enter   a",
            "1:1-1:1 rule.fail    a",
            "1:1-1:1 rule.enter   b",
            "1:1-1:2 rule.match   b",
            "1:1-1:2 rule.match start",
          ];

          if (typeof console === "object") {
            stub(console, "log");
          }

          try {
            parser.parse("b");

            if (typeof console === "object") {
              expect(console.log.callCount).to.equal(messages.length);
              messages.forEach((message, index) => {
                const call = console.log.getCall(index);
                expect(call.calledWithExactly(message)).to.equal(true);
              });
            }
          } finally {
            if (typeof console === "object") {
              console.log.restore();
            }
          }
        });
      });

      describe("custom tracers", () => {
        describe("trace", () => {
          it("receives tracing events", () => {
            const events = [
              {
                type: "rule.enter",
                rule: "start",
                location: {
                  source: undefined,
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 0, line: 1, column: 1 },
                },
              },
              {
                type: "rule.enter",
                rule: "a",
                location: {
                  source: undefined,
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 0, line: 1, column: 1 },
                },
              },
              {
                type: "rule.fail",
                rule: "a",
                location: {
                  source: undefined,
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 0, line: 1, column: 1 },
                },
              },
              {
                type: "rule.enter",
                rule: "b",
                location: {
                  source: undefined,
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 0, line: 1, column: 1 },
                },
              },
              {
                type: "rule.match",
                rule: "b",
                result: "b",
                location: {
                  source: undefined,
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 1, line: 1, column: 2 },
                },
              },
              {
                type: "rule.match",
                rule: "start",
                result: "b",
                location: {
                  source: undefined,
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 1, line: 1, column: 2 },
                },
              },
            ];

            const tracer = { trace: spy() };

            parser.parse("b", { tracer });

            expect(tracer.trace.callCount).to.equal(events.length);
            events.forEach((event, index) => {
              const call = tracer.trace.getCall(index);
              expect(call.calledWithExactly(event)).to.equal(true);
            });
          });
        });
      });
    });

    it("accepts custom options", () => {
      const parser = peg.generate("start = 'a'");

      parser.parse("a", { foo: 42 });
    });
  });
});
