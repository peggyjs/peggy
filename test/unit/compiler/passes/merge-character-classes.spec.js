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
        "one = three / 'a' / [c-g]",
        "two = three / 'P' / [Q-T]",
        "three = 'x' / [u-w]",
      ].join("\n"),
      {
        rules: [
          {
            name: "one",
            expression: { type: "class", parts: ["a", ["c", "g"], ["u", "w"], "x"], ignoreCase: false, inverted: false },
          },
          {
            name: "two",
            expression: { type: "class", parts: ["P", ["Q", "T"], ["u", "w"], "x"], ignoreCase: false, inverted: false },
          },
          {
            name: "three",
            expression: { type: "class", parts: [["u", "w"], "x"], ignoreCase: false, inverted: false },
          },
        ],
      },
      { mergeCharacterClasses: true }
    );
  });
});
