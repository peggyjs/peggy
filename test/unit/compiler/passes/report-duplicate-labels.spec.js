"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/report-duplicate-labels");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |reportDuplicateLabels|", function() {
  describe("in a sequence", function() {
    it("reports labels duplicate with labels of preceding elements", function() {
      expect(pass).to.reportError("start = a:'a' a:'a'", {
        message: "Label \"a\" is already defined",
        location: {
          source: undefined,
          start: { offset: 14, line: 1, column: 15 },
          end: { offset: 15, line: 1, column: 16 }
        },
        diagnostics: [{
          message: "Original label location",
          location: {
            source: undefined,
            start: { offset: 8, line: 1, column: 9 },
            end: { offset: 9, line: 1, column: 10 }
          }
        }]
      });
    });

    it("doesn't report labels duplicate with labels in subexpressions", function() {
      expect(pass).to.not.reportError("start = ('a' / a:'a' / 'a') a:'a'");
      expect(pass).to.not.reportError("start = (a:'a' { }) a:'a'");
      expect(pass).to.not.reportError("start = ('a' a:'a' 'a') a:'a'");
      expect(pass).to.not.reportError("start = b:(a:'a') a:'a'");
      expect(pass).to.not.reportError("start = $(a:'a') a:'a'");
      expect(pass).to.not.reportError("start = &(a:'a') a:'a'");
      expect(pass).to.not.reportError("start = !(a:'a') a:'a'");
      expect(pass).to.not.reportError("start = (a:'a')? a:'a'");
      expect(pass).to.not.reportError("start = (a:'a')* a:'a'");
      expect(pass).to.not.reportError("start = (a:'a')+ a:'a'");
      expect(pass).to.not.reportError("start = (a:'a') a:'a'");
    });
  });

  describe("in a choice", function() {
    it("doesn't report labels duplicate with labels of preceding alternatives", function() {
      expect(pass).to.not.reportError("start = a:'a' / a:'a'");
    });
  });

  describe("in outer sequence", function() {
    it("reports labels duplicate with labels of preceding elements", function() {
      expect(pass).to.reportError("start = a:'a' (a:'a')", {
        message: "Label \"a\" is already defined",
        location: {
          source: undefined,
          start: { offset: 15, line: 1, column: 16 },
          end: { offset: 16, line: 1, column: 17 }
        },
        diagnostics: [{
          message: "Original label location",
          location: {
            source: undefined,
            start: { offset: 8, line: 1, column: 9 },
            end: { offset: 9, line: 1, column: 10 }
          }
        }]
      });
    });

    it("doesn't report labels duplicate with the label of the current element", function() {
      expect(pass).to.not.reportError("start = a:(a:'a')");
    });

    it("doesn't report labels duplicate with labels of following elements", function() {
      expect(pass).to.not.reportError("start = (a:'a') a:'a'");
    });
  });
});
