# Contribution Guidelines

The best way to contribute to Peggy is by using it and giving back useful
feedback — reporting discovered bugs or requesting missing features.

You can also contribute code, but be advised that many patches end up being
rejected, usually because the change doesn’t fit the project or because of
various implementation issues. In almost all cases it’s best to get in touch
first before sending a patch.

## Reporting Bugs

Report bugs using [GitHub issues][issues]. Before submitting a bug report,
please [search existing reports][issues-search-bugs] to see if the bug wasn’t
reported already.

In the report, please describe:

  * Steps to reproduce the problem
  * Expected result(s)
  * Actual result(s)

In most cases, it’s also useful to include a **minimal** example (grammar +
input) reproducing the problem.

## Requesting Features

Request features using [GitHub issues][issues]. Before submitting a feature
request, please [search existing requests][issues-search-enhancements] to see if
the feature wasn’t requested already.

In the request, please describe:

  * How the feature should work
  * Use case(s) behind it

## Contributing Code

Contribute code using [GitHub pull requests][pulls].

1. For non-trivial changes, first file a corresponding bug report or feature
request. This will ensure the *problem* is separated from a *solution*.

1. Split your change into atomic commits with descriptive messages adhering to
[these conventions][git-commit-messages]. Have a look in the commit history to
see good examples.

1. When appropriate, add documentation and tests.

1. Before submitting, make sure your change passes the tests and lint checks
by running `npm run build`.  If the build script produces output that git sees
as a change, please add that output file to your pull request.

1. Ensure that your pull request contains an addition to the
[CHANGELOG.md](CHANGELOG.md) file.

1. Please add yourself to the [AUTHORS](AUTHORS) file, or double-check that the
information there is still correct if you have contributed before.

[issues]: https://github.com/peggyjs/peggy/issues
[issues-search-bugs]: https://github.com/peggyjs/peggy/issues?q=is%3Aopen+is%3Aissue+label%3ABug
[issues-search-enhancements]: https://github.com/peggyjs/peggy/issues?q=is%3Aopen+is%3Aissue+label%3AEnhancement
[pulls]: https://github.com/peggyjs/peggy/pulls
[git-commit-messages]: http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html
