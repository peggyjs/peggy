"use strict";

exports.use = function use(config, options) {
  if (options.cli_test && options.cli_test.words) {
    config.reservedWords.push(...options.cli_test.words);
  }
};
