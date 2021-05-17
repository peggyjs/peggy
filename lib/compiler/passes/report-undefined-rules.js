"use strict";

const GrammarError = require("../../grammar-error");
const asts = require("../asts");
const visitor = require("../visitor");

// Checks that all referenced rules exist.
function reportUndefinedRules(ast) {
  const check = visitor.build({
    rule_ref(node) {
      if (!asts.findRule(ast, node.name)) {
        throw new GrammarError(
          `Rule "${node.name}" is not defined`,
          node.location
        );
      }
    }
  });

  check(ast);
}

module.exports = reportUndefinedRules;
