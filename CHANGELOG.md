Change Log
==========

This file documents all notable changes to Peggy.

1.2.0
-----

Released: TBD

### Minor Changes

- Infrastructural rebake [@StoneCypher](https://github.com/peggyjs/peggy/pull/107)
    - Builds with `typescript`, removes `babel`
    - Bundles with `rollup`, removes `browserify`
    - Tests with `jest`, removes `mocha`
        - Enables coverage analysis using `lcov` notation
        - Coverage is not archived; will archive with #120
    - Minifies with `terser`, removes `uglify`
    - Adds `rimraf` for portable pre-build cleanup
    - Extends CI testing to `windows`, `macintosh`
    - Increases node testing range to include `node 16`
    - Adds an announcer to make the build process more readable
- Option for selection optimization mode removed as it has no significant effect on
  majority of generated parsers and represents only academic interest mostly. You should
  use minifiers to get smaller parsers. Option `optimize` is deleted from the `generate()`
  options, flag `--optimize` is deleted from the CLI (you still can supply it, but the CLI
  will issue a warning that the option is removed).
  [@Mingun](https://github.com/peggyjs/peggy/pull/147)
- `location()`s now will have additional `source` property which value is taken
  from the `options.grammarSource` property. That property can contain arbitrary
  data,for example, path to the currently parsed file.
  [@Mingun](https://github.com/peggyjs/peggy/pull/95)
- Made usage of `GrammarError` and `peg$SyntaxError` more consistent.  Use the
  `format` method to get pretty string outputs.  Updated the `peggy` binary to
  make pretty errors. Slight breaking change: the format of a few error
  messages have changed; use the `toString()` method on `GrammarError` to get
  something close to the old text.
  [@hildjj](https://github.com/peggyjs/peggy/pull/116)
- The code generator was slightly reworked to simplify reusing the bytecode generator
  (`generate.generateBytecode` pass). Property `consts` on the `grammar` AST node,
  has been creating by the pass in the past, was decoupled into 4 other properties
  with the structured information:
  - `literals`
  - `classes`
  - `expectations`
  - `functions`

  Now bytecode generation pass is independent from the JavaScript backend.
  [@Mingun](https://github.com/peggyjs/peggy/pull/117)

### Bug fixes

- [#112](https://github.com/peggyjs/peggy/pull/112): `"group"` node in the AST now have `location` information (back-ported)


1.1.0
-----

Released: 2021-04-22

### Major Changes

- Added global initializer blocks, which contain code that is only run once
  when the grammar is loaded, rather than once every time the parser runs.
  Global initializers are surrounded by `{{` and `}}`, and must come before
  the per-parser initializer, which is surrounded by `{` and `}`.
  [@jaubourg](https://github.com/peggyjs/peggy/pull/73)
- Back-ported value plucking with `@` from pegjs head.  If your rule has a simple action that returns one or more of the values matched by the rule, you can instead mark those expressions with `@` and not need an action.  This works inside of parens as well.  [@hildjj](https://github.com/peggyjs/peggy/pull/89)

### Bug fixes
- [#10](https://github.com/peggyjs/peggy/issues/10): Better docs for parser options
- [#40](https://github.com/peggyjs/peggy/issues/40): Turn on eslint prefer-const
- [#58](https://github.com/peggyjs/peggy/issues/58): Release script didn't push tag correctly
- [#61](https://github.com/peggyjs/peggy/issues/61): Replace download link with new one in doc (partial fix)
- [#71](https://github.com/peggyjs/peggy/issues/71): Readme doesn't include "es" format
- [#72](https://github.com/peggyjs/peggy/issues/72): Generated code has wrong version number

1.0.0
-----

Released: 2021-04-16

### Major Changes

First release

## Previous history

See [previous project](https://github.com/pegjs/pegjs/tree/master/docs/changelogs) for PEG.js changes
