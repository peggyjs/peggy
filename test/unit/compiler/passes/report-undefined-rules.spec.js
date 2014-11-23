"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/report-undefined-rules");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |reportUndefinedRules|", () => {
  it("reports undefined rules", () => {
    expect(pass).to.reportError("start = undefined", {
      message: "Rule \"undefined\" is not defined or imported",
      location: {
        source: undefined,
        start: { offset: 8, line: 1, column: 9 },
        end: { offset: 17, line: 1, column: 18 },
      },
    });
  });
});
