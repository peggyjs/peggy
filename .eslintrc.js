"use strict";

module.exports = {
  root: true,
  extends: "@peggyjs",
  ignorePatterns: [
    "docs/",
    "bin/peggy.js", // Generated
    "lib/parser.js", // Generated
    "test/vendor/",
    "test/cli/fixtures/bad.js", // Intentionally-invalid
    "benchmark/vendor/",
    "browser/",
    "node_modules/",
    "*.min.js",
    "build",
  ],
  overrides: [
    {
      files: ["rollup.config.js", "*.mjs"],
      parserOptions: { sourceType: "module" },
    },
  ],
};
