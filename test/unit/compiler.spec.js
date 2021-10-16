"use strict";

const chai = require("chai");
const parser = require("../../lib/parser");
const compiler = require("../../lib/compiler/index");

const expect = chai.expect;

describe("Peggy compiler", () => {
  it("checks start rules", () => {
    const ast = parser.parse("foo='1'");
    expect(compiler.compile(ast, compiler.passes)).to.be.an("object");
    expect(() => compiler.compile(ast, compiler.passes, {
      allowedStartRules: null,
    })).to.throw("allowedStartRules must be an array");
    expect(() => compiler.compile(ast, compiler.passes, {
      allowedStartRules: [],
    })).to.throw("Must have at least one start rule");
    expect(() => compiler.compile(ast, compiler.passes, {
      allowedStartRules: ["bar"],
    })).to.throw('Unknown start rule "bar"');
  });

  it("checks output type", () => {
    const ast = parser.parse("foo='1'");
    expect(compiler.compile(ast, compiler.passes, {
      output: "source",
    })).to.be.a("string");
    expect(() => compiler.compile(ast, compiler.passes, {
      output: "INVALID OUTPUT TYPE",
    })).to.throw("Invalid output format: INVALID OUTPUT TYPE.");
  });
});
