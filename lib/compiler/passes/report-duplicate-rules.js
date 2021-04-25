"use strict";

const visitor = require("../visitor");

// Checks that each rule is defined only once.
function reportDuplicateRules(ast, options, session) {
  const rules = {};

  const check = visitor.build({
    rule(node) {
      if (Object.prototype.hasOwnProperty.call(rules, node.name)) {
        session.error(
          `Rule "${node.name}" is already defined`,
          node.nameLocation,
          [{
            message: "Original rule location",
            location: rules[node.name],
          }]
        );

        // Do not rewrite original rule location
        return;
      }

      rules[node.name] = node.nameLocation;
    },
  });

  check(ast);
}

module.exports = reportDuplicateRules;
