"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/report-duplicate-imports");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |reportDuplicateImports|", () => {
  it("Errors when the same import all name is used twice", () => {
    expect(pass).to.reportError(`
import {unrelated} from "./foo.js"
import * as foo from "./foo.js"
import * as foo from "./bar.js"

a = foo.one
`,
    {
      message: "Module \"foo\" is already imported",
    });
  });
});
