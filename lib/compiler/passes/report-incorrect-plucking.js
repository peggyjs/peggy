"use strict";

const GrammarError = require("../../grammar-error");
const visitor = require("../visitor");

//
// Compiler pass to ensure the following are enforced:
//
//   - plucking can not be done with an action block
//
function reportIncorrectPlucking(ast) {
  const check = visitor.build({
    action(node) {
      check(node.expression, true);
    },

    labeled(node, action) {
      if (node.pick) {
        if (action) {
          throw new GrammarError(
            "\"@\" cannot be used with an action block "
              + "at line " + node.location.start.line + ", "
              + "column " + node.location.start.column + ".",
            node.location
          );
        }
      }

      check(node.expression);
    }
  });

  check(ast);
}

module.exports = reportIncorrectPlucking;
