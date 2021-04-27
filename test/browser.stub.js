"use strict";

/*
    This file is loaded through Webpack to automatically get mocha test files,
    and create a valid bundled file that executes on the browser.
*/

const mocha = require("mocha/mocha.js");

mocha.setup({
    reporter: "html",
    ui: "bdd",
});

// there's probably a way to automate this, but this worked and I want to ship.
require("./unit/compiler/passes/generate-bytecode.spec.js");
require("./api/generated-parser-api.spec.js");
require("./behavior/generated-parser-behavior.spec.js");
require("./unit/parser.spec.js");
require("./api/pegjs-api.spec.js");
require("./api/plugin-api.spec.js");
require("./unit/compiler/passes/remove-proxy-rules.spec.js");
require("./unit/compiler/passes/report-duplicate-labels.spec.js");
require("./unit/compiler/passes/report-duplicate-rules.spec.js");
require("./unit/compiler/passes/report-incorrect-plucking.spec.js");
require("./unit/compiler/passes/report-infinite-recursion.spec.js");
require("./unit/compiler/passes/report-infinite-repetition.spec.js");
require("./unit/compiler/passes/report-undefined-rules.spec.js");

process.nextTick(() => mocha.run());
