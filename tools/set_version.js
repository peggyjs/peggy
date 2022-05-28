
"use strict";

const fs = require("fs");
const path = require("path");

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json")));

const file_contents = `
// This file is generated.
// Do not edit it!  Your work will be overwritten.
//
// Instead, please look at ./tools/set_version.js

"use strict";

module.exports = "${pkg.version}";
`;

const version_file = path.join(__dirname, "..", "lib", "version.js");
fs.writeFileSync(version_file, file_contents);

console.log(` - Updated ${path.relative(process.cwd(), version_file)} to version ${pkg.version}`);

const index_file = path.join(__dirname, "..", "docs", "index.html");
const index = fs.readFileSync(
  index_file,
  "utf8",
);

const updated = index.replace(/(https:\/\/unpkg.com\/peggy@)\d+\.\d+\.\d+/, `$1${pkg.version}`);
fs.writeFileSync(index_file, updated, "utf8");
console.log(` - Updated ${path.relative(process.cwd(), index_file)} to version ${pkg.version}`);
