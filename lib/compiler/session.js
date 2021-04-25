"use strict";

const GrammarError = require("../grammar-error");

class Defaults {
  constructor(options) {
    options = typeof options !== "undefined" ? options : {};

    if (typeof options.error === "function") { this.error = options.error; }
    if (typeof options.warning === "function") { this.warning = options.warning; }
    if (typeof options.info === "function") { this.info = options.info; }
  }

  error(stage, ...args) {
    throw new GrammarError(...args);
  }

  warning() {
    // Intentionally empty placeholder
  }

  info() {
    // Intentionally empty placeholder
  }
}

class Session {
  constructor(options) {
    this._callbacks = new Defaults(options);
    this.errors = 0;
    this.problems = [];
    this.stage = null;
  }

  error(...args) {
    ++this.errors;
    this.problems.push(["error", ...args]);
    this._callbacks.error(this.stage, ...args);
  }

  warning(...args) {
    this.problems.push(["warning", ...args]);
    this._callbacks.warning(this.stage, ...args);
  }

  info(...args) {
    this.problems.push(["info", ...args]);
    this._callbacks.info(this.stage, ...args);
  }
}

module.exports = Session;
