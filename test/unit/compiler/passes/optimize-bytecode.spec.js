// @ts-check
"use strict";

const chai = require("chai");
// X const { TypeTag, InterpState } = require("../../../../lib/compiler/interp-state");
const op = require("../../../../lib/compiler/opcodes");
const { optimizeBlock } = require("../../../../lib/compiler/passes/optimize-bytecode");
const { InterpState } = require("../../../../lib/compiler/interp-state");

const expect = chai.expect;

/**
 * @typedef {[number, FormattedBytecode, FormattedBytecode]} Cond0Element
 * @typedef {[number, number, FormattedBytecode, FormattedBytecode]} Cond1Element
 * @typedef {[number, FormattedBytecode]} LoopElement
 * @typedef {number[]|Cond0Element|Cond1Element|LoopElement} FormattedElement
 * @typedef {FormattedElement[]} FormattedBytecode
 */

/**
 *
 * @param {FormattedBytecode} fbc
 * @returns {number[]}
 */
function flattenBc(fbc) {
  /** @type {number[]} */
  const result = [];
  fbc.forEach(e => {
    for (let i = 0; i < e.length; i++) {
      const x = e[i];
      if (Array.isArray(x)) {
        const bodies = e.slice(i).map(b => {
          if (!Array.isArray(b)) {
            throw new Error(
              "Incorrect formatted bytecode. Expected an Array"
            );
          }
          return flattenBc(b);
        });
        if (bodies.length === 1) {
          if (e[0] !== op.WHILE_NOT_ERROR) {
            throw new Error(
              `Incorrect formatted bytecode. Expected '${
                op.WHILE_NOT_ERROR
              }', but got ${e[0]}`
            );
          }
        } else {
          const args = InterpState.getConditionalArgCount(e[0]);
          if (i !== args + 1) {
            throw new Error(
              `Incorrect formatted bytecode. Expected ${
                args
              } arguments for ${e[0]}, but got ${bodies.length}`
            );
          }
          if (bodies.length !== 2) {
            throw new Error(
              `Incorrect formatted bytecode. Expected 2 bodies for ${
                e[0]
              }, but got ${bodies.length}`
            );
          }
        }
        bodies.forEach(b => result.push(b.length));
        bodies.forEach(b => result.push(...b));
        break;
      }
      result.push(x);
    }
  });
  return result;
}

describe("compiler pass |optimizeBytecode|", () => {
  describe("combine consecutive ifs", () => {
    it("conditional => op.IF no swap", () => {
      expect(optimizeBlock(flattenBc([
        [
          op.MATCH_CHAR_CLASS, 0, [
            [op.PUSH_EMPTY_ARRAY],
          ], [
            [op.PUSH_NULL],
          ],
        ],
        [
          op.IF, [
            [op.ACCEPT_N, 1],
          ], [
            [op.FAIL, 0],
          ],
        ],
      ]), "combine-with-IF")).to.deep.equal(flattenBc([
        [
          op.MATCH_CHAR_CLASS, 0, [
            [op.PUSH_EMPTY_ARRAY],
            [op.ACCEPT_N, 1],
          ], [
            [op.PUSH_NULL],
            [op.FAIL, 0],
          ],
        ],
      ]));
    });
    it("conditional => op.IF swapped", () => {
      expect(optimizeBlock(flattenBc([
        [
          op.MATCH_CHAR_CLASS, 0, [
            [op.PUSH_NULL],
          ], [
            [op.PUSH_EMPTY_ARRAY],
          ],
        ],
        [
          op.IF, [
            [op.ACCEPT_N, 1],
          ], [
            [op.FAIL, 0],
          ],
        ],
      ]), "combine-with-IF")).to.deep.equal(flattenBc([
        [
          op.MATCH_CHAR_CLASS, 0, [
            [op.PUSH_NULL],
            [op.FAIL, 0],
          ], [
            [op.PUSH_EMPTY_ARRAY],
            [op.ACCEPT_N, 1],
          ],
        ],
      ]));
    });

    it("conditional => op.IF_ERROR no swap", () => {
      expect(optimizeBlock(flattenBc([
        [
          op.MATCH_STRING, 0, [
            [op.PUSH_FAILED],
          ], [
            [op.PUSH_NULL],
          ],
        ],
        [
          op.IF_ERROR, [
            [op.ACCEPT_N, 1],
          ], [
            [op.FAIL, 0],
          ],
        ],
      ]), "combine-with-IF_ERROR")).to.deep.equal(flattenBc([
        [
          op.MATCH_STRING, 0, [
            [op.PUSH_FAILED],
            [op.ACCEPT_N, 1],
          ], [
            [op.PUSH_NULL],
            [op.FAIL, 0],
          ],
        ],
      ]));
    });
    it("conditional => op.IF_ERROR swapped", () => {
      expect(optimizeBlock(flattenBc([
        [
          op.MATCH_STRING, 0, [
            [op.PUSH_NULL],
          ], [
            [op.PUSH_FAILED],
          ],
        ],
        [
          op.IF_ERROR, [
            [op.ACCEPT_N, 1],
          ], [
            [op.FAIL, 0],
          ],
        ],
      ]), "combine-with-IF_ERROR")).to.deep.equal(flattenBc([
        [
          op.MATCH_STRING, 0, [
            [op.PUSH_NULL],
            [op.FAIL, 0],
          ], [
            [op.PUSH_FAILED],
            [op.ACCEPT_N, 1],
          ],
        ],
      ]));
    });

    it("conditional => op.IF_NOT_ERROR no swap", () => {
      expect(optimizeBlock(flattenBc([
        [
          op.MATCH_STRING_IC, 0, [
            [op.PUSH_FAILED],
          ], [
            [op.PUSH_NULL],
          ],
        ],
        [
          op.IF_NOT_ERROR, [
            [op.ACCEPT_N, 1],
          ], [
            [op.FAIL, 0],
          ],
        ],
      ]), "combine-with-IF_NOT_ERROR")).to.deep.equal(flattenBc([
        [
          op.MATCH_STRING_IC, 0, [
            [op.PUSH_FAILED],
            [op.FAIL, 0],
          ], [
            [op.PUSH_NULL],
            [op.ACCEPT_N, 1],
          ],
        ],
      ]));
    });
    it("conditional => op.IF_NOT_ERROR swapped", () => {
      expect(optimizeBlock(flattenBc([
        [
          op.MATCH_STRING_IC, 0, [
            [op.PUSH_NULL],
          ], [
            [op.PUSH_FAILED],
          ],
        ],
        [
          op.IF_NOT_ERROR, [
            [op.ACCEPT_N, 1],
          ], [
            [op.FAIL, 0],
          ],
        ],
      ]), "combine-with-IF_NOT_ERROR")).to.deep.equal(flattenBc([
        [
          op.MATCH_STRING_IC, 0, [
            [op.PUSH_NULL],
            [op.ACCEPT_N, 1],
          ], [
            [op.PUSH_FAILED],
            [op.FAIL, 0],
          ],
        ],
      ]));
    });
  });
  describe("Optimize FAIL opcodes", () => {
    it("to PUSH_FAILURE when SILENT_FAILS is on", () => {
      expect(optimizeBlock([
        op.SILENT_FAILS_ON,
        op.FAIL, 1,
        op.SILENT_FAILS_OFF,
      ], "fail-in-silent").includes(op.PUSH_FAILED)).to.equal(true);
    });
    it("to NOP when discarded and SILENT_FAILS is on", () => {
      expect(optimizeBlock([
        op.SILENT_FAILS_ON,
        op.FAIL, 1,
        op.POP,
        op.SILENT_FAILS_OFF,
      ], "dead-fail-in-silent").length).to.be.lessThanOrEqual(2);
    });
  });
  describe("Optimize PUSH/POP pairs", () => {
    it("with separate POPs", () => {
      expect(optimizeBlock([
        op.PUSH_NULL,
        op.PUSH_UNDEFINED,
        op.PUSH_EMPTY_ARRAY,
        op.PUSH_EMPTY_STRING,
        op.POP,
        op.POP,
        op.POP,
        op.POP,
      ], "dead-push-pops")).to.deep.equal([]);
    });
    it("with POP_N", () => {
      expect(optimizeBlock([
        op.PUSH_NULL,
        op.PUSH_UNDEFINED,
        op.PUSH_EMPTY_ARRAY,
        op.PUSH_EMPTY_STRING,
        op.POP_N, 4,
      ], "dead-push-pops")).to.deep.equal([]);
    });
  });
  describe("kill useless POP_CURR_POS", () => {
    it("when currPos is unchanged", () => {
      expect(optimizeBlock([
        op.PUSH_CURR_POS,
        op.FAIL, 1,
        op.POP,
        op.POP_CURR_POS,
      ], "unchanged-curr-pos").includes(op.POP_CURR_POS)).to.equal(false);
    });
    it("when currPos subsequently killed", () => {
      expect(optimizeBlock([
        op.PUSH_CURR_POS,
        op.ACCEPT_N, 1,
        op.PUSH_CURR_POS,
        op.ACCEPT_N, 1,
        op.PUSH_CURR_POS,
        op.ACCEPT_N, 1,
        op.POP,
        op.POP_CURR_POS,
        op.FAIL, 1,
        op.POP,
        op.POP,
        op.POP_CURR_POS,
        op.POP,
        op.POP_CURR_POS,
      ], "unchanged-curr-pos").filter(
        b => b === op.POP_CURR_POS
      ).length).to.equal(1);
    });
  });
  describe("WHILE_NOT_FAILED", () => {
    it("is removed when always fails", () => {
      expect(optimizeBlock(flattenBc([
        [op.PUSH_FAILED],
        [op.WHILE_NOT_ERROR, [
          [op.POP],
          [op.ACCEPT_N, 1],
        ]],
        [op.POP],
      ]), "dead-while-loop")).to.deep.equal([]);
    });
    it("is hoisted when one if branch always fails", () => {
      expect(optimizeBlock(flattenBc([
        [
          op.MATCH_STRING_IC, 0, [
            [op.ACCEPT_N, 1],
          ], [
            [op.PUSH_FAILED],
          ],
        ],
        [op.WHILE_NOT_ERROR, [
          [op.POP],
          [
            op.MATCH_STRING_IC, 0, [
              [op.ACCEPT_N, 1],
            ], [
              [op.PUSH_FAILED],
            ],
          ],
        ]],
        [op.POP],
      ]), "hoisted-while-loop")).to.deep.equal(flattenBc([
        [
          op.MATCH_STRING_IC, 0, [
            [op.ACCEPT_N, 1],
            [op.WHILE_NOT_ERROR, [
              [op.POP],
              [
                op.MATCH_STRING_IC, 0, [
                  [op.ACCEPT_N, 1],
                ], [
                  [op.PUSH_FAILED],
                ],
              ],
            ]],
          ], [
            [op.PUSH_FAILED],
          ],
        ],
        [op.POP],
      ]));
    });
  });
  describe("SILENT_FAILS", () => {
    it("are killed when nested", () => {
      expect(optimizeBlock([
        op.SILENT_FAILS_ON,
        op.SILENT_FAILS_ON,
        op.RULE, 1,
        op.SILENT_FAILS_OFF,
        op.SILENT_FAILS_OFF,
      ], "nested-silent")).to.be.deep.equal([
        op.SILENT_FAILS_ON,
        op.RULE, 1,
        op.SILENT_FAILS_OFF,
      ]);
    });
  });
  describe("logging", () => {
    const spy = jest.spyOn(console, "log");
    expect(optimizeBlock([
      op.PUSH_NULL,
      op.POP,
    ], "logging", true)).to.deep.equal([]);
    expect(spy.mock.calls.length).to.be.equal(4);
  });
});
