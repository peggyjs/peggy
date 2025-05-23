// @ts-check
"use strict";

const GrammarLocation = require("./grammar-location");

// Thrown when the grammar contains an error.
/** @type {import("./peg").GrammarError} */
class GrammarError extends SyntaxError {
  /**
   *
   * @param {string} message
   * @param {PEG.LocationRange} [location]
   * @param {PEG.DiagnosticNote[]} [diagnostics]
   */
  constructor(message, location, diagnostics) {
    super(message);
    this.name = "GrammarError";
    this.location = location;
    if (diagnostics === undefined) {
      diagnostics = [];
    }
    this.diagnostics = diagnostics;
    // All problems if this error is thrown by the plugin and not at stage
    // checking phase
    this.stage = null;
    this.problems = [
      /** @type {PEG.Problem} */
      (["error", message, location, diagnostics]),
    ];
  }

  toString() {
    let str = super.toString();
    if (this.location) {
      str += "\n at ";
      if ((this.location.source !== undefined)
          && (this.location.source !== null)) {
        str += `${this.location.source}:`;
      }
      str += `${this.location.start.line}:${this.location.start.column}`;
    }
    for (const diag of this.diagnostics) {
      str += "\n from ";
      if ((diag.location.source !== undefined)
          && (diag.location.source !== null)) {
        str += `${diag.location.source}:`;
      }
      str += `${diag.location.start.line}:${diag.location.start.column}: ${diag.message}`;
    }

    return str;
  }

  /**
   * Format the error with associated sources.  The `location.source` should have
   * a `toString()` representation in order the result to look nice. If source
   * is `null` or `undefined`, it is skipped from the output
   *
   * Sample output:
   * ```
   * Error: Label "head" is already defined
   *  --> examples/arithmetics.pegjs:15:17
   *    |
   * 15 |   = head:Factor head:(_ ("*" / "/") _ Factor)* {
   *    |                 ^^^^
   * note: Original label location
   *  --> examples/arithmetics.pegjs:15:5
   *    |
   * 15 |   = head:Factor head:(_ ("*" / "/") _ Factor)* {
   *    |     ^^^^
   * ```
   *
   * @param {import("./peg").SourceText[]} sources mapping from location source to source text
   *
   * @returns {string} the formatted error
   */
  format(sources) {
    const srcLines = sources.map(({ source, text }) => ({
      source,
      text: (text !== null && text !== undefined)
        ? String(text).split(/\r\n|\n|\r/g)
        : [],
    }));

    /**
     * Returns a highlighted piece of source to which the `location` points
     *
     * @param {import("./peg").LocationRange} location
     * @param {number} indent How much width in symbols line number strip should have
     * @param {string} message Additional message that will be shown after location
     * @returns {string}
     */
    function entry(location, indent, message = "") {
      let str = "";
      const src = srcLines.find(({ source }) => source === location.source);
      const s = location.start;
      const offset_s = GrammarLocation.offsetStart(location);
      if (src) {
        const e = location.end;
        const line = src.text[s.line - 1];
        const last = s.line === e.line ? e.column : line.length + 1;
        const hatLen = (last - s.column) || 1;
        if (message) {
          str += `\nnote: ${message}`;
        }
        str += `
 --> ${location.source}:${offset_s.line}:${offset_s.column}
${"".padEnd(indent)} |
${offset_s.line.toString().padStart(indent)} | ${line}
${"".padEnd(indent)} | ${"".padEnd(s.column - 1)}${"".padEnd(hatLen, "^")}`;
      } else {
        str += `\n at ${location.source}:${offset_s.line}:${offset_s.column}`;
        if (message) {
          str += `: ${message}`;
        }
      }

      return str;
    }

    /**
     * Returns a formatted representation of the one problem in the error.
     *
     * @param {import("./peg").Severity} severity Importance of the message
     * @param {string} message Test message of the problem
     * @param {import("./peg").LocationRange} [location] Location of the problem in the source
     * @param {import("./peg").DiagnosticNote[]} [diagnostics] Additional notes about the problem
     * @returns {string}
     */
    function formatProblem(severity, message, location, diagnostics = []) {
      // Calculate maximum width of all lines
      // eslint-disable-next-line no-useless-assignment
      let maxLine = -Infinity;
      if (location) {
        maxLine = diagnostics.reduce(
          (t, { location }) => Math.max(
            t, GrammarLocation.offsetStart(location).line
          ),
          location.start.line
        );
      } else {
        maxLine = Math.max.apply(
          null,
          diagnostics.map(d => d.location.start.line)
        );
      }
      maxLine = maxLine.toString().length;

      let str = `${severity}: ${message}`;
      if (location) {
        str += entry(location, maxLine);
      }
      for (const diag of diagnostics) {
        str += entry(diag.location, maxLine, diag.message);
      }

      return str;
    }

    // "info" problems are only appropriate if in verbose mode.
    // Handle them separately.
    return this.problems
      .filter(p => p[0] !== "info")
      .map(p => formatProblem(...p)).join("\n\n");
  }
}

module.exports = GrammarError;
