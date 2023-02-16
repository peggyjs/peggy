"use strict";

const puppeteer = require("puppeteer");
const version = require("../package.json").version;
const { spawn } = require("child_process");
const path = require("path");

let eleventy = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const elbin = path.resolve(
      __dirname,
      "..",
      "docs",
      "node_modules",
      ".bin",
      "eleventy"
    );
    eleventy = spawn(elbin, ["--serve"], {
      cwd: path.resolve(__dirname, "..", "docs"),
      stdio: ["inherit", "inherit", "pipe"],
    });
    eleventy.stderr.setEncoding("utf8");
    eleventy.stderr.once("data", data => {
      const match = data.match(/http:\/\/localhost:\d+\//);
      if (!match) {
        reject(new Error(`Invalid URL: "${data}"`));
      } else {
        const url = new URL("/development/test.html", match[0]);
        resolve(url);
      }
    });
    eleventy.once("error", reject);
  });
}

async function main() {
  let done = null;
  const url = await startServer();
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
      const m = txt.match(/([A-Z]+): \d+ failures.\s+Peggy Version: (.*)/);
      if (!m) {
        console.error("Console:", txt);
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
    .on("pageerror", ({ message }) => {
      console.log(`ERROR: ${message}`);
      done.reject(new Error(message));
    })
    .on("requestfailed", request => {
      const txt = request.failure().errorText;
      console.log(
        `FAIL: ${txt} ${request.url()}`
      );
      done.reject(new Error(txt));
    });
  await page.goto(url, { waitUntil: "load" });
  await donePromise;
  const url2 = new URL("benchmark.html", url);
  await page.goto(url2, { waitUntil: "load" });
  await page.click("#run");
  const el = await page.waitForSelector(".total .parse-speed .value");
  const val = await el.evaluate(e => e.innerText);
  console.log(`Benchmark total: ${val.trim()}`);
  await browser.close();
}

main().catch(console.error).finally(() => new Promise((resolve, reject) => {
  eleventy.on("exit", resolve);
  eleventy.on("error", reject);
  eleventy.kill("SIGINT");
}));
