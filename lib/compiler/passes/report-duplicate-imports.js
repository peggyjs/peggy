// @ts-check
"use strict";

/** @type {PEG.Pass} */
function reportDuplicateImports(ast, _options, session) {
  /** @type {Record<string, PEG.LocationRange>} */
  const all = {};

  for (const imp of ast.imports) {
    for (const what of imp.what) {
      if (what.type === "import_binding_all") {
        if (Object.prototype.hasOwnProperty.call(all, what.binding)) {
          session.error(
            `Module "${what.binding}" is already imported`,
            what.location,
            [{
              message: "Original module location",
              location: all[what.binding],
            }]
          );
        }
        all[what.binding] = what.location;
      }
    }
  }
}

module.exports = reportDuplicateImports;
