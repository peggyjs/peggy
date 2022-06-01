"use strict";

const puppeteer = require("puppeteer");
const path = require("path");
const version = require("../package.json").version;

const TOP = `file://${path.resolve(
  __dirname, "..", "docs", "development", "test.html",
)}`;

async function main() {
  let done = null;
  const donePromise = new Promise((resolve, reject) => {
    done = { resolve, reject };
  });
  const browser = await puppeteer.launch({
    slowMo: 100,
    headless: false,
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = (pages.length > 0) ? pages[0] : await browser.newPage();
  page
    .on("console", message => {
      const txt = message.text();
      const m = txt.match(/([A-Z]+): \d+ failures.  Peggy Version: (.*)/);
      if (!m) {
        console.error("Bad console message:", txt);
        done.reject();
        return;
      }
      if (m[2] !== version) {
        console.error(`Bad version: "${m[2]}" expected "${version}"`);
        done.reject();
        return;
      }
      switch (m[1]) {
        case "PASS":
          console.log("Tests: PASS");
          done.resolve();
          break;
        case "FAIL":
          console.log("Tests: FAIL");
          done.reject();
          break;
        default: {
          const type = message
            .type()
            .toUpperCase();
          console.error(`${type}: ${txt}`);
          done.reject();
          break;
        }
      }
    })
    .on("pageerror", ({ message }) => console.log(`ERROR: ${message}`))
    .on("requestfailed", request => console.log(
      `FAIL: ${request.failure().errorText} ${request.url()}`,
    ));
  await page.goto(TOP, { waitUntil: "load" });
  await donePromise;
  await page.goto(new URL("benchmark.html", TOP), { waitUntil: "load" });
  await page.click("#run");
  const el = await page.waitForSelector(".total .parse-speed .value");
  const val = await el.evaluate(e => e.innerText);
  console.log(`Benchmark total: ${val.trim()}`);
  await browser.close();
}

main().catch(console.error);
