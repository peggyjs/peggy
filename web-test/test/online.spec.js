// @ts-check
"use strict";

const { test, expect } = require("@playwright/test");

test("online version", async ({ page }) => {
  await page.goto("/online.html");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle("Online Version » Peggy – Parser Generator for JavaScript");
  const input = await page.$("#right-column .CodeMirror");
  // @ts-expect-error .CodeMirror added by CodeMirror
  await page.evaluate(inp => inp?.CodeMirror?.setValue("1 + 2"), input);
  await expect(page.locator("#output")).toContainText("3");
});
