Change Log
==========

This file documents all notable changes to Peggy.

1.2.0
-----

Released: 2021-06-02

### Minor Changes

- Infrastructural rebake [@StoneCypher](https://github.com/peggyjs/peggy/pull/107)
    - Builds with `typescript`, removes `babel`
    - Bundles with `rollup`, removes `browserify`
    - Tests with `jest`, removes `mocha`
    - Minifies with `terser`, removes `uglify`
    - Adds `rimraf` for portable pre-build cleanup
    - Extends CI testing to `windows`, `macintosh`
    - Increases node testing range to include `node 16`
- Option to select optimization mode removed as it had no significant effect on the
  majority of generated parsers and as such represented only academic interest. You should
  use minifiers to get smaller parsers. Option `optimize` is deleted from the `generate()`
  options, flag `--optimize` is deleted from the CLI (you still can supply it, but the CLI
  will issue a warning that the option is removed).
  [@Mingun](https://github.com/peggyjs/peggy/pull/147)
- `location()`s now will have additional `source` property which value is taken
  from the `options.grammarSource` property. That property can contain arbitrary
  data, for example, path to the currently parsed file.
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
- Added missing type definitions to the `peg.d.ts` file. Added definitions for the
  `compiler` and `visitor` modules, AST, and `plugins` option in the `generate()` function.
  [@Mingun](https://github.com/peggyjs/peggy/pull/143)

  Now bytecode generation pass is independent from the JavaScript backend.
  [@Mingun](https://github.com/peggyjs/peggy/pull/117)
- Some opcodes from `compiler/opcode.js` were deprecated. Although you shouldn't use
  them directly because they are not considered as a public API, some plugins use them.
  For that reason backward compatibility is preserved:
  - Opcode `MATCH_REGEXP` is deprecated and replaced by `MATCH_CHAR_CLASS` with the same value.
  - Added new opcode `PUSH_EMPTY_STRING` that puts a new empty string on the stack.
  - Opcode `PUSH` is deprecated because it was used only for pushing empty string constants
    and they now pushed with `PUSH_EMPTY_STRING`.

  Instead of relying on the library opcodes it is better to have a copy of
  them, especially if your plugin replaces both the `generateBytecode` and
  the `generateJs` passes. [@Mingun](https://github.com/peggyjs/peggy/pull/117)
- Default visitor functions, returned by the `visitor.build()`, that just forward
  call to `node.expression`, now return the result of underlying `visit` call.
  [@Mingun](https://github.com/peggyjs/peggy/pull/144)

  Affected functions:
    - `rule`
    - `named`
    - `action`
    - `labeled`
    - `text`
    - `simple_and`
    - `simple_not`
    - `optional`
    - `zero_or_more`
    - `one_or_more`
    - `group`
- Parsers now can use two new functions to get location information:
  `offset()` and `range()`. Use them if you don't need the whole
  location information, because it is expensive to compute.
  These two new functions are always very efficient (back-ported pegjs/pegjs#528).
  [@felix9 and @Mingun](https://github.com/peggyjs/peggy/pull/145)
- Add a new option `config.reservedWords: string[]`, avalible for plugins in their
  `use()` method. Using this option, a plugin can change the list of words that
  cannot be used.

  By default this new option contains an array with [reserved JavaScript words][reserved]
  [@Mingun](https://github.com/peggyjs/peggy/pull/150)
- Several optimizations in the generator. Generated parsers should now be faster and smaller
  [@Mingun](https://github.com/peggyjs/peggy/pull/118)

[reserved]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_keywords_as_of_ecmascript_2015

### Bug fixes

- [#112](https://github.com/peggyjs/peggy/pull/112): `"group"` node in the AST now have `location` information (back-ported)
- [#143](https://github.com/peggyjs/peggy/pull/143): `peg.d.ts` had some errors in the type descriptions, which were fixed


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
