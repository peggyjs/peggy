"use strict";

const chai = require("chai");
const peg = require("../../lib/peg");
const expect = chai.expect;
const { stub } = require("../utils.js");

describe("generated parser behavior", () => {
  function varyOptimizationOptions(block) {
    function clone(object) {
      const result = {};

      Object.keys(object).forEach(key => {
        result[key] = object[key];
      });

      return result;
    }

    const optionsVariants = [
      { cache: false, trace: false },
      { cache: false, trace: true },
      { cache: false, trace: false },
      { cache: false, trace: true },
      { cache: true,  trace: false },
      { cache: true,  trace: true },
      { cache: true,  trace: false },
      { cache: true,  trace: true },
    ];

    optionsVariants.forEach(variant => {
      describe(
        "with options " + chai.util.inspect(variant),
        () => { block(clone(variant)); }
      );
    });
  }

  function withConsoleStub(block) {
    if (typeof console === "object") {
      stub(console, "log");
    }

    try {
      return block();
    } finally {
      if (typeof console === "object") {
        console.log.restore();
      }
    }
  }

  function helpers(chai, utils) {
    const Assertion = chai.Assertion;

    Assertion.addMethod("parse", function(input, expected, options) {
      options = options !== undefined ? options : {};

      const result = withConsoleStub(() => utils.flag(this, "object")
        .parse(input, options));

      if (expected !== undefined) {
        this.assert(
          utils.eql(result, expected),
          "expected #{this} to parse input as #{exp} but got #{act}",
          "expected #{this} to not parse input as #{exp}",
          expected,
          result,
          !utils.flag(this, "negate")
        );
      }
    });

    Assertion.addMethod("failToParse", function(input, props, options) {
      options = options !== undefined ? options : {};

      let passed, result;

      try {
        result = withConsoleStub(() => utils.flag(this, "object")
          .parse(input, options));
        passed = true;
      } catch (e) {
        result = e;
        passed = false;
      }

      this.assert(
        !passed,
        "expected #{this} to fail to parse input but got #{act}",
        "expected #{this} to not fail to parse input but #{act} was thrown",
        null,
        result
      );

      if (!passed && props !== undefined) {
        Object.keys(props).forEach(key => {
          new Assertion(result).to.have.property(key)
            .that.is.deep.equal(props[key]);
        });
      }
    });
  }

  // Helper activation needs to put inside a |beforeEach| block because the
  // helpers conflict with the ones in test/unit/parser.spec.js.
  beforeEach(() => {
    chai.use(helpers);
  });

  varyOptimizationOptions(options => {
    describe("initializer", () => {
      it("executes the code before parsing starts", () => {
        const parser = peg.generate([
          "{ var result = 42; }",
          "start = 'a' { return result; }",
        ].join("\n"), options);

        expect(parser).to.parse("a", 42);
      });

      describe("available variables and functions", () => {
        it("|options| contains options", () => {
          const parser = peg.generate([
            "{ var result = options; }",
            "start = 'a' { return result; }",
          ].join("\n"), options);

          expect(parser).to.parse("a", { a: 42 }, { a: 42 });
        });
      });
    });

    describe("rule", () => {
      if (options.cache) {
        it("caches rule match results", () => {
          const parser = peg.generate([
            "{ var n = 0; }",
            "start = (a 'b') / (a 'c') { return n; }",
            "a = 'a' { n++; }",
          ].join("\n"), options);

          expect(parser).to.parse("ac", 1);
        });
      } else {
        it("doesn't cache rule match results", () => {
          const parser = peg.generate([
            "{ var n = 0; }",
            "start = (a 'b') / (a 'c') { return n; }",
            "a = 'a' { n++; }",
          ].join("\n"), options);

          expect(parser).to.parse("ac", 2);
        });
      }

      describe("when the expression matches", () => {
        describe("without display name", () => {
          describe("returns its match result", () => {
            it("when expression may match", () => {
              const parser = peg.generate("start = 'a'", options);

              expect(parser).to.parse("a", "a");
            });

            it("when expression always match", () => {
              const parser = peg.generate("start = 'a'*", options);

              expect(parser).to.parse("", []);
            });
          });
        });

        describe("with display name", () => {
          describe("returns its match result", () => {
            it("when expression may match", () => {
              const parser = peg.generate("start 'start' = 'a'", options);

              expect(parser).to.parse("a", "a");
            });

            it("when expression always match", () => {
              const parser = peg.generate("start 'start' = 'a'*", options);

              expect(parser).to.parse("", []);
            });
          });
        });
      });

      describe("when the expression doesn't match", () => {
        describe("without display name", () => {
          describe("reports match failure and records an expectation", () => {
            it("when expression may match", () => {
              const parser = peg.generate("start = 'a'", options);

              expect(parser).to.failToParse("b", {
                expected: [{ type: "literal", text: "a", ignoreCase: false }],
              });
            });

            it("when expression never match", () => {
              const parser = peg.generate("start = []", options);

              expect(parser).to.failToParse("b", {
                expected: [{ type: "class", parts: [], inverted: false, ignoreCase: false }],
              });
            });
          });
        });

        describe("with display name", () => {
          it("reports match failure and records an expectation of type \"other\" when expression may match", () => {
            const parser = peg.generate("start 'start' = 'a'", options);

            expect(parser).to.failToParse("b", {
              expected: [{ type: "other", description: "start" }],
            });
          });

          it("reports match failure and doesn't records any expectations when expression never match", () => {
            const parser = peg.generate("start 'start' = []", options);

            expect(parser).to.failToParse("b", {
              expected: [],
            });
          });

          it("discards any expectations recorded when matching the expression", () => {
            const parser = peg.generate("start 'start' = 'a'", options);

            expect(parser).to.failToParse("b", {
              expected: [{ type: "other", description: "start" }],
            });
          });
        });
      });
    });

    describe("literal", () => {
      describe("matching", () => {
        it("matches empty literals", () => {
          const parser = peg.generate("start = ''", options);

          expect(parser).to.parse("");
        });

        it("matches one-character literals", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.parse("a");
          expect(parser).to.failToParse("b");
        });

        it("matches multi-character literals", () => {
          const parser = peg.generate("start = 'abcd'", options);

          expect(parser).to.parse("abcd");
          expect(parser).to.failToParse("efgh");
        });

        it("is case sensitive without the \"i\" flag", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.parse("a");
          expect(parser).to.failToParse("A");
        });

        it("is case insensitive with the \"i\" flag", () => {
          const parser = peg.generate("start = 'a'i", options);

          expect(parser).to.parse("a");
          expect(parser).to.parse("A");
        });
      });

      describe("when it matches", () => {
        it("returns the matched text", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.parse("a", "a");
        });

        it("consumes the matched text", () => {
          const parser = peg.generate("start = 'a' .", options);

          expect(parser).to.parse("ab");
        });
      });

      describe("when it doesn't match", () => {
        it("reports match failure and records an expectation of type \"literal\"", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", {
            expected: [{ type: "literal", text: "a", ignoreCase: false }],
          });
        });
      });
    });

    describe("character class", () => {
      describe("matching", () => {
        it("matches empty classes", () => {
          const parser = peg.generate("start = []", options);

          expect(parser).to.failToParse("a");
        });

        it("matches classes with a character list", () => {
          const parser = peg.generate("start = [abc]", options);

          expect(parser).to.parse("a");
          expect(parser).to.parse("b");
          expect(parser).to.parse("c");
          expect(parser).to.failToParse("d");
        });

        it("matches classes with a character range", () => {
          const parser = peg.generate("start = [a-c]", options);

          expect(parser).to.parse("a");
          expect(parser).to.parse("b");
          expect(parser).to.parse("c");
          expect(parser).to.failToParse("d");
        });

        it("matches inverted classes", () => {
          const parser = peg.generate("start = [^a]", options);

          expect(parser).to.failToParse("a");
          expect(parser).to.parse("b");
        });

        it("is case sensitive without the \"i\" flag", () => {
          const parser = peg.generate("start = [a]", options);

          expect(parser).to.parse("a");
          expect(parser).to.failToParse("A");
        });

        it("is case insensitive with the \"i\" flag", () => {
          const parser = peg.generate("start = [a]i", options);

          expect(parser).to.parse("a");
          expect(parser).to.parse("A");
        });
      });

      describe("when it matches", () => {
        it("returns the matched character", () => {
          const parser = peg.generate("start = [a]", options);

          expect(parser).to.parse("a", "a");
        });

        it("consumes the matched character", () => {
          const parser = peg.generate("start = [a] .", options);

          expect(parser).to.parse("ab");
        });
      });

      describe("when it doesn't match", () => {
        it("reports match failure and records an expectation of type \"class\"", () => {
          const parser = peg.generate("start = [a]", options);

          expect(parser).to.failToParse("b", {
            expected: [{ type: "class", parts: ["a"], inverted: false, ignoreCase: false }],
          });
        });
      });
    });

    describe("dot", () => {
      describe("matching", () => {
        it("matches any character", () => {
          const parser = peg.generate("start = .", options);

          expect(parser).to.parse("a");
          expect(parser).to.parse("b");
          expect(parser).to.parse("c");
        });
      });

      describe("when it matches", () => {
        it("returns the matched character", () => {
          const parser = peg.generate("start = .", options);

          expect(parser).to.parse("a", "a");
        });

        it("consumes the matched character", () => {
          const parser = peg.generate("start = . .", options);

          expect(parser).to.parse("ab");
        });
      });

      describe("when it doesn't match", () => {
        it("reports match failure and records an expectation of type \"any\"", () => {
          const parser = peg.generate("start = .", options);

          expect(parser).to.failToParse("", {
            expected: [{ type: "any" }],
          });
        });
      });
    });

    describe("rule reference", () => {
      describe("when referenced rule's expression matches", () => {
        it("returns its result", () => {
          const parser = peg.generate([
            "start = a",
            "a = 'a'",
          ].join("\n"), options);

          expect(parser).to.parse("a", "a");
        });
      });

      describe("when referenced rule's expression doesn't match", () => {
        it("reports match failure", () => {
          const parser = peg.generate([
            "start = a",
            "a = 'a'",
          ].join("\n"), options);

          expect(parser).to.failToParse("b");
        });
      });
    });

    describe("positive semantic predicate", () => {
      describe("when the code returns a truthy value", () => {
        it("returns |undefined|", () => {
          // The |""| is needed so that the parser doesn't return just
          // |undefined| which we can't compare against in |toParse| due to the
          // way optional parameters work.
          const parser = peg.generate("start = &{ return true; } ''", options);

          expect(parser).to.parse("", [undefined, ""]);
        });
      });

      describe("when the code returns a falsey value", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = &{ return false; }", options);

          expect(parser).to.failToParse("");
        });
      });

      describe("label variables", () => {
        describe("in containing sequence", () => {
          it("can access variables defined by preceding labeled elements", () => {
            const parser = peg.generate(
              "start = a:'a' &{ return a === 'a'; }",
              options
            );

            expect(parser).to.parse("a");
          });

          it("cannot access variable defined by labeled predicate element", () => {
            const parser = peg.generate(
              "start = 'a' b:&{ return b === undefined; } 'c'",
              options
            );

            expect(parser).to.failToParse("ac");
          });

          it("cannot access variables defined by following labeled elements", () => {
            const parser = peg.generate(
              "start = &{ return a === 'a'; } a:'a'",
              options
            );

            expect(parser).to.failToParse("a");
          });

          it("cannot access variables defined by subexpressions", () => {
            const testcases = [
              {
                grammar: "start = (a:'a') &{ return a === 'a'; }",
                input: "a",
              },
              {
                grammar: "start = (a:'a')? &{ return a === 'a'; }",
                input: "a",
              },
              {
                grammar: "start = (a:'a')* &{ return a === 'a'; }",
                input: "a",
              },
              {
                grammar: "start = (a:'a')+ &{ return a === 'a'; }",
                input: "a",
              },
              {
                grammar: "start = $(a:'a') &{ return a === 'a'; }",
                input: "a",
              },
              {
                grammar: "start = &(a:'a') 'a' &{ return a === 'a'; }",
                input: "a",
              },
              {
                grammar: "start = !(a:'a') 'b' &{ return a === 'a'; }",
                input: "b",
              },
              {
                grammar: "start = b:(a:'a') &{ return a === 'a'; }",
                input: "a",
              },
              {
                grammar: "start = ('a' b:'b' 'c') &{ return b === 'b'; }",
                input: "abc",
              },
              {
                grammar: "start = (a:'a' { return a; }) &{ return a === 'a'; }",
                input: "a",
              },
              {
                grammar: "start = ('a' / b:'b' / 'c') &{ return b === 'b'; }",
                input: "b",
              },
            ];

            testcases.forEach(testcase => {
              const parser = peg.generate(testcase.grammar, options);
              expect(parser).to.failToParse(testcase.input);
            });
          });
        });

        describe("in outer sequence", () => {
          it("can access variables defined by preceding labeled elements", () => {
            const parser = peg.generate(
              "start = a:'a' ('b' &{ return a === 'a'; })",
              options
            );

            expect(parser).to.parse("ab");
          });

          it("cannot access variable defined by labeled predicate element", () => {
            const parser = peg.generate(
              "start = 'a' b:('b' &{ return b === undefined; }) 'c'",
              options
            );

            expect(parser).to.failToParse("abc");
          });

          it("cannot access variables defined by following labeled elements", () => {
            const parser = peg.generate(
              "start = ('a' &{ return b === 'b'; }) b:'b'",
              options
            );

            expect(parser).to.failToParse("ab");
          });
        });
      });

      describe("initializer variables & functions", () => {
        it("can access variables defined in the initializer", () => {
          const parser = peg.generate([
            "{ var v = 42 }",
            "start = &{ return v === 42; }",
          ].join("\n"), options);

          expect(parser).to.parse("");
        });

        it("can access functions defined in the initializer", () => {
          const parser = peg.generate([
            "{ function f() { return 42; } }",
            "start = &{ return f() === 42; }",
          ].join("\n"), options);

          expect(parser).to.parse("");
        });
      });

      describe("available variables & functions", () => {
        it("|options| contains options", () => {
          const parser = peg.generate([
            "{ var result; }",
            "start = &{ result = options; return true; } { return result; }",
          ].join("\n"), options);

          expect(parser).to.parse("", { a: 42 }, { a: 42 });
        });

        it("|location| returns current location info", () => {
          const parser = peg.generate([
            "{ var result; }",
            "start = line (nl+ line)* { return result; }",
            "line = thing (' '+ thing)*",
            "thing = digit / mark",
            "digit = [0-9]",
            "mark = &{ result = location(); return true; } 'x'",
            "nl = '\\r'? '\\n'",
          ].join("\n"), options);

          expect(parser).to.parse("1\n2\n\n3\n\n\n4 5 x", {
            source: undefined,
            start: { offset: 13, line: 7, column: 5 },
            end: { offset: 13, line: 7, column: 5 },
          });

          // Newline representations
          expect(parser).to.parse("1\nx", {     // Unix
            source: undefined,
            start: { offset: 2, line: 2, column: 1 },
            end: { offset: 2, line: 2, column: 1 },
          });
          expect(parser).to.parse("1\r\nx", {   // Windows
            source: undefined,
            start: { offset: 3, line: 2, column: 1 },
            end: { offset: 3, line: 2, column: 1 },
          });
        });

        it("|offset| returns current start offset", () => {
          const parser = peg.generate([
            "start = [0-9]+ @mark",
            "mark = 'xx' { return offset(); }",
          ].join("\n"), options);

          expect(parser).to.parse("0123456xx", 7);
        });

        it("|range| returns current range", () => {
          const parser = peg.generate([
            "start = [0-9]+ @mark",
            "mark = 'xx' { return range(); }",
          ].join("\n"), options);

          expect(parser).to.parse("0123456xx", {
            source: undefined,
            start: 7,
            end: 9,
          });
        });
      });
    });

    describe("negative semantic predicate", () => {
      describe("when the code returns a falsey value", () => {
        it("returns |undefined|", () => {
          // The |""| is needed so that the parser doesn't return just
          // |undefined| which we can't compare against in |toParse| due to the
          // way optional parameters work.
          const parser = peg.generate("start = !{ return false; } ''", options);

          expect(parser).to.parse("", [undefined, ""]);
        });
      });

      describe("when the code returns a truthy value", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = !{ return true; }", options);

          expect(parser).to.failToParse("");
        });
      });

      describe("label variables", () => {
        describe("in containing sequence", () => {
          it("can access variables defined by preceding labeled elements", () => {
            const parser = peg.generate(
              "start = a:'a' !{ return a !== 'a'; }",
              options
            );

            expect(parser).to.parse("a");
          });

          it("cannot access variable defined by labeled predicate element", () => {
            const parser = peg.generate(
              "start = 'a' b:!{ return b !== undefined; } 'c'",
              options
            );

            expect(parser).to.failToParse("ac");
          });

          it("cannot access variables defined by following labeled elements", () => {
            const parser = peg.generate(
              "start = !{ return a !== 'a'; } a:'a'",
              options
            );

            expect(parser).to.failToParse("a");
          });

          it("cannot access variables defined by subexpressions", () => {
            const testcases = [
              {
                grammar: "start = (a:'a') !{ return a !== 'a'; }",
                input: "a",
              },
              {
                grammar: "start = (a:'a')? !{ return a !== 'a'; }",
                input: "a",
              },
              {
                grammar: "start = (a:'a')* !{ return a !== 'a'; }",
                input: "a",
              },
              {
                grammar: "start = (a:'a')+ !{ return a !== 'a'; }",
                input: "a",
              },
              {
                grammar: "start = $(a:'a') !{ return a !== 'a'; }",
                input: "a",
              },
              {
                grammar: "start = &(a:'a') 'a' !{ return a !== 'a'; }",
                input: "a",
              },
              {
                grammar: "start = !(a:'a') 'b' !{ return a !== 'a'; }",
                input: "b",
              },
              {
                grammar: "start = b:(a:'a') !{ return a !== 'a'; }",
                input: "a",
              },
              {
                grammar: "start = ('a' b:'b' 'c') !{ return b !== 'b'; }",
                input: "abc",
              },
              {
                grammar: "start = (a:'a' { return a; }) !{ return a !== 'a'; }",
                input: "a",
              },
              {
                grammar: "start = ('a' / b:'b' / 'c') !{ return b !== 'b'; }",
                input: "b",
              },
            ];

            testcases.forEach(testcase => {
              const parser = peg.generate(testcase.grammar, options);
              expect(parser).to.failToParse(testcase.input);
            });
          });
        });

        describe("in outer sequence", () => {
          it("can access variables defined by preceding labeled elements", () => {
            const parser = peg.generate(
              "start = a:'a' ('b' !{ return a !== 'a'; })",
              options
            );

            expect(parser).to.parse("ab");
          });

          it("cannot access variable defined by labeled predicate element", () => {
            const parser = peg.generate(
              "start = 'a' b:('b' !{ return b !== undefined; }) 'c'",
              options
            );

            expect(parser).to.failToParse("abc");
          });

          it("cannot access variables defined by following labeled elements", () => {
            const parser = peg.generate(
              "start = ('a' !{ return b !== 'b'; }) b:'b'",
              options
            );

            expect(parser).to.failToParse("ab");
          });
        });
      });

      describe("initializer variables & functions", () => {
        it("can access variables defined in the initializer", () => {
          const parser = peg.generate([
            "{ var v = 42 }",
            "start = !{ return v !== 42; }",
          ].join("\n"), options);

          expect(parser).to.parse("");
        });

        it("can access functions defined in the initializer", () => {
          const parser = peg.generate([
            "{ function f() { return 42; } }",
            "start = !{ return f() !== 42; }",
          ].join("\n"), options);

          expect(parser).to.parse("");
        });
      });

      describe("available variables & functions", () => {
        it("|options| contains options", () => {
          const parser = peg.generate([
            "{ var result; }",
            "start = !{ result = options; return false; } { return result; }",
          ].join("\n"), options);

          expect(parser).to.parse("", { a: 42 }, { a: 42 });
        });

        it("|location| returns current location info", () => {
          const parser = peg.generate([
            "{ var result; }",
            "start = line (nl+ line)* { return result; }",
            "line = thing (' '+ thing)*",
            "thing = digit / mark",
            "digit = [0-9]",
            "mark = !{ result = location(); return false; } 'x'",
            "nl = '\\r'? '\\n'",
          ].join("\n"), options);

          expect(parser).to.parse("1\n2\n\n3\n\n\n4 5 x", {
            source: undefined,
            start: { offset: 13, line: 7, column: 5 },
            end: { offset: 13, line: 7, column: 5 },
          });

          // Newline representations
          expect(parser).to.parse("1\nx", {     // Unix
            source: undefined,
            start: { offset: 2, line: 2, column: 1 },
            end: { offset: 2, line: 2, column: 1 },
          });
          expect(parser).to.parse("1\r\nx", {   // Windows
            source: undefined,
            start: { offset: 3, line: 2, column: 1 },
            end: { offset: 3, line: 2, column: 1 },
          });
        });
      });
    });

    describe("group", () => {
      describe("when the expression matches", () => {
        it("returns its match result", () => {
          const parser = peg.generate("start = ('a')", options);

          expect(parser).to.parse("a", "a");
        });
      });

      describe("when the expression doesn't match", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = ('a')", options);

          expect(parser).to.failToParse("b");
        });
      });
    });

    describe("optional", () => {
      describe("when the expression matches", () => {
        it("returns its match result", () => {
          const parser = peg.generate("start = 'a'?", options);

          expect(parser).to.parse("a", "a");
        });
      });

      describe("when the expression doesn't match", () => {
        it("returns |null|", () => {
          const parser = peg.generate("start = 'a'?", options);

          expect(parser).to.parse("", null);
        });
      });
    });

    describe("zero or more", () => {
      describe("when the expression matches zero or more times", () => {
        it("returns an array of its match results", () => {
          const parser = peg.generate("start = 'a'*", options);

          expect(parser).to.parse("",    []);
          expect(parser).to.parse("a",   ["a"]);
          expect(parser).to.parse("aaa", ["a", "a", "a"]);
        });
      });
    });

    describe("one or more", () => {
      describe("when the expression matches one or more times", () => {
        it("returns an array of its match results", () => {
          const parser = peg.generate("start = 'a'+", options);

          expect(parser).to.parse("a",   ["a"]);
          expect(parser).to.parse("aaa", ["a", "a", "a"]);
        });
      });

      describe("when the expression doesn't match", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = 'a'+", options);

          expect(parser).to.failToParse("");
        });
      });
    });

    describe("text", () => {
      describe("when the expression matches", () => {
        it("returns the matched text", () => {
          const parser = peg.generate("start = $('a' 'b' 'c')", options);

          expect(parser).to.parse("abc", "abc");
        });
      });

      describe("when the expression doesn't match", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = $('a')", options);

          expect(parser).to.failToParse("b");
        });
      });
    });

    describe("positive simple predicate", () => {
      describe("when the expression matches", () => {
        it("returns |undefined|", () => {
          const parser = peg.generate("start = &'a' 'a'", options);

          expect(parser).to.parse("a", [undefined, "a"]);
        });

        it("resets parse position", () => {
          const parser = peg.generate("start = &'a' 'a'", options);

          expect(parser).to.parse("a");
        });
      });

      describe("when the expression doesn't match", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = &'a'", options);

          expect(parser).to.failToParse("b");
        });

        it("discards any expectations recorded when matching the expression", () => {
          const parser = peg.generate("start = 'a' / &'b' / 'c'", options);

          expect(parser).to.failToParse("d", {
            expected: [
              { type: "literal", text: "a", ignoreCase: false },
              { type: "literal", text: "c", ignoreCase: false },
            ],
          });
        });
      });
    });

    describe("negative simple predicate", () => {
      describe("when the expression matches", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = !'a'", options);

          expect(parser).to.failToParse("a");
        });
      });

      describe("when the expression doesn't match", () => {
        it("returns |undefined|", () => {
          const parser = peg.generate("start = !'a' 'b'", options);

          expect(parser).to.parse("b", [undefined, "b"]);
        });

        it("resets parse position", () => {
          const parser = peg.generate("start = !'a' 'b'", options);

          expect(parser).to.parse("b");
        });

        it("discards any expectations recorded when matching the expression", () => {
          const parser = peg.generate("start = 'a' / !'b' / 'c'", options);

          expect(parser).to.failToParse("b", {
            expected: [
              { type: "literal", text: "a", ignoreCase: false },
              { type: "literal", text: "c", ignoreCase: false },
            ],
          });
        });
      });
    });

    describe("label", () => {
      describe("when the expression matches", () => {
        it("returns its match result", () => {
          const parser = peg.generate("start = a:'a'", options);

          expect(parser).to.parse("a", "a");
        });
      });

      describe("when the expression doesn't match", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = a:'a'", options);

          expect(parser).to.failToParse("b");
        });
      });
    });

    describe("sequence", () => {
      describe("when all expressions match", () => {
        it("returns an array of their match results", () => {
          const parser = peg.generate("start = 'a' 'b' 'c'", options);

          expect(parser).to.parse("abc", ["a", "b", "c"]);
        });

        it("plucks a single value", () => {
          let parser = peg.generate("start = @'a'", options);
          expect(parser).to.parse("a", "a");

          parser = peg.generate("start = @'a' / @'b'", options);
          expect(parser).to.parse("a", "a");
          expect(parser).to.parse("b", "b");

          parser = peg.generate("start = 'a' @'b' 'c'", options);
          expect(parser).to.parse("abc", "b");

          parser = peg.generate("start = 'a' ( @'b' 'c' )", options);
          expect(parser).to.parse("abc", ["a", "b"]);

          parser = peg.generate("start = 'a' @( 'b' @'c' 'd' )", options);
          expect(parser).to.parse("abcd", "c");

          parser = peg.generate("start = 'a' ( @'b' 'c' ) @'d'", options);
          expect(parser).to.parse("abcd", "d");

          parser = peg.generate("start = 'a' @'b' 'c' / 'd' 'e' @'f'", options);
          expect(parser).to.parse("def", "f");
        });

        it("plucks a multiple values", () => {
          let parser = peg.generate("start = 'a' @'b' @'c'", options);
          expect(parser).to.parse("abc", ["b", "c"]);

          parser = peg.generate("start = 'a' ( @'b' @'c' )", options);
          expect(parser).to.parse("abc", ["a", ["b", "c"]]);

          parser = peg.generate("start = 'a' @( 'b' @'c' @'d' )", options);
          expect(parser).to.parse("abcd", ["c", "d"]);

          parser = peg.generate("start = 'a' @( @'b' 'c' ) @'d' 'e'", options);
          expect(parser).to.parse("abcde", ["b", "d"]);

          parser = peg.generate("start = 'a' @'b' 'c' / @'d' 'e' @'f'", options);
          expect(parser).to.parse("def", ["d", "f"]);
        });

        it("prevents \"@\" on a semantic predicate", () => {
          expect(() => peg.generate("start1 = 'a' @&{ /* semantic_and */ } 'c'"), options).to.throw();
          expect(() => peg.generate("start2 = 'a' @!{ /* semantic_not */ } 'c'"), options).to.throw();
        });
      });

      describe("when any expression doesn't match", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = 'a' 'b' 'c'", options);

          expect(parser).to.failToParse("dbc");
          expect(parser).to.failToParse("adc");
          expect(parser).to.failToParse("abd");
        });

        it("resets parse position", () => {
          const parser = peg.generate("start = 'a' 'b' / 'a'", options);

          expect(parser).to.parse("a", "a");
        });
      });
    });

    describe("action", () => {
      describe("when the expression matches", () => {
        it("returns the value returned by the code", () => {
          const parser = peg.generate("start = 'a' { return 42; }", options);

          expect(parser).to.parse("a", 42);
        });

        describe("label variables", () => {
          describe("in the expression", () => {
            it("can access variable defined by labeled expression", () => {
              const parser = peg.generate("start = a:'a' { return a; }", options);

              expect(parser).to.parse("a", "a");
            });

            it("can access variables defined by labeled sequence elements", () => {
              const parser = peg.generate(
                "start = a:'a' b:'b' c:'c' { return [a, b, c]; }",
                options
              );

              expect(parser).to.parse("abc", ["a", "b", "c"]);
            });

            it("cannot access variables defined by subexpressions", () => {
              const testcases = [
                {
                  grammar: "start = (a:'a') { return a; }",
                  input: "a",
                },
                {
                  grammar: "start = (a:'a')? { return a; }",
                  input: "a",
                },
                {
                  grammar: "start = (a:'a')* { return a; }",
                  input: "a",
                },
                {
                  grammar: "start = (a:'a')+ { return a; }",
                  input: "a",
                },
                {
                  grammar: "start = $(a:'a') { return a; }",
                  input: "a",
                },
                {
                  grammar: "start = &(a:'a') 'a' { return a; }",
                  input: "a",
                },
                {
                  grammar: "start = !(a:'a') 'b' { return a; }",
                  input: "b",
                },
                {
                  grammar: "start = b:(a:'a') { return a; }",
                  input: "a",
                },
                {
                  grammar: "start = ('a' b:'b' 'c') { return b; }",
                  input: "abc",
                },
                {
                  grammar: "start = (a:'a' { return a; }) { return a; }",
                  input: "a",
                },
                {
                  grammar: "start = ('a' / b:'b' / 'c') { return b; }",
                  input: "b",
                },
              ];

              testcases.forEach(testcase => {
                const parser = peg.generate(testcase.grammar, options);
                expect(parser).to.failToParse(testcase.input);
              });
            });
          });

          describe("in outer sequence", () => {
            it("can access variables defined by preceding labeled elements", () => {
              const parser = peg.generate(
                "start = a:'a' ('b' { return a; })",
                options
              );

              expect(parser).to.parse("ab", ["a", "a"]);
            });

            it("cannot access variable defined by labeled action element", () => {
              const parser = peg.generate(
                "start = 'a' b:('b' { return b; }) c:'c'",
                options
              );

              expect(parser).to.failToParse("abc");
            });

            it("cannot access variables defined by following labeled elements", () => {
              const parser = peg.generate(
                "start = ('a' { return b; }) b:'b'",
                options
              );

              expect(parser).to.failToParse("ab");
            });
          });
        });

        describe("initializer variables & functions", () => {
          it("can access variables defined in the initializer", () => {
            const parser = peg.generate([
              "{ var v = 42 }",
              "start = 'a' { return v; }",
            ].join("\n"), options);

            expect(parser).to.parse("a", 42);
          });

          it("can access functions defined in the initializer", () => {
            const parser = peg.generate([
              "{ function f() { return 42; } }",
              "start = 'a' { return f(); }",
            ].join("\n"), options);

            expect(parser).to.parse("a", 42);
          });
        });

        describe("available variables & functions", () => {
          it("|options| contains options", () => {
            const parser = peg.generate(
              "start = 'a' { return options; }",
              options
            );

            expect(parser).to.parse("a", { a: 42 }, { a: 42 });
          });

          it("|text| returns text matched by the expression", () => {
            const parser = peg.generate(
              "start = 'a' { return text(); }",
              options
            );

            expect(parser).to.parse("a", "a");
          });

          it("|location| returns location info of the expression", () => {
            const parser = peg.generate([
              "{ var result; }",
              "start = line (nl+ line)* { return result; }",
              "line = thing (' '+ thing)*",
              "thing = digit / mark",
              "digit = [0-9]",
              "mark = 'x' { result = location(); }",
              "nl = '\\r'? '\\n'",
            ].join("\n"), options);

            expect(parser).to.parse("1\n2\n\n3\n\n\n4 5 x", {
              source: undefined,
              start: { offset: 13, line: 7, column: 5 },
              end: { offset: 14, line: 7, column: 6 },
            });

            // Newline representations
            expect(parser).to.parse("1\nx", {     // Unix
              source: undefined,
              start: { offset: 2, line: 2, column: 1 },
              end: { offset: 3, line: 2, column: 2 },
            });
            expect(parser).to.parse("1\r\nx", {   // Windows
              source: undefined,
              start: { offset: 3, line: 2, column: 1 },
              end: { offset: 4, line: 2, column: 2 },
            });
          });

          describe("|expected|", () => {
            it("terminates parsing and throws an exception", () => {
              const parser = peg.generate(
                "start = 'a' { expected('a'); }",
                options
              );

              expect(parser).to.failToParse("a", {
                message: "Expected a but \"a\" found.",
                expected: [{ type: "other", description: "a" }],
                found: "a",
                location: {
                  source: undefined,
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 1, line: 1, column: 2 },
                },
              });
            });

            it("allows to set custom location info", () => {
              const parser = peg.generate([
                "start = 'a' {",
                "  expected('a', {",
                "    start: { offset: 1, line: 1, column: 2 },",
                "    end: { offset: 2, line: 1, column: 3 }",
                "  });",
                "}",
              ].join("\n"), options);

              expect(parser).to.failToParse("a", {
                message: "Expected a but \"a\" found.",
                expected: [{ type: "other", description: "a" }],
                found: "a",
                location: {
                  start: { offset: 1, line: 1, column: 2 },
                  end: { offset: 2, line: 1, column: 3 },
                },
              });
            });
          });

          describe("|error|", () => {
            it("terminates parsing and throws an exception", () => {
              const parser = peg.generate(
                "start = 'a' { error('a'); }",
                options
              );

              expect(parser).to.failToParse("a", {
                message: "a",
                found: null,
                expected: null,
                location: {
                  source: undefined,
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 1, line: 1, column: 2 },
                },
              });
            });

            it("allows to set custom location info", () => {
              const parser = peg.generate([
                "start = 'a' {",
                "  error('a', {",
                "    start: { offset: 1, line: 1, column: 2 },",
                "    end: { offset: 2, line: 1, column: 3 }",
                "  });",
                "}",
              ].join("\n"), options);

              expect(parser).to.failToParse("a", {
                message: "a",
                expected: null,
                found: null,
                location: {
                  start: { offset: 1, line: 1, column: 2 },
                  end: { offset: 2, line: 1, column: 3 },
                },
              });
            });
          });
        });
      });

      describe("when the expression doesn't match", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = 'a' { return 42; }", options);

          expect(parser).to.failToParse("b");
        });

        it("doesn't execute the code", () => {
          const parser = peg.generate(
            "start = 'a' { throw 'Boom!'; } / 'b'",
            options
          );

          expect(parser).to.parse("b");
        });
      });
    });

    describe("choice", () => {
      describe("when any expression matches", () => {
        it("returns its match result", () => {
          const parser = peg.generate("start = 'a' / 'b' / 'c'", options);

          expect(parser).to.parse("a", "a");
          expect(parser).to.parse("b", "b");
          expect(parser).to.parse("c", "c");
        });
      });

      describe("when all expressions don't match", () => {
        it("reports match failure", () => {
          const parser = peg.generate("start = 'a' / 'b' / 'c'", options);

          expect(parser).to.failToParse("d");
        });
      });
    });

    describe("error reporting", () => {
      describe("behavior", () => {
        it("reports only the rightmost error", () => {
          const parser = peg.generate("start = 'a' 'b' / 'a' 'c' 'd'", options);

          expect(parser).to.failToParse("ace", {
            expected: [{ type: "literal", text: "d", ignoreCase: false }],
          });
        });
      });

      describe("expectations reporting", () => {
        it("reports expectations correctly with no alternative", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("ab", {
            expected: [{ type: "end" }],
          });
        });

        it("reports expectations correctly with one alternative", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", {
            expected: [{ type: "literal", text: "a", ignoreCase: false }],
          });
        });

        it("reports expectations correctly with multiple alternatives", () => {
          const parser = peg.generate("start = 'a' / 'b' / 'c'", options);

          expect(parser).to.failToParse("d", {
            expected: [
              { type: "literal", text: "a", ignoreCase: false },
              { type: "literal", text: "b", ignoreCase: false },
              { type: "literal", text: "c", ignoreCase: false },
            ],
          });
        });
      });

      describe("found string reporting", () => {
        it("reports found string correctly at the end of input", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("", { found: null });
        });

        it("reports found string correctly in the middle of input", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", { found: "b" });
        });
      });

      describe("message building", () => {
        it("builds message correctly with no alternative", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("ab", {
            message: "Expected end of input but \"b\" found.",
          });
        });

        it("builds message correctly with one alternative", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", {
            message: "Expected \"a\" but \"b\" found.",
          });
        });

        it("builds message correctly with multiple alternatives", () => {
          const parser = peg.generate("start = 'a' / 'b' / 'c'", options);

          expect(parser).to.failToParse("d", {
            message: "Expected \"a\", \"b\", or \"c\" but \"d\" found.",
          });
        });

        it("builds message correctly at the end of input", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("", {
            message: "Expected \"a\" but end of input found.",
          });
        });

        it("builds message correctly in the middle of input", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", {
            message: "Expected \"a\" but \"b\" found.",
          });
        });

        it("removes duplicates from expectations", () => {
          const parser = peg.generate("start = 'a' / 'a'", options);

          expect(parser).to.failToParse("b", {
            message: "Expected \"a\" but \"b\" found.",
          });
        });

        it("sorts expectations", () => {
          const parser = peg.generate("start = 'c' / 'b' / 'a'", options);

          expect(parser).to.failToParse("d", {
            message: "Expected \"a\", \"b\", or \"c\" but \"d\" found.",
          });
        });
      });

      describe("position reporting", () => {
        it("reports position correctly at the end of input", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("", {
            location: {
              source: undefined,
              start: { offset: 0, line: 1, column: 1 },
              end: { offset: 0, line: 1, column: 1 },
            },
          });
        });

        it("reports position correctly in the middle of input", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", {
            location: {
              source: undefined,
              start: { offset: 0, line: 1, column: 1 },
              end: { offset: 1, line: 1, column: 2 },
            },
          });
        });

        it("reports position correctly with trailing input", () => {
          const parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("aa", {
            location: {
              source: undefined,
              start: { offset: 1, line: 1, column: 2 },
              end: { offset: 2, line: 1, column: 3 },
            },
          });
        });

        it("reports position correctly in complex cases", () => {
          const parser = peg.generate([
            "start = line (nl+ line)*",
            "line = digit (' '+ digit)*",
            "digit = [0-9]",
            "nl = '\\r'? '\\n'",
          ].join("\n"), options);

          expect(parser).to.failToParse("1\n2\n\n3\n\n\n4 5 x", {
            location: {
              source: undefined,
              start: { offset: 13, line: 7, column: 5 },
              end: { offset: 14, line: 7, column: 6 },
            },
          });

          // Newline representations
          expect(parser).to.failToParse("1\nx", {     // Old Mac
            location: {
              source: undefined,
              start: { offset: 2, line: 2, column: 1 },
              end: { offset: 3, line: 2, column: 2 },
            },
          });
          expect(parser).to.failToParse("1\r\nx", {   // Windows
            location: {
              source: undefined,
              start: { offset: 3, line: 2, column: 1 },
              end: { offset: 4, line: 2, column: 2 },
            },
          });
        });

        it("reports location source correctly", () => {
          const source = { source: "object" };
          const parser = peg.generate([
            "start = line (nl+ line)*",
            "line = digit (' '+ digit)*",
            "digit = [0-9]",
            "nl = '\\r'? '\\n'",
          ].join("\n"), options);

          expect(parser).to.failToParse("1\n2\n\n3\n\n\n4 5 x", {
            location: {
              source,
              start: { offset: 13, line: 7, column: 5 },
              end: { offset: 14, line: 7, column: 6 },
            },
          }, { grammarSource: source });
        });
      });
    });

    // Following examples are from Wikipedia, see
    // http://en.wikipedia.org/w/index.php?title=Parsing_expression_grammar&oldid=335106938.
    describe("complex examples", () => {
      it("handles arithmetics example correctly", () => {
        // Value   ← [0-9]+ / '(' Expr ')'
        // Product ← Value (('*' / '/') Value)*
        // Sum     ← Product (('+' / '-') Product)*
        // Expr    ← Sum
        const parser = peg.generate([
          "Expr = Sum",
          "Sum = head:Product tail:(('+' / '-') Product)* {",
          "        return tail.reduce(function(result, element) {",
          "          if (element[0] === '+') { return result + element[1]; }",
          "          if (element[0] === '-') { return result - element[1]; }",
          "        }, head);",
          "      }",
          "Product = head:Value tail:(('*' / '/') Value)* {",
          "            return tail.reduce(function(result, element) {",
          "              if (element[0] === '*') { return result * element[1]; }",
          "              if (element[0] === '/') { return result / element[1]; }",
          "            }, head);",
          "          }",
          "Value = digits:[0-9]+     { return parseInt(digits.join(''), 10); }",
          "      / '(' expr:Expr ')' { return expr; }",
        ].join("\n"), options);

        // The "value" rule
        expect(parser).to.parse("0",       0);
        expect(parser).to.parse("123",     123);
        expect(parser).to.parse("(42+43)", 42 + 43);

        // The "product" rule
        expect(parser).to.parse("42",          42);
        expect(parser).to.parse("42*43",       42 * 43);
        expect(parser).to.parse("42*43*44*45", 42 * 43 * 44 * 45);
        expect(parser).to.parse("42/43",       42 / 43);
        expect(parser).to.parse("42/43/44/45", 42 / 43 / 44 / 45);

        // The "sum" rule
        expect(parser).to.parse("42*43",                   42 * 43);
        expect(parser).to.parse("42*43+44*45",             42 * 43 + 44 * 45);
        expect(parser).to.parse("42*43+44*45+46*47+48*49", 42 * 43 + 44 * 45 + 46 * 47 + 48 * 49);
        expect(parser).to.parse("42*43-44*45",             42 * 43 - 44 * 45);
        expect(parser).to.parse("42*43-44*45-46*47-48*49", 42 * 43 - 44 * 45 - 46 * 47 - 48 * 49);

        // The "expr" rule
        expect(parser).to.parse("42+43", 42 + 43);

        // Complex test
        expect(parser).to.parse("(1+2)*(3+4)", (1 + 2) * (3 + 4));
      });

      it("handles non-context-free language correctly", () => {
        // The following parsing expression grammar describes the classic
        // non-context-free language { a^n b^n c^n : n >= 1 }:
        //
        // S ← &(A c) a+ B !(a/b/c)
        // A ← a A? b
        // B ← b B? c
        const parser = peg.generate([
          "S = &(A 'c') a:'a'+ B:B !('a' / 'b' / 'c') { return a.join('') + B; }",
          "A = a:'a' A:A? b:'b' { return [a, A, b].join(''); }",
          "B = b:'b' B:B? c:'c' { return [b, B, c].join(''); }",
        ].join("\n"), options);

        expect(parser).to.parse("abc",       "abc");
        expect(parser).to.parse("aaabbbccc", "aaabbbccc");
        expect(parser).to.failToParse("aabbbccc");
        expect(parser).to.failToParse("aaaabbbccc");
        expect(parser).to.failToParse("aaabbccc");
        expect(parser).to.failToParse("aaabbbbccc");
        expect(parser).to.failToParse("aaabbbcc");
        expect(parser).to.failToParse("aaabbbcccc");
      });

      it("handles nested comments example correctly", () => {
        // Begin ← "(*"
        // End ← "*)"
        // C ← Begin N* End
        // N ← C / (!Begin !End Z)
        // Z ← any single character
        const parser = peg.generate([
          "C = begin:Begin ns:N* end:End { return begin + ns.join('') + end; }",
          "N = C",
          "  / !Begin !End z:Z { return z; }",
          "Z = .",
          "Begin = '(*'",
          "End = '*)'",
        ].join("\n"), options);

        expect(parser).to.parse("(**)",     "(**)");
        expect(parser).to.parse("(*abc*)",  "(*abc*)");
        expect(parser).to.parse("(*(**)*)", "(*(**)*)");
        expect(parser).to.parse(
          "(*abc(*def*)ghi(*(*(*jkl*)*)*)mno*)",
          "(*abc(*def*)ghi(*(*(*jkl*)*)*)mno*)"
        );
      });
    });

    describe("run side-effects in non-matching", () => {
      it("positive semantic predicate", () => {
        let parser = peg.generate(`
        { let i = 0; }
        start = (neverMatched / .) { return i; };
        neverMatched = &{ i = 1; return true; } [];
        `, options);

        expect(parser).to.parse("b", 1);

        parser = peg.generate(`
        { let i = 0; }
        start = ("a" / neverMatched / .) { return i; };
        neverMatched = &{ i = 1; return true; } [];
        `, options);

        expect(parser).to.parse("b", 1);
      });

      it("negative semantic predicate", () => {
        let parser = peg.generate(`
        { let i = 0; }
        start = (neverMatched / .) { return i; };
        neverMatched = !{ i = 1; return false; } [];
        `, options);

        expect(parser).to.parse("b", 1);

        parser = peg.generate(`
        { let i = 0; }
        start = ("a" / neverMatched / .) { return i; };
        neverMatched = !{ i = 1; return false; } [];
        `, options);

        expect(parser).to.parse("b", 1);
      });

      it("action", () => {
        let parser = peg.generate(`
        { let i = 0; }
        start = (neverMatched / .) { return i; };
        neverMatched = (. { i = 1; }) [];
        `, options);

        expect(parser).to.parse("b", 1);

        parser = peg.generate(`
        { let i = 0; }
        start = ("a" / neverMatched / .) { return i; };
        neverMatched = (. { i = 1; }) [];
        `, options);

        expect(parser).to.parse("b", 1);
      });
    });
    it("Handles non-BMP Unicode escapes", () => {
      const p1 = peg.generate("bee = '\\u{1F41D}'");
      expect(p1).to.parse("\u{1F41D}");
      expect(p1).to.failToParse("\u{1F41E}");
      expect(() => peg.generate("bad = '\\u{11ffff}'")).to.throw("Invalid Unicode codepoint: U+11ffff");
      const p2 = peg.generate("om = '\\u{0F00}'");
      expect(p2).to.parse("\u0F00");
      // This is no worse an idea than \u0061 = 'a', which currently works:
      const p3 = peg.generate("\\u{61} = 'a'");
      expect(p3).to.parse("a");
      // OLD HUNGARIAN SMALL LETTER A
      const p4 = peg.generate("\u{10cc0} = 'b'");
      expect(p4).to.parse("b");
    });
  });
  describe("syntax errors", () => {
    it("formats", () => {
      const source = { source: "stdin",  text: "===" };
      try {
        peg.generate(source.text, { grammarSource: source.source });
      } catch (er) {
        expect(er).to.be.an.instanceof(peg.parser.SyntaxError);
        expect(er.format([source])).to.equal(`\
Error: Expected "{", code block, comment, end of line, identifier, or whitespace but "=" found.
 --> stdin:1:1
  |
1 | ===
  | ^`);
      }

      try {
        peg.generate("===", { grammarSource: "stdin" });
      } catch (er) {
        expect(er).to.be.an.instanceof(peg.parser.SyntaxError);
        expect(er.format([])).to.equal(`\
Error: Expected "{", code block, comment, end of line, identifier, or whitespace but "=" found.
 at stdin:1:1`);
      }
    });

    it("reports multiple errors in each compilation stage", () => {
      try {
        peg.generate(`
          start = leftRecursion
          leftRecursion = duplicatedLabel:duplicatedRule duplicatedLabel:missingRule
          duplicatedRule = missingRule
          duplicatedRule = start
        `);
      } catch (e) {
        expect(e).with.property("stage", "check");
        expect(e).with.property("problems").to.be.an("array");

        // Check that each problem is an array with at least two members and the first is a severity
        e.problems.forEach(problem => {
          expect(problem).to.be.an("array").lengthOf.gte(2);
          expect(problem[0]).to.be.oneOf(["error", "warning", "info"]);
        });

        // Get second elements of errors (error messages)
        const messages = e.problems.filter(p => p[0] === "error").map(p => p[1]);

        // Check that all messages present in the list
        expect(messages).to.include.members([
          "Rule \"missingRule\" is not defined",
          "Rule \"duplicatedRule\" is already defined",
          "Label \"duplicatedLabel\" is already defined",
          "Possible infinite loop when parsing (left recursion: duplicatedRule -> start -> leftRecursion -> duplicatedRule)",
        ]);
      }
    });
  });
});
