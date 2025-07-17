"use strict";

const tsup = require("tsup");
const { umdWrapper } = require("esbuild-plugin-umd-wrapper");

module.exports = tsup.defineConfig([
  {
    entry: {
      "peggy.min": "./lib/peg.js",
    },
    format: ["umd"],
    dts: true,
    platform: "browser",
    minify: true,
    outDir: "browser",
    target: "es5",
    bundle: true,
    clean: true,
    splitting: false,
    noExternal: [/./],
    esbuildPlugins: [
      umdWrapper({ libraryName: "peggy", external: [] }),
    ],
  },
  {
    entry: {
      "test-bundle.min": "test/all.js",
    },
    format: ["umd"],
    platform: "browser",
    minify: true,
    outDir: "docs/js",
    bundle: true,
    clean: false,
    splitting: false,
    external: ["mocha", "chai"],
    noExternal: [/./],
    esbuildPlugins: [
      umdWrapper({ libraryName: "peggy_tests" }),
    ],
    esbuildOptions(options, _context) {
      options.alias = {
        "whatwg-url": "@cto.af/whatwg-url",
      };
    },
  },
  {
    entry: {
      "benchmark-bundle.min": "benchmark/browser.stub.js",
    },
    format: ["umd"],
    platform: "browser",
    minify: true,
    outDir: "docs/js",
    target: "es5",
    bundle: true,
    clean: false,
    splitting: false,
    external: ["../lib/peg"],
    esbuildPlugins: [
      umdWrapper({ libraryName: "peggy_benchmark" }),
    ],
  },
]);
