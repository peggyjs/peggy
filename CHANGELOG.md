Change Log
==========

This file documents all notable changes to Peggy.

3.0.2
----------

Released: 2023-03-21

### Minor Changes

- [#392](https://github.com/peggyjs/peggy/issues/392) Removed the --optimize
  command line argument, which has been invalid since v1.2.  From @hildjj.

### Bug Fixes

- [#371](https://github.com/peggyjs/peggy/issues/371) Error using online Peggy - "Can't find variable: util".  From @hildjj.
- [#374](https://github.com/peggyjs/peggy/issues/374) CLI throws exception
  on grammar errors. From @hildjj
- [#381](https://github.com/peggyjs/peggy/issues/381) Repetitions with code blocks
  for min or max not handling non-integer returns correctly.  From @hildjj.
- [#382](https://github.com/peggyjs/peggy/pull/382) Update grammarSource
  documentation.  From @AndrewRayCode.
- [#384](https://github.com/peggyjs/peggy/issues/384) Improve the error.format()
  documentation.  From @AndrewRayCode.
- [#386](https://github.com/peggyjs/peggy/issues/386) Ensure '*' as
  allowed-start-rule is documented for CLI.

3.0.1
-----

Released: 2022-03-05

### Minor Changes

- [#329](https://github.com/peggyjs/peggy/issues/329) Allow plugin options in
  generate.  This change loosens type checking strictness to allow for options
  unknown to Peggy, but used by plugins such as ts-pegjs.  From @hildjj.

### Bug Fixes

- [#329](https://github.com/peggyjs/peggy/issues/329) Allow type definition for ParserBuildOptions to include plugin options.  From @hildjj.
- [#346](https://github.com/peggyjs/peggy/issues/346) Allow extra semicolons
  between rules.  From @hildjj.
- [#347](https://github.com/peggyjs/peggy/issues/347) Disallow '$' as an initial
  character in identifiers.  This is not a breaking change because no grammar
  could have successfully used these in the past.  From @hildjj.
- [#354](https://github.com/peggyjs/peggy/pull/354) Various minor nits in the
  docs, including indentation and ensuring that the CNAME file is correct.
- [#357](https://github.com/peggyjs/peggy/issues/357) Fix infinite recursion
  possibility in repetition delimeters.  From @hildjj and @Mingun.
- [#359](https://github.com/peggyjs/peggy/issues/359) Do not treat as many
  words as reserved.  Clarify the documentation about identifiers.  Ensure
  that it is more clear that the target language being generated determines
  what words are reserved.  Clarify that reserved word checking is only
  done for labels.  From @nene.
- [#364](https://github.com/peggyjs/peggy/issues/364) Fix passing an incorrect
  external label to the expression inside the `repeated` node.  From @Mingun.

3.0.0
-----

Released: 2023-02-21

### Major Changes

- [#280](https://github.com/peggyjs/peggy/issues/280) Add inline examples to
  the documentation, from @hildjj
- [#240](https://github.com/peggyjs/peggy/issues/240) Generate SourceNodes for
  bytecode, from @hildjj
- [#338](https://github.com/peggyjs/peggy/pull/338) BREAKING CHANGE. Update
  dependencies, causing minimum supported version of node.js to move to 14.
  Generated grammar source should still work on older node versions and some
  older browsers, but testing is currently manual for those. from @hildjj
- [#291](https://github.com/peggyjs/peggy/pull/291): Add support for
  repetition operator `expression|min .. max, delimiter|`, from @Mingun
- [#339](https://github.com/peggyjs/peggy/pull/339): BREAKING CHANGE. Updated
  the list of JavaScript reserved words. This will break existing grammars
  that use any of the new words in their rule or label names. from @hildjj

Important information for plug-in authors: PR [#291] added 4 new opcodes to the bytecode:
- `IF_LT`
- `IF_GE`
- `IF_LT_DYNAMIC`
- `IF_GE_DYNAMIC`

and added a new AST node and a visitor method `repeated`. Do not forget to update your plug-ins.

Important information for grammar authors: the following words, which used to
be valid identifiers for rules and labels, are now treated as JavaScript
reserved words, and will cause errors at compile time if you are using them:

- abstract
- arguments
- as
- async
- boolean
- byte
- char
- double
- eval
- final
- float
- from
- get
- goto
- int
- long
- native
- of
- set
- short
- synchronized
- throws
- transient
- volatile

### Minor Changes

- [#274](https://github.com/peggyjs/peggy/issues/274) `"*"` is now a valid `allowedStartRule`, which means all rules are allowed, from @hildjj
- [#229](https://github.com/peggyjs/peggy/issues/229) new CLI option
  `-S <rule>` or `--start-rule <rule>` to specify the start rule when testing,
  from @hildjj
- [#236](https://github.com/peggyjs/peggy/issues/236) Website: show line numbers
  in parser input textarea, from @Mingun
- [#280](https://github.com/peggyjs/peggy/issues/280) new output type
  `source-with-inline-map`, which generates source text with an inline map,
  from @hildjj
- [#285](https://github.com/peggyjs/peggy/issues/285) Require that a non-empty
  string be given as a grammarSource if you are generating a source map, from
  @hildjj
- [#206](https://github.com/peggyjs/peggy/pull/206): New output type `ast` and
  an `--ast` flag for the CLI to get an internal grammar AST for investigation
  (can be useful for plugin writers), from @Mingun
- [#294](https://github.com/peggyjs/peggy/pull/294) Website: show errors in the
  editors, from @Mingun
- [#297](https://github.com/peggyjs/peggy/pull/297) Website: add Discord widget,
  from @hildjj
- [#299](https://github.com/peggyjs/peggy/issues/299) Add example grammar for a
  [SemVer.org](https://semver.org) semantic version string, from @dselman
- [#307](https://github.com/peggyjs/peggy/issues/307) Allow grammars to have
  relative offsets into their source files (e.g. if embedded in another doc),
  from @hildjj.
- [#308](https://github.com/peggyjs/peggy/pull/308) Add support for reading test
  data from stdin using `-T -`, from @hildjj.
- [#313](https://github.com/peggyjs/peggy/pull/313) Create the website using
  eleventy, from @camcherry

### Bug Fixes

- [#283](https://github.com/peggyjs/peggy/issues/283) Fix incorrect type
  information for DiagnosticCallback, from @hildjj
- [#287](https://github.com/peggyjs/peggy/issues/287) Allow large outputs
  to be received without blocking on the CLI tests, from @hildjj

2.0.1
-----

Released: 2022-01-01

### Major Changes

- None

### Minor Changes

- [#261](https://github.com/peggyjs/peggy/pull/261): Remove documentation from
  README.md, instead linking to the HTML documentation.  HTML documentation on
  <https://peggyjs.org> is now served from the `docs` branch, so that it won't
  update as we change the `main` branch.  `main` must be merged onto `docs` as
  a part of the release process going forward.
- [#266](https://github.com/peggyjs/peggy/issues/266): Expose the private
  field `problems` in the `Session` class, from @hildjj.

### Bug Fixes

- [#263](https://github.com/peggyjs/peggy/issues/263): Broken link to unpkg.
  This bug was a symptom of a relatively bad issue in the 2.0.0 release, where
  the web version of peggy was put in the wrong place, and therefore not
  tested in the release process.  From @hildjj.

2.0.0
-----

Released: 2022-05-28

### Major Changes

- [#163](https://github.com/peggyjs/peggy/pull/163): Add support for
  generating source maps, from @Mingun
- [#160](https://github.com/peggyjs/peggy/pull/160): Introduce an API for
  reporting errors, warnings and information messages from passes. New API
  allows reporting several diagnostics at once with intermediate results
  checking after each compilation stage, from @Mingun
- [#218](https://github.com/peggyjs/peggy/pull/218): Add a `sourceMappingURL`
  to the generated code, from @hildjj
- [#248](https://github.com/peggyjs/peggy/pull/248): Remove support for
  Node.js version 10.  When updating dependencies, too many of the tools we
  use no longer work on the Node 10, which went out of security maintenance
  more than a year ago.  Added support for Node.js version 18, from @hildjj
- [#251](https://github.com/peggyjs/peggy/pull/251): Make `commander` and
  `source-map-generator` full dependencies.  These are not needed for the
  pre-packaged web build, but will be used by Node or people that are doing
  their own packaging for the web, from @hildjj

### Minor Changes

- [#167](https://github.com/peggyjs/peggy/pull/167): New CLI, from @hildjj
  - Backward compatible with the previous
  - New -t/--test and -T/--testfile flags to directly test the generated grammar
- [#169](https://github.com/peggyjs/peggy/issues/169): Expose string escape
  functions, `stringEscape()` and `regexpClassEscape()`, from @hildjj
- [#175](https://github.com/peggyjs/peggy/pull/175): Check allowedStartRules
  for validity, from @hildjj
- [#185](https://github.com/peggyjs/peggy/pull/185): Updated eslint rules,
  from @hildjj
- [#196](https://github.com/peggyjs/peggy/pull/196): Add example grammars for
  XML and source-mapping, from @hildjj
- [#204](https://github.com/peggyjs/peggy/pull/204): Increase coverage for the
  tests, from @Mingun
- [#210](https://github.com/peggyjs/peggy/pull/210): Refactor CLI testing,
  from @hildjj

### Bug fixes

- [#164](https://github.com/peggyjs/peggy/pull/164): Fix some errors in the
  typescript definitions, from @Mingun
- [#170](https://github.com/peggyjs/peggy/issues/170): Add
  missing argument in function call, from @darlanalves
- [#182](https://github.com/peggyjs/peggy/issues/182): Fix typo in
  documentation, from @zargold
- [#197](https://github.com/peggyjs/peggy/pull/197): Fix a regression of
  redundant commas in the character classes in the error messages, introduced
  in fad4ab74d1de67ef1902cd22d479c81ccab73224, from @Mingun
- [#198](https://github.com/peggyjs/peggy/pull/198): Make all build scripts
  run on Windows, from @hildjj
- [#199](https://github.com/peggyjs/peggy/pull/199): Test web version locally,
  using puppeteer, from @hildjj
- [#211](https://github.com/peggyjs/peggy/pull/211):Command-line -t requires
  from wrong directory, from @hildjj
- [#212](https://github.com/peggyjs/peggy/pull/212): Parse errors with zero
  length give badly-formatted errors, from @hildjj
- [#214](https://github.com/peggyjs/peggy/pull/214): Failing tests don't
  format errors
- [#216](https://github.com/peggyjs/peggy/issues/216): Fix typescript
  definition of SyntaxError, from @cmfcmf
- [#220](https://github.com/peggyjs/peggy/issues/220): Fix rollup warnings,
  from @hildjj
- [#285](https://github.com/peggyjs/peggy/issues/285): Work around source-map
  bug by throwing an exception if no grammarSource is given when generating
  source maps, from @hildjj.

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
