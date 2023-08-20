"use strict";

const visitor = require("../visitor");

function cloneOver(target, source) {
  Object.keys(target).forEach(key => delete target[key]);
  Object.keys(source).forEach(key => { target[key] = source[key]; });
}

// Clean up the parts array of a `class` node, by sorting,
// then removing "contained" ranges, and merging overlapping
// or adjacent ranges.
function cleanParts(parts) {
  // Sort parts on increasing start, and then decreasing end.
  parts.sort((a, b) => {
    const [aStart, aEnd] = Array.isArray(a) ? a : [a, a];
    const [bStart, bEnd] = Array.isArray(b) ? b : [b, b];
    if (aStart !== bStart) {
      return aStart < bStart ? -1 : 1;
    }
    if (aEnd !== bEnd) {
      return aEnd > bEnd ? -1 : 1;
    }
    return 0;
  });

  let prevStart = "";
  let prevEnd = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const [curStart, curEnd] = Array.isArray(part) ? part : [part, part];
    if (curEnd <= prevEnd) {
      // Current range is contained in previous range,
      // so drop it.
      parts.splice(i--, 1);
      continue;
    }
    if (prevEnd.charCodeAt(0) + 1 >= curStart.charCodeAt(0)) {
      // Current and previous ranges overlap, or are adjacent.
      // Drop the current, and extend the previous range.
      parts.splice(i--, 1);
      parts[i] = [prevStart, prevEnd = curEnd];
      continue;
    }
    prevStart = curStart;
    prevEnd = curEnd;
  }
  return parts;
}

// Merges a choice character classes into a character class
function mergeCharacterClasses(ast) {
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
      if (node.type === "text") {
        return asClass(node.expression);
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
            prev.parts = cleanParts(prev.parts.concat(cls.parts));
            node.alternatives[i - 1] = null;
            node.alternatives[i] = prev;
            if (prev.parts.length === 1 && !Array.isArray(prev.parts[0])) {
              node.alternatives[i] = {
                type: "literal",
                value: prev.parts[0],
                ignoreCase: prev.ignoreCase,
              };
            }
            changed = true;
          } else {
            prev = cls;
          }
        });
        if (changed) {
          node.alternatives = node.alternatives.filter(alt => alt !== null);
          if (node.alternatives.length === 1) {
            cloneOver(node, node.alternatives[0]);
          }
        }
      },
      text(node) {
        merge(node.expression);
        if (node.expression.type === "class") {
          cloneOver(node, node.expression);
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
