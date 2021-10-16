"use strict";

module.exports = {
  "collectCoverage": true,
  "coverageReporters": ["lcov", "text"],
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
