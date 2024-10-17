import { fileURLToPath } from "node:url";

export default {
  dts: true,
  output: fileURLToPath(new URL("../lib/parser.js", import.meta.url)),
  format: "commonjs",
  allowedStartRules: ["Grammar", "ImportsAndSource"],
  input: fileURLToPath(new URL("parser.pegjs", import.meta.url)),
  returnTypes: {
    Grammar: "import('./peg.d.ts').ast.Grammar",
    ImportsAndSource: "import('./peg.d.ts').ast.TopLevelInitializer[]",
  },
};
