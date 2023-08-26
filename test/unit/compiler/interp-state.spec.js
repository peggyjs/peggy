// @ts-check
"use strict";

const chai = require("chai");
const { TypeTag, InterpState } = require("../../../lib/compiler/interp-state");
const op = require("../../../lib/compiler/opcodes");

const expect = chai.expect;

describe("class InterpState", () => {
  describe("for an empty stack", () => {
    const state = new InterpState("empty");

    describe("throws an error when attempting", () => {
      it("`POP_CURR_POS`", () => {
        expect(() => state.clone().run([op.POP_CURR_POS])).to.throw(
          RangeError,
          "Rule 'empty': Trying to pop from an empty stack."
        );
      });

      it("`POP`", () => {
        expect(() => state.clone().run([op.POP])).to.throw(
          RangeError,
          "Rule 'empty': Trying to pop 1 elements, but only 0 available."
        );
      });

      it("`POP_N`", () => {
        expect(() => state.clone().run([op.POP_N, 5])).to.throw(
          RangeError,
          "Rule 'empty': Trying to pop 5 elements, but only 0 available."
        );
        expect(() => state.clone().run([op.PUSH_NULL, op.POP_N, 5])).to.throw(
          RangeError,
          "Rule 'empty': Trying to pop 5 elements, but only 1 available."
        );
      });

      it("`WRAP`", () => {
        expect(() => state.clone().run([op.WRAP, 2])).to.throw(
          RangeError,
          "Rule 'empty': Trying to pop 2 elements, but only 0 available."
        );
      });

      it("`PLUCK`", () => {
        expect(() => state.clone().run([op.PLUCK, 3, 1, 2])).to.throw(
          RangeError,
          "Rule 'empty': Trying to inspect element 2 in a stack of size 0"
        );
        expect(
          () => state.clone().run([op.PUSH_NULL, op.PLUCK, 3, 1, 0])
        ).to.throw(
          RangeError,
          "Rule 'empty': Trying to pop 3 elements, but only 1 available."
        );
        expect(
          () => state.clone().run([op.PUSH_NULL, op.PLUCK, -3, 1, 0])
        ).to.throw(
          RangeError,
          "Rule 'empty': Trying to discard -3 elements."
        );
      });

      it("`APPEND`", () => {
        expect(() => state.clone().run([op.PUSH_NULL, op.APPEND, 2])).to.throw(
          RangeError,
          "Rule 'empty': Trying to access the top of an empty stack."
        );
      });

      it("`IF`", () => {
        expect(() => state.clone().run([op.IF])).to.throw(
          RangeError,
          "Rule 'empty': Trying to access the top of an empty stack."
        );
      });
    });
  });

  describe("things that can't happen with correct bytecode", () => {
    const state = new InterpState("rule");
    it("throws an error when attempting to merge inconsistent states", () => {
      const state2 = state.clone();
      state2.run([op.PUSH_NULL]);

      expect(() => state2.merge(state)).to.throw(
        Error,
        "Rule 'rule': Merging states with mis-matched stacks."
      );

      const state3 = state.clone();
      state3.run([op.SILENT_FAILS_ON]);

      expect(() => state3.merge(state)).to.throw(
        Error,
        "Rule 'rule': Merging states with mis-matched silentFails."
      );
    });

    it("throws an error when handling unexpected byte codes", () => {
      expect(
        () => InterpState.getConditionalArgCount(op.PUSH_NULL)
      ).to.throw(
        Error,
        `Expected a conditional bytecode, but got: ${op.PUSH_NULL}.`
      );

      expect(() => state.clone().interp([-1], 0)).to.throw(
        Error,
        "rule: Invalid opcode: -1."
      );
    });

    it("throws when trying to set currPos to an invalid value", () => {
      expect(
        () => state.clone().setCurrPos({ type: TypeTag.NULL })
      ).to.throw(
        Error,
        "Rule 'rule': Invalid value assigned to currPos."
      );
    });

    it("throws when trying to pop an invalid value into currPos", () => {
      expect(
        () => state.clone().run([op.PUSH_NULL, op.POP_CURR_POS])
      ).to.throw(
        Error,
        "Rule 'rule': Invalid value assigned to currPos."
      );
    });

    it("APPEND gets an ARRAY", () => {
      expect(() => state.clone().run(
        [op.PUSH_NULL, op.PUSH_EMPTY_STRING, op.APPEND]
      )).to.throw(
        Error,
        "Rule 'rule': Attempting to append to a non-array."
      );
    });

    it("TEXT gets an OFFSET", () => {
      expect(() => state.clone().run(
        [op.PUSH_NULL, op.TEXT]
      )).to.throw(
        Error,
        `Rule 'rule': TEXT bytecode got an incorrect type: ${TypeTag.NULL}.`
      );
    });

    it("IF thats always true and always false throws", () => {
      jest.spyOn(InterpState, "mustBeTrue").mockReturnValue(true);
      jest.spyOn(InterpState, "mustBeFalse").mockReturnValue(true);
      expect(
        () => state.clone().run([op.PUSH_NULL, op.IF, 1, 1, op.POP, op.POP])
      ).to.throw(
        Error,
        "Rule 'rule': Conditional cannot be both always true and always false."
      );
      jest.resetAllMocks();
    });
  });

  describe("consistency", () => {
    it("keeps track of currPos", () => {
      const state = new InterpState("rule");
      expect(state.currPos.value).to.not.equal(undefined);

      let state2 = state.clone();
      expect(state2.currPos.value).to.equal(state.currPos.value);
      state2.run([op.ACCEPT_N, 0]);
      expect(state2.currPos.value).to.not.equal(state.currPos.value);

      state2 = state.clone();
      state2.run([op.RULE, 0]);
      expect(state2.currPos.value).to.not.equal(state.currPos.value);

      state2 = state.clone();
      state2.run([op.CALL, 0, 0]);
      expect(state2.currPos.value).to.not.equal(state.currPos.value);

      state2 = state.clone();
      state2.postInterp = function(bc, ip, result) {
        if (bc[ip] === op.ACCEPT_N) {
          expect(this.currPos.value).to.not.equal(state.currPos.value);
        } else if (bc[ip] === op.FAIL) {
          expect(this.currPos.value).to.equal(state.currPos.value);
        }
        return result;
      };
      state2.run([op.MATCH_STRING, 1, 2, 2, op.ACCEPT_N, 0, op.FAIL, 0]);
      expect(state2.currPos.value).to.not.equal(state.currPos.value);
    });

    it("getConditionalArgCount", () => {
      expect(InterpState.getConditionalArgCount(op.IF_GE)).to.equal(1);
    });
  });

  describe("transformation", () => {
    const state = new InterpState("rule");
    it("reduces always true ifs to then clause", () => {
      expect(state.clone().run([
        op.PUSH_EMPTY_ARRAY,
        op.IF, 2, 2,
        /* */ op.ACCEPT_N, 1,
        /* */ op.FAIL, 1,
      ])).to.deep.equal([op.PUSH_EMPTY_ARRAY, op.ACCEPT_N, 1]);
      expect(state.clone().run([
        op.PUSH_FAILED,
        op.IF_ERROR, 2, 2,
        /* */ op.ACCEPT_N, 1,
        /* */ op.FAIL, 1,
      ])).to.deep.equal([op.PUSH_FAILED, op.ACCEPT_N, 1]);
      expect(state.clone().run([
        op.PUSH_NULL,
        op.IF_NOT_ERROR, 2, 2,
        /* */ op.ACCEPT_N, 1,
        /* */ op.FAIL, 1,
      ])).to.deep.equal([op.PUSH_NULL, op.ACCEPT_N, 1]);
    });
    it("reduces always false ifs to else clause", () => {
      expect(state.clone().run([
        op.PUSH_NULL,
        op.IF, 2, 2,
        /* */ op.ACCEPT_N, 1,
        /* */ op.FAIL, 1,
      ])).to.deep.equal([op.PUSH_NULL, op.FAIL, 1]);
      expect(state.clone().run([
        op.PUSH_NULL,
        op.IF_ERROR, 2, 2,
        /* */ op.ACCEPT_N, 1,
        /* */ op.FAIL, 1,
      ])).to.deep.equal([op.PUSH_NULL, op.FAIL, 1]);
      expect(state.clone().run([
        op.PUSH_FAILED,
        op.IF_NOT_ERROR, 2, 2,
        /* */ op.ACCEPT_N, 1,
        /* */ op.FAIL, 1,
      ])).to.deep.equal([op.PUSH_FAILED, op.FAIL, 1]);
    });

    it("removes never executed loops", () => {
      expect(state.clone().run([
        op.PUSH_FAILED,
        op.WHILE_NOT_ERROR, 2,
        /* */ op.POP,
        /* */ op.PUSH_NULL,
      ])).to.deep.equal([op.PUSH_FAILED]);
    });

    it("iterates to convergence before modifying code", () => {
      expect(state.clone().run([
        op.PUSH_NULL,
        op.WHILE_NOT_ERROR, 7,
        /* */ op.IF, 2, 2,
        /*   */ op.POP, op.PUSH_FAILED,
        /*   */ op.POP, op.PUSH_EMPTY_ARRAY,
      ])).to.equal(null);
    });
  });

  describe("code coverage", () => {
    it("prints bytecode", () => {
      expect(InterpState.print([
        op.MATCH_CHAR_CLASS, 0, 2, 2,
        /* */ op.ACCEPT_N, 1,
        /* */ op.FAIL, 1,
      ], "test")
        .replace(/stack:.*/g, "")
        .replace(/\s+/g, " ")
        .trim()).to.equal(
        "MATCH_CHAR_CLASS ACCEPT_N -- FAIL --"
      );
    });

    it("source mapping bytecodes", () => {
      const state = new InterpState("rule");
      expect(state.run([
        op.SOURCE_MAP_PUSH, 0,
        op.SOURCE_MAP_POP,
        op.SOURCE_MAP_LABEL_PUSH, 0, 0, 0,
        op.SOURCE_MAP_LABEL_POP,
      ])).to.equal(null);
    });

    it("equality tests", () => {
      // These are never hit in practice because we're comparing the result of a
      // state with a merged state, and merge would have thrown
      const state = new InterpState("rule");
      const s2 = state.clone();
      s2.silentFails++;
      expect(state.equal(s2)).to.be.equal(false);
      s2.silentFails--;
      s2.push({ type: TypeTag.NULL });
      expect(state.equal(s2)).to.be.equal(false);
      s2.pop();
      expect(state.equal(s2)).to.be.equal(true);
    });
  });
});
