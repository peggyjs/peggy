"use strict";

module.exports = {
  allowedStartRules: ["foo", "bar", "baz"],
  plugins: [require("./plugin.js")],
  cli_test: {
    words: ["zazzy"],
  },
  dependencies: {
    j: "jest",
    commander: "commander",
  },
};
