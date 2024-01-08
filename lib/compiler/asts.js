"use strict";

const visitor = require("./visitor");

/**
 * Combine two things, each of which might be an array, into a single value,
 * in the order [...a, ...b].
 *
 * @template T
 * @param {T | T[]} a
 * @param {T | T[]} b
 * @returns {T | T[]}
 */
function combinePossibleArrays(a, b) {
  // First might be an array, second will not.  Either might be null.
  if (!(a && b)) {
    return a || b;
  }
  const aa = Array.isArray(a) ? a : [a];
  aa.push(b);
  return aa;
}

// AST utilities.
const asts = {
  /**
   * Find the rule with the given name, if it exists.
   *
   * @param {PEG.ast.Grammar} ast
   * @param {string} name
   * @returns {PEG.ast.Rule | undefined}
   */
  findRule(ast, name) {
    for (let i = 0; i < ast.rules.length; i++) {
      if (ast.rules[i].name === name) {
        return ast.rules[i];
      }
    }

    return undefined;
  },

  /**
   * Find the index of the rule with the given name, if it exists.
   * Otherwise returns -1.
   *
   * @param {PEG.ast.Grammar} ast
   * @param {string} name
   * @returns {number}
   */
  indexOfRule(ast, name) {
    for (let i = 0; i < ast.rules.length; i++) {
      if (ast.rules[i].name === name) {
        return i;
      }
    }

    // istanbul ignore next Presence of rules checked using another approach that not involve this function
    // Any time when it is called the rules always exist
    return -1;
  },

  alwaysConsumesOnSuccess(ast, node) {
    function consumesTrue()  { return true;  }
    function consumesFalse() { return false; }

    const consumes = visitor.build({
      choice(node) {
        return node.alternatives.every(consumes);
      },

      sequence(node) {
        return node.elements.some(consumes);
      },

      simple_and: consumesFalse,
      simple_not: consumesFalse,
      optional: consumesFalse,
      zero_or_more: consumesFalse,
      repeated(node) {
        // If minimum is `null` it is equals to maximum (parsed from `|exact|` syntax)
        const min = node.min ? node.min : node.max;

        // If the low boundary is variable then it can be zero.
        // Expression, repeated zero times, does not consume any input
        // but always matched - so it does not always consumes on success
        if (min.type !== "constant" || min.value === 0) {
          return false;
        }
        if (consumes(node.expression)) {
          return true;
        }
        // |node.delimiter| used only when |node.expression| match at least two times
        // The first `if` filtered out all non-constant minimums, so at this point
        // |min.value| is always a constant
        if (min.value > 1 && node.delimiter && consumes(node.delimiter)) {
          return true;
        }

        return false;
      },
      semantic_and: consumesFalse,
      semantic_not: consumesFalse,

      rule_ref(node) {
        const rule = asts.findRule(ast, node.name);

        // Because we run all checks in one stage, some rules could be missing.
        // Checking for missing rules could be executed in parallel to this check
        return rule ? consumes(rule) : undefined;
      },

      library_ref() {
        // No way to know for external rules.
        return false;
      },

      literal(node) {
        return node.value !== "";
      },

      class: consumesTrue,
      any: consumesTrue,
    });

    return consumes(node);
  },

  combine(asts) {
    return asts.reduce((combined, ast) => {
      combined.topLevelInitializer = combinePossibleArrays(
        combined.topLevelInitializer,
        ast.topLevelInitializer
      );
      combined.initializer = combinePossibleArrays(
        combined.initializer,
        ast.initializer
      );
      combined.rules = combined.rules.concat(ast.rules);
      return combined;
    });
  },
};

module.exports = asts;
