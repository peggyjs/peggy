
"use strict";

const chalk = require('chalk');

const text = process.argv[2];
const pad = '   ';
const boxBlank = ' '.repeat(text.length + (pad.length * 2));
const title = `${pad}${text}${pad}`
const underscore = `${pad}${chalk.cyanBright('═'.repeat(text.length))}${pad}`;

console.log(
    "\n\n\n\n"
  + chalk.bgBlue(
      chalk.whiteBright(
        `${boxBlank}\n${title}\n${underscore}\n${boxBlank}`
      )
    )
  + "\n"
);
