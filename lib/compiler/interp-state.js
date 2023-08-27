// @ts-check
"use strict";

const op = require("./opcodes");

const TypeTag = {
  UNDEFINED: 0b0000001,
  NULL:      0b0000010,
  FAILED:    0b0000100,
  OFFSET:    0b0001000,
  ARRAY:     0b0010000,
  STRING:    0b0100000,
  ANY:       0b1111111,
};

/**
 * A synthetic type, representing values in the interpreter.
 * @typedef {object}        InterpType
 * @property {number}       type
 * @property {string | {}}  [value]
 */

/**
 * A description of modifications to be made to the bytecode
 * @typedef {object}        BytecodeMods
 * @property {number}       startOffset
 * @property {number}       length
 * @property {number[]}     replacements
 */

/**
 * Description of the effects of an interp step
 * @typedef {object}        InterpResult
 * @property {number}       ip - the next bytecode offset
 *      were made without changing the state.
 * @property {InterpState}  [thenState]
 *    - for conditionals, the state at the end of the then block
 * @property {InterpState}  [elseState]
 *    - for conditionals, the state at the end of the else block
 * @property {BytecodeMods | null} [bytecodeMods]
 *    - any modificationss requested by this step.
 */

/**
 * @callback PreInterp
 * @param {number[]}        bc
 * @param {number}          ip
 * @returns {InterpResult | null}
 */

/**
 * @callback PostInterp
 * @param {number[]}        bc
 * @param {number}          ip
 * @param {InterpResult}    result
 * @returns {InterpResult}
 */

/**
 * @callback PreRun
 * @param {number[]}        bc
 */

/**
 * @callback PostRun
 * @param {number[]}        bc
 */

/**
 * @callback InterpCondCallback
 * @param {InterpType}      top
 * @param {boolean}         forThen
 * @returns {[boolean, InterpType]}
 */

class InterpState {
  /**
   * Constructs a helper for tracking the state in the bytecode for the purposes
   * of optimizing it.
   *
   * @param {string} ruleName The name of rule that will be used in error messages
   */
  constructor(ruleName) {
    this.ruleName       = ruleName;
    /** @type {PreInterp | null} */
    this.preInterp      = null;
    /** @type {PostInterp | null} */
    this.postInterp     = null;
    /** @type {PreRun | null} */
    this.preRun         = null;
    /** @type {PostRun | null} */
    this.postRun        = null;
    this.looping        = 0;

    /**
     * Symbolic stack.
     * @type {InterpType[]}
     */
    this.stack          = [];
    /** @type {InterpType} */
    this.currPos        = { type: TypeTag.OFFSET, value: {} };
    this.silentFails    = 0;
  }

  /**
   * Make this a copy of from
   *
   * @param {InterpState} from
   */
  copy(from) {
    this.stack = from.stack.slice();
    this.currPos = from.currPos;
    this.silentFails = from.silentFails;
    this.looping = from.looping;
    this.preInterp = from.preInterp;
    this.postInterp = from.postInterp;
    this.preRun = from.preRun;
    this.postRun = from.postRun;
  }

  /**
   * Clone this.
   *
   * @returns InterpState
   */
  clone() {
    const clone = new InterpState(this.ruleName);
    clone.copy(this);
    return clone;
  }

  /**
   * Merge from into this (at a join point)
   *
   * @param {InterpState} from
   */
  merge(from) {
    if (this.stack.length !== from.stack.length) {
      throw new Error(
        `Rule '${this.ruleName}': Merging states with mis-matched stacks.`
      );
    }
    if (this.silentFails !== from.silentFails) {
      throw new Error(
        `Rule '${this.ruleName}': Merging states with mis-matched silentFails.`
      );
    }
    for (let i = this.stack.length; i--;) {
      this.stack[i] = InterpState.union(this.stack[i], from.stack[i]);
    }
    this.setCurrPos(InterpState.union(this.currPos, from.currPos));
  }

  /**
   *
   * @param {InterpState} from
   * @returns boolean
   */
  equal(from) {
    if (this.stack.length !== from.stack.length) {
      return false;
    }
    if (this.silentFails !== from.silentFails) {
      return false;
    }
    for (let i = this.stack.length; i--;) {
      if (!InterpState.equalType(this.stack[i], from.stack[i])) {
        return false;
      }
    }
    // Don't check currPos; its likely to change on each iteration of a loop,
    // but doesn't mean that the state didn't converge
    return true;
  }

  /**
   * Determine whether two InterpTypes are equal
   *
   * @param {InterpType} a
   * @param {InterpType} b
   * @returns {boolean}
   */
  static equalType(a, b) {
    if (a.type !== b.type) {
      return false;
    }
    return a.value === b.value;
  }

  /**
   * Compute the union of two InterpTypes
   *
   * @param {InterpType} a
   * @param {InterpType} b
   * @returns {InterpType}
   */
  static union(a, b) {
    const utype = a.type | b.type;
    if (a.value !== undefined
        && a.value === b.value
        && !(utype & (utype - 1))) {
      return { type: utype, value: a.value };
    }
    return { type: utype };
  }

  /**
   * Determine whether t could be one of types
   *
   * @param {InterpType} t
   * @param {number} types
   * @returns {boolean}
   */
  static couldBe(t, types) {
    return (t.type & types) !== 0;
  }

  /**
   * Determine whether t must be one of types
   *
   * @param {InterpType} t
   * @param {number} types
   * @returns {boolean}
   */
  static mustBe(t, types) {
    return (t.type & ~types) === 0 && t.type !== 0;
  }

  /**
   * Determine whether an InterpType must be truish
   *
   * @param {InterpType} t
   * @returns {boolean}
   */
  static mustBeTrue(t) {
    // ARRAY and FAILED always test true, anything else
    // could be false.
    return InterpState.mustBe(t, TypeTag.ARRAY | TypeTag.FAILED);
  }

  /**
   * Determine whether an InterpType must be falsish
   *
   * @param {InterpType} t
   * @returns {boolean}
   */
  static mustBeFalse(t) {
    // NULL and UNDEFINED always test false, anything else
    // could be true.
    return InterpState.mustBe(t, TypeTag.NULL | TypeTag.UNDEFINED);
  }

  /**
   * Given one of the "conditional" bytecodes, return the number
   * of arguments it consumes.
   *
   * @param {number} bc
   * @returns number
   */
  static getConditionalArgCount(bc) {
    switch (bc) {
      case op.IF:
      case op.IF_ERROR:
      case op.IF_NOT_ERROR:
      case op.MATCH_ANY:
        return 0;
      case op.IF_GE:
      case op.IF_GE_DYNAMIC:
      case op.IF_LT:
      case op.IF_LT_DYNAMIC:
      case op.MATCH_STRING:
      case op.MATCH_STRING_IC:
      case op.MATCH_CHAR_CLASS:
        return 1;
      default:
        throw new Error(`Expected a conditional bytecode, but got: ${bc}.`);
    }
  }

  /**
   * Given a reference to a conditional bytecode, return the
   * then and else bytecodes as a tuple.
   *
   * As a special case return the entire loop for
   * WHILE_NOT_ERROR.
   *
   * @param {number[]} bc
   * @param {number} ip
   * @returns {[number[], number[], number]}
   */
  static getConditionalCode(bc, ip) {
    if (bc[ip] === op.WHILE_NOT_ERROR) {
      const length = bc[ip + 1] + 2;
      const loopCode = bc.slice(ip, ip + length);
      return [loopCode, [], length];
    }
    const argCount = InterpState.getConditionalArgCount(bc[ip]);
    const baseLength = 3 + argCount;
    const thenLength = bc[ip + baseLength - 2];
    const elseLength = bc[ip + baseLength - 1];
    const thenCode = bc.slice(
      ip + baseLength, ip + baseLength + thenLength
    );
    const elseCode = bc.slice(
      ip + baseLength + thenLength,
      ip + baseLength + thenLength + elseLength
    );
    return [thenCode, elseCode, baseLength + thenLength + elseLength];
  }

  /**
   *
   * @param {number[]} bc
   * @param {number} ip
   * @returns {boolean}
   */
  static killsCurrPos(bc, ip) {
    for (;;) {
      switch (bc[ip]) {
        case op.POP_CURR_POS:
          return true;
        case op.POP:
        case op.PUSH_NULL:
        case op.PUSH_FAILED:
        case op.PUSH_UNDEFINED:
        case op.PUSH_EMPTY_STRING:
        case op.PUSH_EMPTY_ARRAY:
        case op.SILENT_FAILS_ON:
        case op.SILENT_FAILS_OFF:
          ip++;
          break;
        case op.FAIL:
        case op.POP_N:
          ip += 2;
          break;
        default:
          return false;
      }
    }
  }

  /** @param {InterpType} value */
  push(value) {
    this.stack.push(value);
  }

  /** @returns {InterpType} */
  pop() {
    const value = this.stack.pop();
    if (!value) {
      throw new RangeError(
        `Rule '${this.ruleName}': Trying to pop from an empty stack.`
      );
    }
    return value;
  }

  /** @returns {InterpType} */
  top() {
    const value = this.stack.slice(-1).pop();
    if (!value) {
      throw new RangeError(
        `Rule '${this.ruleName}': Trying to access the top of an empty stack.`
      );
    }
    return value;
  }

  /**
   *
   * @param {number} depth
   * @returns {InterpType}
   */
  inspect(depth) {
    const value = this.stack.slice(-1 - depth).pop();
    if (!value) {
      throw new RangeError(
        `Rule '${this.ruleName}': Trying to inspect element ${
          depth
        } in a stack of size ${this.stack.length}.`
      );
    }
    return value;
  }

  /**
   * Remove n elements from the stack, that are expected to be thrown away.
   *
   * @param {number} n
   * @returns {InterpType[]}
   */
  discard(n) {
    if (this.stack.length < n) {
      throw new RangeError(
        `Rule '${this.ruleName}': Trying to pop ${n} elements, but only ${this.stack.length} available.`
      );
    }
    if (n < 0) {
      throw new RangeError(
        `Rule '${this.ruleName}': Trying to discard ${n} elements.`
      );
    }
    return n ? this.stack.splice(-n) : [];
  }

  /**
   * Remove n elements from the stack, but (todo) mark them used.
   *
   * @param {number} n
   * @returns {InterpType[]}
   */
  popn(n) {
    return this.discard(n);
  }

  /**
   * Assign value to currPos.
   *
   * @param {InterpType} value
   */
  setCurrPos(value) {
    if (value.type !== TypeTag.OFFSET) {
      throw new Error(
        `Rule '${this.ruleName}': Invalid value assigned to currPos.`
      );
    }
    if (!value.value) {
      value = { type: TypeTag.OFFSET, value: {} };
    }
    this.currPos = value;
  }

  /**
   * Interpret one bytecode. This may result in a callback to
   * |run| for the then and else clauses of a conditional, or
   * the body of a loop.
   *
   * @param {number[]} bc
   * @param {number} ip
   * @returns {InterpResult}
   */
  interp(bc, ip) {
    switch (bc[ip]) {
      case op.PUSH_EMPTY_STRING:  // PUSH_EMPTY_STRING
        this.push({ type: TypeTag.STRING });
        ip++;
        break;

      case op.PUSH_CURR_POS:      // PUSH_CURR_POS
        this.push(this.currPos);
        ip++;
        break;

      case op.PUSH_UNDEFINED:     // PUSH_UNDEFINED
        this.push({ type: TypeTag.UNDEFINED });
        ip++;
        break;

      case op.PUSH_NULL:          // PUSH_NULL
        this.push({ type: TypeTag.NULL });
        ip++;
        break;

      case op.PUSH_FAILED:        // PUSH_FAILED
        this.push({ type: TypeTag.FAILED });
        ip++;
        break;

      case op.PUSH_EMPTY_ARRAY:   // PUSH_EMPTY_ARRAY
        this.push({ type: TypeTag.ARRAY, value: [] });
        ip++;
        break;

      case op.POP:                // POP
        this.discard(1);
        ip++;
        break;

      case op.POP_CURR_POS:       // POP_CURR_POS
        this.setCurrPos(this.pop());
        ip++;
        break;

      case op.POP_N:              // POP_N n
        this.popn(bc[ip + 1]);
        ip += 2;
        break;

      case op.NIP: {              // NIP
        const value = this.pop();
        this.discard(1);
        this.push(value);
        ip++;
        break;
      }

      case op.APPEND: {           // APPEND
        this.pop();
        const top = this.top();
        if (top.type !== TypeTag.ARRAY) {
          throw new Error(
            `Rule '${this.ruleName}': Attempting to append to a non-array.`
          );
        }
        ip++;
        break;
      }

      case op.WRAP:                // WRAP n
        this.push({ type: TypeTag.ARRAY, value: this.popn(bc[ip + 1]) });
        ip += 2;
        break;

      case op.TEXT: {             // TEXT
        const offset = this.pop();
        if (offset.type !== TypeTag.OFFSET) {
          throw new Error(
            `Rule '${this.ruleName}': TEXT bytecode got an incorrect type: ${offset.type}.`
          );
        }
        this.push({ type: TypeTag.STRING });
        ip++;
        break;
      }

      case op.PLUCK: {            // PLUCK n, k, p1, ..., pK
        const baseLength = 3;
        const paramsLength = bc[ip + baseLength - 1];
        const n = baseLength + paramsLength;
        const indices = bc.slice(ip + baseLength, ip + n);
        const result = paramsLength === 1
          ? this.inspect(indices[0])
          : {
              type: TypeTag.ARRAY,
              value: indices.map(p => this.inspect(p)),
            };

        this.popn(bc[ip + 1]);
        this.push(result);
        ip += n;
        break;
      }

      case op.IF:                 // IF t, f
        return this.interpCondition(bc, ip, 0, (top, forThen) => {
          if (forThen) {
            const type = {
              type: top.type & ~(TypeTag.UNDEFINED | TypeTag.NULL),
            };
            return [InterpState.mustBeTrue(top), type];
          } else {
            const type = { type: top.type & ~(TypeTag.FAILED | TypeTag.ARRAY) };
            return [InterpState.mustBeFalse(top), type];
          }
        });

      case op.IF_ERROR:           // IF_ERROR t, f
        return this.interpCondition(bc, ip, 0, (top, forThen) => {
          if (forThen) {
            return [top.type === TypeTag.FAILED, { type: TypeTag.FAILED }];
          } else {
            const type = { type: top.type & ~TypeTag.FAILED };
            return [!InterpState.couldBe(top, TypeTag.FAILED), type];
          }
        });

      case op.IF_NOT_ERROR:       // IF_NOT_ERROR t, f
        return this.interpCondition(bc, ip, 0, (top, forThen) => {
          if (!forThen) {
            return [top.type === TypeTag.FAILED, { type: TypeTag.FAILED }];
          } else {
            const type = { type: top.type & ~TypeTag.FAILED };
            return [!InterpState.couldBe(top, TypeTag.FAILED), type];
          }
        });

      case op.IF_LT:              // IF_LT min, t, f
        return this.interpCondition(bc, ip, 1, null);

      case op.IF_GE:              // IF_GE max, t, f
        return this.interpCondition(bc, ip, 1, null);

      case op.IF_LT_DYNAMIC:      // IF_LT_DYNAMIC min, t, f
        return this.interpCondition(bc, ip, 1, null);

      case op.IF_GE_DYNAMIC:      // IF_GE_DYNAMIC max, t, f
        return this.interpCondition(bc, ip, 1, null);

      case op.WHILE_NOT_ERROR:    // WHILE_NOT_ERROR b
        return this.interpLoop(bc, ip);

      case op.MATCH_ANY:          // MATCH_ANY a, f, ...
        return this.interpCondition(bc, ip, 0, null);

      case op.MATCH_STRING:       // MATCH_STRING s, a, f, ...
        return this.interpCondition(bc, ip, 1, null);

      case op.MATCH_STRING_IC:    // MATCH_STRING_IC s, a, f, ...
        return this.interpCondition(bc, ip, 1, null);

      case op.MATCH_CHAR_CLASS:   // MATCH_CHAR_CLASS c, a, f, ...
        return this.interpCondition(bc, ip, 1, null);

      case op.ACCEPT_N:           // ACCEPT_N n
        this.push({ type: TypeTag.STRING });
        this.currPos = { type: TypeTag.OFFSET, value: {} };
        ip += 2;
        break;

      case op.ACCEPT_STRING:      // ACCEPT_STRING s
        this.push({ type: TypeTag.STRING });
        this.currPos = { type: TypeTag.OFFSET, value: {} };
        ip += 2;
        break;

      case op.FAIL:               // FAIL e
        this.push({ type: TypeTag.FAILED });
        ip += 2;
        break;

      case op.LOAD_SAVED_POS:     // LOAD_SAVED_POS p
        this.inspect(bc[ip + 1]);
        ip += 2;
        break;

      case op.UPDATE_SAVED_POS:   // UPDATE_SAVED_POS
        ip++;
        break;

      case op.CALL: {              // CALL f, n, pc, p1, p2, ..., pN
        this.push(this.interpCall(bc, ip, 4));
        this.currPos = { type: TypeTag.OFFSET, value: {} };
        ip += 4 + bc[ip + 3];
        break;
      }

      case op.RULE:               // RULE r
        this.push({ type: TypeTag.ANY });
        this.currPos = { type: TypeTag.OFFSET, value: {} };
        ip += 2;
        break;

      case op.SILENT_FAILS_ON:    // SILENT_FAILS_ON
        this.silentFails++;
        ip++;
        break;

      case op.SILENT_FAILS_OFF:   // SILENT_FAILS_OFF
        this.silentFails--;
        ip++;
        break;

      case op.SOURCE_MAP_PUSH:
        ip += 2;
        break;

      case op.SOURCE_MAP_POP: {
        ip++;
        break;
      }

      case op.SOURCE_MAP_LABEL_PUSH:
        ip += 4;
        break;

      case op.SOURCE_MAP_LABEL_POP:
        ip += 2;
        break;

      // istanbul ignore next Because we never generate invalid bytecode we cannot reach this branch
      default:
        throw new Error(`${this.ruleName}: Invalid opcode: ${bc[ip]}.`);
    }
    return { ip };
  }

  /**
   * Interpret a conditional expression.
   *
   * The check callback should be passed if the condition depends
   * on the value on the top of the stack. It is called once for
   * the then clause (with forThen === true), and once for the else
   * clause (with forThen === false). It returns a tuple indicating
   * whether the specified clause can be statically determined to
   * execute, and what we know about the type of the top element on
   * the stack if it does execute (eg in the then clause of an IF_FAILED
   * we know that the top of stack is the "failed" token).
   *
   * @param {number[]} bc
   * @param {number} ip
   * @param {number} argCount
   * @param {InterpCondCallback | null} check
   *
   * @returns {InterpResult}
   */
  interpCondition(bc, ip, argCount, check) {
    const baseLength = argCount + 3;
    const thenLength = bc[ip + baseLength - 2];
    const elseLength = bc[ip + baseLength - 1];

    const thenState = this.clone();
    const [thenOnly, thenType] = check
      ? check(thenState.top(), true)
      : [false, null];
    const [elseOnly, elseType] = check
      ? check(this.top(), false)
      : [false, null];
    const length = baseLength + thenLength + elseLength;
    const thenSlice = bc.slice(ip + baseLength, ip + baseLength + thenLength);
    const elseSlice = bc.slice(ip + baseLength + thenLength, ip + length);
    if (thenOnly || elseOnly) {
      if (thenOnly && elseOnly) {
        throw new Error(
          `Rule '${
            this.ruleName
          }': Conditional cannot be both always true and always false.`
        );
      }
      const slice = thenOnly ? thenSlice : elseSlice;
      return {
        ip: ip + length,
        bytecodeMods: {
          startOffset: ip,
          length,
          replacements: this.run(slice) || slice,
        },
      };
    }
    if (thenType) {
      thenState.pop();
      thenState.push(thenType);
    }
    if (elseType) {
      this.pop();
      this.push(elseType);
    }
    const thenResult = thenState.run(thenSlice);
    const elseResult = this.run(elseSlice);
    const elseState = this.clone();
    if (!elseLength) {
      if (thenState.stack.length > this.stack.length) {
        thenState.stack.splice(this.stack.length);
      }
    }
    let bytecodeMods = null;
    if (thenResult || elseResult) {
      const rep = bc.slice(ip, ip + baseLength);
      bytecodeMods = {
        startOffset: ip,
        length: elseResult ? length : length - elseLength,
        replacements: rep,
      };
      if (thenResult) {
        rep.push(...thenResult);
        rep[baseLength - 2] = thenResult.length;
      } else {
        rep.push(...thenSlice);
      }
      if (elseResult) {
        rep.push(...elseResult);
        rep[baseLength - 1] = elseResult.length;
      }
    }
    ip += length;
    this.merge(thenState);
    return { ip, thenState, elseState, bytecodeMods };
  }

  /**
   *
   * @param {number[]} bc
   * @param {number} ip
   * @returns {InterpResult}
   */
  interpLoop(bc, ip) {
    const baseLength = 2;
    const bodyLength = bc[ip + baseLength - 1];

    if (InterpState.mustBe(this.top(), TypeTag.FAILED)) {
      return {
        ip: ip + baseLength + bodyLength,
        bytecodeMods: {
          startOffset: ip,
          length: bodyLength + baseLength,
          replacements: [],
        },
      };
    }

    this.looping++;
    const state = this.clone();
    const slice = bc.slice(
      ip + baseLength, ip + baseLength + bodyLength
    );
    for (;;) {
      this.run(slice);
      this.merge(state);
      if (this.equal(state)) {
        break;
      }
      state.copy(this);
    }
    this.looping--;
    const bodyResult = this.run(slice);
    let bytecodeMods = null;
    if (bodyResult) {
      bytecodeMods = {
        startOffset: ip,
        length: baseLength + bodyLength,
        replacements: [bc[ip], bodyResult.length].concat(bodyResult),
      };
    }
    ip += baseLength + bodyLength;
    return { ip, bytecodeMods };
  }

  /**
   *
   * @param {number[]} bc
   * @param {number} ip
   * @param {number} baseLength
   * @returns {InterpType}
   */
  interpCall(bc, ip, baseLength) {
    const paramsLength = bc[ip + baseLength - 1];
    bc.slice(ip + baseLength, ip + baseLength + paramsLength).map(
      p => this.inspect(p)
    );
    this.discard(bc[ip + baseLength - 2]);
    return { type: TypeTag.ANY };
  }

  /**
   *
   * @param {number[]}  bc
   * @returns {number[] | null};
   */
  run(bc) {
    let ip = 0;
    const original = bc;
    if (!this.looping && this.preRun) {
      this.preRun(bc);
    }
    /** @param {InterpResult} result */
    const applyMods = result => {
      if (result.bytecodeMods && !this.looping) {
        if (bc === original) {
          bc = bc.slice();
        }
        bc.splice(
          result.bytecodeMods.startOffset,
          result.bytecodeMods.length,
          ...result.bytecodeMods.replacements
        );
        if (result.ip >= result.bytecodeMods.startOffset
            + result.bytecodeMods.length) {
          result.ip += result.bytecodeMods.replacements.length
            - result.bytecodeMods.length;
        }
        delete result.bytecodeMods;
      }
    };
    while (ip < bc.length) {
      let result = this.preInterp && !this.looping && this.preInterp(bc, ip);
      if (!result) {
        result = this.interp(bc, ip);
        if (!this.looping && this.postInterp) {
          applyMods(result);
          result = this.postInterp(bc, ip, result);
        }
      }
      applyMods(result);
      ip = result.ip;
    }
    if (!this.looping && this.postRun) {
      this.postRun(bc);
    }
    return bc !== original ? bc : null;
  }

  /**
   *
   * @param {number[]} bc
   * @param {string} name
   */
  static print(bc, name) {
    let indent = -2;
    /** @type {string[]} */
    const parts = [];
    const map = Object.create(null);
    Object.entries(op).forEach(([key, value]) => {
      if (!/^(PUSH|MATCH_REGEXP)$/.test(key)) {
        map[value] = key;
      }
    });
    const state = new InterpState(name);
    state.preRun = function() {
      indent += 2;
    };
    state.postRun = function() {
      if (indent > 0) {
        parts.push(`${" ".repeat(indent)} --`);
      }
      indent -= 2;
    };
    state.preInterp = function(bc, ip) {
      const name = map[bc[ip]];
      const i = parts.push(`${" ".repeat(indent)} ${name} stack: ${this.stack.length}`);
      const result = this.interp(bc, ip);
      if (i === parts.length) {
        parts[i - 1] += ` => ${this.stack.length}`;
      }
      delete result.bytecodeMods;
      return result;
    };
    state.run(bc);
    return parts.join("\n");
  }
}

module.exports = {
  TypeTag,
  InterpState,
};
