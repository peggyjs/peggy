"use strict";

const visitor      = require("../visitor");
const asts         = require("../asts");
const GrammarError = require("../../grammar-error");

const ALWAYS_MATCH = 1;
const SOMETIMES_MATCH = 0;
const NEVER_MATCH = -1;

// Inference match result of the each node. Can be:
// -1: negative result, matching of that node always fails
//  0: neutral result, may be fail, may be match
//  1: positive result, always match
function inferenceMatchResult(ast) {
  function sometimesMatch(node) { return (node.match = SOMETIMES_MATCH); }
  function alwaysMatch(node) {
    inference(node.expression);

    return (node.match = ALWAYS_MATCH);
  }

  function inferenceExpression(node) {
    return (node.match = inference(node.expression));
  }
  function inferenceElements(elements, forChoice) {
    const length = elements.length;
    let always = 0;
    let never = 0;

    for (let i = 0; i < length; ++i) {
      const result = inference(elements[i]);

      if (result === ALWAYS_MATCH) { ++always; }
      if (result === NEVER_MATCH)  { ++never;  }
    }

    if (always === length) {
      return ALWAYS_MATCH;
    }
    if (forChoice) {
      return never === length ? NEVER_MATCH : SOMETIMES_MATCH;
    }

    return never > 0 ? NEVER_MATCH : SOMETIMES_MATCH;
  }

  const inference = visitor.build({
    rule(node) {
      let oldResult;
      let count = 0;

      // If property not yet calculated, do that
      if (typeof node.match === "undefined") {
        node.match = SOMETIMES_MATCH;
        do {
          oldResult = node.match;
          node.match = inference(node.expression);
          // 6 == 3! -- permutations count for all transitions from one match
          // state to another.
          // After 6 iterations the cycle with guarantee begins
          // For example, an input of `start = [] start` will generate the
          // sequence: 0 -> -1 -> -1 (then stop)
          //
          // A more complex grammar theoretically would generate the
          // sequence: 0 -> 1 -> 0 -> -1 -> 0 -> 1 -> ... (then cycle)
          // but there are no examples of such grammars yet (possible, they
          // do not exist at all)

          // istanbul ignore next  This is canary test, shouldn't trigger in real life
          if (++count > 6) {
            throw new GrammarError(
              "Infinity cycle detected when trying to evaluate node match result",
              node.location
            );
          }
        } while (oldResult !== node.match);
      }

      return node.match;
    },
    named:        inferenceExpression,
    choice(node) {
      return (node.match = inferenceElements(node.alternatives, true));
    },
    action:       inferenceExpression,
    sequence(node) {
      return (node.match = inferenceElements(node.elements, false));
    },
    labeled:      inferenceExpression,
    text:         inferenceExpression,
    simple_and:   inferenceExpression,
    simple_not(node) {
      return (node.match = -inference(node.expression));
    },
    optional:     alwaysMatch,
    zero_or_more: alwaysMatch,
    one_or_more:  inferenceExpression,
    group:        inferenceExpression,
    semantic_and: sometimesMatch,
    semantic_not: sometimesMatch,
    rule_ref(node) {
      const rule = asts.findRule(ast, node.name);

      return (node.match = inference(rule));
    },
    literal(node) {
      // Empty literal always match on any input
      const match = node.value.length === 0 ? ALWAYS_MATCH : SOMETIMES_MATCH;

      return (node.match = match);
    },
    class(node) {
      // Empty character class never match on any input
      const match = node.parts.length === 0 ? NEVER_MATCH : SOMETIMES_MATCH;

      return (node.match = match);
    },
    // |any| not match on empty input
    any:          sometimesMatch,
  });

  inference(ast);
}

inferenceMatchResult.ALWAYS_MATCH    = ALWAYS_MATCH;
inferenceMatchResult.SOMETIMES_MATCH = SOMETIMES_MATCH;
inferenceMatchResult.NEVER_MATCH     = NEVER_MATCH;

module.exports = inferenceMatchResult;
