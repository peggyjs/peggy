#!/usr/bin/env node

"use strict";

const {
  CommanderError, InvalidArgumentError, PeggyCLI,
} = require("./peggy-cli.js");

exports.CommanderError = CommanderError;
exports.InvalidArgumentError = InvalidArgumentError;
exports.PeggyCLI = PeggyCLI;

// Jest's coverage can't see into fork'd processes.
// See: https://github.com/facebook/jest/issues/5274
/* istanbul ignore if */
if (require.main === module) {
  const cli = new PeggyCLI().parse();
  cli.main().then(
    code => process.exit(code),
    er => console.error("Uncaught Error\n", er)
  );
}
