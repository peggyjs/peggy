"use strict";

module.exports = {
  root: true,
  extends: "@peggyjs",
  ignorePatterns: [
    "docs/",
    "lib/parser.js", // Generated
    "examples/*.js", // Testing examples
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
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2018,
      },
      rules: {
        "comma-dangle": ["error", {
          arrays: "always-multiline",
          objects: "always-multiline",
          imports: "always-multiline",
          exports: "always-multiline",
          functions: "never",
        }],
      },
    },
    {
      files: ["bin/*.js"],
      parserOptions: {
        // Doesn't have to run in a browser, and Node 10 not supported.
        ecmaVersion: 2020,
      },
      rules: {
        "comma-dangle": ["error", {
          arrays: "always-multiline",
          objects: "always-multiline",
          imports: "always-multiline",
          exports: "always-multiline",
          functions: "never",
        }],
      },
    },
  ],
};
