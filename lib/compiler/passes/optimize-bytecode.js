// @ts-check
"use strict";

const op = require("../opcodes");
const { InterpState, TypeTag } = require("../interp-state");

/** @type {boolean|string} */
const logging = false;

/**
 * @typedef {import("../../peg")} PEG
 * @typedef {import("../interp-state").InterpResult} InterpResult
 */

/**
 *
 * @this {InterpState}
 * @param {number[]} bc
 * @param {number} ip
 * @param {InterpResult} result
 * @returns {InterpResult}
 */
function postInterp(bc, ip, result) {
  switch (bc[ip]) {
    case op.FAIL:
      if (!this.silentFails) {
        break;
      }
    // Fallthrough
    case op.PUSH_EMPTY_ARRAY:
    case op.PUSH_EMPTY_STRING:
    case op.PUSH_FAILED:
    case op.PUSH_NULL:
    case op.PUSH_UNDEFINED: {
      const next = bc[result.ip];
      if (next === op.POP || next === op.POP_N) {
        const npops = next === op.POP_N ? bc[result.ip + 1] : 1;
        const replacements = [];
        if (npops > 1) {
          replacements.push(
            ...(npops > 2 ? [op.POP_N, npops - 1] : [op.POP])
          );
        }
        result.ip += next === op.POP_N ? 2 : 1;
        result.bytecodeMods = {
          startOffset: ip,
          length: result.ip - ip,
          replacements,
        };
        this.discard(npops);
      } else if (bc[ip] === op.FAIL) {
        result.bytecodeMods = {
          startOffset: ip,
          length: result.ip - ip,
          replacements: [op.PUSH_FAILED],
        };
      }
      return result;
    }
    case op.POP_CURR_POS: {
      if (InterpState.killsCurrPos(bc, result.ip)) {
        result.bytecodeMods = {
          startOffset: ip,
          length: result.ip - ip,
          replacements: [op.POP],
        };
      }
      return result;
    }
    case op.SILENT_FAILS_ON:
      if (this.silentFails > 1) {
        result.bytecodeMods = {
          startOffset: ip,
          length: 1,
          replacements: [],
        };
      }
      break;
    case op.SILENT_FAILS_OFF:
      if (this.silentFails) {
        result.bytecodeMods = {
          startOffset: ip,
          length: 1,
          replacements: [],
        };
      }
      break;

    default:
      break;
  }
  if (result.thenState
        && result.elseState
        && result.ip !== undefined
        && result.thenState.stack.length === result.elseState.stack.length) {
    let swap = null;
    switch (bc[result.ip]) {
      case op.IF_ERROR:
      case op.IF_NOT_ERROR: {
        const thenType = result.thenState.top();
        const elseType = result.elseState.top();
        if (InterpState.mustBe(elseType, TypeTag.FAILED)
              && !InterpState.couldBe(
                thenType, TypeTag.FAILED
              )) {
          swap = bc[result.ip] === op.IF_ERROR;
        } else if (InterpState.mustBe(thenType, TypeTag.FAILED)
              && !InterpState.couldBe(elseType, TypeTag.FAILED)) {
          swap = bc[result.ip] === op.IF_NOT_ERROR;
        }
        break;
      }
      case op.IF: {
        const thenType = result.thenState.top();
        const elseType = result.elseState.top();
        if (InterpState.mustBeTrue(thenType)
              && InterpState.mustBeFalse(elseType)) {
          swap = false;
        } else if (InterpState.mustBeTrue(elseType)
              && InterpState.mustBeFalse(thenType)) {
          swap = true;
        }
        break;
      }
      case op.WHILE_NOT_ERROR: {
        // If one branch of the if/else is guaranteed to result in
        // FAILED, we can pull the while into the other branch.
        const thenType = result.thenState.top();
        const elseType = result.elseState.top();
        if (InterpState.mustBe(elseType, TypeTag.FAILED)) {
          swap = false;
        } else if (InterpState.mustBe(thenType, TypeTag.FAILED)) {
          swap = true;
        }
        break;
      }
      default:
        break;
    }
    if (swap !== null) {
      const [thenCode, elseCode, length]
          = InterpState.getConditionalCode(bc, result.ip);
      const argCount = InterpState.getConditionalArgCount(bc[ip]);
      const baseLength = 3 + argCount;
      const thenLength = bc[ip + baseLength - 2];
      const replacements = bc.slice(ip, result.ip);
      const bytecodeMods = {
        startOffset: ip,
        length: result.ip - ip + length,
        replacements,
      };
      let [t, e] = swap ? [elseCode, thenCode] : [thenCode, elseCode];
      t = result.thenState.run(t) || t;
      e = result.elseState.run(e) || e;
      replacements.splice(baseLength + thenLength, 0, ...t);
      replacements.push(...e);
      replacements[baseLength - 2] += t.length;
      replacements[baseLength - 1] += e.length;
      result.bytecodeMods = bytecodeMods;
      result.ip += length;
      this.copy(result.thenState);
      this.merge(result.elseState);
    }
  }
  return result;
}

/**
 *
 * @this {InterpState}
 * @param {number[]} bc
 * @param {number} ip
 * @returns {InterpResult | null}
 */
function preInterp(bc, ip) {
  switch (bc[ip]) {
    case op.POP_CURR_POS: {
      const top = this.top();
      if (top.type === TypeTag.OFFSET
            && top.value
            && top.value === this.currPos.value) {
        this.pop();
        return {
          ip: ip + 1,
          bytecodeMods: {
            startOffset: ip,
            length: 1,
            replacements: [op.POP],
          },
        };
      }
      break;
    }
    default:
      break;
  }
  return null;
}

/**
 *
 * @param {number[]} bytecode - The bytecode to optimize
 * @param {string}   name - Name for error reporting purposes
 * @param {boolean}  [log] - Whether to report changes to the bytecode
 * @returns {number[]}
 */
function optimizeBlock(bytecode, name, log) {
  const dolog = log || logging;
  for (;;) {
    const state = new InterpState(name);
    state.postInterp = postInterp;
    state.preInterp = preInterp;
    const bc = state.run(bytecode);
    if (!bc) {
      break;
    }
    if (dolog === true || dolog === name) {
      console.log("Before >>>");
      console.log(InterpState.print(bytecode, name));
      console.log("After >>>");
      console.log(InterpState.print(bc, name));
    }
    bytecode = bc;
  }
  return bytecode;
}

/**
 * Optimizes the bytecode.
 *
 * @param {PEG.ast.Grammar} ast
 * @param {PEG.SourceBuildOptions<PEG.SourceOutputs>} options
 */
function optimizeBytecode(ast, options) {
  if (options.output === "source-and-map"
      || options.output === "source-with-inline-map") {
    // The optimizations are not very effective with source maps
    // turned on, and any optimizations are likely to make the
    // source mapping worse.
    return;
  }

  ast.rules.forEach(rule => {
    if (rule.bytecode) {
      rule.bytecode = optimizeBlock(rule.bytecode, rule.name);
    }
  });
}

module.exports = {
  optimizeBytecode,
  optimizeBlock,
};
