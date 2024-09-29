#!/usr/bin/env node

"use strict";

// Since Windows can't handle `env -S`, exec once to get permission
// to use the vm module in its modern form.
const execArgv = new Set(process.execArgv);
if (!execArgv.has("--experimental-vm-modules")) {
  execArgv.add("--experimental-vm-modules");
  execArgv.add("--no-warnings");
  const { spawnSync } = require("child_process");
  // NOTE: Does not replace process.  Node can't do that, apparently.
  const { status, signal, error } = spawnSync(process.argv[0], [
    ...execArgv,
    ...process.argv.slice(1),
  ], { stdio: "inherit" });
  if (error) {
    throw error;
  }
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(status);
}

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
  (async() => {
    let code = 1;
    try {
      const cli = await (new PeggyCLI().parseAsync());
      code = await cli.main();
    } catch (er) {
      console.error("Uncaught Error\n", er);
    }
    process.exit(code);
  })();
}
