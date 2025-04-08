import commonjs from "@peggyjs/eslint-config/commonjs.js";
import compat from "eslint-plugin-compat";
import mocha from "@peggyjs/eslint-config/mocha.js";
import { modern } from "@peggyjs/eslint-config/modern.js";
import ts from "@peggyjs/eslint-config/ts.js";

export default [
  {
    ignores: [
      "benchmark/**",
      "build/**",
      "examples/*.js", // Testing examples
      "test/cli/fixtures/bad.js", // Intentionally-invalid
      "test/cli/fixtures/imports_peggy.js", // Generated
      "test/cli/fixtures/lib.js", // Generated
      "test/cli/fixtures/useFrags/fs.js", // Generated
      "test/cli/fixtures/useFrags/identifier.js", // Generated
      "lib/parser.js", // Generated
      "lib/parser.d.ts", // Generated
      "bin/generated_template.d.ts", // Generated
    ],
  },
  ...commonjs,
  ...mocha,
  ...ts,
  {
    ...modern,
    // All of these can use modern JS and node constructs
    files: ["bin/*.js", "tools/**", "web-test/**", "src/*.mjs"],
  },
  {
    // Check these files for broad browser compatibility.
    files: [
      "**/*.min.js",
      "lib/parser.js",
    ],
    plugins: {
      compat,
    },
    rules: {
      "compat/compat": "error",
    },
  },
  // Enable if you want to lint the generated parser.
  // {
  //   files: [
  //     "lib/parser.js",
  //   ],
  //   rules: {
  //     "init-declarations": "off",
  //     "no-misleading-character-class": "off",
  //     "no-unused-vars": "off",
  //     "no-use-before-define": "off",
  //     "no-useless-assignment": "off",
  //     "prefer-const": "off",
  //   },
  // },
];
