/* eslint-disable mocha/no-setup-in-describe */
"use strict";

const chai = require("chai");
const { GrammarError, GrammarLocation } = require("../../lib/peg");

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
    /** @type {import("../../lib/peg").LocationRange} */
    const subSpan = {
      source: "foo.peggy",
      start: { offset: 5, line: 1, column: 6 },
      end: { offset: 11, line: 2, column: 1 },
    };

    /** @type {import("../../lib/peg").DiagnosticNote} */
    const diagnostics = [{
      message: "Subinfo",
      location: subSpan,
    }];

    describe("single problem", () => {
      describe("with main location", () => {
        location.source = "foo.peggy";
        const e = new GrammarError("message", location, diagnostics);

        it("with zero-length error at the end", () => {
          const ze = new GrammarError("message", {
            source: "foo.peggy",
            start: { offset: 4, line: 1, column: 5 },
            end: { offset: 4, line: 1, column: 5 },
          });
          expect(ze.format([source])).to.equal(`\
error: message
 --> foo.peggy:1:5
  |
1 | some error
  |     ^`);
        });

        it("with source", () => {
          expect(e.format([source])).to.equal(`\
error: message
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
error: message
 at foo.peggy:1:1
 at foo.peggy:1:6: Subinfo`);
        });
      });

      describe("without main location", () => {
        const e = new GrammarError("message", null, diagnostics);

        it("with source", () => {
          expect(e.format([source])).to.equal(`\
error: message
note: Subinfo
 --> foo.peggy:1:6
  |
1 | some error
  |      ^^^^^`);
        });

        it("without source", () => {
          expect(e.format([])).to.equal(`\
error: message
 at foo.peggy:1:6: Subinfo`);
        });
      });
    });

    describe("several problems", () => {
      describe("with main location", () => {
        location.source = "foo.peggy";
        const e = new GrammarError("message", location, diagnostics);
        e.problems.push([
          "warning",
          "Warning message",
          subSpan,
          [{ message: "Warning Subinfo", location: subSpan }],
        ]);
        e.problems.push([
          "info",
          "Info message",
          null,
          [],
        ]);

        it("null source text", () => {
          expect(e.format([{ source: null, text: null }])).to.equal(`\
error: message
 at foo.peggy:1:1
 at foo.peggy:1:6: Subinfo

warning: Warning message
 at foo.peggy:1:6
 at foo.peggy:1:6: Warning Subinfo`);

          expect(e.format([{ source: null, text: undefined }])).to.equal(`\
error: message
 at foo.peggy:1:1
 at foo.peggy:1:6: Subinfo

warning: Warning message
 at foo.peggy:1:6
 at foo.peggy:1:6: Warning Subinfo`);
        });

        it("with source", () => {
          expect(e.format([source])).to.equal(`\
error: message
 --> foo.peggy:1:1
  |
1 | some error
  | ^^^^
note: Subinfo
 --> foo.peggy:1:6
  |
1 | some error
  |      ^^^^^

warning: Warning message
 --> foo.peggy:1:6
  |
1 | some error
  |      ^^^^^
note: Warning Subinfo
 --> foo.peggy:1:6
  |
1 | some error
  |      ^^^^^`);
        });

        it("with GrammarLocation", () => {
          const gl = new GrammarLocation("foo.peggy", {
            offset: 12,
            line: 15,
            column: 8,
          });
          expect(String(gl)).to.equal("foo.peggy");
          location.source = gl;
          subSpan.source = gl;
          e.diagnostics.push({
            message: "Column not offset",
            location: {
              source: gl,
              start: { offset: 11, line: 2, column: 1 },
              end: { offset: 15, line: 2, column: 5 },
            },
          });
          expect(e.format([{ source: gl, text: source.text }])).to.equal(`\
error: message
 --> foo.peggy:15:8
   |
15 | some error
   | ^^^^
note: Subinfo
 --> foo.peggy:15:13
   |
15 | some error
   |      ^^^^^
note: Column not offset
 --> foo.peggy:16:1
   |
16 | that
   | ^^^^

warning: Warning message
 --> foo.peggy:15:13
   |
15 | some error
   |      ^^^^^
note: Warning Subinfo
 --> foo.peggy:15:13
   |
15 | some error
   |      ^^^^^`);
          location.source = "foo.peggy";
          subSpan.source = "foo.peggy";
          e.diagnostics.pop();
        });

        it("without source", () => {
          expect(e.format([])).to.equal(`\
error: message
 at foo.peggy:1:1
 at foo.peggy:1:6: Subinfo

warning: Warning message
 at foo.peggy:1:6
 at foo.peggy:1:6: Warning Subinfo`);
        });
      });

      describe("without main location", () => {
        const e = new GrammarError("message", null, diagnostics);
        e.problems.push([
          "warning",
          "Warning message",
          null,
          [{ message: "Warning Subinfo", location: subSpan }],
        ]);
        e.problems.push([
          "info",
          "Info message",
          null,
          [],
        ]);

        it("with source", () => {
          expect(e.format([source])).to.equal(`\
error: message
note: Subinfo
 --> foo.peggy:1:6
  |
1 | some error
  |      ^^^^^

warning: Warning message
note: Warning Subinfo
 --> foo.peggy:1:6
  |
1 | some error
  |      ^^^^^`);
        });

        it("without source", () => {
          expect(e.format([])).to.equal(`\
error: message
 at foo.peggy:1:6: Subinfo

warning: Warning message
 at foo.peggy:1:6: Warning Subinfo`);
        });
      });
    });
  });
});
