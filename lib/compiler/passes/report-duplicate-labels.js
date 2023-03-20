"use strict";

const visitor = require("../visitor");

// Checks that each label is defined only once within each scope.
function reportDuplicateLabels(ast, options, session) {
  function cloneEnv(env) {
    const clone = {};

    Object.keys(env).forEach(name => {
      clone[name] = env[name];
    });

    return clone;
  }

  function checkExpressionWithClonedEnv(node, env) {
    // eslint-disable-next-line no-use-before-define -- Mutual recursion
    check(node.expression, cloneEnv(env));
  }

  const check = visitor.build({
    rule(node) {
      check(node.expression, { });
    },

    choice(node, env) {
      node.alternatives.forEach(alternative => {
        check(alternative, cloneEnv(env));
      });
    },

    action: checkExpressionWithClonedEnv,

    labeled(node, env) {
      const label = node.label;
      if (label && Object.prototype.hasOwnProperty.call(env, label)) {
        session.error(
          `Label "${node.label}" is already defined`,
          node.labelLocation,
          [{
            message: "Original label location",
            location: env[label],
          }]
        );
      }

      check(node.expression, env);

      env[node.label] = node.labelLocation;
    },

    text: checkExpressionWithClonedEnv,
    simple_and: checkExpressionWithClonedEnv,
    simple_not: checkExpressionWithClonedEnv,
    optional: checkExpressionWithClonedEnv,
    zero_or_more: checkExpressionWithClonedEnv,
    one_or_more: checkExpressionWithClonedEnv,
    repeated(node, env) {
      if (node.delimiter) {
        check(node.delimiter, cloneEnv(env));
      }

      check(node.expression, cloneEnv(env));
    },
    group: checkExpressionWithClonedEnv,
  });

  check(ast);
}

module.exports = reportDuplicateLabels;
