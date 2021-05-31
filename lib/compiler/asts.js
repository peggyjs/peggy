"use strict";

const visitor = require("./visitor");
const { SourceNode } = require("source-map");

// AST utilities.
const asts = {
  toSourceNode(node, options, name) {
    return new SourceNode(
      node.codeLocation.start.line,
      // source-map columns are 0-based, peggy columns is 1-based
      node.codeLocation.start.column - 1,
      options.grammarSource,
      node.code,
      name
    );
  },

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
