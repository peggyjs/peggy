"use strict";

module.exports = [
  {
    ignores: [
      "**/*.d.ts",
      "benchmark/**",
      "build/**",
      "docs/**",
      "examples/*.js", // Testing examples
      "node_modules/**",
      "test/cli/fixtures/bad.js", // Intentionally-invalid
      "test/cli/fixtures/imports_peggy.js", // Generated
      "test/cli/fixtures/lib.js", // Generated
      "test/cli/fixtures/useFrags/fs.js", // Generated
      "test/cli/fixtures/useFrags/identifier.js", // Generated
      "test/vendor/**",
    ],
  },
  {
    ...require("@peggyjs/eslint-config/flat/js"),
    ignores: [
      "**/*.min.js",
      "lib/parser.js", // Generated
    ],
  },
  require("@peggyjs/eslint-config/flat/mjs"),
  require("@peggyjs/eslint-config/flat/mocha"),
  require("@peggyjs/eslint-config/flat/ts"),
  {
    ...require("@peggyjs/eslint-config/flat/modern"),
    // All of these can use modern JS and node constructs
    files: ["bin/*.js", "tools/**", "web-test/**"],
  },
  {
    files: ["lib/peg.d.ts"],
    rules: {
      // Easier than fixing the hand-generated peg.d.ts
      "no-unused-vars": "off",
      "one-var": "off",
      "no-use-before-define": "off",
      "init-declarations": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/init-declarations": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-shadow": "off",
      "@typescript-eslint/prefer-function-type": "off",
    },
  },
  {
    // Check these files for broad browser compatibility.
    files: [
      "**/*.min.js",
      "lib/parser.js",
    ],
    plugins: {
      compat: require("eslint-plugin-compat"),
    },
    rules: {
      "compat/compat": "error",
    },
  },
];
