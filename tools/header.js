"use strict";

// prepend header info to generated files, in-place.
// Pass list of files on command line.

const fs = require("fs");
const version = require("../lib/version.js");

const header = `\
// peggy ${version}
//
// https://peggyjs.org/
//
// Copyright (c) ${new Date().getFullYear()}- the Peggy authors
// Licensed under the MIT License.

`;

for (const f of process.argv.slice(2)) {
  const orig = fs.readFileSync(f, "utf8");
  fs.writeFileSync(f, header + orig);
}
