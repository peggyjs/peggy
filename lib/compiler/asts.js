"use strict";

const visitor = require("./visitor");

// AST utilities.
const asts = {
  findRule(ast, name) {
    for (let i = 0; i < ast.rules.length; i++) {
      if (ast.rules[i].name === name) {
        return ast.rules[i];
      }
    }

    return undefined;
  },

  indexOfRule(ast, name) {
    for (let i = 0; i < ast.rules.length; i++) {
      if (ast.rules[i].name === name) {
        return i;
      }
    }

    // istanbul ignore next Presence of rules checked using another approach that not involve this function
    // Any time when it is called the rules always exist
    return -1;
  },

  alwaysConsumesOnSuccess(ast, node) {
    function consumesTrue()  { return true;  }
    function consumesFalse() { return false; }

    const consumes = visitor.build({
      choice(node) {
        return node.alternatives.every(consumes);
      },

      sequence(node) {
        return node.elements.some(consumes);
      },

      simple_and: consumesFalse,
      simple_not: consumesFalse,
      optional: consumesFalse,
      zero_or_more: consumesFalse,
      semantic_and: consumesFalse,
      semantic_not: consumesFalse,

      rule_ref(node) {
        const rule = asts.findRule(ast, node.name);

        // Because we run all checks in one stage, some rules could be missing.
        // Checking for missing rules could be executed in parallel to this check
        return rule ? consumes(rule) : undefined;
      },

      literal(node) {
        return node.value !== "";
      },

      class: consumesTrue,
      any: consumesTrue,
    });

    return consumes(node);
  },
};

module.exports = asts;
