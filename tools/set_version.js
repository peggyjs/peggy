
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json'));

const file_contents = `
// This file is generated.
// Do not edit it!  Your work will be overwritten.
//
// Instead, please look at ./tools/set_version.js

"use strict";

module.exports = "${pkg.version}";
`;

fs.writeFileSync("./lib/version.js", file_contents);

console.log(` - Updated ./lib/version.js to version ${pkg.version}`);
