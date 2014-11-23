"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/report-duplicate-rules");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |reportDuplicateRules|", () => {
  it("reports duplicate rules", () => {
    expect(pass).to.reportError([
      "start = 'a'",
      "start = 'b'",
    ].join("\n"), {
      message: "Rule \"start\" is already defined",
      location: {
        source: undefined,
        start: { offset: 12, line: 2, column: 1 },
        end: { offset: 17, line: 2, column: 6 },
      },
      diagnostics: [{
        message: "Original rule location",
        location: {
          source: undefined,
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
        },
      }],
    });
  });

  it("reports duplicate imports", () => {
    expect(pass).to.reportError([
      "import { rule, rule } from '';",
      "start = 'a'",
    ].join("\n"), {
      message: "Rule \"rule\" is already imported",
      location: {
        source: undefined,
        start: { offset: 15, line: 1, column: 16 },
        end: { offset: 19, line: 1, column: 20 },
      },
      diagnostics: [{
        message: "Original import location",
        location: {
          source: undefined,
          start: { offset: 9, line: 1, column: 10 },
          end: { offset: 13, line: 1, column: 14 },
        },
      }],
    });
  });

  it("reports overrides of imported rules", () => {
    expect(pass).to.reportError([
      "import { start } from '';",
      "start = 'a'",
    ].join("\n"), {
      message: "Rule with the same name \"start\" is already defined in the grammar, try to add `as <alias_name>` to the imported one",
      location: {
        source: undefined,
        start: { offset: 9, line: 1, column: 10 },
        end: { offset: 14, line: 1, column: 15 },
      },
      diagnostics: [{
        message: "Rule defined here",
        location: {
          source: undefined,
          start: { offset: 26, line: 2, column: 1 },
          end: { offset: 31, line: 2, column: 6 },
        },
      }],
    });
  });
});
