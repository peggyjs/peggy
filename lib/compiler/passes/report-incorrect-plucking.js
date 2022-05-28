"use strict";

const visitor = require("../visitor");

//
// Compiler pass to ensure the following are enforced:
//
//   - plucking can not be done with an action block
//
function reportIncorrectPlucking(ast, options, session) {
  const check = visitor.build({
    action(node) {
      check(node.expression, node);
    },

    labeled(node, action) {
      if (node.pick) {
        if (action) {
          session.error(
            "\"@\" cannot be used with an action block",
            node.labelLocation,
            [{
              message: "Action block location",
              location: action.codeLocation,
            }]
          );
        }
      }

      check(node.expression);
    },
  });

  check(ast);
}

module.exports = reportIncorrectPlucking;
