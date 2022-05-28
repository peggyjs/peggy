"use strict";

exports.use = function use(config, options) {
  if (options.cli_test) {
    if (options.cli_test.words) {
      config.reservedWords.push(...options.cli_test.words);
    }
    if (options.cli_test.warning === true) {
      config.passes.check.unshift((ast, options, session) => {
        session.warning("I WARN YOU");
      });
    }
  }
};
