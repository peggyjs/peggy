#!/usr/bin/env node

import {
  CommanderError, InvalidArgumentError, PeggyCLI,
} from "./peggy-cli.mjs";
import process from "node:process";

export {
  CommanderError,
  InvalidArgumentError,
  PeggyCLI,
};

// Jest's coverage can't see into fork'd processes.
// See: https://github.com/facebook/jest/issues/5274
/* istanbul ignore if */
if (import.meta.url.endsWith(process.argv[1])) {
  (async () => {
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
