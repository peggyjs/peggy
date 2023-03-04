"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/report-infinite-repetition");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |reportInfiniteRepetition|", () => {
  it("reports infinite loops for zero_or_more", () => {
    expect(pass).to.reportError("start = ('')*", {
      message: "Possible infinite loop when parsing (repetition used with an expression that may not consume any input)",
      location: {
        source: undefined,
        start: { offset: 8, line: 1, column: 9 },
        end: { offset: 13, line: 1, column: 14 },
      },
    });
  });

  it("reports infinite loops for one_or_more", () => {
    expect(pass).to.reportError("start = ('')+", {
      message: "Possible infinite loop when parsing (repetition used with an expression that may not consume any input)",
      location: {
        source: undefined,
        start: { offset: 8, line: 1, column: 9 },
        end: { offset: 13, line: 1, column: 14 },
      },
    });
  });

  describe("reports infinite loops for repeated", () => {
    describe("without delimiter", () => {
      it("with constant boundaries", () => {
        expect(pass).to.reportError("start = ('')|..|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 16, line: 1, column: 17 },
          },
        });
        expect(pass).to.reportError("start = ('')|0..|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 17, line: 1, column: 18 },
          },
        });
        expect(pass).to.reportError("start = ('')|1..|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 17, line: 1, column: 18 },
          },
        });
        expect(pass).to.reportError("start = ('')|2..|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 17, line: 1, column: 18 },
          },
        });

        expect(pass).to.not.reportError("start = ('')| ..1|");
        expect(pass).to.not.reportError("start = ('')| ..3|");
        expect(pass).to.not.reportError("start = ('')|2..3|");
        expect(pass).to.not.reportError("start = ('')| 42 |");
      });

      it("with variable boundaries", () => {
        expect(pass).to.reportError("start = ('')|len..|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 19, line: 1, column: 20 },
          },
        });

        expect(pass).to.not.reportError("start = ('')|..len|");
        expect(pass).to.not.reportError("start = ('')|len1..len2|");
        expect(pass).to.not.reportError("start = ('')|len|");
      });

      it("with function boundaries", () => {
        expect(pass).to.reportError("start = ('')|{}..|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 18, line: 1, column: 19 },
          },
        });

        expect(pass).to.not.reportError("start = ('')|..{}|");
        expect(pass).to.not.reportError("start = ('')|{}..{}|");
        expect(pass).to.not.reportError("start = ('')|{}|");
      });
    });

    describe("with empty delimiter", () => {
      it("with constant boundaries", () => {
        expect(pass).to.reportError("start = ('')| .., ''|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 21, line: 1, column: 22 },
          },
        });
        expect(pass).to.reportError("start = ('')|0.., ''|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 21, line: 1, column: 22 },
          },
        });
        expect(pass).to.reportError("start = ('')|1.., ''|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 21, line: 1, column: 22 },
          },
        });
        expect(pass).to.reportError("start = ('')|2.., ''|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 21, line: 1, column: 22 },
          },
        });

        expect(pass).to.not.reportError("start = ('')| ..1, ''|");
        expect(pass).to.not.reportError("start = ('')| ..3, ''|");
        expect(pass).to.not.reportError("start = ('')|2..3, ''|");
        expect(pass).to.not.reportError("start = ('')| 42 , ''|");
      });

      it("with variable boundaries", () => {
        expect(pass).to.reportError("start = ('')|len.., ''|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 23, line: 1, column: 24 },
          },
        });

        expect(pass).to.not.reportError("start = ('')|..len, ''|");
        expect(pass).to.not.reportError("start = ('')|len1..len2, ''|");
        expect(pass).to.not.reportError("start = ('')|len, ''|");
      });

      it("with function boundaries", () => {
        expect(pass).to.reportError("start = ('')|{}.., ''|", {
          message:  "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input)",
          location: {
            source: undefined,
            start: { offset:  8, line: 1, column:  9 },
            end:   { offset: 22, line: 1, column: 23 },
          },
        });

        expect(pass).to.not.reportError("start = ('')|..{}, ''|");
        expect(pass).to.not.reportError("start = ('')|{}..{}, ''|");
        expect(pass).to.not.reportError("start = ('')|{}, ''|");
      });
    });

    describe("with non-empty delimiter", () => {
      it("with constant boundaries", () => {
        expect(pass).to.not.reportError("start = ('')| .., 'a'|");
        expect(pass).to.not.reportError("start = ('')|0.., 'a'|");
        expect(pass).to.not.reportError("start = ('')|1.., 'a'|");
        expect(pass).to.not.reportError("start = ('')|2.., 'a'|");

        expect(pass).to.not.reportError("start = ('')| ..1, 'a'|");
        expect(pass).to.not.reportError("start = ('')| ..3, 'a'|");
        expect(pass).to.not.reportError("start = ('')|2..3, 'a'|");
        expect(pass).to.not.reportError("start = ('')| 42 , 'a'|");
      });

      it("with variable boundaries", () => {
        expect(pass).to.not.reportError("start = ('')|len.., 'a'|");

        expect(pass).to.not.reportError("start = ('')|..len, 'a'|");
        expect(pass).to.not.reportError("start = ('')|len1..len2, 'a'|");
        expect(pass).to.not.reportError("start = ('')|len, 'a'|");
      });

      it("with function boundaries", () => {
        expect(pass).to.not.reportError("start = ('')|{}.., 'a'|");

        expect(pass).to.not.reportError("start = ('')|..{}, 'a'|");
        expect(pass).to.not.reportError("start = ('')|{}..{}, 'a'|");
        expect(pass).to.not.reportError("start = ('')|{}, 'a'|");
      });
    });
  });

  it("computes expressions that always consume input on success correctly", () => {
    expect(pass).to.reportError([
      "start = a*",
      "a 'a' = ''",
    ].join("\n"));
    expect(pass).to.not.reportError([
      "start = a*",
      "a 'a' = 'a'",
    ].join("\n"));

    expect(pass).to.reportError("start = ('' / 'a' / 'b')*");
    expect(pass).to.reportError("start = ('a' / '' / 'b')*");
    expect(pass).to.reportError("start = ('a' / 'b' / '')*");
    expect(pass).to.not.reportError("start = ('a' / 'b' / 'c')*");

    expect(pass).to.reportError("start = ('' { })*");
    expect(pass).to.not.reportError("start = ('a' { })*");

    expect(pass).to.reportError("start = ('' '' '')*");
    expect(pass).to.not.reportError("start = ('a' '' '')*");
    expect(pass).to.not.reportError("start = ('' 'a' '')*");
    expect(pass).to.not.reportError("start = ('' '' 'a')*");

    expect(pass).to.reportError("start = (a:'')*");
    expect(pass).to.not.reportError("start = (a:'a')*");

    expect(pass).to.reportError("start = ($'')*");
    expect(pass).to.not.reportError("start = ($'a')*");

    expect(pass).to.reportError("start = (&'')*");
    expect(pass).to.reportError("start = (&'a')*");

    expect(pass).to.reportError("start = (!'')*");
    expect(pass).to.reportError("start = (!'a')*");

    expect(pass).to.reportError("start = (''?)*");
    expect(pass).to.reportError("start = ('a'?)*");

    expect(pass).to.reportError("start = (''*)*");
    expect(pass).to.reportError("start = ('a'*)*");

    expect(pass).to.reportError("start = (''+)*");
    expect(pass).to.not.reportError("start = ('a'+)*");

    expect(pass).to.reportError("start = ('')*");
    expect(pass).to.not.reportError("start = ('a')*");

    expect(pass).to.reportError("start = (&{ })*");

    expect(pass).to.reportError("start = (!{ })*");

    expect(pass).to.reportError("start = 'a'|..,([ \t]*)+'.'|");

    expect(pass).to.reportError([
      "start = a*",
      "a = ''",
    ].join("\n"));
    expect(pass).to.not.reportError([
      "start = a*",
      "a = 'a'",
    ].join("\n"));

    expect(pass).to.reportError("start = ''*");
    expect(pass).to.not.reportError("start = 'a'*");

    expect(pass).to.not.reportError("start = [a-d]*");

    expect(pass).to.not.reportError("start = .*");
  });
});
