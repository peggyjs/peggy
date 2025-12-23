"use strict";

const tsup = require("tsup");
const { umdWrapper } = require("esbuild-plugin-umd-wrapper");

module.exports = tsup.defineConfig([
  {
    entry: {
      "peggy.min": "./lib/peg.js",
    },

    bundle: true,
    clean: true,
    dts: true,
    format: ["umd"],
    minify: true,
    outDir: "browser",
    platform: "browser",
    splitting: false,
    target: "es5",

    noExternal: [/./],
    esbuildPlugins: [
      umdWrapper({ libraryName: "peggy", external: [] }),
    ],
  },
  {
    entry: {
      "test-bundle.min": "test/all.js",
    },

    bundle: true,
    clean: false,
    format: ["iife"],
    minify: true,
    outDir: "docs/js",
    outExtension() {
      return { js: ".js" };
    },
    platform: "browser",
    splitting: false,

    external: ["mocha", "chai"],
    noExternal: [/./],
  },
  {
    entry: {
      "benchmark-bundle.min": "benchmark/browser.stub.js",
    },

    bundle: true,
    clean: false,
    format: ["umd"],
    minify: true,
    outDir: "docs/js",
    platform: "browser",
    splitting: false,
    target: "es5",

    external: ["../lib/peg"],
    esbuildPlugins: [
      umdWrapper({ libraryName: "peggy_benchmark" }),
    ],
  },
]);
