"use strict";

const chai = require("chai");
const {
  hex,
  stringEscape,
  regexpClassEscape,
  base64,
} = require("../../../lib/compiler/utils");

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
    expect(stringEscape("\u{10ffff}")).to.equal("\\u{10FFFF}");
  });

  it("regexpClassEscape", () => {
    expect(regexpClassEscape("\\\0\b\t\n\v\f\r")).to.equal("\\\\\\0\\b\\t\\n\\v\\f\\r");
    expect(regexpClassEscape("/]^-")).to.equal("\\/\\]\\^\\-");
    expect(regexpClassEscape("\x01\x0f")).to.equal("\\x01\\x0F");
    expect(regexpClassEscape("\x10\x1f\x7f")).to.equal("\\x10\\x1F\\x7F");
    expect(regexpClassEscape("\u0100\u0fff")).to.equal("\\u0100\\u0FFF");
    expect(regexpClassEscape("\u1000\uffff")).to.equal("\\u1000\\uFFFF");
    expect(regexpClassEscape("\u{10ffff}")).to.equal("\\u{10FFFF}");
  });

  it("base64", () => {
    expect(base64(new Uint8Array([]))).to.equal("");
    expect(base64(new Uint8Array([97]))).to.equal("YQ==");
    expect(base64(new Uint8Array([97, 98]))).to.equal("YWI=");
    expect(base64(new Uint8Array([97, 98, 99]))).to.equal("YWJj");
    expect(base64(new Uint8Array([97, 98, 99, 100]))).to.equal("YWJjZA==");
    expect(base64(new Uint8Array([97, 98, 99, 100, 101]))).to.equal("YWJjZGU=");
    expect(base64(new Uint8Array([97, 98, 99, 100, 101, 102]))).to.equal("YWJjZGVm");
  });
});
