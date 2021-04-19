"use strict";

const webpack = require("webpack");
const path = require("path");

module.exports = (env, options) => {
  // Just fake enough of node's `process` to make sinon work
  // eventually replace sinon?
  const fakeProcess = "(" + JSON.stringify({
    env: {
      NODE_ENV: options.mode
    },
    noDeprecation: false,
    traceDeprecation: false,
    pid: 0,
    emitWarning: "console.warn"
  }).replace(/"console.warn"/, "console.warn") + ")";

  const ret = {
    // entry: "mocha-loader!./browser.js",
    entry: "./browser.js",
    mode: "production",
    output: {
      path: path.resolve(__dirname, "../../docs/js"),
      filename: "test-bundle.min.js"
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
        },
        {
          test: /\.(css|less)$/,
          loader: "null-loader",
          exclude: [ /build/ ]
        },
        {
          test: /\.(jpg|jpeg|png|gif)/,
          loader: "null-loader"
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        process: fakeProcess
      })
    ],
    resolve: {
      fallback: {
        // Note: this is just a hack to get sinon working again.
        // Fix by replacing sinon or actually understanding the problem.
        util: require.resolve("node-inspect-extracted")
      }
    }
  };
  if (options.mode === "development") {
    ret.devtool = "inline-source-map";
  }

  return ret;
};
