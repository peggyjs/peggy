"use strict";

module.exports = {
  root: true,
  ignorePatterns: [
    "docs/",
    "lib/parser.js",
    "test/vendor/",
    "benchmark/vendor/",
    "browser/",
    "node_modules/",
    "*.min.js"
  ],
  env: {
    node: true,
    es6: true
  },
  parserOptions: {
    ecmaVersion: 2015,
  },

  // All ESLint rules are explicitly configured here. They are structured in the
  // same way as in the ESLint rule list [1] to make referencing easier.
  //
  // The motivation behind configuration of most rules should be obvious after
  // reading each rule’s documentation. Where this is not the case, the
  // motivation is explained using a comment.
  //
  // Rule configuration usually relies on defaults provided by ESLint, but
  // stylistic rules (most of which are in "Stylistic Issues" and "ECMAScript 6"
  // sections) often have options specified explicitly even when they have
  // defaults. This improves readability because the defaults are often not
  // obvious. It would probably be best if stylistic rules didn't have any
  // defaults at all.
  //
  // Some rules are tagged with an @es5 tag. These would need attention if ES5
  // version of the configuration ever gets produced.
  //
  // [1] http://eslint.org/docs/rules/
  rules: {
    // ----- Possible Errors -----

    "no-cond-assign": "error",

    // Disabled because `console` has legitimate uses.
    "no-console": "off",

    "no-constant-condition": "error",

    // Disabled because there is no other way to match control characters in
    // regexps.
    "no-control-regex": "off",

    "no-debugger": "error",

    "no-dupe-args": "error",

    "no-dupe-keys": "error",

    "no-duplicate-case": "error",

    "no-empty-character-class": "error",

    "no-empty": "error",

    "no-ex-assign": "error",

    "no-extra-boolean-cast": "error",

    // Disabled because extra parens sometimes improve readability.
    "no-extra-parens": "off",

    "no-extra-semi": "error",

    "no-func-assign": "error",

    // Set to catch both `function` and `var` declarations in nested blocks,
    // however catching `var` declarations isn't strictly necessary because they
    // are not allowed at all by `no-var`. But it can't hurt.
    //
    // @es5
    "no-inner-declarations": ["error", "both"],

    "no-invalid-regexp": "error",

    "no-irregular-whitespace": [
      "error",
      {
        skipStrings: false,
        skipComments: false,
        skipRegExps: false,
        skipTemplates: false,
      },
    ],

    "no-obj-calls": "error",

    "no-prototype-builtins": "error",

    // Disabled because when matching an exact number of spaces, writing them
    // out is usually better than using the `{n}` syntax. It makes the regexp
    // more similar to matched strings.
    "no-regex-spaces": "off",

    "no-sparse-arrays": "error",

    "no-template-curly-in-strings": "off",

    "no-unexpected-multiline": "error",

    "no-unreachable": "error",

    "no-unsafe-finally": "error",

    "no-unsafe-negation": "error",

    "use-isnan": "error",

    "valid-jsdoc": "error",

    "valid-typeof": "error",

    // ----- Best Practices -----

    "accessor-pairs": "off",

    // Disabled because this is just guessing.
    "array-callback-return": "off",

    // Enabled, however this isn't strictly necessary because `var` declarations
    // are not allowed at all by `no-var`. But it can't hurt.
    //
    // @es5
    "block-scoped-var": "error",

    // Disabled because class methods without `this` have legitimate uses, for
    // example when a class has to implement a dummy empty method to conform to
    // an interface.
    "class-methods-use-this": "off",

    // Disabled because code quality issues are generally not checked.
    "complexity": "off",

    "consistent-return": "error",

    "curly": "error",

    "default-case": "error",

    "dot-location": ["error", "property"],

    "dot-notation": "error",

    "eqeqeq": "error",

    // Enabled, but it's better to use `Object.keys(...).forEach` instead of
    // `for...in`.
    "guard-for-in": "error",

    // Disabled because `alert`, `prompt`, and `confirm` have legitimate uses.
    "no-alert": "off",

    "no-caller": "error",

    "no-case-declarations": "error",

    "no-div-regex": "off",

    // Disabled because whether an `if` statement does or does not have an
    // `else` branch is meaningful.
    //
    // For example, this `if` statement is most likely a boundary condition
    // check:
    //
    //     function f() {
    //       if (...) {
    //         return ...;
    //       }
    //
    //       return ...;
    //     }
    //
    // On the other hand, this `if` statement most likely chooses between two
    // equally valid alternatives:
    //
    //     function f() {
    //       if (...) {
    //         return ...;
    //       } else {
    //         return ...;
    //       }
    //     }
    //
    // See also `no-lonely-if`.
    "no-else-return": "off",

    "no-empty-function": "error",

    // Disabled because empty destructuring patterns have potential legitimate
    // uses.
    "no-empty-pattern": "off",

    // Enabled, however this isn't strictly necessary because `==` and `!=`
    // are not allowed at all by `eqeqeq`. But it can't hurt.
    "no-eq-null": "error",

    // Disabled because `eval` has legitimate uses.
    "no-eval": "off",

    "no-extend-native": "error",

    "no-extra-bind": "error",

    "no-extra-label": "error",

    "no-fallthrough": "error",

    "no-floating-decimal": "error",

    "no-global-assign": "error",

    "no-implicit-coercion": "error",

    "no-implicit-globals": "error",

    "no-implied-eval": "error",

    // Disabled because this is just guessing and there are frameworks like
    // Mocha where `this` is regularly used outside of classes.
    "no-invalid-this": "off",

    "no-iterator": "error",

    // Disabled because while labels are used sparingly, when you need them, you
    // really need them.
    "no-labels": "off",

    "no-lone-blocks": "error",

    "no-loop-func": "error",

    // Disabled because sometimes putting a number inline is better than
    // complicating the code by creating a constant.
    "no-magic-numbers": "off",

    // Disabled because multiple spaces are often used for alignment.
    "no-multi-spaces": "off",

    "no-multi-str": "error",

    // Disabled because `Function` constructor has legitimate uses.
    "no-new-func": "off",

    "no-new-wrappers": "error",

    "no-new": "error",

    "no-octal-escape": "error",

    "no-octal": "error",

    // Disabled because reassigning parameters is occasionally useful, e.g.
    // when setting default values or when transforming a parameter that can be
    // supplied in multiple formats into a canonical one.
    "no-param-reassign": "off",

    "no-proto": "error",

    "no-redeclare": "error",

    "no-restricted-properties": "off",

    "no-return-assign": "error",

    "no-script-url": "error",

    "no-self-assign": "error",

    "no-self-compare": "error",

    "no-sequences": "error",

    "no-throw-literal": "error",

    "no-unmodified-loop-condition": "error",

    "no-unused-expressions": "error",

    "no-unused-labels": "error",

    "no-useless-call": "error",

    "no-useless-concat": "error",

    "no-useless-escape": "error",

    "no-void": "error",

    "no-warning-comments": "error",

    "no-with": "error",

    // Set to require a radix even though it always defaults to 10 in ES5+. It
    // prevents confusion.
    "radix": "error",

    // Disabled because while putting variable declarations at the top is
    // generally a good idea, it's not always practical. For example, modifying
    // function parameters to set a default value should come before any
    // variable declaration.
    //
    // Moreover, `var` declarations are not allowed at all by `no-var`.
    //
    // @es5
    "vars-on-top": "off",

    "wrap-iife": ["error", "inside"],

    "yoda": "error",

    // ----- Strict Mode -----

    "strict": "error",

    // ----- Variables -----

    "init-declarations": "off",

    "no-catch-shadow": "off",

    // Enabled, however this isn't strictly necessary because strict mode parser
    // doesn't allow to use `delete` with an unqualified identifier. But it
    // can't hurt.
    "no-delete-var": "error",

    "no-label-var": "error",

    "no-restricted-globals": "off",

    "no-shadow-restricted-names": "error",

    "no-shadow": "off",

    // Disabled because sometimes one wants to be explicit about initializing a
    // variable to `undefined`.
    "no-undef-init": "off",

    "no-undef": "error",

    "no-undefined": "off",

    "no-unused-vars": "error",

    // Disabled to allow implementing mutual recursion. Setting the rule to just
    // avoid checking functions isn't enough because these functions may be
    // defined using variables (e.g. when created using a builder).
    "no-use-before-define": "off",

    // ----- Node.js and CommonJS -----

    // Disabled because this is just guessing.
    "callback-return": "off",

    // Disabled because one occasionally needs a non-global `require` call, e.g.
    // when using an optional dependency, choosing from multiple alternative
    // dependencies, or implementing a plugin system.
    "global-require": "off",

    // Disabled because this is just guessing.
    "handle-callback-err": "off",

    // Enabled, however this isn't strictly necessary because `one-var` doesn't
    // allow multiple `require` calls in one `let`/`const`/`var` statement. But
    // it can't hurt.
    "no-mixed-requires": "off",

    "no-new-require": "error",

    // Disabled because code using `path.join` is usually more verbose than
    // string concatenation or template literals. In theory, `path.join` is more
    // portable because it always uses correct path separator, but since Node.js
    // on all platforms can deal with paths that use `/`, this is not really an
    // advantage.
    "no-path-concat": "off",

    // Disabled because `process.env` has legitimate uses, mainly in binaries.
    "no-process-env": "off",

    // Disabled because `process.exit` has legitimate uses, mainly in binaries.
    "no-process-exit": "off",

    "no-restriced-modules": "off",

    "no-sync": "off",

    // Disabled because code quality issues are generally not checked.
    "id-length": "off",

    // Disabled because it seems redundant with `camelcase`.
    "id-match": "off",

    // Disabled because code quality issues are generally not checked.
    "max-depth": "off",

    // Set to ignore lines that contain strings and template literals because
    // devising more targeted pattern and putting it into `ignorePattern` would
    // be quite hard.
    "max-len": [
      "error",
      {
        code: 80,
        ignoreComments: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],

    // Disabled because code quality issues are generally not checked.
    "max-lines": "off",

    // Disabled because code quality issues are generally not checked.
    "max-nested-callbacks": "off",

    // Disabled because code quality issues are generally not checked.
    "max-params": "off",

    // Disabled because code quality issues are generally not checked.
    "max-statements-per-line": "off",

    // Disabled because code quality issues are generally not checked.
    "max-statements": "off",

    "multiline-ternary": ["off"],

    "new-cap": ["error", { newIsCap: true, capIsNew: true, properties: true }],

    "new-parens": "error",

    // Disabled because variable declarations are mostly treated as assignments.
    // See `one-var`.
    //
    // @es5
    "newline-after-var": "off",

    "newline-before-return": "error",

    "newline-per-chained-call": "off",

    "no-array-constructor": "error",

    // Disabled because bitwise operators have legitimate uses.
    "no-bitwise": "off",

    "no-continue": "off",

    "no-inline-comments": "off",

    // Disabled because where an `if` statement is placed is meaningful.
    //
    // For example, here the second `if` statement most likely checks a
    // condition which is related to and equally important as the condition of
    // the first `if` statement:
    //
    //   if (...) {
    //     ...
    //   } else if (...) {
    //     ...
    //   }
    //
    // On the other hand, here the second `if` statement most likely checks a
    // condition which is unrelated to and less important than the condition of
    // the first `if` statement:
    //
    //   if (...) {
    //     ...
    //   } else {
    //     if (...) {
    //       ...
    //     }
    //   }
    //
    // See also `no-else-return`.
    "no-lonely-if": "off",

    "no-mixed-operators": "off",

    "no-mixed-spaces-and-tabs": "error",

    "no-multiple-empty-lines": ["error", { max: 1 }],

    // Disabled because the usual rule is to put more important or common case
    // into the `if` branch and the less important or uncommon case into the
    // `else` branch, even if that means negating the condition.
    "no-negated-condition": "off",

    "no-nested-ternary": "error",

    "no-new-object": "error",

    "no-plusplus": "off",

    "no-restricted-syntax": "off",

    "no-tabs": "error",

    "no-ternary": "off",

    // Disabled because leading underscores are used to mark private members in
    // classes and trailing underscores are used to avoid collisions with
    // reserved words.
    "no-underscore-dangle": "off",

    "no-unneeded-ternary": "error",

    "no-whitespace-before-property": "error",

    "object-curly-newline": "off",

    "object-curly-spacing": ["error", "always"],

    "object-property-newline": "off",

    // Disabled because `one-var` doesn't allow multiple initialized variable
    // declarations in one `let`/`const`/`var` statement and it doesn't make
    // sense to put each uninitialized variable on a separate line.
    "one-var-declaration-per-line": "off",

    // Set to split initialized variable declarations into separate
    // `let`/`const`/`var` statements while grouping uninitialized declarations
    // together. The idea behind this is that initialized and uninitialized
    // variable declarations are really two different things.
    //
    // An initialized variable declaration is just an assignment which happens
    // to assign to a variable for the first time, so it must also declare it.
    // Therefore, it should be mostly treated like an assignment, which
    // naturally leads to one `let`/`const`/`var` statement per variable.
    //
    // On the other hand, uninitialized variable declaration is just an
    // assertion that the variable exists in given scope and the actual
    // assignment happens later. Here, it makes sense to save space and combine
    // all declared variables into one statement.
    "one-var": ["error", { initialized: "never", uninitialized: "always" }],

    "operator-assignment": ["error", "always"],

    "operator-linebreak": ["error", "before"],

    "padded-blocks": ["error", "never"],

    "quote-props": ["error", "consistent"],

    "quotes": ["error", "double"],

    "require-jsdoc": "off",

    "semi-spacing": ["error", { before: false, after: true }],

    "semi": ["error", "always"],

    "sort-keys": "off",

    "sort-vars": "off",

    "space-before-blocks": ["error", "always"],

    "space-before-function-paren": ["error", "never"],

    "space-in-parens": ["error", "never"],

    "space-infix-ops": "error",

    "space-unary-ops": ["error", { words: true, nonwords: false }],

    "spaced-comment": [
      "error",
      "always",
      {
        line: { markers: ["/"] },
        block: { markers: ["*"], balanced: true },
      },
    ],

    "unicode-bom": ["error", "never"],

    "wrap-regex": "off",

    // ----- ECMAScript 6 -----

    "constructor-super": "error",

    "generator-star-spacing": ["error", "after"],

    "no-class-assign": "error",

    "no-confusing-arrow": "off",

    "no-const-assign": "error",

    "no-dupe-class-members": "error",

    "no-duplicate-imports": ["error", { includeExports: true }],

    "no-new-symbol": "error",

    "no-restricted-imports": "off",

    "no-this-before-super": "error",

    "no-useless-computed-key": "error",

    "no-useless-constructor": "error",

    "no-useless-rename": "error",

    "no-var": "error",

    // Set not to require shorthands for properties because their syntax is
    // misleading. It conflates together a key name and a variable name, which
    // are the same only by coincidence and represent completely different
    // things with different reasons for change. Method shorthands are fine in
    // this respect (they only save typing a colon and the `function` keyword).
    "object-shorthand": ["error", "methods"],

    // Disabled because there are frameworks like Mocha that use callbacks
    // extensively yet these callbacks can't be arrow functions because the
    // framework sets `this` dynamically when calling them. This rule doesn't
    // allow to make exceptions for these cases.
    "prefer-arrow-callback": "off",

    "prefer-const": "error",

    "prefer-numeric-literals": "error",

    // Disabled because `Reflect` doesn't deprecate the old methods "enough",
    // i.e. there is no clear advantage of using it. Moreover, `Reflect` is not
    // supported in Node.js < 6.
    "prefer-reflect": "off",

    // Disabled because rest parameters are not supported in Node.js < 6 without
    // a flag.
    "prefer-rest-params": "off",

    // Disabled because the spread operator is not supported in Node.js 4.x
    // without a flag.
    "prefer-spread": "off",

    // Disabled because the decision between using string concatenation or a
    // template literal is a subtle one and it shouldn't be done mechanically.
    "prefer-template": "off",

    "require-yield": "error",

    "rest-spread-spacing": ["error", "never"],

    "sort-imports": [
      "error",
      {
        "memberSyntaxSortOrder": ["none", "all", "multiple", "single"],
      },
    ],

    "symbol-description": "error",

    "template-curly-spacing": ["error", "never"],

    "yield-star-spacing": ["error", "after"],
  },
};
