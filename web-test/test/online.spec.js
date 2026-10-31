// @ts-check
"use strict";

const { test, expect } = require("@playwright/test");

test("online version", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/online.html");
  await expect(page.locator("#loader")).toBeHidden();
  await expect(page.locator("#content")).toBeVisible();

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle("Online Version » Peggy – Parser Generator for JavaScript");
  const input = await page.$("#right-column .CodeMirror");
  // @ts-expect-error .CodeMirror added by CodeMirror
  await page.evaluate(inp => inp?.CodeMirror?.setValue("1 + 2"), input);
  await expect(page.locator("#output")).toContainText("3");
  expect(pageErrors).toEqual([]);
});
