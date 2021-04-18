"use strict";

const path = require("path");

module.exports = (env, options) => {
  const ret = {
    entry: "./browser.js",
    mode: "production",
    output: {
      path: path.resolve(__dirname, "..", "..", "docs", "js"),
      filename: "benchmark-bundle.min.js",
      libraryTarget: "umd",
      globalObject: "this"
    },
    target: "web",
    module: {
      rules: [
        {
          test: /\.js$/,
          use: {
            loader: "babel-loader",
            options: { presets: ["@babel/preset-env"] }
          }
        }
      ]
    }
  };
  if (options.mode === "development") {
    ret.devtool = "inline-source-map";
  }

  return ret;
};
