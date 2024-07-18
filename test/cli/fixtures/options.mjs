import plugin from "./plugin.js";

export default {
  plugins: [plugin],
  cli_test: {
    words: ["zazzy"],
  },
  dependencies: {
    j: "jest",
    commander: "commander",
  },
  returnTypes: {
    foo: "string",
  },
};
