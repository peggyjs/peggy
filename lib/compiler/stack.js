"use strict";

const { SourceNode } = require("source-map-generator");
const GrammarLocation = require("../grammar-location.js");

/** Utility class that helps generating code for C-like languages. */
class Stack {
  /**
   * Constructs the helper for tracking variable slots of the stack virtual machine
   *
   * @param {string} ruleName The name of rule that will be used in error messages
   * @param {string} varName The prefix for generated names of variables
   * @param {string} type The type of the variables. For JavaScript there are `var` or `let`
   * @param {number[]} bytecode Bytecode for error messages
   */
  constructor(ruleName, varName, type, bytecode) {
    /** Last used variable in the stack. */
    this.sp             = -1;
    /** Maximum stack size. */
    this.maxSp          = -1;
    this.varName        = varName;
    this.ruleName       = ruleName;
    this.type           = type;
    this.bytecode       = bytecode;
    /* Map from stack index, to label targetting that index */
    this.labels         = {};
    /* Stack of in-flight source mappings */
    this.sourceMapStack = [];
  }

  /**
   * Returns name of the variable at the index `i`.
   *
   * @param {number} i Index for which name must be generated
   * @return {string} Generated name
   *
   * @throws {RangeError} If `i < 0`, which means a stack underflow (there are more `pop`s than `push`es)
   */
  name(i) {
    if (i < 0) {
      throw new RangeError(
        `Rule '${this.ruleName}': The variable stack underflow: attempt to use a variable '${this.varName}<x>' at an index ${i}.\nBytecode: ${this.bytecode}`
      );
    }

    return this.varName + i;
  }

  static sourceNode(location, chunks, name) {
    const start = GrammarLocation.offsetStart(location);
    return new SourceNode(
      start.line,
      start.column ? start.column - 1 : null,
      String(location.source),
      chunks,
      name
    );
  }

  /**
   * Assigns `exprCode` to the new variable in the stack, returns generated code.
   * As the result, the size of a stack increases on 1.
   *
   * @param {string} exprCode Any expression code that must be assigned to the new variable in the stack
   * @return {string|SourceNode} Assignment code
   */
  push(exprCode) {
    if (++this.sp > this.maxSp) { this.maxSp = this.sp; }

    const label = this.labels[this.sp];
    const code = [this.name(this.sp), " = ", exprCode, ";"];
    if (label) {
      if (this.sourceMapStack.length) {
        const sourceNode = Stack.sourceNode(
          label.location,
          code.splice(0, 2),
          label.label
        );
        const { parts, location } = this.sourceMapPopInternal();
        const newLoc = (location.start.offset < label.location.end.offset)
          ? {
              start: label.location.end,
              end: location.end,
              source: location.source,
            }
          : location;

        const outerNode = Stack.sourceNode(
          newLoc,
          code.concat("\n")
        );
        this.sourceMapStack.push([parts, parts.length + 1, location]);
        return new SourceNode(
          null,
          null,
          label.location.source,
          [sourceNode, outerNode]
        );
      } else {
        return Stack.sourceNode(
          label.location,
          code.concat("\n")
        );
      }
    }
    return code.join("");
  }

  /**
   * Returns name or `n` names of the variable(s) from the top of the stack.
   *
   * @param {number} [n=1] Quantity of variables, which need to be removed from the stack
   * @return {string|string[]} Generated name(s). If `n > 1` than array has length of `n`
   *
   * @throws {RangeError} If the stack underflow (there are more `pop`s than `push`es)
   */
  pop(n) {
    if (n !== undefined) {
      this.sp -= n;

      return Array.from({ length: n }, (v, i) => this.name(this.sp + 1 + i));
    }

    return this.name(this.sp--);
  }

  /**
   * Returns name of the first free variable. The same as `index(0)`.
   *
   * @return {string} Generated name
   *
   * @throws {RangeError} If the stack is empty (there was no `push`'s yet)
   */
  top() { return this.name(this.sp); }

  /**
   * Returns name of the variable at index `i`.
   *
   * @param {number} [i] Index of the variable from top of the stack
   * @return {string} Generated name
   *
   * @throws {RangeError} If `i < 0` or more than the stack size
   */
  index(i) {
    if (i < 0) {
      throw new RangeError(
        `Rule '${this.ruleName}': The variable stack overflow: attempt to get a variable at a negative index ${i}.\nBytecode: ${this.bytecode}`
      );
    }

    return this.name(this.sp - i);
  }

  /**
   * Returns variable name that contains result (bottom of the stack).
   *
   * @return {string} Generated name
   *
   * @throws {RangeError} If the stack is empty (there was no `push`es yet)
   */
  result() {
    if (this.maxSp < 0) {
      throw new RangeError(
        `Rule '${this.ruleName}': The variable stack is empty, can't get the result.\nBytecode: ${this.bytecode}`
      );
    }

    return this.name(0);
  }

  /**
   * Returns defines of all used variables.
   *
   * @return {string} Generated define variable expression with the type `this.type`.
   *         If the stack is empty, returns empty string
   */
  defines() {
    if (this.maxSp < 0) {
      return "";
    }

    return this.type + " " + Array.from({ length: this.maxSp + 1 }, (v, i) => this.name(i)).join(", ") + ";";
  }

  /**
   * Checks that code in the `generateIf` and `generateElse` move the stack pointer in the same way.
   *
   * @param {number} pos Opcode number for error messages
   * @param {function()} generateIf First function that works with this stack
   * @param {function()} [generateElse] Second function that works with this stack
   * @return {undefined}
   *
   * @throws {Error} If `generateElse` is defined and the stack pointer moved differently in the
   *         `generateIf` and `generateElse`
   */
  checkedIf(pos, generateIf, generateElse) {
    const baseSp = this.sp;

    generateIf();

    if (generateElse) {
      const thenSp = this.sp;

      this.sp = baseSp;
      generateElse();

      if (thenSp !== this.sp) {
        throw new Error(
          "Rule '" + this.ruleName + "', position " + pos + ": "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: " + baseSp + ", after then: " + thenSp + ", after else: " + this.sp + "). "
          + "Bytecode: " + this.bytecode
        );
      }
    }
  }

  /**
   * Checks that code in the `generateBody` do not move stack pointer.
   *
   * @param {number} pos Opcode number for error messages
   * @param {function()} generateBody Function that works with this stack
   * @return {undefined}
   *
   * @throws {Error} If `generateBody` move the stack pointer (if it contains unbalanced `push`es and `pop`s)
   */
  checkedLoop(pos, generateBody) {
    const baseSp = this.sp;

    generateBody();

    if (baseSp !== this.sp) {
      throw new Error(
        "Rule '" + this.ruleName + "', position " + pos + ": "
        + "Body of a loop can't move the stack pointer "
        + "(before: " + baseSp + ", after: " + this.sp + "). "
        + "Bytecode: " + this.bytecode
      );
    }
  }

  sourceMapPush(parts, location) {
    if (this.sourceMapStack.length) {
      const top = this.sourceMapStack[this.sourceMapStack.length - 1];
      // If the current top of stack starts at the same location as
      // the about to be pushed item, we should update its start location to
      // be past the new one. Otherwise any code it generates will
      // get allocated to the inner node.
      if (top[2].start.offset === location.start.offset
          && top[2].end.offset > location.end.offset) {
        top[2] = {
          start: location.end,
          end: top[2].end,
          source: top[2].source,
        };
      }
    }
    this.sourceMapStack.push([
      parts,
      parts.length,
      location,
    ]);
  }

  sourceMapPopInternal() {
    const [
      parts,
      index,
      location,
    ] = this.sourceMapStack.pop();
    const chunks = parts.splice(index).map(
      chunk => (chunk instanceof SourceNode
        ? chunk
        : chunk + "\n"
      )
    );
    if (chunks.length) {
      const start = GrammarLocation.offsetStart(location);
      parts.push(new SourceNode(
        start.line,
        start.column - 1,
        String(location.source),
        chunks
      ));
    }
    return { parts, location };
  }

  sourceMapPop(offset) {
    const { location } = this.sourceMapPopInternal();
    if (this.sourceMapStack.length
      && location.end.offset
      < this.sourceMapStack[this.sourceMapStack.length - 1][2].end.offset) {
      const { parts, location: outer } = this.sourceMapPopInternal();
      const newLoc = (outer.start.offset < location.end.offset)
        ? {
            start: location.end,
            end: outer.end,
            source: outer.source,
          }
        : outer;

      this.sourceMapStack.push([
        parts,
        parts.length + (offset || 0),
        newLoc,
      ]);
    }
  }
}

module.exports = Stack;
