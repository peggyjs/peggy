"use strict";

// See: https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
// This is roughly what typescript generates, it's not called after super(), where it's needed.
const setProtoOf = Object.setPrototypeOf
  || ({ __proto__: [] } instanceof Array
      && function(d, b) {
        // eslint-disable-next-line no-proto
        d.__proto__ = b;
      })
  || function(d, b) {
    for (const p in b) {
      if (Object.prototype.hasOwnProperty.call(b, p)) {
        d[p] = b[p];
      }
    }
  };

// Thrown when the grammar contains an error.
class GrammarError extends Error {
  constructor(message, location, diagnostics) {
    super(message);
    setProtoOf(this, GrammarError.prototype);
    this.name = "GrammarError";
    this.location = location;
    if (diagnostics === undefined) {
      diagnostics = [];
    }
    this.diagnostics = diagnostics;
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
   * @typedef SourceText {source: any, text: string}
   */
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
   * @param {SourceText[]} sources mapping from location source to source text
   *
   * @returns {string} the formatted error
   */
  format(sources) {
    const srcLines = sources.map(({ source, text }) => ({
      source,
      text: text.split(/\r\n|\n|\r/g)
    }));

    function entry(location, indent, message = "") {
      let str = "";
      const src = srcLines.find(({ source }) => source === location.source);
      const s = location.start;
      if (src) {
        const e = location.end;
        const line = src.text[s.line - 1];
        const last = s.line === e.line ? e.column : line.length + 1;
        if (message) {
          str += `\nnote: ${message}`;
        }
        str += `
 --> ${location.source}:${s.line}:${s.column}
${"".padEnd(indent)} |
${s.line.toString().padStart(indent)} | ${line}
${"".padEnd(indent)} | ${"".padEnd(s.column - 1)}${"".padEnd(last - s.column, "^")}`;
      } else {
        str += `\n at ${location.source}:${s.line}:${s.column}`;
        if (message) {
          str += `: ${message}`;
        }
      }

      return str;
    }

    // Calculate maximum width of all lines
    let maxLine;
    if (this.location) {
      maxLine = this.diagnostics.reduce(
        (t, { location }) => Math.max(t, location.start.line),
        this.location.start.line
      );
    } else {
      maxLine = Math.max.apply(
        null,
        this.diagnostics.map(d => d.location.start.line)
      );
    }
    maxLine = maxLine.toString().length;

    let str = `Error: ${this.message}`;
    if (this.location) {
      str += entry(this.location, maxLine);
    }
    for (const diag of this.diagnostics) {
      str += entry(diag.location, maxLine, diag.message);
    }

    return str;
  }
}

module.exports = GrammarError;
