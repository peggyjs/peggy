"use strict";

const visitor = require("../visitor");

// Reports expressions that don't consume any input inside |*|, |+| or repeated in the
// grammar, which prevents infinite loops in the generated parser.
function reportInfiniteRepetition(ast, _options, session) {
  const rules = new Map();
  const results = new Map();
  const evaluating = new Set();
  const repetitions = [];

  // Build each expression's consumption summary while visiting its children.
  // Resolve rule references afterwards, without traversing their ASTs again.
  function consumes(summary) {
    if (typeof summary !== "function") {
      return summary;
    }
    if (results.has(summary)) {
      return results.get(summary);
    }
    // Left recursion is reported by its own pass. Do not recurse indefinitely
    // if it or an undefined rule is present while checks are still running.
    if (evaluating.has(summary)) {
      return undefined;
    }
    evaluating.add(summary);
    const result = summary();
    evaluating.delete(summary);
    results.set(summary, result);
    return result;
  }

  let check = null;

  function visitExpression(node) {
    return check(node.expression);
  }

  function visitExpressionAndReturnFalse(node) {
    check(node.expression);
    return false;
  }

  function checkRepetition(node) {
    const expression = check(node.expression);
    repetitions.push(() => {
      if (!consumes(expression)) {
        session.error(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input)",
          node.location
        );
      }
    });
    return expression;
  }

  check = visitor.build({
    grammar(node) {
      node.rules.forEach(rule => {
        rules.set(rule.name, check(rule.expression));
      });
    },

    named: visitExpression,
    action: visitExpression,
    labeled: visitExpression,
    text: visitExpression,
    group: visitExpression,

    choice(node) {
      const alternatives = node.alternatives.map(check);
      return () => alternatives.every(consumes);
    },

    sequence(node) {
      const elements = node.elements.map(check);
      return () => elements.some(consumes);
    },

    simple_and: visitExpressionAndReturnFalse,
    simple_not: visitExpressionAndReturnFalse,
    optional: visitExpressionAndReturnFalse,
    zero_or_more(node) {
      checkRepetition(node);
      return false;
    },
    one_or_more: checkRepetition,

    repeated(node) {
      // Delimiters are visited first to retain diagnostic order.
      const delimiter = node.delimiter ? check(node.delimiter) : false;
      const expression = check(node.expression);
      const min = node.min ? node.min : node.max;

      repetitions.push(() => {
        if (consumes(expression) || consumes(delimiter)) {
          return;
        }
        if (node.max.value === null) {
          session.error(
            "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
            node.location
          );
        } else {
          session.warning(
            min.type === "constant" && node.max.type === "constant"
              ? `An expression may not consume any input and may always match ${node.max.value} times`
              : "An expression may not consume any input and may always match with a maximum repetition count",
            node.location
          );
        }
      });

      return () => min.type === "constant" && min.value !== 0
        && (consumes(expression) || (min.value > 1 && consumes(delimiter)));
    },

    semantic_and() { return false; },
    semantic_not() { return false; },
    library_ref() { return false; },

    rule_ref(node) {
      return () => consumes(rules.get(node.name));
    },

    literal(node) {
      return node.value !== "";
    },
    class() { return true; },
    any() { return true; },
  });

  check(ast);
  repetitions.forEach(report => report());
}

module.exports = reportInfiniteRepetition;
