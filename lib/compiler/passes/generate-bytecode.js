"use strict";

const asts = require("../asts");
const op = require("../opcodes");
const visitor = require("../visitor");
const { ALWAYS_MATCH, SOMETIMES_MATCH, NEVER_MATCH } = require("./inference-match-result");

// Generates bytecode.
//
// Instructions
// ============
//
// Stack Manipulation
// ------------------
//
//  [35] PUSH_EMPTY_STRING
//
//        stack.push("");
//
//  [1] PUSH_UNDEFINED
//
//        stack.push(undefined);
//
//  [2] PUSH_NULL
//
//        stack.push(null);
//
//  [3] PUSH_FAILED
//
//        stack.push(FAILED);
//
//  [4] PUSH_EMPTY_ARRAY
//
//        stack.push([]);
//
//  [5] PUSH_CURR_POS
//
//        stack.push(currPos);
//
//  [6] POP
//
//        stack.pop();
//
//  [7] POP_CURR_POS
//
//        currPos = stack.pop();
//
//  [8] POP_N n
//
//        stack.pop(n);
//
//  [9] NIP
//
//        value = stack.pop();
//        stack.pop();
//        stack.push(value);
//
// [10] APPEND
//
//        value = stack.pop();
//        array = stack.pop();
//        array.push(value);
//        stack.push(array);
//
// [11] WRAP n
//
//        stack.push(stack.pop(n));
//
// [12] TEXT
//
//        stack.push(input.substring(stack.pop(), currPos));
//
// [36] PLUCK n, k, p1, ..., pK
//
//        value = [stack[p1], ..., stack[pK]]; // when k != 1
//        -or-
//        value = stack[p1];                   // when k == 1
//
//        stack.pop(n);
//        stack.push(value);
//
// Conditions and Loops
// --------------------
//
// [13] IF t, f
//
//        if (stack.top()) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [14] IF_ERROR t, f
//
//        if (stack.top() === FAILED) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [15] IF_NOT_ERROR t, f
//
//        if (stack.top() !== FAILED) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [30] IF_LT min, t, f
//
//        if (stack.top().length < min) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [31] IF_GE max, t, f
//
//        if (stack.top().length >= max) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [32] IF_LT_DYNAMIC min, t, f
//
//        if (stack.top().length < stack[min]) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [33] IF_GE_DYNAMIC max, t, f
//
//        if (stack.top().length >= stack[max]) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [16] WHILE_NOT_ERROR b
//
//        while(stack.top() !== FAILED) {
//          interpret(ip + 2, ip + 2 + b);
//        }
//
// Matching
// --------
//
// [17] MATCH_ANY a, f, ...
//
//        if (input.length > currPos) {
//          interpret(ip + 3, ip + 3 + a);
//        } else {
//          interpret(ip + 3 + a, ip + 3 + a + f);
//        }
//
// [18] MATCH_STRING s, a, f, ...
//
//        if (input.substr(currPos, literals[s].length) === literals[s]) {
//          interpret(ip + 4, ip + 4 + a);
//        } else {
//          interpret(ip + 4 + a, ip + 4 + a + f);
//        }
//
// [19] MATCH_STRING_IC s, a, f, ...
//
//        if (input.substr(currPos, literals[s].length).toLowerCase() === literals[s]) {
//          interpret(ip + 4, ip + 4 + a);
//        } else {
//          interpret(ip + 4 + a, ip + 4 + a + f);
//        }
//
// [20] MATCH_CHAR_CLASS c, a, f, ...
//
//        if (classes[c].test(input.charAt(currPos))) {
//          interpret(ip + 4, ip + 4 + a);
//        } else {
//          interpret(ip + 4 + a, ip + 4 + a + f);
//        }
//
// [21] ACCEPT_N n
//
//        stack.push(input.substring(currPos, n));
//        currPos += n;
//
// [22] ACCEPT_STRING s
//
//        stack.push(literals[s]);
//        currPos += literals[s].length;
//
// [23] FAIL e
//
//        stack.push(FAILED);
//        fail(expectations[e]);
//
// Calls
// -----
//
// [24] LOAD_SAVED_POS p
//
//        savedPos = stack[p];
//
// [25] UPDATE_SAVED_POS
//
//        savedPos = currPos;
//
// [26] CALL f, n, pc, p1, p2, ..., pN
//
//        value = functions[f](stack[p1], ..., stack[pN]);
//        stack.pop(n);
//        stack.push(value);
//
// Rules
// -----
//
// [27] RULE r
//
//        stack.push(parseRule(r));
//
// Failure Reporting
// -----------------
//
// [28] SILENT_FAILS_ON
//
//        silentFails++;
//
// [29] SILENT_FAILS_OFF
//
//        silentFails--;
//
// Source Mapping
// --------------
//
// [37] SOURCE_MAP_PUSH n
//
//        Everything generated from here until the corresponding SOURCE_MAP_POP
//        will be wrapped in a SourceNode tagged with locations[n].
//
// [38] SOURCE_MAP_POP
//
//        See above.
//
// [39] SOURCE_MAP_LABEL_PUSH sp, label, loc
//
//        Mark that the stack location sp will be used to hold the value
//        of the label named literals[label], with location info locations[loc]
//
// [40] SOURCE_MAP_LABEL_POP sp
//
//        End the region started by [39]
//
// This pass can use the results of other previous passes, each of which can
// change the AST (and, as consequence, the bytecode).
//
// In particular, if the pass |inferenceMatchResult| has been run before this pass,
// then each AST node will contain a |match| property, which represents a possible
// match result of the node:
// - `<0` - node is never matched, for example, `!('a'*)` (negation of the always
//          matched node). Generator can put |FAILED| to the stack immediately
// - `=0` - sometimes node matched, sometimes not. This is the same behavior
//          when |match| is missed
// - `>0` - node is always matched, for example, `'a'*` (because result is an
//          empty array, or an array with some elements). The generator does not
//          need to add a check for |FAILED|, because it is impossible
//
// To handle the situation, when the |inferenceMatchResult| has not run (that
// happens, for example, in tests), the |match| value extracted using the
// `|0` trick, which performing cast of any value to an integer with value `0`
// that is equivalent of an unknown match result and signals the generator that
// runtime check for the |FAILED| is required. Trick is explained on the
// Wikipedia page (https://en.wikipedia.org/wiki/Asm.js#Code_generation)
function generateBytecode(ast, options) {
  const literals = [];
  const classes = [];
  const expectations = [];
  const functions = [];
  const locations = [];

  function addLiteralConst(value) {
    const index = literals.indexOf(value);

    return index === -1 ? literals.push(value) - 1 : index;
  }

  function addClassConst(node) {
    const cls = {
      value: node.parts,
      inverted: node.inverted,
      ignoreCase: node.ignoreCase,
    };
    const pattern = JSON.stringify(cls);
    const index = classes.findIndex(c => JSON.stringify(c) === pattern);

    return index === -1 ? classes.push(cls) - 1 : index;
  }

  function addExpectedConst(expected) {
    const pattern = JSON.stringify(expected);
    const index = expectations.findIndex(e => JSON.stringify(e) === pattern);

    return index === -1 ? expectations.push(expected) - 1 : index;
  }

  function addFunctionConst(predicate, params, node) {
    const func = {
      predicate,
      params,
      body: node.code,
      location: node.codeLocation,
    };
    const pattern = JSON.stringify(func);
    const index = functions.findIndex(f => JSON.stringify(f) === pattern);

    return index === -1 ? functions.push(func) - 1 : index;
  }

  function addLocation(location) {
    // Don't bother de-duplicating. There can be a lot of locations,
    // they will almost never collide, and unlike the "consts" above,
    // it won't affect code generation even if they do.
    return locations.push(location) - 1;
  }

  function cloneEnv(env) {
    const clone = {};

    Object.keys(env).forEach(name => {
      clone[name] = env[name];
    });

    return clone;
  }

  function buildSequence(first, ...args) {
    return first.concat(...args);
  }

  function buildCondition(match, condCode, thenCode, elseCode) {
    if (match === ALWAYS_MATCH) { return thenCode; }
    if (match === NEVER_MATCH)  { return elseCode; }

    return condCode.concat(
      [thenCode.length, elseCode.length],
      thenCode,
      elseCode
    );
  }

  function buildLoop(condCode, bodyCode) {
    return condCode.concat([bodyCode.length], bodyCode);
  }

  function buildCall(functionIndex, delta, env, sp) {
    const params = Object.keys(env).map(name => sp - env[name]);

    return [op.CALL, functionIndex, delta, params.length].concat(params);
  }

  function buildSimplePredicate(expression, negative, context) {
    const match = expression.match | 0;

    return buildSequence(
      [op.PUSH_CURR_POS],
      [op.SILENT_FAILS_ON],
      // eslint-disable-next-line no-use-before-define -- Mutual recursion
      generate(expression, {
        sp: context.sp + 1,
        env: cloneEnv(context.env),
        action: null,
      }),
      [op.SILENT_FAILS_OFF],
      buildCondition(
        negative ? -match : match,
        [negative ? op.IF_ERROR : op.IF_NOT_ERROR],
        buildSequence(
          [op.POP],
          [negative ? op.POP : op.POP_CURR_POS],
          [op.PUSH_UNDEFINED]
        ),
        buildSequence(
          [op.POP],
          [negative ? op.POP_CURR_POS : op.POP],
          [op.PUSH_FAILED]
        )
      )
    );
  }

  function buildSemanticPredicate(node, negative, context) {
    const functionIndex = addFunctionConst(
      true, Object.keys(context.env), node
    );

    return buildSequence(
      [op.UPDATE_SAVED_POS],
      buildCall(functionIndex, 0, context.env, context.sp),
      buildCondition(
        node.match | 0,
        [op.IF],
        buildSequence(
          [op.POP],
          negative ? [op.PUSH_FAILED] : [op.PUSH_UNDEFINED]
        ),
        buildSequence(
          [op.POP],
          negative ? [op.PUSH_UNDEFINED] : [op.PUSH_FAILED]
        )
      )
    );
  }

  function buildAppendLoop(expressionCode) {
    return buildLoop(
      [op.WHILE_NOT_ERROR],
      buildSequence([op.APPEND], expressionCode)
    );
  }

  /**
   *
   * @param {import("../../peg").ast.RepeatedBoundary} boundary
   * @param {{ [label: string]: number}} env Mapping of label names to stack positions
   * @param {number} sp Number of the first free slot in the stack
   *
   * @returns {{ pre: number[], post: number[], sp: number}}
   *          Bytecode that should be added before and after parsing and new
   *          first free slot in the stack
   */
  function buildRangeCall(boundary, env, sp, offset) {
    switch (boundary.type) {
      case "constant":
        return { pre: [], post: [], sp };
      case "variable":
        boundary.sp = offset + sp - env[boundary.value];
        return { pre: [], post: [], sp };
      case "function": {
        boundary.sp = offset;

        const functionIndex = addFunctionConst(
          true,
          Object.keys(env),
          { code: boundary.value, codeLocation: boundary.codeLocation }
        );

        return {
          pre: buildCall(functionIndex, 0, env, sp),
          post: [op.NIP],
          // +1 for the function result
          sp: sp + 1,
        };
      }

      // istanbul ignore next Because we never generate invalid boundary type we cannot reach this branch
      default:
        throw new Error(`Unknown boundary type "${boundary.type}" for the "repeated" node`);
    }
  }

  /* eslint capitalized-comments: "off" */
  /**
   * @param {number[]} expressionCode Bytecode for parsing repetitions
   * @param {import("../../peg").ast.RepeatedBoundary} max Maximum boundary of repetitions.
   *        If `null`, the maximum boundary is unlimited
   *
   * @returns {number[]} Bytecode that performs check of the maximum boundary
   */
  function buildCheckMax(expressionCode, max) {
    if (max.value !== null) {
      const checkCode = max.type === "constant"
        ? [op.IF_GE, max.value]
        : [op.IF_GE_DYNAMIC, max.sp];

      // Push `peg$FAILED` - this break loop on next iteration, so |result|
      // will contains not more then |max| elements.
      return buildCondition(
        SOMETIMES_MATCH,
        checkCode,             // if (r.length >= max)   stack:[ [elem...] ]
        [op.PUSH_FAILED],      //   elem = peg$FAILED;   stack:[ [elem...], peg$FAILED ]
        expressionCode         // else
      );                       //   elem = expr();       stack:[ [elem...], elem ]
    }

    return expressionCode;
  }

  /* eslint capitalized-comments: "off" */
  /**
   * @param {number[]} expressionCode Bytecode for parsing repeated elements
   * @param {import("../../peg").ast.RepeatedBoundary} min Minimum boundary of repetitions.
   *        If `null`, the minimum boundary is zero
   *
   * @returns {number[]} Bytecode that performs check of the minimum boundary
   */
  function buildCheckMin(expressionCode, min) {
    const checkCode = min.type === "constant"
      ? [op.IF_LT, min.value]
      : [op.IF_LT_DYNAMIC, min.sp];

    return buildSequence(
      expressionCode,             // result = [elem...];      stack:[ pos, [elem...] ]
      buildCondition(
        SOMETIMES_MATCH,
        checkCode,                // if (result.length < min) {
        /* eslint-disable indent -- Clarity */
        [op.POP, op.POP_CURR_POS, //   currPos = savedPos;    stack:[  ]
         op.PUSH_FAILED],         //   result = peg$FAILED;   stack:[ peg$FAILED ]
        /* eslint-enable indent */
        [op.NIP]                  // }                        stack:[ [elem...] ]
      )
    );
  }

  function buildRangeBody(
    delimiterNode,
    expressionMatch,
    expressionCode,
    context,
    offset
  ) {
    if (delimiterNode) {
      return buildSequence(           //                          stack:[  ]
        [op.PUSH_CURR_POS],           // pos = peg$currPos;       stack:[ pos ]
        // eslint-disable-next-line no-use-before-define -- Mutual recursion
        generate(delimiterNode, {     // item = delim();          stack:[ pos, delim ]
          // +1 for the saved offset
          sp: context.sp + offset + 1,
          env: cloneEnv(context.env),
          action: null,
        }),
        buildCondition(
          delimiterNode.match | 0,
          [op.IF_NOT_ERROR],          // if (item !== peg$FAILED) {
          buildSequence(
            [op.POP],                 //                          stack:[ pos ]
            expressionCode,           //   item = expr();         stack:[ pos, item ]
            buildCondition(
              -expressionMatch,
              [op.IF_ERROR],          //   if (item === peg$FAILED) {
              // If element FAILED, rollback currPos to saved value.
              /* eslint-disable indent -- Clarity */
              [op.POP,                //                          stack:[ pos ]
               op.POP_CURR_POS,       //     peg$currPos = pos;   stack:[  ]
               op.PUSH_FAILED],       //     item = peg$FAILED;   stack:[ peg$FAILED ]
              /* eslint-enable indent */
              // Else, just drop saved currPos.
              [op.NIP]                //   }                      stack:[ item ]
            )
          ),                          // }
          // If delimiter FAILED, currPos not changed, so just drop it.
          [op.NIP]                    //                          stack:[ peg$FAILED ]
        )                             //                          stack:[ <?> ]
      );
    }

    return expressionCode;
  }

  function wrapGenerators(generators) {
    if (options && options.output === "source-and-map") {
      Object.entries(generators).forEach(([name, generator]) => {
        generators[name] = function(node, ...args) {
          const generated = generator(node, ...args);
          // Some generators ("grammar" and "rule") don't return anything,
          // so don't bother wrapping their return values.
          if (generated === undefined || !node.location) {
            return generated;
          }
          return buildSequence(
            [
              op.SOURCE_MAP_PUSH,
              addLocation(node.location),
            ],
            generated,
            [
              op.SOURCE_MAP_POP,
            ]
          );
        };
      });
    }
    return visitor.build(generators);
  }

  const generate = wrapGenerators({
    grammar(node) {
      node.rules.forEach(generate);

      node.literals = literals;
      node.classes = classes;
      node.expectations = expectations;
      node.functions = functions;
      node.locations = locations;
    },

    rule(node) {
      node.bytecode = generate(node.expression, {
        sp: -1,        // Stack pointer
        env: {},       // Mapping of label names to stack positions
        pluck: [],     // Fields that have been picked
        action: null,  // Action nodes pass themselves to children here
      });
    },

    named(node, context) {
      const match = node.match | 0;
      // Expectation not required if node always fail
      const nameIndex = (match === NEVER_MATCH)
        ? null
        : addExpectedConst({ type: "rule", value: node.name });

      // The code generated below is slightly suboptimal because |FAIL| pushes
      // to the stack, so we need to stick a |POP| in front of it. We lack a
      // dedicated instruction that would just report the failure and not touch
      // the stack.
      return buildSequence(
        [op.SILENT_FAILS_ON],
        generate(node.expression, context),
        [op.SILENT_FAILS_OFF],
        buildCondition(match, [op.IF_ERROR], [op.FAIL, nameIndex], [])
      );
    },

    choice(node, context) {
      function buildAlternativesCode(alternatives, context) {
        const match = alternatives[0].match | 0;
        const first = generate(alternatives[0], {
          sp: context.sp,
          env: cloneEnv(context.env),
          action: null,
        });
        // If an alternative always match, no need to generate code for the next
        // alternatives. Because their will never tried to match, any side-effects
        // from next alternatives is impossible so we can skip their generation
        if (match === ALWAYS_MATCH) {
          return first;
        }

        // Even if an alternative never match it can have side-effects from
        // a semantic predicates or an actions, so we can not skip generation
        // of the first alternative.
        // We can do that when analysis for possible side-effects will be introduced
        return buildSequence(
          first,
          alternatives.length > 1
            ? buildCondition(
              SOMETIMES_MATCH,
              [op.IF_ERROR],
              buildSequence(
                [op.POP],
                buildAlternativesCode(alternatives.slice(1), context)
              ),
              []
            )
            : []
        );
      }

      return buildAlternativesCode(node.alternatives, context);
    },

    action(node, context) {
      const env = cloneEnv(context.env);
      const emitCall = node.expression.type !== "sequence"
                    || node.expression.elements.length === 0;
      const expressionCode = generate(node.expression, {
        sp: context.sp + (emitCall ? 1 : 0),
        env,
        action: node,
      });
      const match = node.expression.match | 0;
      // Function only required if expression can match
      const functionIndex = emitCall && match !== NEVER_MATCH
        ? addFunctionConst(false, Object.keys(env), node)
        : null;

      return emitCall
        ? buildSequence(
          [op.PUSH_CURR_POS],
          expressionCode,
          buildCondition(
            match,
            [op.IF_NOT_ERROR],
            buildSequence(
              [op.LOAD_SAVED_POS, 1],
              buildCall(functionIndex, 1, env, context.sp + 2)
            ),
            []
          ),
          [op.NIP]
        )
        : expressionCode;
    },

    sequence(node, context) {
      function buildElementsCode(elements, context) {
        if (elements.length > 0) {
          const processedCount = node.elements.length - elements.length + 1;

          return buildSequence(
            generate(elements[0], {
              sp: context.sp,
              env: context.env,
              pluck: context.pluck,
              action: null,
            }),
            buildCondition(
              elements[0].match | 0,
              [op.IF_NOT_ERROR],
              buildElementsCode(elements.slice(1), {
                sp: context.sp + 1,
                env: context.env,
                pluck: context.pluck,
                action: context.action,
              }),
              buildSequence(
                processedCount > 1 ? [op.POP_N, processedCount] : [op.POP],
                [op.POP_CURR_POS],
                [op.PUSH_FAILED]
              )
            )
          );
        } else {
          if (context.pluck.length > 0) {
            return buildSequence(
              [op.PLUCK, node.elements.length + 1, context.pluck.length],
              context.pluck.map(eSP => context.sp - eSP)
            );
          }

          if (context.action) {
            const functionIndex = addFunctionConst(
              false,
              Object.keys(context.env),
              context.action
            );

            return buildSequence(
              [op.LOAD_SAVED_POS, node.elements.length],
              buildCall(
                functionIndex,
                node.elements.length + 1,
                context.env,
                context.sp
              )
            );
          } else {
            return buildSequence([op.WRAP, node.elements.length], [op.NIP]);
          }
        }
      }

      return buildSequence(
        [op.PUSH_CURR_POS],
        buildElementsCode(node.elements, {
          sp: context.sp + 1,
          env: context.env,
          pluck: [],
          action: context.action,
        })
      );
    },

    labeled(node, context) {
      let env = context.env;
      const label = node.label;
      const sp = context.sp + 1;

      if (label) {
        env = cloneEnv(context.env);
        context.env[node.label] = sp;
      }

      if (node.pick) {
        context.pluck.push(sp);
      }

      const expression = generate(node.expression, {
        sp: context.sp,
        env,
        action: null,
      });

      if (label && node.labelLocation && options && options.output === "source-and-map") {
        return buildSequence(
          [
            op.SOURCE_MAP_LABEL_PUSH,
            sp,
            addLiteralConst(label),
            addLocation(node.labelLocation),
          ],
          expression,
          [op.SOURCE_MAP_LABEL_POP, sp]
        );
      }
      return expression;
    },

    text(node, context) {
      return buildSequence(
        [op.PUSH_CURR_POS],
        generate(node.expression, {
          sp: context.sp + 1,
          env: cloneEnv(context.env),
          action: null,
        }),
        buildCondition(
          node.match | 0,
          [op.IF_NOT_ERROR],
          buildSequence([op.POP], [op.TEXT]),
          [op.NIP]
        )
      );
    },

    simple_and(node, context) {
      return buildSimplePredicate(node.expression, false, context);
    },

    simple_not(node, context) {
      return buildSimplePredicate(node.expression, true, context);
    },

    optional(node, context) {
      return buildSequence(
        generate(node.expression, {
          sp: context.sp,
          env: cloneEnv(context.env),
          action: null,
        }),
        buildCondition(
          // Check expression match, not the node match
          // If expression always match, no need to replace FAILED to NULL,
          // because FAILED will never appeared
          -(node.expression.match | 0),
          [op.IF_ERROR],
          buildSequence([op.POP], [op.PUSH_NULL]),
          []
        )
      );
    },

    zero_or_more(node, context) {
      const expressionCode = generate(node.expression, {
        sp: context.sp + 1,
        env: cloneEnv(context.env),
        action: null,
      });

      return buildSequence(
        [op.PUSH_EMPTY_ARRAY],
        expressionCode,
        buildAppendLoop(expressionCode),
        [op.POP]
      );
    },

    one_or_more(node, context) {
      const expressionCode = generate(node.expression, {
        sp: context.sp + 1,
        env: cloneEnv(context.env),
        action: null,
      });

      return buildSequence(
        [op.PUSH_EMPTY_ARRAY],
        expressionCode,
        buildCondition(
          // Condition depends on the expression match, not the node match
          node.expression.match | 0,
          [op.IF_NOT_ERROR],
          buildSequence(buildAppendLoop(expressionCode), [op.POP]),
          buildSequence([op.POP], [op.POP], [op.PUSH_FAILED])
        )
      );
    },

    repeated(node, context) {
      // Handle case when minimum was literally equals to maximum
      const min = node.min ? node.min : node.max;
      const hasMin = min.type !== "constant" || min.value > 0;
      const hasBoundedMax = node.max.type !== "constant" && node.max.value !== null;

      // +1 for the result slot with an array
      // +1 if we have non-constant (i.e. potentially non-zero) or non-zero minimum
      //    for the position before match for backtracking
      const offset = hasMin ? 2 : 1;

      // Do not generate function for "minimum" if grammar used `exact` syntax
      const minCode = node.min
        ? buildRangeCall(
          node.min,
          context.env,
          context.sp,
          // +1 for the result slot with an array
          // +1 for the saved position
          // +1 if we have a "function" maximum it occupies an additional slot in the stack
          2 + (node.max.type === "function" ? 1 : 0)
        )
        : { pre: [], post: [], sp: context.sp };
      const maxCode = buildRangeCall(node.max, context.env, minCode.sp, offset);

      const firstExpressionCode = generate(node.expression, {
        sp: maxCode.sp + offset,
        env: cloneEnv(context.env),
        action: null,
      });
      const expressionCode = node.delimiter !== null
        ? generate(node.expression, {
          // +1 for the saved position before parsing the `delimiter elem` pair
          sp: maxCode.sp + offset + 1,
          env: cloneEnv(context.env),
          action: null,
        })
        : firstExpressionCode;
      const bodyCode = buildRangeBody(
        node.delimiter,
        node.expression.match | 0,
        expressionCode,
        context,
        offset
      );
      // Check the high boundary, if it is defined.
      const checkMaxCode = buildCheckMax(bodyCode, node.max);
      // For dynamic high boundary we need check the first iteration, because the result can be
      // empty. Constant boundaries does not require that check, because they are always >=1
      const firstElemCode = hasBoundedMax
        ? buildCheckMax(firstExpressionCode, node.max)
        : firstExpressionCode;
      const mainLoopCode = buildSequence(
        // If the low boundary present, then backtracking is possible, so save the current pos
        hasMin ? [op.PUSH_CURR_POS] : [], // var savedPos = curPos;   stack:[ pos ]
        [op.PUSH_EMPTY_ARRAY],            // var result = [];         stack:[ pos, [] ]
        firstElemCode,                    // var elem = expr();       stack:[ pos, [], elem ]
        buildAppendLoop(checkMaxCode),    // while(...)r.push(elem);  stack:[ pos, [...], elem|peg$FAILED ]
        [op.POP]                          //                          stack:[ pos, [...] ] (pop elem===`peg$FAILED`)
      );

      return buildSequence(
        minCode.pre,
        maxCode.pre,
        // Check the low boundary, if it is defined and not |0|.
        hasMin
          ? buildCheckMin(mainLoopCode, min)
          : mainLoopCode,
        maxCode.post,
        minCode.post
      );
    },

    group(node, context) {
      return generate(node.expression, {
        sp: context.sp,
        env: cloneEnv(context.env),
        action: null,
      });
    },

    semantic_and(node, context) {
      return buildSemanticPredicate(node, false, context);
    },

    semantic_not(node, context) {
      return buildSemanticPredicate(node, true, context);
    },

    rule_ref(node) {
      return [op.RULE, asts.indexOfRule(ast, node.name)];
    },

    literal(node) {
      if (node.value.length > 0) {
        const match = node.match | 0;
        // String only required if condition is generated or string is
        // case-sensitive and node always match
        const needConst = match === SOMETIMES_MATCH
                      || (match === ALWAYS_MATCH && !node.ignoreCase);
        const stringIndex = needConst
          ? addLiteralConst(
            node.ignoreCase ? node.value.toLowerCase() : node.value
          )
          : null;
        // Expectation not required if node always match
        const expectedIndex = (match !== ALWAYS_MATCH)
          ? addExpectedConst({
            type: "literal",
            value: node.value,
            ignoreCase: node.ignoreCase,
          })
          : null;

        // For case-sensitive strings the value must match the beginning of the
        // remaining input exactly. As a result, we can use |ACCEPT_STRING| and
        // save one |substr| call that would be needed if we used |ACCEPT_N|.
        return buildCondition(
          match,
          node.ignoreCase
            ? [op.MATCH_STRING_IC, stringIndex]
            : [op.MATCH_STRING, stringIndex],
          node.ignoreCase
            ? [op.ACCEPT_N, node.value.length]
            : [op.ACCEPT_STRING, stringIndex],
          [op.FAIL, expectedIndex]
        );
      }

      return [op.PUSH_EMPTY_STRING];
    },

    class(node) {
      const match = node.match | 0;
      // Character class constant only required if condition is generated
      const classIndex = match === SOMETIMES_MATCH ? addClassConst(node) : null;
      // Expectation not required if node always match
      const expectedIndex = (match !== ALWAYS_MATCH)
        ? addExpectedConst({
          type: "class",
          value: node.parts,
          inverted: node.inverted,
          ignoreCase: node.ignoreCase,
        })
        : null;

      return buildCondition(
        match,
        [op.MATCH_CHAR_CLASS, classIndex],
        [op.ACCEPT_N, 1],
        [op.FAIL, expectedIndex]
      );
    },

    any(node) {
      const match = node.match | 0;
      // Expectation not required if node always match
      const expectedIndex = (match !== ALWAYS_MATCH)
        ? addExpectedConst({
          type: "any",
        })
        : null;

      return buildCondition(
        match,
        [op.MATCH_ANY],
        [op.ACCEPT_N, 1],
        [op.FAIL, expectedIndex]
      );
    },
  });

  generate(ast);
}

module.exports = generateBytecode;
