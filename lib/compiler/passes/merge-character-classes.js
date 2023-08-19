"use strict";

// A const asts = require("../asts");
const visitor = require("../visitor");

// Merges a choice character classes into a character class
function mergeCharacterClasses(ast, options) {
  if (!options || !options.mergeCharacterClasses) {
    return;
  }
  // Build a map from rule names to rules for quick lookup of
  // ref_fules.
  const rules = Object.create(null);
  ast.rules.forEach(rule => (rules[rule.name] = rule.expression));
  // Keep a map of which rules have been processed, so that when
  // we find a ref_rule, we can make sure its processed, before we
  // try to use it.
  const processedRules = Object.create(null);
  const [asClass, merge] = [
    node => {
      if (node.type === "class" && !node.inverted) {
        return node;
      }
      if (node.type === "literal" && node.value.length === 1) {
        return { type: "class", parts: [node.value], inverted:false, ignoreCase: node.ignoreCase };
      }
      if (node.type === "choice" && node.alternatives.length === 1) {
        return asClass(node.alternatives[0]);
      }
      if (node.type === "rule_ref") {
        const ref = rules[node.name];
        if (ref) {
          if (!processedRules[node.name]) {
            processedRules[node.name] = true;
            merge(ref);
          }
          const cls = asClass(ref);
          // Return a clone, not the original, because the value we return
          // may get merged into.
          return cls && {
            type: cls.type,
            parts: cls.parts.slice(),
            inverted: cls.inverted,
            ignoreCase: cls.ignoreCase,
          };
        }
      }
      return null;
    },
    visitor.build({
      choice(node) {
        let prev = null;
        let changed = false;
        node.alternatives.forEach((alt, i) => {
          merge(alt);
          const cls = asClass(alt);
          if (!cls) {
            prev = null;
            return;
          }
          if (prev && prev.ignoreCase === cls.ignoreCase) {
            prev.parts.push(...cls.parts);
            // Sort and remove duplicates, and elements and ranges
            // that are contained within ranges.
            prev.parts = prev.parts.sort((a, b) => {
              const a1 = Array.isArray(a) ? a[0] : a;
              const b1 = Array.isArray(b) ? b[0] : b;
              if (a1 < b1) {
                return -1;
              }
              if (a1 > b1) {
                return 1;
              }
              if (a1 === a) {
                return b1 === b ? 0 : 1;
              }
              if (b1 === b) {
                return -1;
              }
              if (a[1] > b[1]) {
                return -1;
              }
              return a[1] < b[1] ? 1 : 0;
            }).filter((cur, i, arr) => {
              if (!i) {
                return true;
              }
              const prev = arr[i - 1];
              if (Array.isArray(prev)) {
                if (Array.isArray(cur)) {
                  if (cur[1] <= prev[1]) {
                    return false;
                  }
                } else if (cur <= prev[1]) {
                  return false;
                }
              } else if (prev === cur) {
                return false;
              }
              return true;
            });
            if (prev.parts.length === 1) {
              prev = { type: "literal", value: prev.parts[0], ignoreCase: prev.ignoreCase };
            }
            node.alternatives[i - 1] = null;
            node.alternatives[i] = prev;
            changed = true;
          } else {
            prev = cls;
          }
        });
        if (changed) {
          node.alternatives = node.alternatives.filter(alt => alt !== null);
          if (node.alternatives.length === 1) {
            const rep = node.alternatives[0];
            Object.keys(node).forEach(key => delete node[key]);
            Object.keys(rep).forEach(key => { node[key] = rep[key]; });
          }
        }
      },
    }),
  ];

  ast.rules.forEach(rule => {
    processedRules[rule.name] = true;
    merge(rule.expression);
  });
}

module.exports = mergeCharacterClasses;
