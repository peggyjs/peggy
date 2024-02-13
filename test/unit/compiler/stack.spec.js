"use strict";

const chai = require("chai");
const Stack = require("../../../lib/compiler/stack");

const expect = chai.expect;

describe("utility class Stack", () => {
  describe("for an empty stack", () => {
    let stack = undefined;

    beforeEach(() => { stack = new Stack("rule", "v", "let", [42]); });

    describe("throws an error when attempting", () => {
      it("`pop`", () => {
        expect(() => stack.pop()).to.throw(
          RangeError,
          "Rule 'rule': The variable stack underflow: attempt to use a variable 'v<x>' at an index -1.\nBytecode: 42"
        );
      });

      it("`top`", () => {
        expect(() => stack.top()).to.throw(
          RangeError,
          "Rule 'rule': The variable stack underflow: attempt to use a variable 'v<x>' at an index -1.\nBytecode: 42"
        );
      });

      it("`result`", () => {
        expect(() => stack.result()).to.throw(
          RangeError,
          "Rule 'rule': The variable stack is empty, can't get the result"
        );
      });

      it("`index`", () => {
        expect(() => stack.index(-2)).to.throw(
          RangeError,
          "Rule 'rule': The variable stack overflow: attempt to get a variable at a negative index -2.\nBytecode: 42"
        );
        expect(() => stack.index(0)).to.throw(
          RangeError,
          "Rule 'rule': The variable stack underflow: attempt to use a variable 'v<x>' at an index -1.\nBytecode: 42"
        );
        expect(() => stack.index(2)).to.throw(
          RangeError,
          "Rule 'rule': The variable stack underflow: attempt to use a variable 'v<x>' at an index -3.\nBytecode: 42"
        );
      });

      it("`sourceMapPop`", () => {
        expect(() => stack.sourceMapPop()).to.throw(
          RangeError,
          "Rule 'rule': Attempting to pop an empty source map stack.\nBytecode: 42"
        );
      });
    });

    it("`defines` returns an empty string", () => {
      expect(stack.defines()).to.equal("");
    });
  });

  it("throws an error when attempting `pop` more than `push`", () => {
    const stack = new Stack("rule", "v", "let", [42]);

    stack.push("1");

    expect(() => stack.pop(3)).to.throw(
      RangeError,
      "Rule 'rule': The variable stack underflow: attempt to use a variable 'v<x>' at an index -2.\nBytecode: 42"
    );
  });

  it("returns a variable with an index 0 for `result`", () => {
    const stack = new Stack("rule", "v", "let", []);

    stack.push("1");

    expect(stack.result()).to.equal("v0");
  });

  it("`defines` returns a define expression for all used variables", () => {
    const stack = new Stack("rule", "v", "let", []);

    stack.push("1");
    stack.push("2");
    stack.pop();
    stack.push("3");

    expect(stack.defines()).to.equal("let v0, v1;");
  });

  describe("`checkedIf` method", () => {
    let stack = undefined;

    beforeEach(() => {
      stack = new Stack("rule", "v", "let", [42]);
      stack.push("1");
    });

    describe("does not throws an error", () => {
      it("without the else brach", () => {
        expect(() => stack.checkedIf(0, () => { /* Lint */ })).to.not.throw();
        expect(() => stack.checkedIf(0, () => stack.pop())).to.not.throw();
        expect(() => stack.checkedIf(0, () => stack.push("2"))).to.not.throw();
      });

      describe("when the stack pointer", () => {
        it("was not moving in both the arms", () => {
          function fn1() { /* Lint */ }
          function fn2() {
            stack.push("1");
            stack.pop();
          }
          function fn3() {
            stack.push("1");
            stack.push("2");
            stack.pop(2);
          }
          function fn4() {
            stack.push("1");
            stack.pop();
            stack.push("2");
            stack.pop();
          }

          expect(() => stack.checkedIf(0, fn1, fn1)).to.not.throw();
          expect(() => stack.checkedIf(0, fn2, fn2)).to.not.throw();
          expect(() => stack.checkedIf(0, fn3, fn3)).to.not.throw();
          expect(() => stack.checkedIf(0, fn4, fn4)).to.not.throw();
        });

        it("increases on the same value in both the arms", () => {
          expect(() => stack.checkedIf(
            0,
            () => stack.push("1"),
            () => stack.push("2")
          )).to.not.throw();
        });

        it("decreases on the same value in both the arms", () => {
          stack.push("2");

          expect(() => stack.checkedIf(
            0,
            () => stack.pop(2),
            () => { stack.pop(); stack.pop(); }
          )).to.not.throw();
        });
      });
    });

    describe("throws an error when the stack pointer", () => {
      it("was not moving in `if` and decreases in `then`", () => {
        expect(() => {
          stack.checkedIf(0, () => { /* Lint */ }, () => stack.pop());
        }).to.throw(
          Error,
          "Rule 'rule', position 0: "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: 0, after else: -1). "
          + "Bytecode: 42"
        );
      });
      it("decreases in `if` and was not moving in `then`", () => {
        expect(() => {
          stack.checkedIf(0, () => stack.pop(), () => { /* Lint */ });
        }).to.throw(
          Error,
          "Rule 'rule', position 0: "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: -1, after else: 0). "
          + "Bytecode: 42"
        );
      });

      it("was not moving in `if` and increases in `then`", () => {
        expect(() => {
          stack.checkedIf(0, () => { /* Lint */ }, () => stack.push("2"));
        }).to.throw(
          Error,
          "Rule 'rule', position 0: "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: 0, after else: 1). "
          + "Bytecode: 42"
        );
      });
      it("increases in `if` and was not moving in `then`", () => {
        expect(() => {
          stack.checkedIf(0, () => stack.push("2"), () => { /* Lint */ });
        }).to.throw(
          Error,
          "Rule 'rule', position 0: "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: 1, after else: 0). "
          + "Bytecode: 42"
        );
      });

      it("decreases in `if` and increases in `then`", () => {
        expect(() => {
          stack.checkedIf(0, () => stack.pop(), () => stack.push("2"));
        }).to.throw(
          Error,
          "Rule 'rule', position 0: "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: -1, after else: 1). "
          + "Bytecode: 42"
        );
      });
      it("increases in `if` and decreases in `then`", () => {
        expect(() => {
          stack.checkedIf(0, () => stack.push("2"), () => stack.pop());
        }).to.throw(
          Error,
          "Rule 'rule', position 0: "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: 1, after else: -1). "
          + "Bytecode: 42"
        );
      });
    });
  });

  describe("`checkedLoop` method", () => {
    let stack = undefined;

    beforeEach(() => {
      stack = new Stack("rule", "v", "let", [42]);
      stack.push("1");
    });

    it("does not throws an error when the stack pointer was not moving", () => {
      function fn1() { /* Lint */ }
      function fn2() {
        stack.push("1");
        stack.pop();
      }
      function fn3() {
        stack.push("1");
        stack.push("2");
        stack.pop(2);
      }
      function fn4() {
        stack.push("1");
        stack.pop();
        stack.push("2");
        stack.pop();
      }

      expect(() => stack.checkedLoop(0, fn1)).to.not.throw();
      expect(() => stack.checkedLoop(0, fn2)).to.not.throw();
      expect(() => stack.checkedLoop(0, fn3)).to.not.throw();
      expect(() => stack.checkedLoop(0, fn4)).to.not.throw();
    });

    it("throws an error when the stack pointer increases", () => {
      expect(() => stack.checkedLoop(0, () => stack.push("1"))).to.throw(
        Error,
        "Rule 'rule', position 0: "
        + "Body of a loop can't move the stack pointer "
        + "(before: 0, after: 1). "
        + "Bytecode: 42"
      );
    });

    it("throws an error when the stack pointer decreases", () => {
      expect(() => stack.checkedLoop(0, () => stack.pop())).to.throw(
        Error,
        "Rule 'rule', position 0: "
        + "Body of a loop can't move the stack pointer "
        + "(before: 0, after: -1). "
        + "Bytecode: 42"
      );
    });
  });

  describe("SourceNode handling", () => {
    it("sourceNode handles unknown column", () => {
      expect(Stack.sourceNode({
        source: "",
        start: { line:1, column:0, offset:0 },
        end: { line:1, column:0, offset:0 },
      }, ["foo"], "test").column).to.equal(null);
    });
  });
});
