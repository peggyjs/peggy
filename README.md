[![Tests](https://github.com/peggyjs/peggy/actions/workflows/node.js.yml/badge.svg)](https://github.com/peggyjs/peggy/actions/workflows/node.js.yml)
[![npm version](https://img.shields.io/npm/v/peggy.svg)](https://www.npmjs.com/package/peggy)
[![License](https://img.shields.io/badge/license-mit-blue.svg)](https://opensource.org/licenses/MIT)

# Peggy

Peggy is a simple parser generator for JavaScript that produces fast parsers
with excellent error reporting. You can use it to process complex data or
computer languages and build transformers, interpreters, compilers and other
tools easily.

Peggy is the successor of [PEG.js](https://github.com/pegjs/pegjs).

## Migrating from PEG.js

Peggy version 1.x.x is API compatible with the most recent PEG.js release.
Follow these steps to upgrade:

1. Uninstall `pegjs` (and `@types/pegjs` if you're using the DefinitelyTyped type definitions - we now include type definitions as part of peggy itself).
2. Replace all `require("pegjs")` or `import ... from "pegjs"` with `require("peggy")` or `import ... from "peggy"` as appropriate.
3. Any scripts that use the `pegjs` cli should now use `peggy` instead.
4. That's it!

## Features

- Simple and expressive grammar syntax
- Integrates both lexical and syntactical analysis
- Parsers have excellent error reporting out of the box
- Based on [parsing expression
  grammar](http://en.wikipedia.org/wiki/Parsing_expression_grammar) formalism
  — more powerful than traditional LL(_k_) and LR(_k_) parsers
- Usable [from your browser](https://peggyjs.org/online), from the command line,
  or via JavaScript API
- [Source map](https://developer.mozilla.org/en-US/docs/Tools/Debugger/How_to/Use_a_source_map) support

## Getting Started

[Online version](https://peggyjs.org/online) is the easiest way to generate a
parser. Just enter your grammar, try parsing few inputs, and download generated
parser code.

## Documentation

Full documentation is available at [peggyjs.org](https://peggyjs.org/documentation.html).

## Development

- [Project website](https://peggyjs.org/)
- [Wiki](https://github.com/peggyjs/peggy/wiki)
- [Source code](https://github.com/peggyjs/peggy)
- [Issue tracker](https://github.com/peggyjs/peggy/issues)
- [Discussions](https://github.com/peggyjs/peggy/discussions)
- [Browser Benchmark Suite](https://peggyjs.org/development/benchmark.html)
- [Browser Test Suite](https://peggyjs.org/development/test.html)
- [Discord Server](https://discord.gg/HU5tbEbwAB)

Peggy was originally developed by [David Majda](https://majda.cz/)
([@dmajda](http://twitter.com/dmajda)). It is currently maintained by
[Joe Hildebrand](https://github.com/hildjj) ([@hildjj](https://twitter.com/hildjj)).

You are welcome to contribute code. Unless your contribution is really trivial
you should [get in touch with us](https://discord.gg/HU5tbEbwAB)
first — this can prevent wasted effort on both sides.
