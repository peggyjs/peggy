"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/report-incorrect-plucking");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |reportIncorrectPlucking|", function() {
  it("prevents \"@\" from being used with an action block", function() {
    expect(pass).to.reportError("start1 = 'a' @'b' 'c' { /* empty action block */ }", {
      message: "\"@\" cannot be used with an action block",
      location: {
        source: undefined,
        start: { offset: 13, line: 1, column: 14 },
        end: { offset: 14, line: 1, column: 15 }
      },
      diagnostics: [{
        message: "Action block location",
        location: {
          source: undefined,
          start: { offset: 23, line: 1, column: 24 },
          end: { offset: 49, line: 1, column: 50 }
        }
      }]
    });

    expect(pass).to.reportError("start2 = 'a' @('b' @'c' { /* empty action block */ })", {
      message: "\"@\" cannot be used with an action block",
      location: {
        source: undefined,
        start: { offset: 19, line: 1, column: 20 },
        end: { offset: 20, line: 1, column: 21 }
      },
      diagnostics: [{
        message: "Action block location",
        location: {
          source: undefined,
          start: { offset: 25, line: 1, column: 26 },
          end: { offset: 51, line: 1, column: 52 }
        }
      }]
    });
  });

  it("allows valid plucking", function() {
    expect(pass).not.to.reportError(`

      start1 =  @'1'               // return '1'
      start2 =  @'1' / @'2'        // return '1' or '2'
      start2 =   '1'   @'2' '3'    // return '2'
      start3 =   '1' @b:'2' '3'    // return '2', label "b" can be used in semantic predicates
      start4 = a:'1' @b:'2' '3'    // return '2', labels "a" and "b" can be used in semantic predicates
      start5 =  @'1'   @'2' '3'    // return ['1', '2']
      start6 =  @'1' @b:'2' '3'    // return ['1', '2'], label "b" can be used in semantic predicates
      start7 = a:'1'   @'2' &{}    // return '2' if the semantic predicate doesnt fail
      start8 = @a:$[a-z]i+ &{ return a === 'foo' } // return "foo"

    `);
  });
});
