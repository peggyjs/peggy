"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/fix-library-numbers");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |fixLibraryNumbers|", () => {
  it("Adds library numbers for import * as", () => {
    expect(pass).to.changeAST(
      `
import * as foo from "./foo.js";
import * as bar from "./foo.js";

a = foo.one / bar.two
      `,
      {
        rules: [
          {
            "type": "rule",
            "name": "a",
            "expression": {
              "type": "choice",
              "alternatives": [
                {
                  "type": "library_ref",
                  "name": "one",
                  "library": "foo",
                  "libraryNumber": 0,
                },
                {
                  "type": "library_ref",
                  "name": "two",
                  "library": "bar",
                  "libraryNumber": 1,
                },
              ],
            },
          },
        ],
      }
    );
  });

  it("fails on unknown module names", () => {
    expect(pass).to.reportError("a = foo.bar", {
      message: "Unknown module \"foo\"",
    });
  });
});
