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
        return consumes(asts.findRule(ast, node.name));
      },

      literal(node) {
        return node.value !== "";
      },

      class: consumesTrue,
      any: consumesTrue
    });

    return consumes(node);
  }
};

module.exports = asts;
