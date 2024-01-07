"use strict";

const chai = require("chai");
const Intern = require("../../../lib/compiler/intern");

const expect = chai.expect;

describe("utility class Intern", () => {
  it("handles strings", () => {
    const i = new Intern();
    expect(i.add("one")).to.equal(0);
    expect(i.add("one")).to.equal(0);
    expect(i.add("two")).to.equal(1);
    expect(i.add("one")).to.equal(0);
    expect(i.add("two")).to.equal(1);
    expect(i.items.length).to.equal(2);
    expect(i.items).to.deep.equal(["one", "two"]);
    expect(i.get(0)).to.equal("one");
    expect(i.get(1)).to.equal("two");

    expect(i.get(-1)).to.equal(undefined);
    expect(i.get(10)).to.equal(undefined);

    const nums = i.map((v, i) => [v, i]);
    expect(nums).to.deep.equal([
      ["one", 0],
      ["two", 1],
    ]);
  });

  it("does conversions", () => {
    /** @type {Intern<string, number[]>} */
    const i = new Intern({
      convert: x => [...x].map(y => y.codePointAt(0)),
    });
    expect(i.add("abc")).to.equal(0);
    expect(i.add("abc")).to.equal(0);
    expect(i.add("abd")).to.equal(1);
    expect(i.get(0)).to.deep.equal([0x61, 0x62, 0x63]);
    expect(i.get(1)).to.deep.equal([0x61, 0x62, 0x64]);
  });

  it("stringifies", () => {
    const i = new Intern({
      stringify: () => "same",
    });
    expect(i.add("abc")).to.equal(0);
    expect(i.add("def")).to.equal(0);
  });
});
