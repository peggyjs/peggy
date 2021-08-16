"use strict";

module.exports = {
  plugins: [require("./plugin.js")],
  cli_test: {
    words: ["zazzy"],
  },
  dependencies: {
    j: "jest",
    commander: "commander",
  },
};
