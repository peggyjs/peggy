// @ts-check
"use strict";

/**
 * Generate trampoline stubs for each rule imported into this namespace.
 *
 * @example
 * import bar from "./lib.js" // Default rule imported into this namespace
 * import {baz} from "./lib.js" // One rule imported into this namespace by name
 *
 * @type {PEG.Pass}
 */
function addImportedRules(ast) {
  let libraryNumber = 0;
  for (const imp of ast.imports) {
    for (const what of imp.what) {
      let original = undefined;
      switch (what.type) {
        case "import_binding_all":
          // Don't create stub.
          continue;
        case "import_binding_default":
          // Use the default (usually first) rule.
          break;
        case "import_binding":
          original = what.binding;
          break;
        case "import_binding_rename":
          original = what.rename;
          break;
        default:
          throw new TypeError("Unknown binding type");
      }
      ast.rules.push({
        type: "rule",
        name: what.binding,
        nameLocation: what.location,
        expression: {
          type: "library_ref",
          name: original,
          library: imp.from.module,
          libraryNumber,
          location: what.location,
        },
        location: imp.from.location,
      });
    }
    libraryNumber++;
  }
}

module.exports = addImportedRules;
