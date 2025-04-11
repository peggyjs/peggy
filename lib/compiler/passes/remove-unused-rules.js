"use strict";
const visitor = require("../visitor");

/**
 * Remove rules that cannot be reached from the allowedStartRules.  This
 * includes rules that are never referenced in the input grammar, rules that
 * only they call, and rules removed by previous passes such as
 * remove-proxy-rules and merge-character-classes.
 *
 * @type {PEG.Pass}
 */
function removeUnusedRules(ast, options, session) {
  const rules = Object.create(null);
  ast.rules.forEach(rule => { rules[rule.name] = rule; });
  // Follow the call graph, starting at each of the startRules.
  // Try to not visit the same portion of the graph more than once.
  // report-infinite-recursion should have already found and errored
  // on loops.
  const queue = [...options.allowedStartRules];
  const found = new Set();
  const findRefs = visitor.build({
    rule_ref(node) {
      queue.push(node.name);
    },
  });
  while (queue.length) {
    const r = queue.shift();
    if (!found.has(r)) {
      found.add(r);
      findRefs(rules[r]);
    }
  }
  ast.rules = ast.rules.filter(r => {
    if (found.has(r.name)) {
      return true;
    }
    session.info(`Removing unused rule: "${r.name}"`, r.location);
    return false;
  });
}

module.exports = removeUnusedRules;
