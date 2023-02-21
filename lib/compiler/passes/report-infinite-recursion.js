"use strict";

const asts = require("../asts");
const visitor = require("../visitor");

// Reports left recursion in the grammar, which prevents infinite recursion in
// the generated parser.
//
// Both direct and indirect recursion is detected. The pass also correctly
// reports cases like this:
//
//   start = "a"? start
//
// In general, if a rule reference can be reached without consuming any input,
// it can lead to left recursion.
function reportInfiniteRecursion(ast, options, session) {
  // Array with rule names for error message
  const visitedRules = [];
  // Array with rule_refs for diagnostic
  const backtraceRefs = [];

  const check = visitor.build({
    rule(node) {
      visitedRules.push(node.name);
      check(node.expression);
      visitedRules.pop();
    },

    sequence(node) {
      node.elements.every(element => {
        check(element);

        return !asts.alwaysConsumesOnSuccess(ast, element);
      });
    },

    repeated(node) {
      check(node.expression);

      // If an expression does not consume input then recursion
      // over delimiter is possible
      if (node.delimiter
       && !asts.alwaysConsumesOnSuccess(ast, node.expression)
      ) {
        check(node.delimiter);
      }
    },

    rule_ref(node) {
      backtraceRefs.push(node);

      const rule = asts.findRule(ast, node.name);

      if (visitedRules.indexOf(node.name) !== -1) {
        visitedRules.push(node.name);

        session.error(
          "Possible infinite loop when parsing (left recursion: "
            + visitedRules.join(" -> ")
            + ")",
          rule.nameLocation,
          backtraceRefs.map((ref, i, a) => ({
            message: i + 1 !== a.length
              ? `Step ${i + 1}: call of the rule "${ref.name}" without input consumption`
              : `Step ${i + 1}: call itself without input consumption - left recursion`,
            location: ref.location,
          }))
        );

        // Because we enter into recursion we should break it
        return;
      }

      // Because we run all checks in one stage, some rules could be missing - this check
      // executed in parallel
      if (rule) {
        check(rule);
      }
      backtraceRefs.pop();
    },
  });

  check(ast);
}

module.exports = reportInfiniteRecursion;
