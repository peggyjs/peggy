// @ts-check
"use strict";

const { test, expect } = require("@playwright/test");

test("benchmark tests", async({ page }) => {
  await page.goto("/development/benchmark.html");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle("Benchmark » Peggy – Parser Generator for JavaScript");
  await page.getByRole("button", { name: "Run" }).click();
  await page.getByRole("cell", { name: "Total", exact: true });
});
