"use strict";

/*
    This file is loaded through Webpack to automatically get mocha test files,
    and create a valid bundled file that executes on the browser.
*/

mocha.setup({
    reporter: "html",
    ui: "bdd",
    cleanReferencesAfterRun: false
});

const context = require.context("./lib", true, /\.spec\.js$/);
context.keys().forEach(context);

