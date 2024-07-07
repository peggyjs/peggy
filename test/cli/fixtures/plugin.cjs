"use strict";

module.exports = {
  use(config, options) {
    if (options.cli_test) {
      if (options.cli_test.words) {
        config.reservedWords.push(...options.cli_test.words);
      }
      if (options.cli_test.warning === true) {
        config.passes.check.unshift((_ast, _options, session) => {
          session.warning("I WARN YOU");
        });
      }
    }
  },
};
