"use strict";

const GrammarError = require("../../grammar-error");
const asts = require("../asts");
const visitor = require("../visitor");

/**
 * This pass will instantiate referenced templates
 * The instantiation is done by duplicating the templated rule, and replacing any parameters by whatever they are
 */
function instantiateTemplates(ast, options, session) {
  function instantiateTemplate(template, templateArgs) {
    // Javascript does not let us have variables names such as Map<Key,Value>
    // Instead, it accepts MapᐊKeyͺValueᐅ
    // See https://es5.github.io/x7.html#x7.6
    const name =  `${template.name}ᐊ${templateArgs.map(a => a.name).join("ͺ")}ᐅ`;
    const existing = asts.findRule(ast, name);
    if (existing) {
      return existing;
    }

    session.info(`Instantiating ${template.name} with ${templateArgs.map(x => x.name)}`);

    /**
     * This will replace every usage of the template parameters by the args specified in instantiateTemplate
     */
    const instantiateVisitor = visitor.build({

      /**
       * Check if the rule we reference is one of the template parameter.
       * If yes, we replace by the template arguments.
       * Then, if the target rule is a template, we instantiate this template
       */
      rule_ref(node) {
        const i = template.templateParams.declarations.indexOf(node.name);
        if (i === -1 && !node.templateArgs) {
          // We reference a rule that is not a template, and this rule has no parameters
          return node;
        }

        // Find the target rule
        const targetName = (i !== -1) ? templateArgs[i].name : node.name;

        if (node.templateArgs) {
          const targetRule = asts.findRule(ast, targetName);
          if (!targetRule) {
            throw new GrammarError(`Rule "${targetName}" is not defined`, node.location);
          }

          const expected = targetRule.templateParams;

          if (!expected) {
            throw new GrammarError(`Rule "${node.name}" is not a template `, node.location);
          }
          if (expected.declarations.length !== node.templateArgs.length) {
            throw new GrammarError(`Template "${node.name}" expect ${expected.declarations.length} "
            +" arguments, but ${node.templateArgs.length} were given`, node.location);
          }
          const params = node.templateArgs.map(arg => instantiateVisitor(arg));
          // We deep clone to be able to mutate this without side effect
          const clonedTargetRule = JSON.parse(JSON.stringify(targetRule));
          const { name } = instantiateTemplate(clonedTargetRule, params);

          node.name = name;
        } else {
          node.name = targetName;
        }
        delete node.templateArgs;
        return node;
      },

      /**
       * We replace the target template by its instance
       */
      rule(node) {
        if (node !== template) {
          throw new Error("We only support replacing one rule at once, call instantiateRule please ");
        }

        instantiateVisitor(node.expression);

        delete node.templateParams;
        return node;
      },
    });

    const rule = instantiateVisitor(template);
    rule.name = name;
    ast.rules.push(rule);

    return rule;
  }

  // Replace the first template calls: a non-template rule referencing a templated rule.
  // For example the grammar A = B<u> , B<X>=C<X>, C<X>=X will be transformed first as
  // 2. A = Bᐊuᐅ , B<X>=C<X>, C<X>=X , Bᐊuᐅ = Cᐊuᐅ, Cᐊuᐅ = u
  const replaceRootTemplateCalls = visitor.build({
    rule_ref(node) {
      if (!node.templateArgs) {
        return node;
      }

      if (node.templateArgs.some(g => !asts.findRule(ast, g.name))) {
        // This ref depends on parameters, so it is not a root template call
        return node;
      }

      const targetRule = asts.findRule(ast, node.name);
      if (!targetRule) {
        throw new GrammarError(`Rule "${node.name}" is not defined`, node.location);
      }

      const expected = targetRule.templateParams;

      if (!expected) {
        throw new GrammarError(`Rule "${node.name}" is not a template`, node.location);
      }
      if (expected.declarations.length !== node.templateArgs.length) {
        throw new GrammarError(`Template "${node.name}" expect ${expected.declarations.length} "
            +" arguments, but ${node.templateArgs.length} were given`, node.location);
      }

      // We clone because it mutates
      const clonedTargetRule = JSON.parse(JSON.stringify(targetRule));
      const { name } = instantiateTemplate(clonedTargetRule, node.templateArgs);

      // Finally override the redirection
      node.name = name;
      return node;
    },
  });

  replaceRootTemplateCalls(ast);
}

module.exports = instantiateTemplates;
