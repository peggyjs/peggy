"use strict";

const GrammarError = require("../../grammar-error");
const visitor = require("../visitor");

// Checks that each rule is defined only once.
function reportDuplicateRules(ast) {
  const rules = {};

  const check = visitor.build({
    rule(node) {
      if (Object.prototype.hasOwnProperty.call(rules, node.name)) {
        throw new GrammarError(
          `Rule "${node.name}" is already defined`,
          node.nameLocation,
          [{
            message: "Original rule location",
            location: rules[node.name]
          }]
        );
      }

      rules[node.name] = node.nameLocation;
    }
  });

  check(ast);
}

module.exports = reportDuplicateRules;
