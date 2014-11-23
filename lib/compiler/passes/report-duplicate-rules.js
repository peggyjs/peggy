"use strict";

const asts = require("../asts");
const visitor = require("../visitor");

// Checks that each rule is defined only once.
function reportDuplicateRules(ast, options, session) {
  const defined = {};
  const imported = {};

  function checkRepository(repository, node, errorMessage, detailMessage) {
    if (Object.prototype.hasOwnProperty.call(repository, node.name)) {
      session.error(
        errorMessage,
        node.nameLocation,
        [{
          message: detailMessage,
          location: repository[node.name],
        }]
      );

      return true;
    }

    return false;
  }

  const check = visitor.build({
    imported_rule(node) {
      if (checkRepository(
        imported,
        node,
        `Rule "${node.name}" is already imported`,
        "Original import location"
      )) {
        // Do not rewrite original rule location
        return;
      }

      imported[node.name] = node.location;

      const rule = asts.findRule(ast, node.name);
      if (rule) {
        session.error(
          node.aliasLocation
            ? `Rule with the same name "${node.name}" is already defined in the grammar`
            : `Rule with the same name "${node.name}" is already defined in the grammar, try to add \`as <alias_name>\` to the imported one`,
          node.nameLocation,
          [{
            message: "Rule defined here",
            location: rule.nameLocation,
          }]
        );
      }
    },

    rule(node) {
      if (checkRepository(
        defined,
        node,
        `Rule "${node.name}" is already defined`,
        "Original rule location"
      )) {
        // Do not rewrite original rule location
        return;
      }

      defined[node.name] = node.nameLocation;
    },
  });

  check(ast);
}

module.exports = reportDuplicateRules;
