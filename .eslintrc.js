"use strict";

module.exports = {
  root: true,
  extends: "@peggyjs",
  ignorePatterns: [
    "docs/",
    "lib/parser.js",
    "test/vendor/",
    "benchmark/vendor/",
    "browser/",
    "node_modules/",
    "*.min.js",
    "build",
    "rollup.config.js" // in .eslintrc-modules.js
  ]
};
