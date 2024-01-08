"use strict";

module.exports = {
  root: true,
  extends: ["@peggyjs", "@peggyjs/eslint-config/typescript"],
  ignorePatterns: [
    "docs/",
    "lib/parser.js", // Generated
    "examples/*.js", // Testing examples
    "test/vendor/",
    "test/cli/fixtures/bad.js", // Intentionally-invalid
    "test/cli/fixtures/imports_peggy.js", // Generated
    "test/cli/fixtures/lib.js", // Generated
    "benchmark/vendor/",
    "browser/",
    "node_modules/",
    "*.min.js",
    "build",
  ],
  parserOptions: {
    project: "tsconfig.json",
  },
  overrides: [
    {
      files: ["rollup.config.js", "*.mjs"],
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2018,
      },
    },
    {
      files: ["bin/*.js"],
      parserOptions: {
        // Doesn't have to run in a browser, and Node 10 not supported.
        ecmaVersion: 2020,
      },
      env: {
        node: true,
      },
    },
  ],
};
