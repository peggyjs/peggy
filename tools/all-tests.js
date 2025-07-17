"use strict";

const { globSync } = require("glob");
const path = require("node:path");
const fs = require("node:fs");

const cwd = path.resolve(__dirname, "..", "test");
const tests = globSync("**/*.spec.js", {
  cwd,
});

const f = fs.createWriteStream(path.join(cwd, "all.js"));

f.write('"use strict";\n\n');
for (const t of tests) {
  f.write(`require("./${t}");\n`);
}
f.close();
