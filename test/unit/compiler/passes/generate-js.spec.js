// @ts-check
"use strict";

const chai = require("chai");
const pass = require("../../../../lib/compiler/passes/generate-js");

const { expect } = chai;
/**
 * @typedef {import("../../../../lib/peg")} PEG
 */

describe("compiler pass |generateJS|", () => {
  describe("coverage", () => {
  /** @type {PEG.ast.Grammar} */
    const ast = {
      type: "grammar",
      rules: [],
      location: {
        source: "",
        start: { line:1, column:1, offset:0 },
        end: { line:1, column:1, offset:0 },
      },
    };
    const options
      = /** @type {PEG.SourceBuildOptions<PEG.SourceOutputs>} */({});
    it("throws unless various grammar fields are set", () => {
      expect(
        () => pass(ast, options)
      ).to.throw(Error, "generateJS: generate bytecode was not called.");
      ast.literals = [];
      expect(
        () => pass({ ...ast, literals:[] }, options)
      ).to.throw(Error, "generateJS: generate bytecode was not called.");
      ast.locations = [];
      expect(
        () => pass({ ...ast, literals:[] }, options)
      ).to.throw(Error, "generateJS: generate bytecode was not called.");
      ast.classes = [];
      expect(
        () => pass({ ...ast, literals:[] }, options)
      ).to.throw(Error, "generateJS: generate bytecode was not called.");
      ast.expectations = [];
      expect(
        () => pass({ ...ast, literals:[] }, options)
      ).to.throw(Error, "generateJS: generate bytecode was not called.");
      ast.functions = [];
      expect(
        () => pass(ast, options)
      ).to.throw(Error, "generateJS: options.allowedStartRules was not set.");
      options.allowedStartRules = ["start"];
      expect(
        () => pass(ast, options)
      ).to.not.throw();
    });
  });
});
