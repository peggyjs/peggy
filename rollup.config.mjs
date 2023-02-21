
import commonjs    from "@rollup/plugin-commonjs";
import ignore      from "rollup-plugin-ignore";
import json        from "@rollup/plugin-json";
import multiEntry  from "@rollup/plugin-multi-entry";
import nodeResolve from "@rollup/plugin-node-resolve";

/**
 * @type {import('rollup').RollupOptions}
 */
const umd_config = {
  onwarn(message) {
    // Avoid this warning: "Use of eval is strongly discouraged, as it poses
    // security risks and may cause issues with minification"
    if (message.code === "EVAL") {
      return;
    }
    console.error(message);
  },

  input: "build/ts/lib/peg.js",

  output: {
    file   : "build/rollup/peggy.umd.js",
    format : "umd",
    name   : "peggy",
  },

  plugins : [
    nodeResolve({
      mainFields     : ["browser", "module", "main"],
      browser        : true,
      extensions     : [".js", ".json", ".ts", ".tsx"],
      preferBuiltins : false,
    }),
    commonjs(),
  ],
};

/**
 * @type {import('rollup').RollupOptions}
 */
const browser_test_config = {
  onwarn(message) {
    // Avoid this warning: "Use of eval is strongly discouraged, as it poses
    // security risks and may cause issues with minification"
    if (message.code === "EVAL") {
      return;
    }
    console.error(message);
  },

  input: "build/ts/test/**/*.spec.js",

  output: {
    file   : "build/rollup/test.umd.js",
    format : "umd",
    name   : "browser",
    globals: {
      "chai": "chai",
      "whatwg-url": "whatwgURL",
    },
  },
  external: ["chai", "whatwg-url"],
  plugins : [
    ignore(["fs", "os", "path", "tty", "url", "util"]),
    json(),
    nodeResolve({
      mainFields     : ["browser", "module", "main"],
      browser        : true,
      extensions     : [".js", ".json", ".ts", ".tsx"],
      preferBuiltins : false,
    }),
    commonjs(),
    multiEntry(),
  ],
};

/**
 * @type {import('rollup').RollupOptions}
 */
const browser_benchmark_config = {
  onwarn(message) {
    // Avoid this warning: "Use of eval is strongly discouraged, as it poses
    // security risks and may cause issues with minification"
    if (message.code === "EVAL") {
      return;
    }
    console.error(message);
  },

  input: "build/ts/benchmark/browser.stub.js",

  output: {
    file   : "build/rollup/benchmark.umd.js",
    format : "umd",
    name   : "browser",
  },
  plugins : [
    nodeResolve({
      mainFields     : ["browser", "module", "main"],
      browser        : true,
      extensions     : [".js", ".json", ".ts", ".tsx"],
      preferBuiltins : false,
    }),
    commonjs(),
  ],
};

const all = [
  umd_config, browser_test_config, browser_benchmark_config,
];

export default all;
