"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/inference-match-result");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |inferenceMatchResult|", () => {
  it("calculate |match| property for |any| correctly", () => {
    expect(pass).to.changeAST("start = .",       { rules: [{ match:  0 }] });
  });

  it("calculate |match| property for |literal| correctly", () => {
    expect(pass).to.changeAST("start = ''",      { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = ''i",     { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = 'a'",     { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = 'a'i",    { rules: [{ match:  0 }] });
  });

  it("calculate |match| property for |class| correctly", () => {
    expect(pass).to.changeAST("start = []",      { rules: [{ match: -1 }] });
    expect(pass).to.changeAST("start = []i",     { rules: [{ match: -1 }] });
    expect(pass).to.changeAST("start = [a]",     { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = [a]i",    { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = [a-b]",   { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = [a-b]i",  { rules: [{ match:  0 }] });
  });

  it("calculate |match| property for |sequence| correctly", () => {
    expect(pass).to.changeAST("start = 'a' 'b'", { rules: [{ match:  0 }] });

    expect(pass).to.changeAST("start = 'a' ''",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = '' 'b'",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = '' ''",   { rules: [{ match:  1 }] });

    expect(pass).to.changeAST("start = 'a' []",  { rules: [{ match: -1 }] });
    expect(pass).to.changeAST("start = [] 'b'",  { rules: [{ match: -1 }] });
    expect(pass).to.changeAST("start = [] []",   { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |choice| correctly", () => {
    expect(pass).to.changeAST("start = 'a' / 'b'", { rules: [{ match:  0 }] });

    expect(pass).to.changeAST("start = 'a' / ''",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = ''  / 'b'", { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = ''  / ''",  { rules: [{ match:  1 }] });

    expect(pass).to.changeAST("start = 'a' / []",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = []  / 'b'", { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = []  / []",  { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for predicates correctly", () => {
    expect(pass).to.changeAST("start = &.",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = &''", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = &[]", { rules: [{ match: -1 }] });

    expect(pass).to.changeAST("start = !.",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = !''", { rules: [{ match: -1 }] });
    expect(pass).to.changeAST("start = ![]", { rules: [{ match:  1 }] });

    expect(pass).to.changeAST("start = &{ code }", { rules: [{ match: 0 }] });
    expect(pass).to.changeAST("start = !{ code }", { rules: [{ match: 0 }] });
  });

  it("calculate |match| property for |text| correctly", () => {
    expect(pass).to.changeAST("start = $.",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = $''", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = $[]", { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |action| correctly", () => {
    expect(pass).to.changeAST("start = .  { code }", { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = '' { code }", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = [] { code }", { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |labeled| correctly", () => {
    expect(pass).to.changeAST("start = a:.",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = a:''", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = a:[]", { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |named| correctly", () => {
    expect(pass).to.changeAST("start 'start' = .",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start 'start' = ''", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start 'start' = []", { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |optional| correctly", () => {
    expect(pass).to.changeAST("start = .?",  { rules: [{ match: 1 }] });
    expect(pass).to.changeAST("start = ''?", { rules: [{ match: 1 }] });
    expect(pass).to.changeAST("start = []?", { rules: [{ match: 1 }] });
  });

  it("calculate |match| property for |zero_or_more| correctly", () => {
    expect(pass).to.changeAST("start = .*",  { rules: [{ match: 1 }] });
    expect(pass).to.changeAST("start = ''*", { rules: [{ match: 1 }] });
    expect(pass).to.changeAST("start = []*", { rules: [{ match: 1 }] });
  });

  it("calculate |match| property for |one_or_more| correctly", () => {
    expect(pass).to.changeAST("start = .+",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = ''+", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = []+", { rules: [{ match: -1 }] });
  });

  describe("calculate |match| property for |repeated|", () => {
    describe("without delimiter", () => {
      describe("with constant boundaries", () => {
        it("for | .. | correctly", () => {
          expect(pass).to.changeAST("start =  .| .. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| .. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| .. |", { rules: [{ match:  1 }] });
        });
        it("for | ..1| correctly", () => {
          expect(pass).to.changeAST("start =  .| ..1|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| ..1|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| ..1|", { rules: [{ match:  1 }] });
        });
        it("for | ..3| correctly", () => {
          expect(pass).to.changeAST("start =  .| ..3|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| ..3|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| ..3|", { rules: [{ match:  1 }] });
        });
        it("for |0.. | correctly", () => {
          expect(pass).to.changeAST("start =  .|0.. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''|0.. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []|0.. |", { rules: [{ match:  1 }] });
        });
        it("for |1.. | correctly", () => {
          expect(pass).to.changeAST("start =  .|1.. |", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''|1.. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []|1.. |", { rules: [{ match: -1 }] });
        });
        it("for |2.. | correctly", () => {
          expect(pass).to.changeAST("start =  .|2.. |", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''|2.. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []|2.. |", { rules: [{ match: -1 }] });
        });
        it("for |2..3| correctly", () => {
          expect(pass).to.changeAST("start =  .|2..3|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''|2..3|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []|2..3|", { rules: [{ match: -1 }] });
        });
        it("for | 42 | correctly", () => {
          expect(pass).to.changeAST("start =  .| 42 |", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''| 42 |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| 42 |", { rules: [{ match: -1 }] });
        });
      });

      describe("with variable boundaries", () => {
        it("for |   ..max| correctly", () => {
          expect(pass).to.changeAST("start =  .|   ..max|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|   ..max|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|   ..max|", { rules: [{ match: 0 }] });
        });
        it("for |min..   | correctly", () => {
          expect(pass).to.changeAST("start =  .|min..   |", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|min..   |", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|min..   |", { rules: [{ match: 0 }] });
        });
        it("for |min..max| correctly", () => {
          expect(pass).to.changeAST("start =  .|min..max|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|min..max|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|min..max|", { rules: [{ match: 0 }] });
        });
        it("for | exact  | correctly", () => {
          expect(pass).to.changeAST("start =  .|exact|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|exact|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|exact|", { rules: [{ match: 0 }] });
        });
      });
    });
  });

  it("calculate |match| property for |group| correctly", () => {
    expect(pass).to.changeAST("start = (.)",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = ('')", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = ([])", { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |rule_ref| correctly", () => {
    expect(pass).to.changeAST(
      ["start = end", "end = . "].join("\n"),
      { rules: [{ match:  0 }, { match:  0 }] }
    );
    expect(pass).to.changeAST(
      ["start = end", "end = ''"].join("\n"),
      { rules: [{ match:  1 }, { match:  1 }] }
    );
    expect(pass).to.changeAST(
      ["start = end", "end = []"].join("\n"),
      { rules: [{ match: -1 }, { match: -1 }] }
    );

    expect(pass).to.changeAST("start = .  start", { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = '' start", { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = [] start", { rules: [{ match: -1 }] });

    expect(pass).to.changeAST("start = . start []", { rules: [{ match: -1 }] });
  });
});
