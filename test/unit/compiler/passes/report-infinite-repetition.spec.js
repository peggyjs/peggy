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
