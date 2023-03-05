"use strict";

const asts = require("../asts");
const visitor = require("../visitor");

// Reports expressions that don't consume any input inside |*|, |+| or repeated in the
// grammar, which prevents infinite loops in the generated parser.
function reportInfiniteRepetition(ast, options, session) {
  const check = visitor.build({
    zero_or_more(node) {
      if (!asts.alwaysConsumesOnSuccess(ast, node.expression)) {
        session.error(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input)",
          node.location
        );
      }
    },

    one_or_more(node) {
      if (!asts.alwaysConsumesOnSuccess(ast, node.expression)) {
        session.error(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input)",
          node.location
        );
      }
    },

    repeated(node) {
      // No need to check min or max.  They can only be numbers, variable
      // names, or code blocks.

      if (node.delimiter) {
        check(node.delimiter);
      }
      if (asts.alwaysConsumesOnSuccess(ast, node.expression)
          || (node.delimiter
              && asts.alwaysConsumesOnSuccess(ast, node.delimiter))) {
        return;
      }
      if (node.max.value === null) {
        session.error(
          "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          node.location
        );
      } else {
        // If minimum is `null` it is equals to maximum (parsed from `|exact|` syntax)
        const min = node.min ? node.min : node.max;

        // Because the high boundary is defined, infinity repetition is not possible
        // but the grammar will waste of CPU
        session.warning(
          min.type === "constant" && node.max.type === "constant"
            ? `An expression may not consume any input and may always match ${node.max.value} times`
            : "An expression may not consume any input and may always match with a maximum repetition count",
          node.location
        );
      }
    },
  });

  check(ast);
}

module.exports = reportInfiniteRepetition;
