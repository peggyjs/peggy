"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/remove-proxy-rules");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |removeProxyRules|", () => {
  it("updates references", () => {
    // This pass no longer removes the proxy rule, that is done in
    // remove-unused-rules.
    expect(pass).to.changeAST(
      [
        "start = proxy",
        "proxy = proxied",
        "proxied = 'a'",
      ].join("\n"),
      {
        rules: [
          {
            name: "start",
            expression: { type: "rule_ref", name: "proxied" },
          },
          { name: "proxy" },
          { name: "proxied" },
        ],
      },
      { allowedStartRules: ["start"] }
    );
  });
});
