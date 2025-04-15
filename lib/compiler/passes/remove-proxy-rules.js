"use strict";

const asts = require("../asts");
const visitor = require("../visitor");

// Removes proxy rules -- that is, rules that only delegate to other rule.
function removeProxyRules(ast, options, session) {
  function isProxyRule(node) {
    return node.type === "rule" && node.expression.type === "rule_ref";
  }

  function replaceRuleRefs(ast, from, to) {
    const replace = visitor.build({
      rule_ref(node) {
        if (node.name === from) {
          node.name = to;

          session.info(
            `Proxy rule "${from}" replaced by the rule "${to}"`,
            node.location,
            [{
              message: "This rule will be used",
              location: asts.findRule(ast, to).nameLocation,
            }]
          );
        }
      },
    });

    replace(ast);
  }

  ast.rules.forEach(rule => {
    if (isProxyRule(rule)) {
      replaceRuleRefs(ast, rule.name, rule.expression.name);
    }
  });
}

module.exports = removeProxyRules;
