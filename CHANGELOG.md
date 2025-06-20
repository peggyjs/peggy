Change Log
==========

This file documents all notable changes to Peggy.

Unreleased
----------

Released: TBD

### Major Changes

### New features

### Bug fixes

5.0.4
-----

Released: 2025-07-20

### Bug fixes

- Update dependencies.
  [#630](https://github.com/peggyjs/peggy/pull/630)

5.0.3
-----

Released: 2025-05-30

### Bug fixes

- Tweak TypeScript output from --dts to make error type more clear. [#623](https://github.com/peggyjs/peggy/pull/623)
- Test on Node 24, but not Node 23.
  [#624](https://github.com/peggyjs/peggy/pull/624)
- Write a message after failing a compile in watch mode.
  [#624](https://github.com/peggyjs/peggy/pull/624)

### Documentation

5.0.2
-----

Released: 2025-05-07

### Bug fixes

- Fix TypeScript error in peg.d.ts, SyntaxError constructor should not have a return type.
  [#619](https://github.com/peggyjs/peggy/pull/619)
- Add more Unicode to fizzbuzz example.
  [#619](https://github.com/peggyjs/peggy/pull/619)
- Catch invalid unicode property escapes at compile time.
  [#619](https://github.com/peggyjs/peggy/pull/619)

5.0.1
-----

Released: 2025-05-07

### Bug fixes

- Fix TypeScript error in peg.d.ts.
  [#615](https://github.com/peggyjs/peggy/pull/615)
- Fix SyntaxError definition in peg.d.ts
  [#616](https://github.com/peggyjs/peggy/pull/616)

5.0.0
-----

Released: 2025-05-03

### Major Changes

- BREAKING: Generated code no longer supports ES5.  You can still generate
  commonjs or es6 exports, but the code itself requires ES2020.  If you need
  to support earlier runtimes, you should use a transpiler such as Babel.
  Generated code now uses `const` and `let`, but is still not strict about
  using `const` wherever possible, due to the complexities of code generation.
  Work-arounds and polyfills for class extension, padding, and `Object.assign`
  have been removed in favor of their ES2020 equivalents.
  [#593](https://github.com/peggyjs/peggy/pull/593)
- BREAKING: Node.js v20+ is now required for the CLI tools.  No testing is
  performed on earlier versions of Node, and no issues will be fixed for
  earlier versions. [#593](https://github.com/peggyjs/peggy/pull/593)
- BREAKING: The SyntaxError class exported from generated parsers is now a
  proper subclass of the built-in ECMAscript SyntaxError class.  The name of
  the type has changed to `PeggySyntaxError`, which may cause some slight need
  for rework in TypeScript-aware projects.  This was the main driver behind
  moving away from ES5. [#593](https://github.com/peggyjs/peggy/pull/593)
- BREAKING: The grammar parser now uses your JavaScript environment's understanding
  of Unicode classes, rather than a partial copy of Unicode 8 as before.  This
  should be more correct and evolve over time while staying backward-compatible
  to the extent that the Unicode Consortium keeps to its goals.  Because this
  might slightly affect what rule names are valid, we are marking this as a
  breaking change just in case.
  [#602](https://github.com/peggyjs/peggy/pull/602)

### New features
- Extend library mode to include a success flag and a function for throwing
  syntax errors when needed.  Library mode is still intended as internal-only,
  and subject to backward-incompatible changes in future versions.
  [#501](https://github.com/peggyjs/peggy/issues/501)
- Slightly better verbose output from the CLI, showing where files are written.
  [#601](https://github.com/peggyjs/peggy/pull/601)
- Merged class rules (rules which consist of a character class like
  `foo = [0-9]` that are only called from a rule like `bar = foo / [a-z]`, which
  merges the two classes together into a single rule like `bar = [0-9a-z]`),
  and which are not allowedStartRules, are no longer output into the generated
  parser, since there is no way for that code to be called.  This has a chance
  of generating issues for people who are calling the internals of the
  generated parser using
  [@peggyjs/coverage](https://github.com/peggyjs/coverage), but that's a
  lightly-documented feature of that library.
  [#594](https://github.com/peggyjs/peggy/pull/594)
- Superfluous rules (rules which cannot be reached from an allowedStartRule)
  no longer generate code into the parser.  An INFO-level debug statement is
  generated for each of these removals.  Like merged class rules above, this
  should only be removing dead code.
  [#594](https://github.com/peggyjs/peggy/pull/594)
- Character classes now process characters not in the Basic Multi-Lingual
  Plane (BMP) correctly.  This feature requires a JavaScript environment
  that supports the `u` flag to regular expressions.  The `u` flag will only
  be used on character classes that make use of this new feature.
  [#602](https://github.com/peggyjs/peggy/pull/602)
- Unicode characters may now be specified with the `\u{hex}` syntax, allowing
  easier inclusion of characters not in the BMP (such as newer emoji).  This
  syntax works both in string literals and in character classes.
  [#602](https://github.com/peggyjs/peggy/pull/602)
- Errors pointing to non-BMP characters as the "found" text will now show the
  full character and not the replacement character for the first surrogate in
  the UTF-16 representation.
  [#602](https://github.com/peggyjs/peggy/pull/602)
- Character classes can now be annotated with the "u" flag, which will force
  the character class into Unicode mode, where one full Codepoint will be matched.
  For example, `[^a]u` will match 💪 (U+1F4AA).  Without the "u" flag, `[^a]`
  would only match \uD83D, the first surrogate that makes up U+1F4AA in UTF-16
  encoding.  [#602](https://github.com/peggyjs/peggy/pull/602)
- Empty inverted character classes such as `[^]` or `[^]u` now match one
  character, because they match "not-nothing". Without the "u" flag, this is
  the same as `.`.  With the "u" flag, this matches an entire codepoint that
  is not a lone surrogate, not just a single UTF-16 code unit (one or two JS
  characters). Previously, this expression compiled without the "u" flag, but
  was useless. [#602](https://github.com/peggyjs/peggy/pull/602)
- String literals may now contain characters from outside the BMP.
  [#602](https://github.com/peggyjs/peggy/pull/602)
- Character classes may now contain `\p{}` or `\P{}` escapes to match or
  inverted-match Unicode properties.  See
  [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape)
  for more details.  If you are generating code for a non-JavaScript environment
  using a plugin, this may be somewhat challenging for the plugin author.
  Please file an issue on Peggy for help.
  [#602](https://github.com/peggyjs/peggy/pull/602)
- A new "semantic" pass has been added to the compiler, which occurs after all
  transformations, but before code generation.  Plugins in this pass can rely
  on annotations from previous passes to reason about the code.
  [#606](https://github.com/peggyjs/peggy/pull/606)
- Unreachable code in rules like `'b'* / 'c'`, `![]`, `&[]`, `!('f'*)`, and
  `&('f'*)` now cause a semantic warning.  This warning may be escalated to an
  error in a future release, once experience in the field has shown that the
  approach does not catch code that is valid.
  [#606](https://github.com/peggyjs/peggy/pull/606)
- Globals, UMD, and CommonJS are now downloadable from the online version.  The
  weird version of globals that was only available from the web download was
  removed. [#608](https://github.com/peggyjs/peggy/pull/608)

### Bug fixes

-  Switch to pnpm-action instead of corepack for GitHub Actions. Ensure that help text always wraps the same in tests, no matter the actual terminal width. [#588](https://github.com/peggyjs/peggy/pull/588)
- All libraries used in the web site brought up-to-date, versioned with all
  other dependencies, and served locally. (TODO: Old version of CodeMirror to
  be replaced with Monaco). [#593](https://github.com/peggyjs/peggy/pull/593)
- Code coverage increased for Peggy Grammar parser.
  [#593](https://github.com/peggyjs/peggy/pull/593)
- Minor changes in code generation for parsers.  More consistent indentation,
  trailing commas (for consistency with the Peggy house style).
  [#593](https://github.com/peggyjs/peggy/pull/593)
- Avoid performance cliff for deeply-nested grammars when checking for
  infinite recursion.  Previously, nesting more than about 30 layers deep
  caused drastically increasing processing time.  Now, nesting more than 700
  layers deep causes "Maximum call stack size exceeded"; hopefully this is
  deep enough in practice. [#600](https://github.com/peggyjs/peggy/pull/600)
- Small measures to try to get `deno run -A npm:peggy` to work.  We will not
  know if these were successful until the package is published next.  Testing
  with `--format es -t foo` will still not work in Deno.
  [#603](https://github.com/peggyjs/peggy/pull/603)
- Fix a bug with named NEVER_MATCH expressions.
  [#454](https://github.com/peggyjs/peggy/pull/454)
- Warnings from grammar parsing are now presented more fully to the user in
  the CLI.  Info messages from grammar parsing are presented the same if in
  verbose mode. [#605](https://github.com/peggyjs/peggy/pull/605)
- One of the intermediate files that is generated in tests was not getting
  a warning when it was unexpectedly found on test start.
  [#604](https://github.com/peggyjs/peggy/pull/604)

### Documentation

- Link to browserlist support matrix in documentation.
  [#593](https://github.com/peggyjs/peggy/pull/593)
- When clicking on the link to the examples grammar, do not download the
  .peggy file, but instead show a .peggy.txt file in a browser window.
  [#595](https://github.com/peggyjs/peggy/pull/595)
- Set a minimum height for the editors in the online version.
  [#596](https://github.com/peggyjs/peggy/pull/596)
- Update the docs for newly-created compiler passes.  Make pluck and literal
  syntax use the new "dim" approach for optional bits.
  [$612](https://github.com/peggyjs/peggy/pull/612)

4.2.0
-----

Released: 2024-11-19

### New features

- [#568](https://github.com/peggyjs/peggy/pull/568) Upgrading to TypeScript 5.6 allowed for generating `parser.d.ts`, which should may help people that use Peggy programmatically in nonstandard ways.

### Bug fixes

- [#567](https://github.com/peggyjs/peggy/issues/567) Load config files and plugins correctly on Windows by using file: URIs in import().

### Documentation

- [#566](https://github.com/peggyjs/peggy/pull/566) Slight tweaks to document generation.

4.1.0
-----

Released: 2024-10-03

### New features

- [#477](https://github.com/peggyjs/peggy/issues/477) Option to output .d.ts files next to .js from CLI.
- [#530](https://github.com/peggyjs/peggy/issues/531) Allow es6 plugins from CLI
- [#532](https://github.com/peggyjs/peggy/issues/532) Allow es6 options files from the CLI

### Bug fixes

- [#531](https://github.com/peggyjs/peggy/issues/531) Clean up rollup hacks from CLI code.
- [#514](https://github.com/peggyjs/peggy/issues/514) Allow execution of the `peggy` binary on Windows by handling node runtime flags manually, executing a sub-instance of node to actually run `peggy`.
- [#538](https://github.com/peggyjs/peggy/pull/509) Fixed error in TS types for `peg$maxFailExpected` and `peg$maxFailPos`.
- [#551](https://github.com/peggyjs/peggy/pull/551) Moved to package-extract instead of a custom script for version file generation.

4.0.3
-----

Released: 2024-06-19

### New features

- [#509](https://github.com/peggyjs/peggy/pull/509) Add and implement ES6 export button

### Bug fixes

- [#493](https://github.com/peggyjs/peggy/issues/493) Allow use of an empty
  array, null, or undefined as allowedStartRules option
- [#505](https://github.com/peggyjs/peggy/pull/505) Fix vscode-eslint settings
  to work with eslint flat config
- [#507](https://github.com/peggyjs/peggy/pull/507) Remove stray semicolon in CSS
- [#508](https://github.com/peggyjs/peggy/pull/508) Fix broken text input in
  web version
- [#512](https://github.com/peggyjs/peggy/issues/512) Add "StartRules" to peg.d.ts
- [#513](https://github.com/peggyjs/peggy/issues/513) Allow whitespace between
  plucked word and its pattern.
- [#520](https://github.com/peggyjs/peggy/issues/520) Grammar with token "constructor" fails to generate
- [#522](https://github.com/peggyjs/peggy/issues/522) Switched from puppeteer
  to playwright for web tests, and added them to CI.

### Documentation

- [#506](https://github.com/peggyjs/peggy/pull/506) Added END OF INPUT (`!.`).

4.0.2
-----

Released: 2024-02-26

### Bug fixes
- [#490](https://github.com/peggyjs/peggy/issues/490) Throw error when imports are used in unsupported formats.  Supported formats are now only "es" and "commonjs".
- [#494](https://github.com/peggyjs/peggy/pull/494) Updated docs to make `--allowedRules *` more clear
- [#495](https://github.com/peggyjs/peggy/issues/495) from-mem inadvertantly
  made the minimum supported node version v20.8.  Updated to latest from-mem.

4.0.1
-----

Released: 2024-02-23

### Bug fixes

- [#478](https://github.com/peggyjs/peggy/issues/478) Add "npx" to some doc
  examples.
- [#479](https://github.com/peggyjs/peggy/issues/479)
  Refactor `cli/fromMem.js` into separate project
  [from-mem](https://github.com/peggyjs/from-mem/).
- [#481](https://github.com/peggyjs/peggy/issues/481) Add CLI test for
  --library
- [#483](https://github.com/peggyjs/peggy/issues/483) fix errors in
  typescript file.

4.0.0
-----

Released: 2024-02-13

### Major Changes

- [#379](https://github.com/peggyjs/peggy/issues/379) Fix infinite recursion
  issue by moving reportInfiniteRecursion to the new prepare pass, and having
  it fail after finding the first issue.  This will require plugin authors
  to ensure that reportInfiniteRecursion is in the new pass correctly.
- [#417](https://github.com/peggyjs/peggy/pull/417) BREAKING: change to AST to
  allow topLevelInitializer and initializer to be arrays, in support of
  multi-file inputs.  This will require plugin updates.  The CLI and API now
  take multiple files as input, where the first file is your main library, and
  subsequent files consist of a library of other rules.  The CLI can take file
  names of the form `npm:<package-name>/<filename>` to load library rules from
  an NPM package that is installed relative to the previous non-npm file name,
  or to the current working directory if this is the first file name.
- [#420](https://github.com/peggyjs/peggy/pull/420) BREAKING: Node v16+ is now
  required for running the CLI or using Peggy as a library.  Generated code
  still targets older runtimes.
- [#456](https://github.com/peggyjs/peggy/pull/456) BREAKING: Allow imports
  from external compiled grammars inside a source grammar, using `import
  {rule} from "external.js"`.  Note that this syntax will generate either
  `import` or `require` in the JavaScript output, depending on the value of
  the `format` parameter.  This will need explicit support from
  plugins, with a few new AST node types and a few visitor changes.
- [#463](https://github.com/peggyjs/peggy/issues/463) Drop support for
  Internet Explorer.  Move to eslint flat configs in order to lint minimized
  browser code for compatibility with
  `defaults, maintained node versions, not op_mini all`.

### Minor Changes

- [#400](https://github.com/peggyjs/peggy/pull/400) Use `@generated` in generated
  code
- [#404](https://github.com/peggyjs/peggy/issues/404) Add support for -w/--watch
  to the command line interface.
- [#415](https://github.com/peggyjs/peggy/issues/415) Added `browser` key to package.json, pointing to Webpack output.
- [#420](https://github.com/peggyjs/peggy/pull/420) Updated dependencies to
  avoid audit warnings.
- [#425](https://github.com/peggyjs/peggy/pull/425) Add a pass to simplify single-character choices
- [#427](https://github.com/peggyjs/peggy/pull/427) Avoid double extraction of
  substrings in various MATCH_ bytecodes
- [#430](https://github.com/peggyjs/peggy/pull/430) Make generate-js.js ts clean
- [#432](https://github.com/peggyjs/peggy/pull/432) Add peggy.code-workspace
- [#435](https://github.com/peggyjs/peggy/pull/435) Setup tsconfig to detect use of library functions from es6 or later
- [#436](https://github.com/peggyjs/peggy/pull/436) Get rid of tsd
- [#437](https://github.com/peggyjs/peggy/pull/437) Better type checking for visitor
- [#438](https://github.com/peggyjs/peggy/pull/438) Make test build deterministic
- [#439](https://github.com/peggyjs/peggy/pull/439) Make peg$computePosDetails a little faster
- [#440](https://github.com/peggyjs/peggy/issues/440) Create directories for
  output and source-map if they do not exist, rather than erroring.
- [#446](https://github.com/peggyjs/peggy/pull/446) Add a right-associative `ExponentiationExpression` rule (operator `**`) to `javascript.pegjs` example grammar.
- [#451](https://github.com/peggyjs/peggy/pull/451) Make stack.js ts clean
- [#452](https://github.com/peggyjs/peggy/pull/452) Fixes to prepare generate-bytecode.js for ts-check
- [#453](https://github.com/peggyjs/peggy/pull/453) Make generate-bytecode.js ts-clean
- [#460](https://github.com/peggyjs/peggy/pull/453) Allow `-t` and `-T` testing
  from the CLI with `--format es`.

### Bug Fixes

- [#405](https://github.com/peggyjs/peggy/pull/405) Doc example doesn't correspond to code example.  From @hildjj
- [#415](https://github.com/peggyjs/peggy/issues/415) Make docs match reality with `import`.
- [#426](https://github.com/peggyjs/peggy/pull/426) Fix typo in XML example.
- [#434](https://github.com/peggyjs/peggy/issues/434) Fixed bad example in docs.
- [#445](https://github.com/peggyjs/peggy/issues/415) Fix indentation in `examples/javascript.pegjs`.
- [#450](https://github.com/peggyjs/peggy/issues/450) Fixed misleading documentation.
- [#466](https://github.com/peggyjs/peggy/issues/466) Add docs for developers.

3.0.2
-----

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
  allowed-start-rule is documented for CLI.  From @hildjj.

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

Important information for plug-in authors: PR #291 added 4 new opcodes to the bytecode:
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
