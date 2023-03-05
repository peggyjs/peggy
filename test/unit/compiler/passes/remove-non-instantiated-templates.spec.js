"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/remove-non-instantiated-templates");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |remove-non-instantiated-templates|", () => {
  it("should remove orphan rules", () => {
    expect(pass).to.changeAST("start = .\nA<Param> = A", {
      rules: [
        {
          expression: {
            type: "any",
          },
          name: "start",
          type: "rule",
        },
      ],
    });
  });
});
