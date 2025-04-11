"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/merge-character-classes");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |mergeCharacterClasses|", () => {
  it("Merges single character literals, class, and ref_rules", () => {
    expect(pass).to.changeAST(
      [
        "one = three / $('a' / 'd') / [c-f] / [efh] / [c-h] / [c-g]",
        "two = 'P' / 'P' / three / 'P' / [Q-T]",
        "three = $('x' / [u-w])",
        "four = 'a' / [aaa] / 'a'",
      ].join("\n"),
      {
        rules: [
          {
            name: "one",
            expression: {
              type: "class",
              parts: ["a", ["c", "h"], ["u", "x"]],
              ignoreCase: false,
              inverted: false,
              location: {
                start: { line: 1, column: 7 },
                end: { line: 1, column: 59 },
              },
            },
          },
          {
            name: "two",
            expression: {
              type: "class",
              parts: [["P", "T"], ["u", "x"]],
              ignoreCase: false,
              inverted: false,
              location: {
                start: { line: 2, column: 7 },
                end: { line: 2, column: 38 },
              },
            },
          },
          {
            name: "three",
            expression: {
              type: "class",
              parts: [["u", "x"]],
              ignoreCase: false,
              inverted: false,
              location: {
                start: { line: 3, column: 9 },
                end: { line: 3, column: 23 },
              },
            },
          },
          {
            name: "four",
            expression: {
              type: "literal",
              value: "a",
              ignoreCase: false,
              location: {
                start: { line: 4, column: 8 },
                end: { line: 4, column: 25 },
              },
            },
          },
        ],
      },
      { allowedStartRules: ["one"] }
    );
  });

  it("Merges case-independent single character literals, class, and ref_rules", () => {
    expect(pass).to.changeAST(
      [
        "one = three / $('a'i / 'd'i) / [c-f]i / [efh]i / [c-h]i / [c-g]i",
        "two = 'P'i / 'P'i / three / 'P'i / [Q-T]i",
        "three = $('x'i / [u-w]i)",
        "four = 'a'i / [aaa]i / 'a'i",
      ].join("\n"),
      {
        rules: [
          {
            name: "one",
            expression: {
              type: "class",
              parts: ["a", ["c", "h"], ["u", "x"]],
              ignoreCase: true,
              inverted: false,
              location: {
                start: { line: 1, column: 7 },
                end: { line: 1, column: 65 },
              },
            },
          },
          {
            name: "two",
            expression: {
              type: "class",
              parts: [["P", "T"], ["u", "x"]],
              ignoreCase: true,
              inverted: false,
              location: {
                start: { line: 2, column: 7 },
                end: { line: 2, column: 42 },
              },
            },
          },
          {
            name: "three",
            expression: {
              type: "class",
              parts: [["u", "x"]],
              ignoreCase: true,
              inverted: false,
              location: {
                start: { line: 3, column: 9 },
                end: { line: 3, column: 25 },
              },
            },
          },
          {
            name: "four",
            expression: {
              type: "literal",
              value: "a",
              ignoreCase: true,
              location: {
                start: { line: 4, column: 8 },
                end: { line: 4, column: 28 },
              },
            },
          },
        ],
      },
      { allowedStartRules: ["one"] }
    );
  });

  it("Doesn't merge inappropriately", () => {
    expect(pass).to.changeAST(
      [
        "case = action / 'a'i / [c-g]",
        "invert = action / 'P' / [^Q-T]",
        "action = 'x' { return 42; } / [u-w]",
      ].join("\n"),
      {
        rules: [
          {
            name: "case",
            expression: {
              type: "choice",
              alternatives: [
                { type: "rule_ref", name: "action" },
                { type: "literal", value: "a", ignoreCase: true },
                { type: "class", parts: [["c", "g"]], ignoreCase: false, inverted: false },
              ],
            },
          },
          {
            name: "invert",
            expression: {
              type: "choice",
              alternatives: [
                { type: "rule_ref", name: "action" },
                { type: "literal", value: "P", ignoreCase: false },
                { type: "class", parts: [["Q", "T"]], ignoreCase: false, inverted: true },
              ],
            },
          },
          {
            name: "action",
            expression: {
              type: "choice",
              alternatives: [
                { type: "action" },
                { type: "class", parts: [["u", "w"]], ignoreCase: false, inverted: false },
              ],
            },
          },
        ],
      },
      { allowedStartRules: ["case"] }
    );
  });

  it("Handles undefined rule_refs", () => {
    expect(pass).to.changeAST(
      [
        "start = unknown / 'a' / [c-g]",
      ].join("\n"),
      {
        rules: [
          {
            name: "start",
            expression: {
              type: "choice",
              alternatives: [
                { type: "rule_ref", name: "unknown" },
                { type: "class", parts: ["a", ["c", "g"]], ignoreCase: false, inverted: false },
              ],
            },
          },
        ],
      },
      { allowedStartRules: ["start"] }
    );
  });

  it("handles empty literals", () => {
    expect(pass).to.changeAST(
      [
        "start = [a] / ''",
      ].join("\n"),
      {
        rules: [
          {
            name: "start",
            expression: {
              type: "choice",
              alternatives: [
                { type: "class", parts: ["a"], ignoreCase: false, inverted: false, unicode: false },
                { type: "literal", value: "" },
              ],
            },
          },
        ],
      },
      { allowedStartRules: ["start"] }
    );
  });
});
