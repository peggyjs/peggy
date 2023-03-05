"use strict";

const visitor = require("../visitor");

/**
 * This passes will remove any non-used templates
 */
function removeNonInstantiatedTemplates(ast, options, session) {
  const rulesToRemove = [];
  const danglingRemoveVisitor = visitor.build({

    rule(node) {
      if (!node.templateParams) {
        return node;
      }
      rulesToRemove.push(node.name);

      return null;
    },
  });

  danglingRemoveVisitor(ast);

  while (rulesToRemove.length) {
    const name = rulesToRemove.pop();
    session.info("Removing dangling generic rule", name);

    const idx = ast.rules.findIndex(x => x.name === name);
    ast.rules.splice(idx, 1);
  }
}

module.exports = removeNonInstantiatedTemplates;
