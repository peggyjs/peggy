"use strict";

// Simple AST node visitor builder.
const visitor = {
  build(functions) {
    function visit(node, ...args) {
      return functions[node.type](node, ...args);
    }

    function visitNop() {
      // Do nothing.
    }

    function visitExpression(node, ...args) {
      visit(node.expression, ...args);
    }

    function visitChildren(property) {
      return function(node, ...args) {
        node[property].forEach(child => visit(child, ...args));
      };
    }

    const DEFAULT_FUNCTIONS = {
      grammar(node, ...args) {
        if (node.topLevelInitializer) {
          visit(node.topLevelInitializer, ...args);
        }

        if (node.initializer) {
          visit(node.initializer, ...args);
        }

        node.rules.forEach(rule => visit(rule, ...args));
      },

      top_level_initializer: visitNop,
      initializer: visitNop,
      rule: visitExpression,
      named: visitExpression,
      choice: visitChildren("alternatives"),
      action: visitExpression,
      sequence: visitChildren("elements"),
      labeled: visitExpression,
      text: visitExpression,
      simple_and: visitExpression,
      simple_not: visitExpression,
      optional: visitExpression,
      zero_or_more: visitExpression,
      one_or_more: visitExpression,
      group: visitExpression,
      semantic_and: visitNop,
      semantic_not: visitNop,
      rule_ref: visitNop,
      literal: visitNop,
      class: visitNop,
      any: visitNop
    };

    Object.keys(DEFAULT_FUNCTIONS).forEach(type => {
      if (!Object.prototype.hasOwnProperty.call(functions, type)) {
        functions[type] = DEFAULT_FUNCTIONS[type];
      }
    });

    return visit;
  }
};

module.exports = visitor;
