"use strict";

const chai = require("chai");
const GrammarError = require("../../lib/grammar-error");

const expect = chai.expect;

/** @type {import("../../lib/peg").LocationRange} */
const location = {
  source: undefined,
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 4, line: 1, column: 5 },
};

describe("Grammar Errors", () => {
  it("might not have a location", () => {
    const e = new GrammarError("message");
    expect(e.location).to.equal(undefined);
    expect(e.toString()).to.equal("GrammarError: message");
  });
  it("might have locations", () => {
    location.source = undefined;
    let e = new GrammarError("message", location);
    expect(e.location).to.eql(location);
    expect(e.toString()).to.equal(`\
GrammarError: message
 at 1:1`);

    e = new GrammarError("message", null, [{ message: "Subinfo", location }]);
    expect(e.location).to.equal(null);
    expect(e.toString()).to.equal(`\
GrammarError: message
 from 1:1: Subinfo`);

    location.source = "foo.peggy";
    e = new GrammarError("message", location, [{ message: "Subinfo", location }]);
    expect(e.toString()).to.equal(`\
GrammarError: message
 at foo.peggy:1:1
 from foo.peggy:1:1: Subinfo`);
  });

  describe("formats", () => {
    /** @type {import("../../lib/peg").SourceText} */
    const source = {
      source: "foo.peggy",
      text: "some error\nthat",
    };
    /** @type {import("../../lib/peg").DiagnosticNote} */
    const diagnostics = [{
      message: "Subinfo",
      location: {
        source: "foo.peggy",
        start: { offset: 5, line: 1, column: 6 },
        end: { offset: 11, line: 2, column: 1 },
      },
    }];

    describe("with main location", () => {
      location.source = "foo.peggy";
      const e = new GrammarError("message", location, diagnostics);

      it("with source", () => {
        expect(e.format([source])).to.equal(`\
Error: message
 --> foo.peggy:1:1
  |
1 | some error
  | ^^^^
note: Subinfo
 --> foo.peggy:1:6
  |
1 | some error
  |      ^^^^^`);
      });

      it("without source", () => {
        expect(e.format([])).to.equal(`\
Error: message
 at foo.peggy:1:1
 at foo.peggy:1:6: Subinfo`);
      });
    });

    describe("without main location", () => {
      const e = new GrammarError("message", null, diagnostics);

      it("with source", () => {
        expect(e.format([source])).to.equal(`\
Error: message
note: Subinfo
 --> foo.peggy:1:6
  |
1 | some error
  |      ^^^^^`);
      });

      it("without source", () => {
        expect(e.format([])).to.equal(`\
Error: message
 at foo.peggy:1:6: Subinfo`);
      });
    });
  });
});
