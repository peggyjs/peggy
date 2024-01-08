// @ts-check
"use strict";

const visitor = require("../visitor");

/**
 * @param {PEG.ast.Grammar} ast
 * @param {string} name
 * @returns {number}
 */
function findLibraryNumber(ast, name) {
  let libraryNumber = 0;
  for (const imp of ast.imports) {
    for (const what of imp.what) {
      if ((what.type === "import_binding_all") && (what.binding === name)) {
        return libraryNumber;
      }
    }
    libraryNumber++;
  }

  return -1;
}

/** @type {PEG.Pass} */
function fixLibraryNumbers(ast, _options, session) {
  const check = visitor.build({
    library_ref(/** @type {PEG.ast.LibraryReference} */ node) {
      if (node.libraryNumber === -1) {
        node.libraryNumber = findLibraryNumber(ast, node.library);
        if (node.libraryNumber === -1) {
          session.error(
            `Unknown module "${node.library}"`,
            node.location
          );
        }
      }
    },
  });
  check(ast);
}

module.exports = fixLibraryNumbers;
