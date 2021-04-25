"use strict";

const asts = require("../asts");
const visitor = require("../visitor");

// Checks that all referenced rules exist.
function reportUndefinedRules(ast, options, session) {
  const check = visitor.build({
    rule_ref(node) {
      if (!asts.findRule(ast, node.name)) {
        session.error(
          `Rule "${node.name}" is not defined`,
          node.location
        );
      }
    },
  });

  check(ast);
}

module.exports = reportUndefinedRules;
