"use strict";

module.exports = {
  "collectCoverage": true,
  "coverageReporters": ["lcov"],
  "roots": [
    "<rootDir>/test"
  ],
  "testMatch": [
    "**/*.spec.js",
    "**/*.test-d.ts"
  ],
  "transform": {
    "^.+\\.ts$": "ts-jest",
  }
};
