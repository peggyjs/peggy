// @ts-check
"use strict";

const op = require("../opcodes");
const { InterpState, TypeTag } = require("../interp-state");

/**
 * @typedef {import("../../peg")} PEG
 */

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

  /**
   *
   * @param {PEG.ast.Rule} rule
   */
  function optimize(rule) {
    if (!rule.bytecode) {
      return;
    }
    const state = new InterpState(rule.name);
    state.postInterp = function(bc, ip, result) {
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
    };
    const bc = state.run(rule.bytecode);
    if (bc) {
      rule.bytecode = bc;
    }
  }

  ast.rules.forEach(rule => {
    optimize(rule);
  });
}

module.exports = optimizeBytecode;
