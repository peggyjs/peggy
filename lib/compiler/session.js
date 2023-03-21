"use strict";

const GrammarError = require("../grammar-error");

class Defaults {
  constructor(options) {
    options = typeof options !== "undefined" ? options : {};

    if (typeof options.error === "function") { this.error = options.error; }
    if (typeof options.warning === "function") { this.warning = options.warning; }
    if (typeof options.info === "function") { this.info = options.info; }
  }

  // eslint-disable-next-line class-methods-use-this -- Abstract
  error() {
    // Intentionally empty placeholder
  }

  // eslint-disable-next-line class-methods-use-this -- Abstract
  warning() {
    // Intentionally empty placeholder
  }

  // eslint-disable-next-line class-methods-use-this -- Abstract
  info() {
    // Intentionally empty placeholder
  }
}

class Session {
  constructor(options) {
    this._callbacks = new Defaults(options);
    this._firstError = null;
    this.errors = 0;
    /** @type {import("../peg").Problem[]} */
    this.problems = [];
    /** @type {import("../peg").Stage} */
    this.stage = null;
  }

  error(...args) {
    ++this.errors;
    // In order to preserve backward compatibility we cannot change `GrammarError`
    // constructor, nor throw another class of error:
    // - if we change `GrammarError` constructor, this will break plugins that
    //   throws `GrammarError`
    // - if we throw another Error class, this will break parser clients that
    //   catches GrammarError
    //
    // So we use a compromise: we throw an `GrammarError` with all found problems
    // in the `problems` property, but the thrown error itself is the first
    // registered error.
    //
    // Thus when the old client catches the error it can find all properties on
    // the Grammar error that it want. On the other hand the new client can
    // inspect the `problems` property to get all problems.
    if (this._firstError === null) {
      this._firstError = new GrammarError(...args);
      this._firstError.stage = this.stage;
      this._firstError.problems = this.problems;
    }

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

  checkErrors() {
    if (this.errors !== 0) {
      throw this._firstError;
    }
  }
}

module.exports = Session;
