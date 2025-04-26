// @ts-check
"use strict";

const { stringEscape } = require("../utils");

/**
 * @typedef {import("../../peg")} PEG
 */

/** @type {PEG.compiler.visitor} */
const visitor = require("../visitor");
const { codePointLen1 } = require("../utils");

/**
 * @param {unknown} target
 * @param {unknown} source
 */
function cloneOver(target, source) {
  const t = /** @type {Record<string,unknown>} */ (target);
  const s = /** @type {Record<string,unknown>} */ (source);
  Object.keys(t).forEach(key => delete t[key]);
  Object.keys(s).forEach(key => { t[key] = s[key]; });
}

/**
 * Clean up the parts array of a `class` node, by sorting,
 * then removing "contained" ranges, and merging overlapping
 * or adjacent ranges.
 *
 * @param {PEG.ast.CharacterClass["parts"]} parts
 */
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

  /** @type {string | PEG.ast.ClassEscape} */
  let prevStart = "";
  /** @type {string | PEG.ast.ClassEscape} */
  let prevEnd = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const [curStart, curEnd] = Array.isArray(part) ? part : [part, part];
    if ((typeof curStart === "string") && (typeof curEnd === "string")
        && (typeof prevStart === "string") && (typeof prevEnd === "string")) {
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
    }
    prevStart = curStart;
    prevEnd = curEnd;
  }
  return parts;
}

const LAST_LOW = String.fromCodePoint(0xD7FF);
const FIRST_SURROGATE = 0xD800;
const LAST_SURROGATE = 0xDFFF;
const FIRST_HIGH = String.fromCodePoint(0xE000);

/**
 * Split Unicode ranges in classes that span over the surrogate range.
 * @param {PEG.ast.Grammar} ast
 * @param {PEG.Session} session
 */
function splitUnicodeRanges(ast, session) {
  const split = visitor.build({
    /**
     * @param {PEG.ast.CharacterClass} node
     */
    class(node) {
      if (!node.unicode) {
        return;
      }
      const extras = [];
      for (const p of node.parts) {
        if (Array.isArray(p)) {
          const [s, e] = p.map(c => /** @type {number} */(c.codePointAt(0)));
          if ((s < FIRST_SURROGATE) && (e > LAST_SURROGATE)) {
            session.info(
              `Removing surrogate range from [${stringEscape(p[0])}-${stringEscape(p[1])}]`,
              node.location
            );
            extras.push([FIRST_HIGH, p[1]]);
            p[1] = LAST_LOW;
          }
        }
      }
      node.parts.push(...extras);
    },
  });
  split(ast);
}

/**
 * Merges a choice character classes into a character class
 * @type {PEG.Pass}
 */
function mergeCharacterClasses(ast, _options, session) {
  // Build a map from rule names to rules for quick lookup of
  // ref_rules.
  const rules = Object.create(null);
  ast.rules.forEach(rule => (rules[rule.name] = rule.expression));
  // Keep a set of which rules have been processed, so that when
  // we find a ref_rule, we can make sure its processed, before we
  // try to use it.
  const processedRules = new Set();

  splitUnicodeRanges(ast, session);

  // Mutually-recursive.  Get around use-before-declaration.
  const [asClass, merge] = [
    /**
     * Determine whether a node can be represented as a simple character class,
     * and return that class if so.
     *
     * @param {PEG.ast.Expression} node - the node to inspect
     * @param {boolean} [clone=false] - if true, always return a new node that
     *   can be modified by the caller
     * @returns {PEG.ast.CharacterClass | null}
     */
    (node, clone = false) => { // "asClass"
      // eslint-disable-next-line default-case
      switch (node.type) {
        case "class":
          if (node.inverted) {
            // Only combine positives, which are more common.
            // Negatives are more subtle.
            break;
          }
          return clone ? { ...node, parts: [...node.parts] } : node;
        case "literal": {
          const ul = codePointLen1(node.value);
          if (ul < 0) {
            break;
          }
          return {
            type: "class",
            parts: [node.value],
            inverted: false,
            ignoreCase: node.ignoreCase,
            location: node.location,
            unicode: (ul > 0xFFFF),
          };
        }
        case "rule_ref": {
          const ref = rules[node.name];
          if (!ref) { // Undefined rule
            break;
          }
          if (!processedRules.has(node.name)) {
            processedRules.add(node.name);
            merge(ref);
          }
          const cls = asClass(ref, true);
          if (cls) {
            cls.location = node.location;
          }
          return cls;
        }
      }
      return null;
    },
    visitor.build({ // "merge"
      choice(node) {
        /** @type {PEG.ast.CharacterClass | null} */
        let prev = null;
        let changed = false;

        node.alternatives.forEach((alt, i) => {
          merge(alt);
          const cls = asClass(alt);
          if (!cls) {
            prev = null;
            return;
          }
          if (prev && (prev.ignoreCase === cls.ignoreCase)) {
            // Combine the two parts sets, leaving two copies of prev
            // to be cleaned up later.
            prev.parts.push(...cls.parts);
            // Leave prev as-is until we decide to merge it with cls.
            node.alternatives[i - 1] = prev;
            // Don't change the number of items during foreach
            node.alternatives[i] = prev;
            prev.unicode = prev.unicode || cls.unicode;
            prev.location = {
              // Fix this when imports work.  Needs a combined source class.
              source: prev.location.source,
              start: prev.location.start,
              end: cls.location.end,
            };
            changed = true;
          } else {
            prev = cls;
          }
        });
        if (changed) {
          // Remove dups, these are places where we removed a merged class.
          node.alternatives = node.alternatives.filter(
            (alt, i, arr) => !i || alt !== arr[i - 1]
          );
          node.alternatives.forEach((alt, i) => {
            if (alt.type === "class") {
              alt.parts = cleanParts(alt.parts);
              // Convert single-char classes back to string literals.
              if (alt.parts.length === 1
                  && !Array.isArray(alt.parts[0])
                  && (typeof alt.parts[0] === "string")
                  && !alt.inverted) { // Don't check alt.unicode on purpose
                node.alternatives[i] = {
                  type: "literal",
                  value: alt.parts[0],
                  ignoreCase: alt.ignoreCase,
                  location: alt.location,
                };
              }
            }
          });
          if (node.alternatives.length === 1) {
            cloneOver(node, node.alternatives[0]);
          }
        }
      },
      text(node) {
        merge(node.expression);
        if (node.expression.type === "class"
            || node.expression.type === "literal") {
          const location = node.location;
          cloneOver(node, node.expression);
          node.location = location;
        }
      },
    }),
  ];

  ast.rules.forEach(rule => {
    processedRules.add(rule.name);
    merge(rule.expression);
  });
}

module.exports = mergeCharacterClasses;
