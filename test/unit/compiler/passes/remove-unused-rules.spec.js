"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/remove-unused-rules");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |removeUnusedRules|", () => {
  it("removes superfluous input rules", () => {
    expect(pass).to.changeAST(`
one = "a"
two = "b"`, {
      rules: [
        { "name": "one" },
      ],
    }, {
      allowedStartRules: ["one"],
    });
  });

  it("does not remove allowedStartRules", () => {
    expect(pass).to.changeAST(`
one = "a"
two = "b"`, {
      rules: [
        { "name": "one" },
        { "name": "two" },
      ],
    }, {
      allowedStartRules: ["one", "two"],
    });
  });

  it("removes entire trees of unused rules", () => {
    expect(pass).to.changeAST(`
one = "a" four
two = three three four
three = "b" four
four = "c"`, {
      rules: [
        { "name": "one" },
        { "name": "four" },
      ],
    }, {
      allowedStartRules: ["one"],
    });
  });

  it("does not visit subtrees twice", () => {
    // Verified in the debugger.
    expect(pass).to.changeAST(`
one = "a" four two three
two = four "b"
three = four "c"
four = "4" five
five = "5"
`, {
      rules: [
        { "name": "one" },
        { "name": "two" },
        { "name": "three" },
        { "name": "four" },
        { "name": "five" },
      ],
    }, {
      allowedStartRules: ["one"],
    });
  });
});
