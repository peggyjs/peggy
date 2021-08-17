"use strict";

const chai = require("chai");
const { hex, stringEscape, regexpClassEscape } = require("../../../lib/compiler/utils");

const expect = chai.expect;

describe("utility functions", () => {
  it("hex", () => {
    expect(hex("0")).to.equal("30");
    expect(hex("\0")).to.equal("0");
    expect(hex("\n")).to.equal("A");
    expect(hex("\ufeff")).to.equal("FEFF");
  });
  it("stringEscape", () => {
    expect(stringEscape("abc")).to.equal("abc");
    expect(stringEscape("\\\"\0\b\t\n\v\f\r")).to.equal("\\\\\\\"\\0\\b\\t\\n\\v\\f\\r");
    expect(stringEscape("\x01\x0f")).to.equal("\\x01\\x0F");
    expect(stringEscape("\x10\x1f\x7f")).to.equal("\\x10\\x1F\\x7F");
    expect(stringEscape("\u0100\u0fff")).to.equal("\\u0100\\u0FFF");
    expect(stringEscape("\u1000\uffff")).to.equal("\\u1000\\uFFFF");
  });
  it("regexpClassEscape", () => {
    expect(regexpClassEscape("\\\0\b\t\n\v\f\r")).to.equal("\\\\\\0\\b\\t\\n\\v\\f\\r");
    expect(regexpClassEscape("/]^-")).to.equal("\\/\\]\\^\\-");
    expect(regexpClassEscape("\x01\x0f")).to.equal("\\x01\\x0F");
    expect(regexpClassEscape("\x10\x1f\x7f")).to.equal("\\x10\\x1F\\x7F");
    expect(regexpClassEscape("\u0100\u0fff")).to.equal("\\u0100\\u0FFF");
    expect(regexpClassEscape("\u1000\uffff")).to.equal("\\u1000\\uFFFF");
  });
});
