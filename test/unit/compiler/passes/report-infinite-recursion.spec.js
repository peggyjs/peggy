"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/report-infinite-recursion");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |reportInfiniteRecursion|", () => {
  it("reports direct left recursion", () => {
    expect(pass).to.reportError("start = start", {
      message: "Possible infinite loop when parsing (left recursion: start -> start)",
      location: {
        source: undefined,
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 5, line: 1, column: 6 },
      },
    });
  });

  it("reports indirect left recursion", () => {
    expect(pass).to.reportError([
      "start = stop",
      "stop = start",
    ].join("\n"), {
      message: "Possible infinite loop when parsing (left recursion: start -> stop -> start)",
      location: {
        source: undefined,
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 5, line: 1, column: 6 },
      },
    });
  });

  describe("in sequences", () => {
    it("reports left recursion if all preceding elements match empty string", () => {
      expect(pass).to.reportError("start = '' '' '' start");
    });

    it("doesn't report left recursion if some preceding element doesn't match empty string", () => {
      expect(pass).to.not.reportError("start = 'a' '' '' start");
      expect(pass).to.not.reportError("start = '' 'a' '' start");
      expect(pass).to.not.reportError("start = '' '' 'a' start");
    });

    // Regression test for #359.
    it("reports left recursion when rule reference is wrapped in an expression", () => {
      expect(pass).to.reportError("start = '' start?");
    });

    it("computes expressions that always consume input on success correctly", () => {
      expect(pass).to.reportError([
        "start = a start",
        "a 'a' = ''",
      ].join("\n"));
      expect(pass).to.not.reportError([
        "start = a start",
        "a 'a' = 'a'",
      ].join("\n"));

      expect(pass).to.reportError("start = ('' / 'a' / 'b') start");
      expect(pass).to.reportError("start = ('a' / '' / 'b') start");
      expect(pass).to.reportError("start = ('a' / 'b' / '') start");
      expect(pass).to.not.reportError("start = ('a' / 'b' / 'c') start");

      expect(pass).to.reportError("start = ('' { }) start");
      expect(pass).to.not.reportError("start = ('a' { }) start");

      expect(pass).to.reportError("start = ('' '' '') start");
      expect(pass).to.not.reportError("start = ('a' '' '') start");
      expect(pass).to.not.reportError("start = ('' 'a' '') start");
      expect(pass).to.not.reportError("start = ('' '' 'a') start");

      expect(pass).to.reportError("start = a:'' start");
      expect(pass).to.not.reportError("start = a:'a' start");

      expect(pass).to.reportError("start = $'' start");
      expect(pass).to.not.reportError("start = $'a' start");

      expect(pass).to.reportError("start = &'' start");
      expect(pass).to.reportError("start = &'a' start");

      expect(pass).to.reportError("start = !'' start");
      expect(pass).to.reportError("start = !'a' start");

      expect(pass).to.reportError("start = ''? start");
      expect(pass).to.reportError("start = 'a'? start");

      expect(pass).to.reportError("start = ''* start");
      expect(pass).to.reportError("start = 'a'* start");

      expect(pass).to.reportError("start = ''+ start");
      expect(pass).to.not.reportError("start = 'a'+ start");

      expect(pass).to.reportError("start = ''| .. | start");
      expect(pass).to.reportError("start = ''|0.. | start");
      expect(pass).to.reportError("start = ''|1.. | start");
      expect(pass).to.reportError("start = ''|2.. | start");
      expect(pass).to.reportError("start = ''| ..1| start");
      expect(pass).to.reportError("start = ''| ..3| start");
      expect(pass).to.reportError("start = ''|2..3| start");
      expect(pass).to.reportError("start = ''| 42 | start");

      expect(pass).to.reportError("start = 'a'| .. | start");
      expect(pass).to.reportError("start = 'a'|0.. | start");
      expect(pass).to.not.reportError("start = 'a'|1.. | start");
      expect(pass).to.not.reportError("start = 'a'|2.. | start");
      expect(pass).to.reportError("start = 'a'| ..1| start");
      expect(pass).to.reportError("start = 'a'| ..3| start");
      expect(pass).to.not.reportError("start = 'a'|2..3| start");
      expect(pass).to.not.reportError("start = 'a'| 42 | start");

      expect(pass).to.reportError("start = ('') start");
      expect(pass).to.not.reportError("start = ('a') start");

      expect(pass).to.reportError("start = &{ } start");

      expect(pass).to.reportError("start = !{ } start");

      expect(pass).to.reportError([
        "start = a start",
        "a = ''",
      ].join("\n"));
      expect(pass).to.not.reportError([
        "start = a start",
        "a = 'a'",
      ].join("\n"));

      expect(pass).to.reportError("start = '' start");
      expect(pass).to.not.reportError("start = 'a' start");

      expect(pass).to.not.reportError("start = [a-d] start");

      expect(pass).to.not.reportError("start = . start");
    });
  });

  describe("in repeated with delimiter", () => {
    it("doesn't report left recursion for delimiter if expression not match empty string", () => {
      expect(pass).to.not.reportError("start = 'a'| .. , start|");
      expect(pass).to.not.reportError("start = 'a'|0.. , start|");
      expect(pass).to.not.reportError("start = 'a'|1.. , start|");
      expect(pass).to.not.reportError("start = 'a'|2.. , start|");
      expect(pass).to.not.reportError("start = 'a'| ..3, start|");
      expect(pass).to.not.reportError("start = 'a'|2..3, start|");
      expect(pass).to.not.reportError("start = 'a'| 42 , start|");
    });

    it("reports left recursion for delimiter if expression match empty string", () => {
      expect(pass).to.reportError("start = ''| .. , start|");
      expect(pass).to.reportError("start = ''|0.. , start|");
      expect(pass).to.reportError("start = ''|1.. , start|");
      expect(pass).to.reportError("start = ''|2.. , start|");
      expect(pass).to.reportError("start = ''| ..3, start|");
      expect(pass).to.reportError("start = ''|2..3, start|");
      expect(pass).to.reportError("start = ''| 42 , start|");
    });

    it("does not inifinite loop", () => {
      // From https://github.com/peggyjs/peggy/issues/379
      expect(pass).to.reportError(`
        start = expr*

        expr
          = expr "++"
      `, {
        message: "Possible infinite loop when parsing (left recursion: start -> expr -> expr)",
      });
    });
  });
});
