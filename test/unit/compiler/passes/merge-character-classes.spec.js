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
        "one = three / 'a' / 'd' / [efh] / [c-g]",
        "two = three / 'P' / [Q-T]",
        "three = $('x' / [u-w])",
      ].join("\n"),
      {
        rules: [
          {
            name: "one",
            expression: { type: "class", parts: ["a", ["c", "h"], ["u", "x"]], ignoreCase: false, inverted: false },
          },
          {
            name: "two",
            expression: { type: "class", parts: [["P", "T"], ["u", "x"]], ignoreCase: false, inverted: false },
          },
          {
            name: "three",
            expression: { type: "class", parts: [["u", "x"]], ignoreCase: false, inverted: false },
          },
        ],
      },
      { mergeCharacterClasses: true }
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
      { mergeCharacterClasses: true }
    );
  });
});
