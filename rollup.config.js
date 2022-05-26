
import commonjs    from "@rollup/plugin-commonjs";
import json        from "@rollup/plugin-json";
import multiEntry  from "@rollup/plugin-multi-entry";
import nodeResolve from "@rollup/plugin-node-resolve";

/**
 * @type {import('rollup').RollupOptions}
 */
const umd_config = {
  onwarn(message) {
    if (message.code === "EVAL") { return; }
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
      mainFields     : ["module", "main"],
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
    if (message.code === "EVAL") { return; }
    console.error(message);
  },

  input: "build/ts/test/**/*.spec.js",

  output: {
    file   : "build/rollup/test.umd.js",
    format : "umd",
    name   : "browser",
    globals: {
      chai: "chai",
      fs: "ignore_fs",
      path: "ignore_path",
      url: "ignore_url",
    },
  },
  external: ["chai"],
  plugins : [
    json(),
    nodeResolve(),
    commonjs(),
    multiEntry(),
  ],
};

/**
 * @type {import('rollup').RollupOptions}
 */
const browser_benchmark_config = {
  onwarn(message) {
    if (message.code === "EVAL") { return; }
    console.error(message);
  },

  input: "build/ts/benchmark/browser.stub.js",

  output: {
    file   : "build/rollup/benchmark.umd.js",
    format : "umd",
    name   : "browser",
  },
  plugins : [
    nodeResolve(),
    commonjs(),
  ],
};

const all = [
  umd_config, browser_test_config, browser_benchmark_config,
];

export default all;
