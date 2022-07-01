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
   * @param {Location} start The starting offset for the grammar in the larger
   *   file.
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
   * @param {Location} loc The location as if the start of the grammar was the
   *   start of the file.
   * @returns {Location} The offset location.
   */
  offset(loc) {
    return {
      line: loc.line + this.start.line,
      column: (loc.line === 1)
        ? loc.column + this.start.column - 1
        : loc.column,
      offset: loc.offset + this.start.offset,
    };
  }
}

module.exports = GrammarLocation;
