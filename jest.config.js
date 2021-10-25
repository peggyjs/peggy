"use strict";

module.exports = {
  "collectCoverage": true,
  "coverageReporters": ["lcov", "text"],
  "coveragePathIgnorePatterns": [
    "<rootDir>/node_modules/",
    "<rootDir>/lib/parser.js",
    "<rootDir>/test",
  ],
  "roots": [
    "<rootDir>/test",
  ],
  "testMatch": [
    "**/*.spec.js",
    "**/*.spec.ts",
    "**/*.test-d.ts",
  ],
  "transform": {
    "^.+\\.ts$": "ts-jest",
  },
};
