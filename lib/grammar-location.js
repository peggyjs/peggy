"use strict";

/**
 * When used as a grammarSource, allows grammars embedded in larger files to
 * specify their offset.  The start location is the first character in the
 * grammar.  The first line is often moved to the right by some number of
 * columns, but subsequent lines all start at the first column.
 */
class GrammarLocation {
  /**
   * Create an instance.
   *
   * @param {any} source The original grammarSource.  Should be a string or
   *   have a toString() method.
   * @param {import("./peg").Location} start The starting offset for the
   *   grammar in the larger file.
   */
  constructor(source, start) {
    this.source = source;
    this.start = start;
  }

  /**
   * Coerce to a string.
   *
   * @returns {string} The source, stringified.
   */
  toString() {
    return String(this.source);
  }

  /**
   * Return a new Location offset from the given location by the start of the
   * grammar.
   *
   * @param {import("./peg").Location} loc The location as if the start of the
   *   grammar was the start of the file.
   * @returns {import("./peg").Location} The offset location.
   */
  offset(loc) {
    return {
      line: loc.line + this.start.line - 1,
      column: (loc.line === 1)
        ? loc.column + this.start.column - 1
        : loc.column,
      offset: loc.offset + this.start.offset,
    };
  }

  /**
   * If the range has a grammarSource that is a GrammarLocation, offset the
   * start of that range by the GrammarLocation.
   *
   * @param {import("./peg").LocationRange} range The range to extract from.
   * @returns {import("./peg").Location} The offset start if possible, or the
   *   original start.
   */
  static offsetStart(range) {
    if (range.source && (typeof range.source.offset === "function")) {
      return range.source.offset(range.start);
    }
    return range.start;
  }

  /**
   * If the range has a grammarSource that is a GrammarLocation, offset the
   * end of that range by the GrammarLocation.
   *
   * @param {import("./peg").LocationRange} range The range to extract from.
   * @returns {import("./peg").Location} The offset end if possible, or the
   *   original end.
   */
  static offsetEnd(range) {
    if (range.source && (typeof range.source.offset === "function")) {
      return range.source.offset(range.end);
    }
    return range.end;
  }
}

module.exports = GrammarLocation;
