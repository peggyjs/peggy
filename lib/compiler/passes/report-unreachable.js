// @ts-check
"use strict";

const visitor = require("../visitor");
const { ALWAYS_MATCH, NEVER_MATCH } = require("./inference-match-result");

/** @type {PEG.Pass} */
function reportUnreachable(ast, options, session) {
  const visit = visitor.build({
    /**
     * @param {PEG.ast.Choice} node
     */
    choice(node) {
      node.alternatives.forEach(a => visit(a));
      for (let i = 0; i < node.alternatives.length - 1; i++) {
        const alt = node.alternatives[i];
        if (alt.match === ALWAYS_MATCH) {
          session.warning(
            "Always matches.  Following alternatives may not be reachable.",
            alt.location
          );
        }
      }
    },
    /**
     * @param {PEG.ast.Prefixed} node
     */
    simple_and(node) {
      visit(node.expression);
      if (node.expression.match === ALWAYS_MATCH) {
        session.warning(
          "Always matches, making the & predicate redundant.",
          node.expression.location
        );
      } else if (node.expression.match === NEVER_MATCH) {
        session.warning(
          "Never matches, making the & predicate always fail.",
          node.expression.location
        );
      }
    },
    /**
     * @param {PEG.ast.Prefixed} node
     */
    simple_not(node) {
      visit(node.expression);
      if (node.expression.match === ALWAYS_MATCH) {
        session.warning(
          "Always matches, making the ! predicate always fail.",
          node.expression.location
        );
      } else if (node.expression.match === NEVER_MATCH) {
        session.warning(
          "Never matches, making the ! predicate redundant.",
          node.expression.location
        );
      }
    },
  });
  visit(ast);
}

module.exports = reportUnreachable;
