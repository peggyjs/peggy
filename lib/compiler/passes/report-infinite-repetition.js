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
      if (asts.alwaysConsumesOnSuccess(ast, node.expression)) {
        return;
      }
      if (node.max.value === null) {
        session.error(
          "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          node.location
        );
      } else {
        session.warning(
          `An expression always match ${node.max.value} times, because it does not consume any input`,
          node.location
        );
      }
    },
  });

  check(ast);
}

module.exports = reportInfiniteRepetition;
