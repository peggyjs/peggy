// @ts-check
"use strict";

const asts = require("../asts");
const op = require("../opcodes");
const Stack = require("../stack");
const { version } = require("../../version");
const { stringEscape, regexpClassEscape } = require("../utils");
const { SourceNode } = require("source-map-generator");
const GrammarLocation = require("../../grammar-location");
const { parse } = require("../../parser.js");

function _addUint8ArrayPolyfills () {
  String.prototype.toUint8Array = function () {
    return new TextEncoder().encode(this);
  };

  Array.prototype.toUint8Array = function () {
    return new Uint8Array(this.map(function (item) {
      if (item instanceof Uint8Array || typeof item === "number") {
        return item;
      }
      if (typeof item.toUint8Array !== "undefined") {
        return item.toUint8Array();
      }

      throw new Error(`Array.toUint8Array unexpected item ${item} of type ${typeof item})`);
    }));
  };

  Uint8Array.prototype.charAt = function (index) { 
    let result = this[index]; 
    console.log("Uint8Array charCodeAt()", index, this, "=>", result);
    return result;
  }

  Uint8Array.prototype.charCodeAt = Uint8Array.prototype.charAt;

  Uint8Array.prototype.substr = function (from, to) {
    console.log("Uint8Array substr()", from, to, this);
    return this.slice(from, from+to);
  }

  Uint8Array.prototype.substring = function (from, to) {
    console.log("Uint8Array substring()", from, to, this);
    return this.slice(from, to);
  }

  Uint8Array.prototype.replace = function (search, replace) {
    console.log("Uint8Array replace()", search, replace, this);
    return this;
  }

  Uint8Array.prototype.equals = function(something) {
    if (typeof something === "string" || something instanceof Uint8Array) {
      if (something.length !== this.length) {
        console.log("equals FALSE:", this, something);
        return false;
      }

      for (let i=0; i<this.length; i++) {
        if (this[i] !== something[i]) {
          console.log("equals FALSE:", this, something);
          return false;
        }
      }

      console.log("equals TRUE:", this, something);
      return true;
    } else { 
        console.error("comparison with", typeof something, "is not implemented:", something);
    }

    return false;
  }

  Uint8Array.prototype.toUTF8String = function () {
    return TextDecoder().decode(this);
  }

  Uint8Array.prototype.test = function (param) {
    let parameter_is_uint8array = (param instanceof Uint8Array);
    let parameter_is_number = (typeof param === "number");

    // console.log("test()", this, param, "parameter_is_number", parameter_is_number, "parameter_is_uint8array", parameter_is_uint8array);

    if (!parameter_is_uint8array && !parameter_is_number) { 
      throw new Error("expected different datatype for test(): " + (typeof param) + " " + param);
    }

    let value_to_compare_against;

    if (parameter_is_uint8array) {
      if (param.length > 1) {
        throw "other Uint8Array needs to be single cahracter"
      }

      // only compare first item
      value_to_compare_against = param[0];
    } else {
      // parameter is number, use that
      value_to_compare_against = param
    }

    for (var i = 0; i<this.length; i++) {
      if (this[i] === value_to_compare_against) {
        // console.log("test() => TRUE");
        return true;
      }
    }

    // console.log("test() => FALSE");
    return false;
  }

  Uint8Array.prototype.indexOfMulti = function(searchElements, fromIndex) {
      fromIndex = fromIndex || 0;

      var index = Array.prototype.indexOf.call(this, searchElements[0], fromIndex);
      if(searchElements.length === 1 || index === -1) {
          // Not found or no other elements to check
          return index;
      }

      for(var i = index, j = 0; j < searchElements.length && i < this.length; i++, j++) {
          if(this[i] !== searchElements[j]) {
              return this.indexOfMulti(searchElements, index + 1);
          }
      }

      return(i === index + searchElements.length) ? index : -1;
  };
}



_addUint8ArrayPolyfills();


/**
 * @typedef {import("../../peg")} PEG
 */

/**
 * Converts source text from the grammar into the `source-map` object
 *
 * @param {string} code Multiline string with source code
 * @param {PEG.LocationRange} location
 *        Location that represents code block in the grammar
 * @param {string} [name] Name of the code chunk
 *
 * @returns {SourceNode} New node that represents code chunk.
 *          Code will be splitted by lines if necessary
 */
function toSourceNode(code, location, name) {
  const start = GrammarLocation.offsetStart(location);
  const line = start.line;
  // `source-map` columns are 0-based, peggy columns is 1-based
  const column = start.column - 1;
  const lines = code.split("\n");

  if (lines.length === 1) {
    return new SourceNode(
      line, column, String(location.source), code, name
    );
  }

  return new SourceNode(
    null, null, String(location.source), lines.map((l, i) => new SourceNode(
      line + i,
      i === 0 ? column : 0,
      String(location.source),
      i === lines.length - 1 ? l : [l, "\n"],
      name
    ))
  );
}

/**
 * Wraps code line that consists from three parts into `SourceNode`.
 *
 * @param {string} prefix String that will be prepended before mapped chunk
 * @param {string} chunk Chunk for mapping (possible multiline)
 * @param {PEG.LocationRange} location
 *        Location that represents chunk in the grammar
 * @param {string} suffix String that will be appended after mapped chunk
 * @param {string} [name] Name of the code chunk
 *
 * @returns {SourceNode} New node that represents code chunk.
 *          Code will be splitted by lines if necessary
 */
function wrapInSourceNode(prefix, chunk, location, suffix, name) {
  // If location is not defined (for example, AST node was replaced
  // by a plugin and does not provide location information, see
  // plugin-api.spec.js/"can replace parser") returns original chunk
  if (location) {
    const end = GrammarLocation.offsetEnd(location);
    return new SourceNode(null, null, String(location.source), [
      prefix,
      toSourceNode(chunk, location, name),
      // Mark end location with column information otherwise
      // mapping will be always continue to the end of line
      new SourceNode(
        end.line,
        // `source-map` columns are 0-based, peggy columns is 1-based
        end.column - 1,
        String(location.source),
        suffix
      ),
    ]);
  }

  return new SourceNode(null, null, null, [prefix, chunk, suffix]);
}

/**
 * @typedef {(string|SourceNode)[]} SourceArray
 *
 * @typedef {PEG.SourceBuildOptions<PEG.SourceOutputs>} SourceBuildOptions
 * @typedef {object} ExtraOptions
 * @property {PEG.Dependencies} [dependencies]
 * @property {string} [exportVar]
 * @typedef {SourceBuildOptions & ExtraOptions} Options
 */
/**
 * Generates parser JavaScript code.
 *
 * @param {PEG.ast.Grammar} ast
 * @param {Options} options
 */
function generateJS(ast, options) {
  if (!ast.literals || !ast.locations || !ast.classes
      || !ast.expectations || !ast.functions || !ast.importedNames) {
    throw new Error(
      "generateJS: generate bytecode was not called."
    );
  }
  const {
    literals, locations, classes, expectations, functions, importedNames,
  } = ast;
  if (!options.allowedStartRules) {
    throw new Error(
      "generateJS: options.allowedStartRules was not set."
    );
  }
  const { allowedStartRules } = options;
  /** @type {PEG.Dependencies} */
  const dependencies = options.dependencies || {};

  /**
   * @overload
   * @param {string} code
   * @returns {string}
   */
  /**
   * @overload
   * @param {SourceArray} code
   * @returns {SourceArray}
   */
  /**
   * These only indent non-empty lines to avoid trailing whitespace.
   * @param {SourceArray} code
   * @returns {SourceArray}
   */
  function indent2(code) {
    /*
     * - raw lines (outside of SourceNodes) have implict newlines
     *   that get inserted at the end of processing, so indent
     *   should always be applied to the next string.
     *
     * - chunks inside SourceNodes are assumed to have explict
     *   new lines, and often have several chunks on one line.
     *   we therefore shouldn't indent them, unless we've seen
     *   an explicit new line, or the previous line was raw.
     *
     * So eg:
     * [
     *   SourceNode(["a ", "b", "\nfoo "]),
     *   "x",
     *   "y",
     * ]
     *
     * Should end up as
     * [
     *   SourceNode(["  a ", "b", "\n  foo "]),
     *   "x",
     *   "  y",
     * ]
     *
     * sawEol, and inSourceNode are used to keep track of when
     * we should apply the indent.
     */
    let sawEol = true;
    let inSourceNode = 0;
    /**
     * @overload
     * @param {string | SourceNode} code
     * @returns {string | SourceNode}
     */
    /**
     * @overload
     * @param {SourceNode} code
     * @returns {SourceNode}
     */
    /**
     * @overload
     * @param {SourceNode[]} code
     * @returns {SourceNode[]}
     */
    /**
     * @overload
     * @param {SourceArray} code
     * @returns {SourceArray}
     */
    /**
     * @param {SourceArray | string | SourceNode} code
     * @returns {SourceArray | string | SourceNode}
     */
    function helper(code) {
      if (Array.isArray(code)) {
        return code.map(s => helper(s));
      }
      if (code instanceof SourceNode) {
        inSourceNode++;
        code.children = helper(code.children);
        inSourceNode--;
        return code;
      }
      if (sawEol) {
        // There was an immediately prior newline, so
        // indent at the start of every line
        code = code.replace(/^(.+)$/gm, "  $1");
      } else {
        // This line will be appended directly to
        // the end of the previous one, so only indent
        // after each contained newline (and only if
        // there's non-whitespace following the newline)
        code = code.replace(/\n(\s*\S)/g, "\n  $1");
      }
      sawEol = !inSourceNode || code.endsWith("\n");
      return code;
    }
    return helper(code);
  }
  /** @param {number} i */
  function l(i) { return "peg$c" + i; } // |literals[i]| of the abstract machine
  /** @param {number} i */
  function r(i) { return "peg$r" + i; } // |classes[i]| of the abstract machine
  /** @param {number} i */
  function e(i) { return "peg$e" + i; } // |expectations[i]| of the abstract machine
  /** @param {number} i */
  function f(i) { return "peg$f" + i; } // |actions[i]| of the abstract machine
  /** @param {number} i */
  function gi(i) { return "peg$import" + i; } // |grammar_import[i]|

  /**
   * Generates name of the function that parses specified rule.
   * @param {string} name
   */
  function name(name) { 
    return "peg$parse" + name; 
  }

  function isUint8Array(val) {
    return (val instanceof Uint8Array);
  }

  function isUndefined(val) {
    return (typeof val === "undefined");
  }

  function generateTables() {
    /** @param {Uint8Array} literal */
    function buildLiteral(literal) {
      console.log("buildLiteral", typeof literal, literal instanceof Uint8Array, literal);

      if (!isUint8Array(literal)) {
        if (!isUndefined(literal.toUint8Array)) {
          literal = literal.toUint8Array();
        }
        if (!isUint8Array(literal)) {          
          throw new Error(`buildLiteral literal is not Uint8Array. type found: ${typeof literal}`);
        }
      } 


      // return "convertStringToUint8Array(\"" + stringEscape(literal) + "\")";
      let output = `new Uint8Array([ ${literal.toString()} ])`;
      console.log("buildLiteral", typeof literal, literal instanceof Uint8Array, literal, "=>", output);
      return output
    }

    /** @param {PEG.ast.GrammarCharacterClass} cls */
    function buildRegexp(cls) {
      // return "/^["
      //   + (cls.inverted ? "^" : "")
      //   + cls.value.map(part => (Array.isArray(part)
      //     ? regexpClassEscape(part[0])
      //       + "-"
      //       + regexpClassEscape(part[1])
      //     : regexpClassEscape(part))).join("")
      //   + "]/" + (cls.ignoreCase ? "i" : "");

      /** @type Array<string> */
      let arrByteValues = []
      cls.value.forEach(part => {
        if (Array.isArray(part)) {
          // range of characters FROM-TO is provided

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          // @ts-ignore
          console.log("part", part, typeof part, part instanceof Uint8Array);

          let comment_was_written = false
          for (var i=part[0].charCodeAt(0); i<=part[1].charCodeAt(0); i++) {
            if (!comment_was_written) {
              comment_was_written = true;
              arrByteValues.push(`/* regexp range: from '${part[0]}' to '${part[1]}' */ ${i}`);
            } else {
              arrByteValues.push(i);
            }
          }
        } else {
          // single character is provided
          arrByteValues.push(`${part.charCodeAt(0)} /* ${part} */`);
        }
      });

      let output = `new Set(new Uint8Array([ ${arrByteValues.join(", ")} ]));`
      console.log("buildRegxp", cls, typeof cls.value, cls.value instanceof Uint8Array, cls.value, "=>", output);
      return output
    }

    /** @param {PEG.ast.GrammarExpectation} e */
    function buildExpectation(e) {
      console.log("buildExpectation", e, e.value instanceof Uint8Array);

      if (!isUndefined(e.value)) {
        if (!isUint8Array(e.value)) {
          if (!isUndefined(e.value.toUint8Array)) {
            e.value = e.value.toUint8Array();
          }
          if (!isUint8Array(e.value)) {
            throw new Error(`buildExpectation e.value is not Uint8Array. type found: ${typeof e.value}. e.value is ${JSON.stringify(e.value)}`);
          }
        }
      }

      switch (e.type) {
        case "rule": {
          // return "peg$otherExpectation(\"" + stringEscape(e.value) + "\")";
          let output = `peg\$otherExpectation(/* ${e.value} */ new Uint8Array(${e.value.join(", ")}));`;
          console.log("buildExpectation", e.type, typeof e.value, e.value instanceof Uint8Array, e.value, "=>", output);
          return output;
        }

        case "literal": {
          // return "peg$literalExpectation(\""
          //         + stringEscape(e.value)
          //         + "\", "
          //         + e.ignoreCase
          //         + ")";
          if (e.ignoreCase) {
            throw new Error("buildExpectation(): e.ignoreCase not supported");
          }
          
          let output = `peg\$literalExpectation(/* ${e.value} */ new Uint8Array(${e.value.join(", ")}));`;
          console.log("buildExpectation", e.type, typeof e.value, e.value instanceof Uint8Array, e.value, "=>", output);
          return output;
        }

        case "class": {
          // const parts = e.value.map(part => (Array.isArray(part)
          //   ? "[\"" + stringEscape(part[0]) + "\", \"" + stringEscape(part[1]) + "\"]"
          //   : "\""  + stringEscape(part) + "\"")).join(", ");

          // return "peg$classExpectation(["
          //         + parts + "], "
          //         + e.inverted + ", "
          //         + e.ignoreCase
          //         + ")";

          let output = (Array.isArray(e.value)) 
            ? `peg$classExpectation( /* e.value[0]: '${e.value[0]}' e.value[1]: '${e.value[1]}' */ new Uint8Array([ ${e.value[0]}, ${e.value[1]} ]));`
            : `peg$classExpectation( /* e.value: '${e.value}' */ new Uint8Array([ ${e.value} ]));`;
          console.log("buildExpectation", e.type, typeof e.value, e.value instanceof Uint8Array, e.value, "=>", output);
          return output;
        }

        case "any": 
            return "peg$anyExpectation()";

        // istanbul ignore next Because we never generate expectation type we cannot reach this branch
        default: throw new Error("Unknown expectation type (" + JSON.stringify(e) + ")");
      }
    }

    /**
     * @param {PEG.ast.FunctionConst} a
     * @param {number} i
     */
    function buildFunc(a, i) {
      return wrapInSourceNode(
        `\n  var ${f(i)} = function(${a.params.join(", ")}) {`,
        a.body,
        a.location,
        "};"
      );
    }

    return new SourceNode(
      null, null, options.grammarSource, [
        literals.map(
          (c, i) => "  var " + l(i) + " = " + buildLiteral(c) + ";"
        ).concat("", classes.map(
          (c, i) => "  var " + r(i) + " = " + buildRegexp(c) + ";"
        )).concat("", expectations.map(
          (c, i) => "  var " + e(i) + " = " + buildExpectation(c) + ";"
        )).concat("").join("\n"),
        ...functions.map(buildFunc),
      ]
    );
  }

  /**
   * @param {string} ruleNameCode
   * @param {number} ruleIndexCode
   */
  function generateRuleHeader(ruleNameCode, ruleIndexCode) {
    /** @type {string[]} */
    const parts = [];

    parts.push("");

    if (options.trace) {
      parts.push(
        "peg$tracer.trace({",
        "  type: \"rule.enter\",",
        "  rule: " + ruleNameCode + ",",
        "  location: peg$computeLocation(startPos, startPos, true)",
        "});",
        ""
      );
    }

    if (options.cache) {
      parts.push(
        "var key = peg$currPos * " + ast.rules.length + " + " + ruleIndexCode + ";",
        "var cached = peg$resultsCache[key];",
        "",
        "if (cached) {",
        "  peg$currPos = cached.nextPos;",
        ""
      );

      if (options.trace) {
        parts.push(
          "if (cached.result !== peg$FAILED) {",
          "  peg$tracer.trace({",
          "    type: \"rule.match\",",
          "    rule: " + ruleNameCode + ",",
          "    result: cached.result,",
          "    location: peg$computeLocation(startPos, peg$currPos, true)",
          "  });",
          "} else {",
          "  peg$tracer.trace({",
          "    type: \"rule.fail\",",
          "    rule: " + ruleNameCode + ",",
          "    location: peg$computeLocation(startPos, startPos, true)",
          "  });",
          "}",
          ""
        );
      }

      parts.push(
        "  return cached.result;",
        "}",
        ""
      );
    }

    return parts;
  }

  /**
   * @param {string} ruleNameCode
   * @param {string} resultCode
   */
  function generateRuleFooter(ruleNameCode, resultCode) {
    /** @type {string[]} */
    const parts = [];

    if (options.cache) {
      parts.push(
        "",
        "peg$resultsCache[key] = { nextPos: peg$currPos, result: " + resultCode + " };"
      );
    }

    if (options.trace) {
      parts.push(
        "",
        "if (" + resultCode + " !== peg$FAILED) {",
        "  peg$tracer.trace({",
        "    type: \"rule.match\",",
        "    rule: " + ruleNameCode + ",",
        "    result: " + resultCode + ",",
        "    location: peg$computeLocation(startPos, peg$currPos, true)",
        "  });",
        "} else {",
        "  peg$tracer.trace({",
        "    type: \"rule.fail\",",
        "    rule: " + ruleNameCode + ",",
        "    location: peg$computeLocation(startPos, startPos, true)",
        "  });",
        "}"
      );
    }

    parts.push(
      "",
      "return " + resultCode + ";"
    );

    return parts;
  }

  /** @param {PEG.ast.Rule} rule */
  function generateRuleFunction(rule) {
    /** @type {SourceArray} */
    const parts = [];
    const bytecode = /** @type {number[]} */(rule.bytecode);
    const stack = new Stack(rule.name, "s", "var", bytecode);

    /** @param {number[]} bc */
    function compile(bc) {
      let ip = 0;
      const end = bc.length;
      const parts = [];
      // eslint-disable-next-line no-useless-assignment
      let value = undefined;

      /**
       * @param {string} cond
       * @param {number} argCount
       * @param {((bc: number[])=>SourceArray) | null} [thenFn]
       */
      function compileCondition(cond, argCount, thenFn) {
        const baseLength = argCount + 3;
        const thenLength = bc[ip + baseLength - 2];
        const elseLength = bc[ip + baseLength - 1];

        const [thenCode, elseCode] = stack.checkedIf(
          ip,
          () => {
            ip += baseLength + thenLength;
            return (thenFn || compile)(bc.slice(ip - thenLength, ip));
          },
          (elseLength > 0)
            ? () => {
                ip += elseLength;
                return compile(bc.slice(ip - elseLength, ip));
              }
            : null
        );

        parts.push("if (" + cond + ") {");
        parts.push(...indent2(thenCode));
        if (elseLength > 0) {
          parts.push("} else {");
          parts.push(...indent2(elseCode));
        }
        parts.push("}");
      }

      /**
        MATCH_* opcodes typically do something like

          if (<test>(input.substr(peg$currPos, length))) {
            sN = input.substr(peg$currPos, length);
            ...
          } else {
            sN = peg$FAILED;
            ...
          }

        compileInputChunkCondition will convert that to

          sN = input.substr(peg$currPos, length);
          if (<test>(sN)) {
            ...
          } else {
            sN = peg$FAILED;
            ...
          }

          and avoid extracting the sub string twice.
        @param {(chunk:string, optimized:boolean)=>string} condFn
        @param {number} argCount
        @param {number} inputChunkLength
      */
      function compileInputChunkCondition(
        condFn, argCount, inputChunkLength
      ) {
        const baseLength = argCount + 3;
        let inputChunk = inputChunkLength === 1
          ? "input[peg$currPos]"
          : "input.slice(peg$currPos, peg$currPos + " + inputChunkLength + ")";
        let thenFn = null;
        if (bc[ip + baseLength] === op.ACCEPT_N
              && bc[ip + baseLength + 1] === inputChunkLength) {
          // Push the assignment to the next available variable.
          parts.push(stack.push(inputChunk));
          inputChunk = stack.pop();
          /** @param {number[]} bc */
          thenFn = bc => {
            // The bc[0] is an ACCEPT_N, and bc[1] is the N. We've already done
            // the assignment (before the if), so we just need to bump the
            // stack, and increment peg$currPos appropriately.
            stack.sp++;
            const code = compile(bc.slice(2));
            code.unshift(
              inputChunkLength === 1
                ? "peg$currPos++;"
                : "peg$currPos += " + inputChunkLength + ";"
            );
            return code;
          };
        }
        compileCondition(condFn(inputChunk, thenFn !== null), argCount, thenFn);
      }

      /** @param {string} cond */
      function compileLoop(cond) {
        const baseLength = 2;
        const bodyLength = bc[ip + baseLength - 1];

        const bodyCode = stack.checkedLoop(ip, () => {
          ip += baseLength + bodyLength;
          return compile(bc.slice(ip - bodyLength, ip));
        });

        parts.push("while (" + cond + ") {");
        parts.push(...indent2(bodyCode));
        parts.push("}");
      }

      /** @param {number} baseLength */
      function compileCall(baseLength) {
        const paramsLength = bc[ip + baseLength - 1];

        return f(bc[ip + 1]) + "("
          + bc.slice(ip + baseLength, ip + baseLength + paramsLength).map(
            p => stack.index(p)
          ).join(", ")
          + ")";
      }

      while (ip < end) {
        switch (bc[ip]) {
          case op.PUSH_EMPTY_STRING:  // PUSH_EMPTY_STRING
            parts.push(stack.push("''"));
            ip++;
            break;

          case op.PUSH_CURR_POS:      // PUSH_CURR_POS
            parts.push(stack.push("peg$currPos"));
            ip++;
            break;

          case op.PUSH_UNDEFINED:     // PUSH_UNDEFINED
            parts.push(stack.push("undefined"));
            ip++;
            break;

          case op.PUSH_NULL:          // PUSH_NULL
            parts.push(stack.push("null"));
            ip++;
            break;

          case op.PUSH_FAILED:        // PUSH_FAILED
            parts.push(stack.push("peg$FAILED"));
            ip++;
            break;

          case op.PUSH_EMPTY_ARRAY:   // PUSH_EMPTY_ARRAY
            parts.push(stack.push("[]"));
            ip++;
            break;

          case op.POP:                // POP
            stack.pop();
            ip++;
            break;

          case op.POP_CURR_POS:       // POP_CURR_POS
            parts.push("peg$currPos = " + stack.pop() + ";");
            ip++;
            break;

          case op.POP_N:              // POP_N n
            stack.pop(bc[ip + 1]);
            ip += 2;
            break;

          case op.NIP:                // NIP
            value = stack.pop();
            stack.pop();
            parts.push(stack.push(value));
            ip++;
            break;

          case op.APPEND:             // APPEND
            value = stack.pop();
            parts.push(stack.top() + ".push(" + value + ");");
            ip++;
            break;

          case op.WRAP:               // WRAP n
            parts.push(
              stack.push("[" + stack.pop(bc[ip + 1]).join(", ") + "]")
            );
            ip += 2;
            break;

          case op.TEXT:               // TEXT
            parts.push(
              stack.push("input.slice(" + stack.pop() + ", peg$currPos)")
            );
            ip++;
            break;

          case op.PLUCK: {            // PLUCK n, k, p1, ..., pK
            const baseLength = 3;
            const paramsLength = bc[ip + baseLength - 1];
            const n = baseLength + paramsLength;
            value = bc.slice(ip + baseLength, ip + n);
            value = paramsLength === 1
              ? stack.index(value[0])
              : `[ ${
                value.map(p => stack.index(p)).join(", ")
              } ]`;
            stack.pop(bc[ip + 1]);
            parts.push(stack.push(value));
            ip += n;
            break;
          }

          case op.IF:                 // IF t, f
            compileCondition(stack.top(), 0);
            break;

          case op.IF_ERROR:           // IF_ERROR t, f
            compileCondition(stack.top() + " === peg$FAILED", 0);
            break;

          case op.IF_NOT_ERROR:       // IF_NOT_ERROR t, f
            compileCondition(stack.top() + " !== peg$FAILED", 0);
            break;

          case op.IF_LT:              // IF_LT min, t, f
            compileCondition(stack.top() + ".length < " + bc[ip + 1], 1);
            break;

          case op.IF_GE:              // IF_GE max, t, f
            compileCondition(stack.top() + ".length >= " + bc[ip + 1], 1);
            break;

          case op.IF_LT_DYNAMIC:      // IF_LT_DYNAMIC min, t, f
            compileCondition(stack.top() + ".length < (" + stack.index(bc[ip + 1]) + "|0)", 1);
            break;

          case op.IF_GE_DYNAMIC:      // IF_GE_DYNAMIC max, t, f
            compileCondition(stack.top() + ".length >= (" + stack.index(bc[ip + 1]) + "|0)", 1);
            break;

          case op.WHILE_NOT_ERROR:    // WHILE_NOT_ERROR b
            compileLoop(stack.top() + " !== peg$FAILED");
            break;

          case op.MATCH_ANY:          // MATCH_ANY a, f, ...
            compileCondition("input.length > peg$currPos", 0);
            break;

          case op.MATCH_STRING: {     // MATCH_STRING s, a, f, ...
            const litNum = bc[ip + 1];
            const literal = literals[litNum];
            compileInputChunkCondition(
              (inputChunk, optimized) => {
                if (literal.length > 1) {
                  return `${inputChunk}.equals(${l(litNum)})`;
                }
                inputChunk = !optimized
                  ? "input[peg$currPos]"
                  : `${inputChunk}[0]`;
                return `${inputChunk} === ${literal.charCodeAt(0)}`;
                // return `${inputChunk} === ${literal[0]}`;
                // return `${inputChunk}.equals(${literal.charCodeAt(0)})`;
              },
              1,
              literal.length
            );
            break;
          }

          case op.MATCH_STRING_IC: {  // MATCH_STRING_IC s, a, f, ...
            const litNum = bc[ip + 1];
            compileInputChunkCondition(
              // inputChunk => `${inputChunk}.toLowerCase() === ${l(litNum)}`,
              inputChunk => `${inputChunk}.toUTF8String().toLowerCase() === ${l(litNum)}.toUTF8String().toLowerCase()`,
              1,
              literals[litNum].length
            );
            break;
          }

          case op.MATCH_CHAR_CLASS: { // MATCH_CHAR_CLASS c, a, f, ...
            const regNum = bc[ip + 1];
            compileInputChunkCondition(
              inputChunk => `${r(regNum)}.test(${inputChunk})`, 1, 1
            );
            break;
          }

          case op.ACCEPT_N:           // ACCEPT_N n
            parts.push(stack.push(
              bc[ip + 1] > 1
                ? "input.slice(peg$currPos, peg$currPos + " + bc[ip + 1] + ")"
                : "input[peg$currPos]"
            ));
            parts.push(
              bc[ip + 1] > 1
                ? "peg$currPos += " + bc[ip + 1] + ";"
                : "peg$currPos++;"
            );
            ip += 2;
            break;

          case op.ACCEPT_STRING:      // ACCEPT_STRING s
            parts.push(stack.push(l(bc[ip + 1])));
            parts.push(
              literals[bc[ip + 1]].length > 1
                ? "peg$currPos += " + literals[bc[ip + 1]].length + ";"
                : "peg$currPos++;"
            );
            ip += 2;
            break;

          case op.FAIL:               // FAIL e
            parts.push(stack.push("peg$FAILED"));
            parts.push("if (peg$silentFails === 0) { peg$fail(" + e(bc[ip + 1]) + "); }");
            ip += 2;
            break;

          case op.LOAD_SAVED_POS:     // LOAD_SAVED_POS p
            parts.push("peg$savedPos = " + stack.index(bc[ip + 1]) + ";");
            ip += 2;
            break;

          case op.UPDATE_SAVED_POS:   // UPDATE_SAVED_POS
            parts.push("peg$savedPos = peg$currPos;");
            ip++;
            break;

          case op.CALL:               // CALL f, n, pc, p1, p2, ..., pN
            value = compileCall(4);
            stack.pop(bc[ip + 2]);
            parts.push(stack.push(value));
            ip += 4 + bc[ip + 3];
            break;

          case op.RULE:               // RULE r
            parts.push(stack.push(name(ast.rules[bc[ip + 1]].name) + "()"));
            ip += 2;
            break;

          case op.LIBRARY_RULE: {       // LIBRARY_RULE module, name
            const nm = bc[ip + 2];
            const cnm = (nm === -1) ? "" : ", \"" + importedNames[nm] + "\"";
            parts.push(stack.push("peg$callLibrary("
              + gi(bc[ip + 1])
              + cnm
              + ")"));
            ip += 3;
            break;
          }

          case op.SILENT_FAILS_ON:    // SILENT_FAILS_ON
            parts.push("peg$silentFails++;");
            ip++;
            break;

          case op.SILENT_FAILS_OFF:   // SILENT_FAILS_OFF
            parts.push("peg$silentFails--;");
            ip++;
            break;

          case op.SOURCE_MAP_PUSH:
            stack.sourceMapPush(
              parts,
              locations[bc[ip + 1]]
            );
            ip += 2;
            break;

          case op.SOURCE_MAP_POP: {
            stack.sourceMapPop();
            ip++;
            break;
          }

          case op.SOURCE_MAP_LABEL_PUSH:
            stack.labels[bc[ip + 1]] = {
              label: literals[bc[ip + 2]],
              location: locations[bc[ip + 3]],
            };
            ip += 4;
            break;

          case op.SOURCE_MAP_LABEL_POP:
            delete stack.labels[bc[ip + 1]];
            ip += 2;
            break;

          // istanbul ignore next Because we never generate invalid bytecode we cannot reach this branch
          default:
            throw new Error("Invalid opcode: " + bc[ip] + ".");
        }
      }

      return parts;
    }

    const code = compile(bytecode);

    parts.push(wrapInSourceNode(
      "function ",
      name(rule.name),
      rule.nameLocation,
      "() {\n",
      rule.name
    ));

    if (options.trace) {
      parts.push("  var startPos = peg$currPos;");
    }

    parts.push(indent2(stack.defines()));

    parts.push(...indent2(generateRuleHeader(
      "\"" + stringEscape(rule.name) + "\"",
      asts.indexOfRule(ast, rule.name)
    )));
    parts.push(...indent2(code));
    parts.push(...indent2(generateRuleFooter(
      "\"" + stringEscape(rule.name) + "\"",
      stack.result()
    )));

    parts.push("}");

    return parts;
  }

  /**
   * @template {string} T
   * @param {PEG.ast.CodeBlock<T>} node
   */
  function ast2SourceNode(node) {
    // If location is not defined (for example, AST node was replaced
    // by a plugin and does not provide location information, see
    // plugin-api.spec.js/"can replace parser") returns initializer code
    if (node.codeLocation) {
      // Append "$" to the name to create an impossible rule name
      // so that names will not collide with rule names
      return toSourceNode(node.code, node.codeLocation, "$" + node.type);
    }

    return node.code;
  }

  function generateToplevel() {
    const parts = [];

    let topLevel = ast.topLevelInitializer;
    if (topLevel) {
      if (Array.isArray(topLevel)) {
        if (options.format === "es") {
          const imps = [];
          const codes = [];
          for (const tli of topLevel) {
            const [
              imports,
              code,
            ] = /** @type {PEG.ast.TopLevelInitializer[]} */ (
              parse(tli.code, {
                startRule: "ImportsAndSource",
                grammarSource: new GrammarLocation(
                  tli.codeLocation.source,
                  tli.codeLocation.start
                ),
              })
            );
            if (imports.code) {
              imps.push(imports);
              codes.push(code);
            } else {
              // Prefer the original
              codes.push(tli);
            }
          }
          // Imports go at the end so that when reversed, they end up in front.
          topLevel = codes.concat(imps);
        }
        // Put library code before code using it.
        const reversed = topLevel.slice(0).reverse();
        for (const tli of reversed) {
          parts.push(ast2SourceNode(tli));
          parts.push("");
        }
      } else {
        parts.push(ast2SourceNode(topLevel));
        parts.push("");
      }
    }

    let myFunctionDefinitions = [
      _addUint8ArrayPolyfills
    ];

    myFunctionDefinitions.forEach(function(fn_obj) {
      let fn_as_string = `${fn_obj.toString()};`;
      console.log("writing function to parts: ", fn_as_string);
      parts.push(fn_as_string);
    })

    parts.push(
      `
        _addUint8ArrayPolyfills();
      `,
      "function peg$subclass(child, parent) {",
      "  function C() { this.constructor = child; }",
      "  C.prototype = parent.prototype;",
      "  child.prototype = new C();",
      "}",
      "",
      "function peg$SyntaxError(message, expected, found, location) {",
      "  var self = Error.call(this, message);",
      "  // istanbul ignore next Check is a necessary evil to support older environments",
      "  if (Object.setPrototypeOf) {",
      "    Object.setPrototypeOf(self, peg$SyntaxError.prototype);",
      "  }",
      "  self.expected = expected;",
      "  self.found = found;",
      "  self.location = location;",
      "  self.name = \"SyntaxError\";",
      "  return self;",
      "}",
      "",
      "peg$subclass(peg$SyntaxError, Error);",
      "",
      "function peg$padEnd(str, targetLength, padString) {",
      "  padString = padString || \" \";",
      "  if (str.length > targetLength) { return str; }",
      "  targetLength -= str.length;",
      "  padString += padString.repeat(targetLength);",
      "  return str + padString.slice(0, targetLength);",
      "}",
      "",
      "peg$SyntaxError.prototype.format = function(sources) {",
      "  var str = \"Error: \" + this.message;",
      "  if (this.location) {",
      "    var src = null;",
      "    var k;",
      "    var text_contains_nonprintable_characters;",
      `   
            let regExpNonPrintableCharacter = /[^\\x20-\\x7E]/; 
            
            for (k = 0; k < sources.length; k++) {
              if (sources[k].source === this.location.source) {
                // check if unprintable characters are in file
                text_contains_nonprintable_characters = sources[k].arr_bytes.some(char => regExpNonPrintableCharacter.test(char));
                
                if (text_contains_nonprintable_characters) {
                  // keep text unchanged so we can handle it as hex later
                  src = sources[k].arr_bytes;
                } else {
                  // handle line-by-line as readable text
                  // src = sources[k].text.split(/\\r\\n|\\n|\\r/g);
                  src = sources[k].arr_bytes;
                }

                break
              }
            }
      `,
      "    var s = this.location.start;",
      "    var offset_s = (this.location.source && (typeof this.location.source.offset === \"function\"))",
      "      ? this.location.source.offset(s)",
      "      : s;",
      "    var loc = this.location.source + \":\" + offset_s.line + \":\" + offset_s.column;",
      "    if (src) {",
      "       if (!text_contains_nonprintable_characters) { ",
      "         // process as plain text line-by-line ",
      "      var e = this.location.end;",
      "      var filler = peg$padEnd(\"\", offset_s.line.toString().length, ' ');",
      "      var line = src[s.line - 1];",
      "      var last = s.line === e.line ? e.column : line.length + 1;",
      "      var hatLen = (last - s.column) || 1;",
      "      str += \"\\n --> \" + loc + \"\\n\"",
      "          + filler + \" |\\n\"",
      "          + offset_s.line + \" | \" + line + \"\\n\"",
      "          + filler + \" | \" + peg$padEnd(\"\", s.column - 1, ' ')",
      "          + peg$padEnd(\"\", hatLen, \"^\");",
      "       } else {",
      `
                // text has non-printable characters
                // replace unprintable characters with hex value
                // display where error happened in a way that is safe for console output

                // number of characters to show left and right of where the error happened
                let num_bytes_context = 60;

                // calculate snippet start and end
                let offset_snippet_start = Math.max(0, this.location.start.offset - num_bytes_context);
                let offset_snippet_end = Math.min(this.location.end.offset + num_bytes_context, src.length);

                // create strings for error snippet: before, during, after
                let arr_bytes_before_error_position = src.slice(offset_snippet_start, this.location.start.offset);
                let arr_bytes_at_error_position = src.slice(this.location.start.offset, this.location.end.offset);
                let arr_bytes_after_error_position = src.slice(this.location.end.offset, offset_snippet_end);

                // old offset position does not work for new string
                let offset_error_start_in_new_array = arr_bytes_before_error_position.length;
                let offset_error_end_in_new_array = offset_error_start_in_new_array + arr_bytes_at_error_position.length;

                // combine arrays into one large array
                let arr_bytes_with_error_context = [...arr_bytes_before_error_position, ...arr_bytes_at_error_position,...arr_bytes_after_error_position];

                // this will be the error context for printing to console
                let arr_output_line_string = [];
                let arr_output_line_hex = [];

                // this will be the visual pointer that shows where exactly the error happened
                let arr_output_line_pointer = [];

                // create snippet which shows exactly where error has happened
                for (var position = 0; position < arr_bytes_with_error_context.length; position++) {
                  // read one character at a time
                  let charcode_at_current_position = arr_bytes_with_error_context[position];
                  // let charcode_at_current_position = parseInt(hex_at_current_position, 16);
                  let hex_at_current_position = charcode_at_current_position.toString(16).padStart(2, "0");
                  let character_at_current_position = String.fromCharCode(charcode_at_current_position);

                  console.log(position, charcode_at_current_position, "hex", hex_at_current_position, "display", character_at_current_position);

                  // remember how much space was taken up
                  let num_characters_added;

                  // check if character is printable or not
                  if (charcode_at_current_position < 32 || charcode_at_current_position > 126) {
                    // character not printable, use hex
                    arr_output_line_hex.push(hex_at_current_position)

                    // remember how many characters were added
                    num_characters_added = hex_at_current_position.length

                    // add two spaces to visual pointer string for proper spacing
                    arr_output_line_string.push(" ".repeat(num_characters_added))
                  } else {
                    // character is printable, so no need to transform it to hex
                    // just add it to context string
                    arr_output_line_string.push(character_at_current_position)

                    // remember how many characters were added
                    num_characters_added = character_at_current_position.length

                    // add space to hex string to ensure proper spacing
                    arr_output_line_hex.push(" ".repeat(num_characters_added))
                  }

                  // add visual pointer to exact error location if needed
                  if (position < offset_error_start_in_new_array) {
                    // pointer not needed YET because position is left of where error happened
                    // add spaces so pointer will be properly placed
                    // ensure two spaces are added when hex conversion was done
                    arr_output_line_pointer.push(" ".repeat(num_characters_added))
                  } else if (position < offset_error_end_in_new_array) {
                    // position is within start and end of error offset
                    // add visual pointer to error
                    // ensure two pointers are added when hex conversion was done
                    arr_output_line_pointer.push("X".repeat(num_characters_added))
                  } else {
                    // we have passed error location, so we won't add anything to the pointer string
                  }
                }

                // in case we're in terminal, ensure we stay smaller than the terminal width
                if (typeof process !== "undefined" 
                  && typeof process.stdout !== "undefined"
                  && typeof process.stdout.columns !== "undefined"
                  && process.stdout.isTTY
                ) {
                  let terminal_width = process.stdout.columns;

                  // reduce length of strings if terminal width is not enough
                  while (arr_output_line_string.join("").length > terminal_width) {
                    let max_length_first_array_item = Math.max(
                      arr_output_line_string[0].length,
                      arr_output_line_hex[0].length,
                      arr_output_line_pointer[0].length
                    );

                    if (max_length_first_array_item === 2) {
                      if (arr_output_line_string[0].length === 1) {
                        arr_output_line_string.shift();
                        arr_output_line_string.shift();
                      } else {
                        arr_output_line_string.shift();
                      }

                      if (arr_output_line_hex[0].length === 1) {
                        arr_output_line_hex.shift();
                        arr_output_line_hex.shift();
                      } else {
                        arr_output_line_hex.shift();
                      }

                      if (arr_output_line_pointer[0].length === 1) {
                        arr_output_line_pointer.shift();
                        arr_output_line_pointer.shift();
                      } else {
                        arr_output_line_pointer.shift();
                      }
                    } else {
                      // length is 1, remove one item each
                      arr_output_line_pointer.shift();
                      arr_output_line_hex.shift();
                      arr_output_line_string.shift();
                    }

                    let max_length_last_array_item = Math.max(
                      arr_output_line_string[arr_output_line_string.length-1].length,
                      arr_output_line_hex[arr_output_line_hex.length-1].length,
                      arr_output_line_pointer[arr_output_line_pointer.length-1].length
                    );

                    if (max_length_last_array_item === 2) {
                      if (arr_output_line_string[arr_output_line_string.length-1].length === 1) {
                        arr_output_line_string.pop();
                        arr_output_line_string.pop();
                      } else {
                        arr_output_line_string.pop();
                      }

                      if (arr_output_line_hex[arr_output_line_hex.length-1].length === 1) {
                        arr_output_line_hex.pop();
                        arr_output_line_hex.pop();
                      } else {
                        arr_output_line_hex.pop();
                      }

                      if (arr_output_line_pointer[arr_output_line_pointer.length-1].length === 1) {
                        arr_output_line_pointer.pop();
                        arr_output_line_pointer.pop();
                      } else {
                        arr_output_line_pointer.pop();
                      }
                    } else {
                      // length is 1, remove one item each
                      arr_output_line_pointer.pop();
                      arr_output_line_hex.pop();
                      arr_output_line_string.pop();
                    }
                  }
                }

                // output to console
                str += ("\\n\\n" + arr_output_line_pointer.join("") + "\\n" + arr_output_line_string.join("") + "\\n" 
                  + arr_output_line_hex.join("") + "\\n" + arr_output_line_pointer.join("") + "\\n\\n");

                // add some further info
                str += ("\\n\\nError starts at offset " + this.location.start.offset
                  + " and ends after " + (this.location.end.offset-this.location.start.offset) + " bytes in file " + this.location.source + "\\n");
              }
      `,
      "    } else {",
      "      str += \"\\n at \" + loc;",
      "    }",
      "  }",
      "  return str;",
      "};",
      "",
      "peg$SyntaxError.buildMessage = function(expected, found) {",
      "  var DESCRIBE_EXPECTATION_FNS = {",
      "    literal: function(expectation) {",
      "      return \"\\\"\" + literalEscape(expectation.text) + \"\\\"\";",
      "    },",
      "",
      "    class: function(expectation) {",
      "      var escapedParts = expectation.parts.map(function(part) {",
      "        return Array.isArray(part)",
      "          ? classEscape(part[0]) + \"-\" + classEscape(part[1])",
      "          : classEscape(part);",
      "      });",
      "",
      "      return \"[\" + (expectation.inverted ? \"^\" : \"\") + escapedParts.join(\"\") + \"]\";",
      "    },",
      "",
      "    any: function() {",
      "      return \"any character\";",
      "    },",
      "",
      "    end: function() {",
      "      return \"end of input\";",
      "    },",
      "",
      "    other: function(expectation) {",
      "      return expectation.description;",
      "    }",
      "  };",
      "",
      "  function hex(ch) {",
      "    return ch.charCodeAt(0).toString(16).toUpperCase();",
      "  }",
      "",
      "  function literalEscape(s) { ",
      ` 
            console.log('literalEscape s',s);
            if (typeof s === "number") {
              s = String.fromCharCode(s)
            }
      `,
      "    return s",
      "      .replace(/\\\\/g, \"\\\\\\\\\")",   // Backslash
      "      .replace(/\"/g,  \"\\\\\\\"\")",    // Closing double quote
      "      .replace(/\\0/g, \"\\\\0\")",       // Null
      "      .replace(/\\t/g, \"\\\\t\")",       // Horizontal tab
      "      .replace(/\\n/g, \"\\\\n\")",       // Line feed
      "      .replace(/\\r/g, \"\\\\r\")",       // Carriage return
      "      .replace(/[\\x00-\\x0F]/g,          function(ch) { return \"\\\\x0\" + hex(ch); })",
      "      .replace(/[\\x10-\\x1F\\x7F-\\x9F]/g, function(ch) { return \"\\\\x\"  + hex(ch); });",
      "  }",
      "",
      "  function classEscape(s) { ",
      ` 
            console.log('classEscape s',s);
            if (typeof s === "number") {
              s = ("" + s)
            }
      `,
      "    return s",
      "      .replace(/\\\\/g, \"\\\\\\\\\")",   // Backslash
      "      .replace(/\\]/g, \"\\\\]\")",       // Closing bracket
      "      .replace(/\\^/g, \"\\\\^\")",       // Caret
      "      .replace(/-/g,  \"\\\\-\")",        // Dash
      "      .replace(/\\0/g, \"\\\\0\")",       // Null
      "      .replace(/\\t/g, \"\\\\t\")",       // Horizontal tab
      "      .replace(/\\n/g, \"\\\\n\")",       // Line feed
      "      .replace(/\\r/g, \"\\\\r\")",       // Carriage return
      "      .replace(/[\\x00-\\x0F]/g,          function(ch) { return \"\\\\x0\" + hex(ch); })",
      "      .replace(/[\\x10-\\x1F\\x7F-\\x9F]/g, function(ch) { return \"\\\\x\"  + hex(ch); });",
      "  }",
      "",
      "  function describeExpectation(expectation) {",
      "    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);",
      "  }",
      "",
      "  function describeExpected(expected) {",
      "    var descriptions = expected.map(describeExpectation);",
      "    var i, j;",
      "",
      "    descriptions.sort();",
      "",
      "    if (descriptions.length > 0) {",
      "      for (i = 1, j = 1; i < descriptions.length; i++) {",
      "        if (descriptions[i - 1] !== descriptions[i]) {",
      "          descriptions[j] = descriptions[i];",
      "          j++;",
      "        }",
      "      }",
      "      descriptions.length = j;",
      "    }",
      "",
      "    switch (descriptions.length) {",
      "      case 1:",
      "        return descriptions[0];",
      "",
      "      case 2:",
      "        return descriptions[0] + \" or \" + descriptions[1];",
      "",
      "      default:",
      "        return descriptions.slice(0, -1).join(\", \")",
      "          + \", or \"",
      "          + descriptions[descriptions.length - 1];",
      "    }",
      "  }",
      "",
      "  function describeFound(found) {",
      "    return found ? \"\\\"\" + literalEscape(found) + \"\\\"\" : \"end of input\";",
      "  }",
      "",
      "  return \"Expected \" + describeExpected(expected) + \" but \" + describeFound(found) + \" found.\";",
      "};",
      ""
    );

    if (options.trace) {
      parts.push(
        "function peg$DefaultTracer() {",
        "  this.indentLevel = 0;",
        "}",
        "",
        "peg$DefaultTracer.prototype.trace = function(event) {",
        "  var that = this;",
        "",
        "  function log(event) {",
        "    function repeat(string, n) {",
        "       var result = \"\", i;",
        "",
        "       for (i = 0; i < n; i++) {",
        "         result += string;",
        "       }",
        "",
        "       return result;",
        "    }",
        "",
        "    function pad(string, length) {",
        "      return string + repeat(\" \", length - string.length);",
        "    }",
        "",
        "    if (typeof console === \"object\") {",   // IE 8-10
        "      console.log(",
        "        event.location.start.line + \":\" + event.location.start.column + \"-\"",
        "          + event.location.end.line + \":\" + event.location.end.column + \" \"",
        "          + pad(event.type, 10) + \" \"",
        "          + repeat(\"  \", that.indentLevel) + event.rule",
        "      );",
        "    }",
        "  }",
        "",
        "  switch (event.type) {",
        "    case \"rule.enter\":",
        "      log(event);",
        "      this.indentLevel++;",
        "      break;",
        "",
        "    case \"rule.match\":",
        "      this.indentLevel--;",
        "      log(event);",
        "      break;",
        "",
        "    case \"rule.fail\":",
        "      this.indentLevel--;",
        "      log(event);",
        "      break;",
        "",
        "    default:",
        "      throw new Error(\"Invalid event type: \" + event.type + \".\");",
        "  }",
        "};",
        ""
      );
    }

    const startRuleFunctions = "{ "
      + allowedStartRules.map(
        r => r + ": " + name(r)
      ).join(", ")
      + " }";
    const startRuleFunction = name(allowedStartRules[0]);

    parts.push(
      `
        function convertStringToUint8Array (str) {
          return(new TextEncoder()).encode(str);
        }
      `,
      "function peg$parse(input, options) {",
      `
        if (typeof input === "string") {
          input = convertStringToUint8Array(input);
        }
      `,
      "  options = options !== undefined ? options : {};",
      "",
      "  var peg$FAILED = {};",
      "  var peg$source = options.grammarSource;",
      "",
      "  var peg$startRuleFunctions = " + startRuleFunctions + ";",
      "  var peg$startRuleFunction = " + startRuleFunction + ";",
      "",
      generateTables(),
      "",
      "  var peg$currPos = options.peg$currPos | 0;",
      "  var peg$savedPos = peg$currPos;",
      "  var peg$posDetailsCache = [{ line: 1, column: 1 }];",
      "  var peg$maxFailPos = peg$currPos;",
      "  var peg$maxFailExpected = options.peg$maxFailExpected || [];",
      "  var peg$silentFails = options.peg$silentFails | 0;",   // 0 = report failures, > 0 = silence failures
      ""
    );

    if (options.cache) {
      parts.push(
        "  var peg$resultsCache = {};",
        ""
      );
    }

    if (options.trace) {
      parts.push(
        "  var peg$tracer = \"tracer\" in options ? options.tracer : new peg$DefaultTracer();",
        ""
      );
    }

    parts.push(
      "  var peg$result;",
      "",
      "  if (options.startRule) {",
      "    if (!(options.startRule in peg$startRuleFunctions)) {",
      "      throw new Error(\"Can't start parsing from rule \\\"\" + options.startRule + \"\\\".\");",
      "    }",
      "",
      "    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];",
      "  }",
      "",
      "  function text() {",
      "    return input.slice(peg$savedPos, peg$currPos);",
      "  }",
      "",
      "  function offset() {",
      "    return peg$savedPos;",
      "  }",
      "",
      "  function range() {",
      "    return {",
      "      source: peg$source,",
      "      start: peg$savedPos,",
      "      end: peg$currPos",
      "    };",
      "  }",
      "",
      "  function location() {",
      "    return peg$computeLocation(peg$savedPos, peg$currPos);",
      "  }",
      "",
      "  function expected(description, location) {",
      "    location = location !== undefined",
      "      ? location",
      "      : peg$computeLocation(peg$savedPos, peg$currPos);",
      "",
      "    throw peg$buildStructuredError(",
      "      [peg$otherExpectation(description)],",
      "      input.slice(peg$savedPos, peg$currPos),",
      "      location",
      "    );",
      "  }",
      "",
      "  function error(message, location) {",
      "    location = location !== undefined",
      "      ? location",
      "      : peg$computeLocation(peg$savedPos, peg$currPos);",
      "",
      "    throw peg$buildSimpleError(message, location);",
      "  }",
      "",
      "  function peg$literalExpectation(text, ignoreCase) {",
      "    return { type: \"literal\", text: text, ignoreCase: ignoreCase };",
      "  }",
      "",
      "  function peg$classExpectation(parts, inverted, ignoreCase) {",
      "    return { type: \"class\", parts: parts, inverted: inverted, ignoreCase: ignoreCase };",
      "  }",
      "",
      "  function peg$anyExpectation() {",
      "    return { type: \"any\" };",
      "  }",
      "",
      "  function peg$endExpectation() {",
      "    return { type: \"end\" };",
      "  }",
      "",
      "  function peg$otherExpectation(description) {",
      "    return { type: \"other\", description: description };",
      "  }",
      "",
      "  function peg$computePosDetails(pos) {",
      "    var details = peg$posDetailsCache[pos];",
      "    var p;",
      "",
      "    if (details) {",
      "      return details;",
      "    } else {",
      "      if (pos >= peg$posDetailsCache.length) {",
      "        p = peg$posDetailsCache.length - 1;",
      "      } else {",
      "        p = pos;",
      "        while (!peg$posDetailsCache[--p]) {}",
      "      }",
      "",
      "      details = peg$posDetailsCache[p];",
      "      details = {",
      "        line: details.line,",
      "        column: details.column",
      "      };",
      "",
      "      while (p < pos) {",
      "        if (input[p] === 10) {",
      "          details.line++;",
      "          details.column = 1;",
      "        } else {",
      "          details.column++;",
      "        }",
      "",
      "        p++;",
      "      }",
      "",
      "      peg$posDetailsCache[pos] = details;",
      "",
      "      return details;",
      "    }",
      "  }",
      "",
      "  function peg$computeLocation(startPos, endPos, offset) {",
      "    var startPosDetails = peg$computePosDetails(startPos);",
      "    var endPosDetails = peg$computePosDetails(endPos);",
      "",
      "    var res = {",
      "      source: peg$source,",
      "      start: {",
      "        offset: startPos,",
      "        line: startPosDetails.line,",
      "        column: startPosDetails.column",
      "      },",
      "      end: {",
      "        offset: endPos,",
      "        line: endPosDetails.line,",
      "        column: endPosDetails.column",
      "      }",
      "    };",
      "    if (offset && peg$source && (typeof peg$source.offset === \"function\")) {",
      "      res.start = peg$source.offset(res.start);",
      "      res.end = peg$source.offset(res.end);",
      "    }",
      "    return res;",
      "  }",
      "",
      "  function peg$fail(expected) {",
      "    if (peg$currPos < peg$maxFailPos) { return; }",
      "",
      "    if (peg$currPos > peg$maxFailPos) {",
      "      peg$maxFailPos = peg$currPos;",
      "      peg$maxFailExpected = [];",
      "    }",
      "",
      "    peg$maxFailExpected.push(expected);",
      "  }",
      "",
      "  function peg$buildSimpleError(message, location) {",
      "    return new peg$SyntaxError(message, null, null, location);",
      "  }",
      "",
      "  function peg$buildStructuredError(expected, found, location) {",
      "    return new peg$SyntaxError(",
      "      peg$SyntaxError.buildMessage(expected, found),",
      "      expected,",
      "      found,",
      "      location",
      "    );",
      "  }",
      ""
    );

    if (ast.imports.length > 0) {
      parts.push(
        "  var peg$assign = Object.assign || function(t) {",
        "    var i, s;",
        "    for (i = 1; i < arguments.length; i++) {",
        "      s = arguments[i];",
        "      for (var p in s) {",
        "        if (Object.prototype.hasOwnProperty.call(s, p)) {",
        "          t[p] = s[p];",
        "        }",
        "      }",
        "    }",
        "    return t;",
        "  };",
        "",
        "  function peg$callLibrary(lib, startRule) {",
        "    const opts = peg$assign({}, options, {",
        "      startRule: startRule,",
        "      peg$currPos: peg$currPos,",
        "      peg$silentFails: peg$silentFails,",
        "      peg$library: true,",
        "      peg$maxFailExpected: peg$maxFailExpected",
        "    });",
        "    const res = lib.parse(input, opts);",
        "    peg$currPos = res.peg$currPos;",
        "    peg$maxFailPos = res.peg$maxFailPos;",
        "    peg$maxFailExpected = res.peg$maxFailExpected;",
        "    return (res.peg$result === res.peg$FAILED) ? peg$FAILED : res.peg$result;",
        "  }",
        ""
      );
    }

    ast.rules.forEach(rule => {
      parts.push(...indent2(generateRuleFunction(rule)));
      parts.push("");
    });

    if (ast.initializer) {
      if (Array.isArray(ast.initializer)) {
        for (const init of ast.initializer) {
          parts.push(ast2SourceNode(init));
          parts.push("");
        }
      } else {
        parts.push(ast2SourceNode(ast.initializer));
        parts.push("");
      }
    }

    parts.push(
      "  peg$result = peg$startRuleFunction();",
      "",
      "  if (options.peg$library) {",
      // Hide this from TypeScript.  It's internal-only.
      "    return /** @type {any} */ ({",
      "      peg$result,",
      "      peg$currPos,",
      "      peg$FAILED,",
      "      peg$maxFailExpected,",
      "      peg$maxFailPos",
      "    });",
      "  }",
      "  if (peg$result !== peg$FAILED && peg$currPos === input.length) {",
      "    return peg$result;",
      "  } else {",
      "    if (peg$result !== peg$FAILED && peg$currPos < input.length) {",
      "      peg$fail(peg$endExpectation());",
      "    }",
      "",
      "    throw peg$buildStructuredError(",
      "      peg$maxFailExpected,",
      "      peg$maxFailPos < input.length ? input[peg$maxFailPos] : null,",
      "      peg$maxFailPos < input.length",
      "        ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)",
      "        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)",
      "    );",
      "  }",
      "}"
    );

    return new SourceNode(
      // This expression has a better readability when on two lines
      // eslint-disable-next-line @stylistic/function-call-argument-newline
      null, null, options.grammarSource,
      parts.map(s => (s instanceof SourceNode ? s : s + "\n"))
    );
  }

  /** @param {SourceNode} toplevelCode */
  function generateWrapper(toplevelCode) {
    /** @return {(string|SourceNode)[]} */
    function generateGeneratedByComment() {
      return [
        `// @generated by Peggy ${version}.`,
        "//",
        "// https://peggyjs.org/",
      ];
    }

    function generateParserObject() {
      const res = ["{"];
      if (options.trace) {
        res.push("  DefaultTracer: peg$DefaultTracer,");
      }

      if (options.allowedStartRules) {
        res.push("  StartRules: [" + options.allowedStartRules.map(r => '"' + r + '"').join(", ") + "],");
      }

      res.push(
        "  SyntaxError: peg$SyntaxError,",
        "  parse: peg$parse"
      );

      res.push("}");
      return res.join("\n");
    }

    const generators = {
      bare() {
        if ((Object.keys(dependencies).length > 0)
            || (ast.imports.length > 0)) {
          throw new Error("Dependencies not supported in format 'bare'.");
        }
        return [
          ...generateGeneratedByComment(),
          "(function() {",
          "  \"use strict\";",
          "",
          toplevelCode,
          "",
          indent2("return " + generateParserObject() + ";"),
          "})()",
        ];
      },

      commonjs() {
        const dependencyVars = Object.keys(dependencies);

        const parts = generateGeneratedByComment();
        parts.push(
          "",
          "\"use strict\";",
          ""
        );

        if (dependencyVars.length > 0) {
          dependencyVars.forEach(variable => {
            parts.push(
              "var " + variable
              + " = require(\""
              + stringEscape(dependencies[variable])
              + "\");"
            );
          });
          parts.push("");
        }

        const impLen = ast.imports.length;
        for (let i = 0; i < impLen; i++) {
          parts.push(
            "var " + gi(i)
            + " = require(\""
            + stringEscape(ast.imports[i].from.module)
            + "\");"
          );
        }

        parts.push(
          "",
          toplevelCode,
          "",
          "module.exports = " + generateParserObject() + ";"
        );

        return parts;
      },

      es() {
        const dependencyVars = Object.keys(dependencies);

        const parts = generateGeneratedByComment();
        parts.push("");

        if (dependencyVars.length > 0) {
          dependencyVars.forEach(variable => {
            parts.push(
              "import " + variable
              + " from \""
              + stringEscape(dependencies[variable])
              + "\";"
            );
          });
          parts.push("");
        }

        for (let i = 0; i < ast.imports.length; i++) {
          parts.push(
            "import * as " + gi(i)
            + " from \""
            + stringEscape(ast.imports[i].from.module)
            + "\";"
          );
        }

        parts.push(
          "",
          toplevelCode,
          ""
        );

        parts.push(
          "const peg$allowedStartRules = [",
          "  " + (options.allowedStartRules ? options.allowedStartRules.map(r => '"' + r + '"').join(",\n  ") : ""),
          "];",
          ""
        );

        parts.push(
          "export {"
        );

        if (options.trace) {
          parts.push("  peg$DefaultTracer as DefaultTracer,");
        }

        parts.push(
          "  peg$allowedStartRules as StartRules,",
          "  peg$SyntaxError as SyntaxError,",
          "  peg$parse as parse",
          "};"
        );

        return parts;
      },

      amd() {
        if (ast.imports.length > 0) {
          throw new Error("Imports are not supported in format 'amd'.");
        }

        const dependencyVars = Object.keys(dependencies);
        const dependencyIds = dependencyVars.map(v => dependencies[v]);
        const deps = "["
          + dependencyIds.map(
            id => "\"" + stringEscape(id) + "\""
          ).join(", ")
          + "]";
        const params = dependencyVars.join(", ");

        return [
          ...generateGeneratedByComment(),
          "define(" + deps + ", function(" + params + ") {",
          "  \"use strict\";",
          "",
          toplevelCode,
          "",
          indent2("return " + generateParserObject() + ";"),
          "});",
        ];
      },

      globals() {
        if ((Object.keys(dependencies).length > 0)
            || (ast.imports.length > 0)) {
          throw new Error("Dependencies not supported in format 'globals'.");
        }
        if (!options.exportVar) {
          throw new Error("No export variable defined for format 'globals'.");
        }

        return [
          ...generateGeneratedByComment(),
          "(function(root) {",
          "  \"use strict\";",
          "",
          toplevelCode,
          "",
          indent2("root." + options.exportVar + " = " + generateParserObject() + ";"),
          "})(this);",
        ];
      },

      umd() {
        if (ast.imports.length > 0) {
          throw new Error("Imports are not supported in format 'umd'.");
        }

        const dependencyVars = Object.keys(dependencies);
        const dependencyIds = dependencyVars.map(v => dependencies[v]);
        const deps = "["
          + dependencyIds.map(
            id => "\"" + stringEscape(id) + "\""
          ).join(", ")
          + "]";
        const requires = dependencyIds.map(
          id => "require(\"" + stringEscape(id) + "\")"
        ).join(", ");
        const params = dependencyVars.join(", ");

        const parts = generateGeneratedByComment();
        parts.push(
          "(function(root, factory) {",
          "  if (typeof define === \"function\" && define.amd) {",
          "    define(" + deps + ", factory);",
          "  } else if (typeof module === \"object\" && module.exports) {",
          "    module.exports = factory(" + requires + ");"
        );

        if (options.exportVar) {
          parts.push(
            "  } else {",
            "    root." + options.exportVar + " = factory();"
          );
        }

        parts.push(
          "  }",
          "})(this, function(" + params + ") {",
          "  \"use strict\";",
          "",
          toplevelCode,
          "",
          indent2("return " + generateParserObject() + ";"),
          "});"
        );

        return parts;
      },
    };

    const parts = generators[options.format || "bare"]();

    return new SourceNode(
      // eslint-disable-next-line @stylistic/function-call-argument-newline -- This expression has a better readability when on two lines
      null, null, options.grammarSource,
      parts.map(s => (s instanceof SourceNode ? s : s + "\n"))
    );
  }

  ast.code = generateWrapper(generateToplevel());
}

module.exports = generateJS;
