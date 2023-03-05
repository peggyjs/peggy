"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/instantiate-templates");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |instantiate-templates|", () => {
  it("should instantiate template", () => {
    expect(pass).to.changeAST("start = A<dot>\ndot = .\nA<Param> = A", {
      rules: [
        {
          expression: {
            templateArgs: [
              {
                name: "dot",
                type: "rule_ref",
              },
            ],
            name: "Aᐊdotᐅ",
            type: "rule_ref",
          },
          name: "start",
          type: "rule",
        },
        {
          expression: {
            type: "any",
          },
          name: "dot",
          type: "rule",
        },
        {
          expression: {
            name: "A",
            type: "rule_ref",
          },
          templateParams: {
            declarations: ["Param"],
            type: "template_params",
          },
          name: "A",
          type: "rule",
        },
        {
          expression: {
            name: "A",
            type: "rule_ref",
          },
          name: "Aᐊdotᐅ",
          type: "rule",
        },
      ],
      topLevelInitializer: null,
      type: "grammar",
    });
  });

  it("should instantiate indirect template", () => {
    expect(pass).to.changeAST(
      "start = A<dot>\ndot = .\nA<Param> = B<Param>\nB<Param> = Param",
      {
        rules: [
          {
            expression: {
              templateArgs: [
                {
                  name: "dot",
                  type: "rule_ref",
                },
              ],
              name: "Aᐊdotᐅ",
              type: "rule_ref",
            },
            name: "start",
            type: "rule",
          },
          {
            expression: {
              type: "any",
            },
            name: "dot",
            type: "rule",
          },
          {
            expression: {
              templateArgs: [
                {
                  name: "Param",
                  type: "rule_ref",
                },
              ],
              name: "B",
              type: "rule_ref",
            },
            name: "A",
            type: "rule",
          },
          {
            expression: {
              name: "Param",
              type: "rule_ref",
            },
            name: "B",
            type: "rule",
          },
          {
            expression: {
              name: "dot",
              type: "rule_ref",
            },
            name: "Bᐊdotᐅ",
            type: "rule",
          },
          {
            expression: {
              name: "Bᐊdotᐅ",
              type: "rule_ref",
            },
            name: "Aᐊdotᐅ",
            type: "rule",
          },
        ],
      }
    );
  });
});
