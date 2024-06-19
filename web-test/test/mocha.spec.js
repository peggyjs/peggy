// @ts-check
"use strict";

const { test, expect } = require("@playwright/test");
const { version } = require("../../package.json");

test("benchmark tests", async({ page }) => {
  page.on("console", msg => {
    const txt = msg.text();
    if (!/^(\[11ty\]|PASS: 0)/.test(txt)) {
      console.log(`CONSOLE: "${txt}"`);
      page.close();
    }
  });
  await page.goto("/development/test.html");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle("Test » Peggy – Parser Generator for JavaScript");
  await expect(page.locator("#results")).toContainText(`PASS: 0 failures. Peggy Version: ${version}`);
});
