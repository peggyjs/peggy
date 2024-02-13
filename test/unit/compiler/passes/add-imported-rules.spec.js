"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/add-imported-rules");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |addImportedRules|", () => {
  it("creates default rules with undefined startRule", () => {
    expect(pass).to.changeAST(
      `
import foo from './foo.js'
import bar from './bar.js'

a = foo / bar
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
                  "name": "foo",
                  "type": "rule_ref",
                },
                {
                  "name": "bar",
                  "type": "rule_ref",
                },
              ],
            },
          },
          {
            "type": "rule",
            "name": "foo",
            "expression": {
              "type": "library_ref",
              "name": undefined,
              "library": "./foo.js",
              "libraryNumber": 0,
            },
          },
          {
            "type": "rule",
            "name": "bar",
            "expression": {
              "type": "library_ref",
              "name": undefined,
              "library": "./bar.js",
              "libraryNumber": 1,
            },
          },
        ],
      }
    );
  });

  it("creates bound rules with named startRule", () => {
    expect(pass).to.changeAST(
      `
import {foo} from './foo.js'
import {bar} from './bar.js'

a = foo / bar
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
                  "name": "foo",
                  "type": "rule_ref",
                },
                {
                  "name": "bar",
                  "type": "rule_ref",
                },
              ],
            },
          },
          {
            "type": "rule",
            "name": "foo",
            "expression": {
              "type": "library_ref",
              "name": "foo",
              "library": "./foo.js",
              "libraryNumber": 0,
            },
          },
          {
            "type": "rule",
            "name": "bar",
            "expression": {
              "type": "library_ref",
              "name": "bar",
              "library": "./bar.js",
              "libraryNumber": 1,
            },
          },
        ],
      }
    );
  });

  it("creates bound rules with renamed startRule", () => {
    expect(pass).to.changeAST(
      `
import {foo as foo1} from './foo.js'
import {bar as bar2} from './bar.js'

a = foo1 / bar2
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
                  "name": "foo1",
                  "type": "rule_ref",
                },
                {
                  "name": "bar2",
                  "type": "rule_ref",
                },
              ],
            },
          },
          {
            "type": "rule",
            "name": "foo1",
            "expression": {
              "type": "library_ref",
              "name": "foo",
              "library": "./foo.js",
              "libraryNumber": 0,
            },
          },
          {
            "type": "rule",
            "name": "bar2",
            "expression": {
              "type": "library_ref",
              "name": "bar",
              "library": "./bar.js",
              "libraryNumber": 1,
            },
          },
        ],
      }
    );
  });

  it("skips import as", () => {
    expect(pass).to.changeAST(
      `
import * as foo from './foo.js'

a = foo.one / foo.two
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
                  "libraryNumber": -1,
                },
                {
                  "type": "library_ref",
                  "name": "two",
                  "library": "foo",
                  "libraryNumber": -1,
                },
              ],
            },
          },
        ],
      }
    );
  });

  it("errors on bad types", () => {
    expect(() => {
      pass({
        imports: [
          {
            what: [
              {
                type: "unknown",
              },
            ],
            from: {
              "module": "foo.js",
            },
          },
        ],
      });
    }).to.throw(TypeError);
  });
});
