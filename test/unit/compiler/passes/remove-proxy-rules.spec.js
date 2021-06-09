"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/remove-proxy-rules");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |removeProxyRules|", () => {
  describe("when a proxy rule isn't listed in |allowedStartRules|", () => {
    it("updates references and removes it", () => {
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
            { name: "proxied" },
          ],
        },
        { allowedStartRules: ["start"] }
      );
    });
  });

  describe("when a proxy rule is listed in |allowedStartRules|", () => {
    it("updates references but doesn't remove it", () => {
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
            {
              name: "proxy",
              expression: { type: "rule_ref", name: "proxied" },
            },
            { name: "proxied" },
          ],
        },
        { allowedStartRules: ["start", "proxy"] }
      );
    });
  });
});
