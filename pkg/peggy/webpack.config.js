"use strict";

module.exports = (env, options) => {
  const ret = {
    entry: "./lib/peg.js",
    mode: "production",
    output: {
      path: __dirname,
      filename: "peggy.min.js",
      library: "peggy",
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
