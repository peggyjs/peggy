[![Tests](https://github.com/peggyjs/peggy/actions/workflows/node.js.yml/badge.svg)](https://github.com/peggyjs/peggy/actions/workflows/node.js.yml)
[![npm version](https://img.shields.io/npm/v/peggy.svg)](https://www.npmjs.com/package/peggy)
[![License](https://img.shields.io/badge/license-mit-blue.svg)](https://opensource.org/licenses/MIT)

# Peggy

Peggy is a simple parser generator for JavaScript that produces fast parsers
with excellent error reporting. You can use it to process complex data or
computer languages and build transformers, interpreters, compilers and other
tools easily.

Peggy is the successor of [PEG.js](https://github.com/pegjs/pegjs) which had been abandoned by its maintainer.

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

## Getting Started

[Online version](https://peggyjs.org/online) is the easiest way to generate a
parser. Just enter your grammar, try parsing few inputs, and download generated
parser code.

## Installation

### Node.js

To use the `peggy` command, install Peggy globally:

```console
$ npm install -g peggy
```

To use the JavaScript API, install Peggy locally:

```console
$ npm install peggy
```

If you need both the `peggy` command and the JavaScript API, install Peggy both
ways.

### Browser

The easiest way to use Peggy from the browser is to pull the latest version from a CDN.  Either of these should work:

```html
<script src="https://unpkg.com/peggy"></script>
```

```html
<script src="https://cdn.jsdelivr.net/npm/peggy"></script>
```

When your document is done loading, there will be a global `peggy` object.

## Generating a Parser

Peggy generates parser from a grammar that describes expected input and can
specify what the parser returns (using semantic actions on matched parts of the
input). Generated parser itself is a JavaScript object with a simple API.

### Command Line

To generate a parser from your grammar, use the `peggy` command:

```console
$ peggy arithmetics.peggy
```

This writes parser source code into a file with the same name as the grammar
file but with “.js” extension. You can also specify the output file explicitly:

```console
$ peggy -o arithmetics-parser.js arithmetics.peggy
```

If you omit both input and output file, standard input and standard output are used.

By default, the generated parser is in the Node.js module format. You can
override this using the `--format` option.

You can tweak the generated parser with several options:

- `--allowed-start-rules` — comma-separated list of rules the parser will be
  allowed to start parsing from (default: the first rule in the grammar)
- `--cache` — makes the parser cache results, avoiding exponential parsing
  time in pathological cases but making the parser slower
- `--dependency` — makes the parser require a specified dependency (can be
  specified multiple times)
- `--export-var` — name of a global variable into which the parser object is
  assigned to when no module loader is detected
- `--extra-options` — additional options (in JSON format) to pass to
  `peg.generate`
- `--extra-options-file` — file with additional options (in JSON format) to
  pass to `peg.generate`
- `--format` — format of the generated parser: `amd`, `es`, `commonjs`, `globals`,
  `umd` (default: `commonjs`)
- `--plugin` — makes Peggy use a specified plugin (can be specified multiple
  times)
- `--trace` — makes the parser trace its progress

### JavaScript API

In Node.js, require the Peggy parser generator module:

```javascript
const peggy = require("peggy");
```

or

```javascript
import * as peggy from "peggy";
```

For use in browsers, include the Peggy library in your web page or application
using the `<script>` tag. If Peggy detects an AMD loader, it will define
itself as a module, otherwise the API will be available in the `peggy` global
object.

To generate a parser, call the `peggy.generate` method and pass your grammar as a
parameter:

```javascript
const parser = peggy.generate("start = ('a' / 'b')+");
```

The method will return generated parser object or its source code as a string
(depending on the value of the `output` option — see below). It will throw an
exception if the grammar is invalid. The exception will contain a `message`
property with more details about the error.

You can tweak the generated parser by passing a second parameter with an options
object to `peg.generate`. The following options are supported:

- `allowedStartRules` — rules the parser will be allowed to start parsing from
  (default: the first rule in the grammar)
- `cache` — if `true`, makes the parser cache results, avoiding exponential
  parsing time in pathological cases but making the parser slower (default:
  `false`)
- `dependencies` — parser dependencies, the value is an object which maps
  variables used to access the dependencies in the parser to module IDs used
  to load them; valid only when `format` is set to `"amd"`, `"commonjs"`,
  `"es"`, or `"umd"`. Dependencies variables will be available in both the
  _global initializer_ and the _per-parse initializer_. Unless the parser is
  to be generated in different formats, it is recommended to rather import
  dependencies from within the _global initializer_. (default: `{}`)
- `exportVar` — name of a global variable into which the parser object is
  assigned to when no module loader is detected; valid only when `format` is
  set to `"globals"` or `"umd"` (default: `null`)
- `format` — format of the generated parser (`"amd"`, `"bare"`, `"commonjs"`,
  `"es"`, `"globals"`, or `"umd"`); valid only when `output` is set to `"source"`
  (default: `"bare"`)
- `grammarSource` — this object will be passed to any `location()` objects as the
  `source` property (default: `undefined`). This object will be used even if
  `options.grammarSource` is redefined in the grammar. It is useful to attach
  the file information to the errors, for example
- `output` — if set to `"parser"`, the method will return generated parser
  object; if set to `"source"`, it will return parser source code as a string
  (default: `"parser"`)
- `plugins` — plugins to use. See the [Plugins API](#plugins-api) section
- `trace` — makes the parser trace its progress (default: `false`)

## Using the Parser

To use the generated parser, call its `parse` method and pass an input string
as a parameter. The method will return a parse result (the exact value depends
on the grammar used to generate the parser) or throw an exception if the input
is invalid. The exception will contain `location`, `expected`, `found`,
`message`, and `diagnostics` properties with more details about the error.
The error will have a `format(SourceText[])` function, to which you pass an
array of objects that look like `{ source: grammarSource, text: string }`;
this will return a nicely-formatted error suitable for human consumption.

```javascript
parser.parse("abba"); // returns ["a", "b", "b", "a"]

parser.parse("abcd"); // throws an exception
```

You can tweak parser behavior by passing a second parameter with an options
object to the `parse` method. The following options are supported:

- `startRule` — name of the rule to start parsing from
- `tracer` — tracer to use
- `...` (any others) — made available in the `options` variable

As you can see above, parsers can also support their own custom options.  For
example:

```javascript
const parser = peggy.generate(`
{
  // options are available in the per-parse initializer
  console.log(options.validWords);  // outputs "[ 'boo', 'baz', 'boop' ]"
}

validWord = @word:$[a-z]+ &{ return options.validWords.includes(word) }
`);

const result = parser.parse("boo", {
  validWords: [ "boo", "baz", "boop" ]
});

console.log(result);  // outputs "boo"
```

## Grammar Syntax and Semantics

The grammar syntax is similar to JavaScript in that it is not line-oriented and
ignores whitespace between tokens. You can also use JavaScript-style comments
(`// ...` and `/* ... */`).

Let's look at example grammar that recognizes simple arithmetic expressions like
`2*(3+4)`. A parser generated from this grammar computes their values.

```peggy
start
  = additive

additive
  = left:multiplicative "+" right:additive { return left + right; }
  / multiplicative

multiplicative
  = left:primary "*" right:multiplicative { return left * right; }
  / primary

primary
  = integer
  / "(" additive:additive ")" { return additive; }

integer "integer"
  = digits:[0-9]+ { return parseInt(digits.join(""), 10); }
```

On the top level, the grammar consists of _rules_ (in our example, there are
five of them). Each rule has a _name_ (e.g. `integer`) that identifies the rule,
and a _parsing expression_ (e.g. `digits:[0-9]+ { return parseInt(digits.join(""), 10); }`)
that defines a pattern to match against the input text and possibly contains
some JavaScript code that determines what happens when the pattern matches
successfully. A rule can also contain _human-readable name_ that is used in
error messages (in our example, only the `integer` rule has a human-readable
name). The parsing starts at the first rule, which is also called the _start
rule_.

A rule name must be a JavaScript identifier. It is followed by an equality sign
(“=”) and a parsing expression. If the rule has a human-readable name, it is
written as a JavaScript string between the rule name and the equality sign.
Rules need to be separated only by whitespace (their beginning is easily
recognizable), but a semicolon (“;”) after the parsing expression is allowed.

The first rule can be preceded by a _global initializer_ and/or a _per-parse
initializer_, in that order. Both are pieces of JavaScript code in double
curly braces (“{{” and “}}”) and single curly braces (“{” and “}”) respectively.
All variables and functions defined in both _initializers_ are accessible in
rule actions and semantic predicates. Curly braces in both _initializers_ code
must be balanced.

The _global initializer_ is executed once and only once, when the generated
parser is loaded (through a `require` or an `import` statement for instance).
It is the ideal location to require, to import, to declare constants, or to
declare utility functions to be used in rule actions and semantic predicates.

The _per-parse initializer_ is called before the generated parser starts
parsing. The code inside the _per-parse initializer_ can access the input
string and the options passed to the parser using the `input` variable and the
`options` variable respectively. It is the ideal location to create data
structures that are unique to each parse or to modify the input before the
parse.

Let's look at the example grammar from above using a _global initializer_ and
a _per-parse initializer_:

```peggy
{{
  function makeInteger(o) {
    return parseInt(o.join(""), 10);
  }
}}

{
  if (options.multiplier) {
    input = "(" + input + ")*(" + options.multiplier + ")";
  }
}

start
  = additive

additive
  = left:multiplicative "+" right:additive { return left + right; }
  / multiplicative

multiplicative
  = left:primary "*" right:multiplicative { return left * right; }
  / primary

primary
  = integer
  / "(" additive:additive ")" { return additive; }

integer "integer"
  = digits:[0-9]+ { return makeInteger(digits); }
```

The parsing expressions of the rules are used to match the input text to the
grammar. There are various types of expressions — matching characters or
character classes, indicating optional parts and repetition, etc. Expressions
can also contain references to other rules. See detailed description below.

If an expression successfully matches a part of the text when running the
generated parser, it produces a _match result_, which is a JavaScript value. For
example:

- An expression matching a literal string produces a JavaScript string
  containing matched text.
- An expression matching repeated occurrence of some subexpression produces a
  JavaScript array with all the matches.

The match results propagate through the rules when the rule names are used in
expressions, up to the start rule. The generated parser returns start rule's
match result when parsing is successful.

One special case of parser expression is a _parser action_ — a piece of
JavaScript code inside curly braces (“{” and “}”) that takes match results of
some of the the preceding expressions and returns a JavaScript value. This value
is considered match result of the preceding expression (in other words, the
parser action is a match result transformer).

In our arithmetics example, there are many parser actions. Consider the action
in expression `digits:[0-9]+ { return parseInt(digits.join(""), 10); }`. It
takes the match result of the expression [0-9]+, which is an array of strings
containing digits, as its parameter. It joins the digits together to form a
number and converts it to a JavaScript `number` object.

### Parsing Expression Types

There are several types of parsing expressions, some of them containing
subexpressions and thus forming a recursive structure:

#### "_literal_"<br>'_literal_'

Match exact literal string and return it. The string syntax is the same as in
JavaScript. Appending `i` right after the literal makes the match
case-insensitive.

#### .

Match exactly one character and return it as a string.

#### [ _characters_ ]

Match one character from a set and return it as a string. The characters in the
list can be escaped in exactly the same way as in JavaScript string. The list of
characters can also contain ranges (e.g. `[a-z]` means “all lowercase letters”).
Preceding the characters with `^` inverts the matched set (e.g. `[^a-z]` means
“all character but lowercase letters”). Appending `i` right after the right
bracket makes the match case-insensitive.

#### _rule_

Match a parsing expression of a rule recursively and return its match result.

#### ( _expression_ )

Match a subexpression and return its match result.

#### _expression_ \*

Match zero or more repetitions of the expression and return their match results
in an array. The matching is greedy, i.e. the parser tries to match the
expression as many times as possible. Unlike in regular expressions, there is no
backtracking.

#### _expression_ +

Match one or more repetitions of the expression and return their match results
in an array. The matching is greedy, i.e. the parser tries to match the
expression as many times as possible. Unlike in regular expressions, there is no
backtracking.

#### _expression_ ?

Try to match the expression. If the match succeeds, return its match result,
otherwise return `null`. Unlike in regular expressions, there is no
backtracking.

#### & _expression_

Try to match the expression. If the match succeeds, just return `undefined` and
do not consume any input, otherwise consider the match failed.

#### ! _expression_

Try to match the expression. If the match does not succeed, just return
`undefined` and do not consume any input, otherwise consider the match failed.

#### & { _predicate_ }

This is a positive assertion. No input is consumed.

The predicate should be JavaScript code, and it's executed as a
function. Curly braces in the predicate must be balanced.

The predicate should `return` a boolean value. If the result is
truthy, it's match result is `undefined`, otherwise the match is
considered failed.

The predicate has access to all variables and functions in the
[Action Execution Environment](#action-execution-environment).

#### ! { _predicate_ }

This is a negative assertion. No input is consumed.

The predicate should be JavaScript code, and it's executed as a
function. Curly braces in the predicate must be balanced.

The predicate should `return` a boolean value. If the result is
falsy, it's match result is `undefined`, otherwise the match is
considered failed.

The predicate has access to all variables and functions in the
[Action Execution Environment](#action-execution-environment).

#### \$ _expression_

Try to match the expression. If the match succeeds, return the matched text
instead of the match result.

If you need to return the matched text in an action, use the
[`text()` function](#action-execution-environment).

#### _label_ : _expression_

Match the expression and remember its match result under given label. The label
must be a JavaScript identifier, but not in the list of reserved words.
By default this is a list of [JavaScript reserved words][reserved],
but [plugins](#plugins-api) can change it.

Labeled expressions are useful together with actions, where saved match results
can be accessed by action's JavaScript code.

#### _@_ ( _label_ : )? _expression_

Match the expression and if the label exists, remember its match result under
given label. The label must be a JavaScript identifier if it exists, but not
in the list of reserved words. By default this is a list of
[JavaScript reserved words][reserved], but [plugins](#plugins-api) can
change it.

Return the value of this expression from the rule, or "pluck" it. You may not
have an action for this rule. The expression must not be a semantic predicate
([`&{ predicate }`](#-predicate-) or [`!{ predicate }`](#--predicate-)). There may
be multiple pluck expressions in a given rule, in which case an array of the
plucked expressions is returned from the rule.

Pluck expressions are useful for writing terse grammars, or returning parts of
an expression that is wrapped in parentheses.

#### _expression<sub>1</sub>_ _expression<sub>2</sub>_ ... _expression<sub>n</sub>_

Match a sequence of expressions and return their match results in an array.

#### _expression_ { _action_ }

If the expression matches successfully, run the action, otherwise
consider the match failed.

The action should be JavaScript code, and it's executed as a
function. Curly braces in the action must be balanced.

The action should `return` some value, which will be used as the
match result of the expression.

The action has access to all variables and functions in the
[Action Execution Environment](#action-execution-environment).

#### _expression<sub>1</sub>_ / _expression<sub>2</sub>_ / ... / _expression<sub>n</sub>_

Try to match the first expression, if it does not succeed, try the second one,
etc. Return the match result of the first successfully matched expression. If no
expression matches, consider the match failed.

### Action Execution Environment

Actions and predicates have these variables and functions
available to them.

- All variables and functions defined in the initializer or the top-level
  initializer at the beginning of the grammar are available.

- Note, that all functions and variables, described below, are unavailable
  in the global initializer.

- Labels from preceding expressions are available as local variables,
  which will have the match result of the labelled expressions.

  A label is only available after its labelled expression is matched:

  ```peggy
  rule = A:('a' B:'b' { /* B is available, A is not */ } )
  ```

  A label in a sub-expression is only valid within the
  sub-expression:

  ```peggy
  rule = A:'a' (B:'b') (C:'b' { /* A and C are available, B is not */ })
  ```

- `input` is a parsed string that was passed to the `parse()` method.

- `options` is a variable that contains the parser options.
  That is the same object that was passed to the `parse()` method.

- `error(message, where)` will report an error and throw an exception.
  `where` is optional; the default is the value of `location()`.

- `expected(message, where)` is similar to `error`, but reports
  > Expected _message_ but "_other_" found.

  where `other` is, by default, the character in the `location().start.offset` position.

- `location()` returns an object with the information about the parse position.
  Refer to [the corresponding section](#locations) for the details.

- `range()` is similar to `location()`, but returns an object with offsets only.
  Refer to [the "Locations" section](#locations) for the details.

- `offset()` returns only the start offset, i.e. `location().start.offset`.
  Refer to [the "Locations" section](#locations) for the details.

- `text()` returns the source text between `start` and `end` (which will be `""` for
  predicates). Instead of using that function as a return value for the rule consider
  using the [`$` operator](#-expression-2).

### Parsing Lists

One of the most frequent questions about Peggy grammars is how to parse a
delimited list of items.  The cleanest current approach is:

```peggy
list = head:word tail:(_ "," _ @word)* { return [head, ...tail]; }
word = $[a-z]i+
_ = [ \t]*
```

Note that the `@` in the tail section plucks the word out of the
parentheses, NOT out of the rule itself.

## Error Messages

As described above, you can annotate your grammar rules with human-readable
names that will be used in error messages. For example, this production:

```peggy
integer "integer"
  = digits:[0-9]+
```

will produce an error message like:

> Expected integer but "a" found.

when parsing a non-number, referencing the human-readable name "integer."
Without the human-readable name, Peggy instead uses a description of the
character class that failed to match:

> Expected [0-9] but "a" found.

Aside from the text content of messages, human-readable names also have a
subtler effect on _where_ errors are reported. Peggy prefers to match
named rules completely or not at all, but not partially. Unnamed rules,
on the other hand, can produce an error in the middle of their
subexpressions.

For example, for this rule matching a comma-separated list of integers:

```peggy
seq
  = integer ("," integer)*
```

an input like `1,2,a` produces this error message:

> Expected integer but "a" found.

But if we add a human-readable name to the `seq` production:

```peggy
seq "list of numbers"
  = integer ("," integer)*
```

then Peggy prefers an error message that implies a smaller attempted parse
tree:

> Expected end of input but "," found.

There are two classes of errors in Peggy:

- `SyntaxError`: Syntax errors, found during parsing the input. This kind of
  errors can be thrown both during _grammar_ parsing and during _input_ parsing.
  Although name is the same, errors of each generated parser (including Peggy
  parser itself) has its own unique class.
- `GrammarError`: Grammar errors, found during construction of the parser.
  These errors can be thrown only in the parser generation phase. This error
  signals a logical mistake in the grammar, such as having two rules with
  the same name in one grammar, etc.

Both of these errors have the `format()` method that takes an array of mappings from
source to grammar text:

```javascript
let source = ...;
try {
  peggy.generate(text, { grammarSource: source, ... }); // throws SyntaxError or GrammarError
  parser.parse(input, { grammarSource: source2, ... }); // throws SyntaxError
} catch (e) {
  if (typeof e.format === "function") {
    console.log(e.format([
      { source, text },
      { source: source2, text: input },
      ...
    ]));
  } else {
    throw e;
  }
}
```

Messages generated by `format()` look like this:

```console
Error: Possible infinite loop when parsing (left recursion: start -> proxy -> end -> start)
 --> .\recursion.pegjs:1:1
  |
1 | start = proxy;
  | ^^^^^
note: Step 1: call of the rule "proxy" without input consumption
 --> .\recursion.pegjs:1:9
  |
1 | start = proxy;
  |         ^^^^^
note: Step 2: call of the rule "end" without input consumption
 --> .\recursion.pegjs:2:11
  |
2 | proxy = a:end { return a; };
  |           ^^^
note: Step 3: call itself without input consumption - left recursion
 --> .\recursion.pegjs:3:8
  |
3 | end = !start
  |        ^^^^^
```

## Locations

During the parsing you can access to the information of the current parse location,
such as offset in the parsed string, line and column information. You can get this
information by calling `location()` function, which returns you the following object:

```javascript
{
  source: options.grammarSource,
  start: { offset: 23, line: 5, column: 6 },
  end: { offset: 25, line: 5, column: 8 }
}
```

`source` is an any object that was supplied in the `grammarSource` option in
the `parse()` call. That object can be used to hold reference to the origin of
the grammar, for example, it can be a filename. It is recommended that this
object have a `toString()` implementation that returns meaningful string,
because that string will be used when getting formatted error representation
with [`e.format()`](#error-messages).

If `source` is `null` or `undefined` it doesn't appear in the formatted messages.
The default value for `source` is `undefined`.

For actions, `start` refers to the position at the beginning of the preceding
expression, and `end` refers to the position after the end of the preceding
expression.

For semantic predicates, `start` and `end` are equal, denoting the location
where the predicate is evaluated.

For the per-parse initializer, the location is the start of the input, i.e.
```javascript
{
  source: options.grammarSource,
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 }
}
```

`offset` is a 0-based character index within the source text.
`line` and `column` are 1-based indices.

The line number is incremented each time the parser finds an end of line
sequence in the input.

Line and column are somewhat expensive to compute, so if you just need the
offset, there's also a function `offset()` that returns just the start offset,
and a function `range()` that returns the object:

```javascript
{
  source: options.grammarSource,
  start: 23,
  end: 25
}
```

(i.e. difference from the `location()` result only in type of `start` and `end`
properties, which contain just an offset instead of the `Location` object.)

All notes about values for `location()` object is also applicable to the `range()`
and `offset()` calls.

Currently, Peggy only works with the [Basic Multilingual Plane (BMP)][BMP] of
Unicode. This means that all offsets are measured in UTF-16 code units. If you
try to parse characters outside this Plane (for example, emoji, or any
surrogate pairs), you may get an offset inside a code point.

Changing this behavior may be a breaking change and will not to be done before
Peggy 2.0. You can join to the discussion for this topic on the [GitHub
Discussions page][unicode].

[BMP]: https://en.wikipedia.org/wiki/Plane_(Unicode)#Basic_Multilingual_Plane
[unicode]: https://github.com/peggyjs/peggy/discussions/15

## Plugins API

A plugin is an object with the `use(config, options)` method. That method will be
called for all plugins in the `options.plugins` array, supplied to the `generate()`
method.

`use` accepts these parameters:
- `config` — object with the following properties:
  - `parser` — `Parser` object, by default the `peggy.parser` instance. That object
    will be used to parse the grammar. Plugin can replace this object
  - `passes` — mapping `{ [stage: string]: Pass[] }` that represents compilation
    stages that would applied to the AST, returned by the `parser` object. That
    mapping will contain at least the following keys:
    - `check` — passes that check AST for correctness. They shouldn't change the AST
    - `transform` — passes that performs various optimizations. They can change
      the AST, add or remove nodes or their properties
    - `generate` — passes used for actual code generating

    A plugin that implement a pass usually should push it to the end of one of that
    arrays. Pass is a simple function with signature `pass(ast, options)`:
    - `ast` — the AST created by the `config.parser.parse()` method
    - `options` — compilation options passed to the `peggy.compiler.compile()` method.
      If parser generation is started because `generate()` function was called that
      is also an options, passed to the `generate()` method
  - `reservedWords` — string array with a list of words that shouldn't be used as
    label names. This list can be modified by plugins. That property is not required
    to be sorted or not contain duplicates, but it is recommend to remove duplicates.

    Default list contains [JavaScript reserved words][reserved], and can be found
    in the `peggy.RESERVED_WORDS` property.
- `options` — build options passed to the `generate()` method. A best practice for
  a plugin would look for its own options under a `<plugin_name>` key.

## Compatibility

Both the parser generator and generated parsers should run well in the following
environments:

- Node.js 10+
- Internet Explorer 9+
- Edge
- Firefox
- Chrome
- Safari
- Opera

## Development

- [Project website](https://peggyjs.org/)
- [Wiki](https://github.com/peggyjs/peggy/wiki)
- [Source code](https://github.com/peggyjs/peggy)
- [Issue tracker](https://github.com/peggyjs/peggy/issues)
- [Discussions](https://github.com/peggyjs/peggy/discussions)

Peggy was originally developed by [David Majda](https://majda.cz/)
([@dmajda](http://twitter.com/dmajda)). It is currently maintained by
[Joe Hildebrand](https://github.com/hildjj) ([@hildjj](https://twitter.com/hildjj)).

You are welcome to contribute code. Unless your contribution is really trivial
you should [get in touch with us](https://github.com/peggyjs/peggy/discussions)
first — this can prevent wasted effort on both sides.

[reserved]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_keywords_as_of_ecmascript_2015
