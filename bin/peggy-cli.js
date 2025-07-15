"use strict";

const {
  Command, CommanderError, InvalidArgumentError, Option,
} = require("commander");
const {
  addExtraOptionsJSON, refineOptions,
} = require("./opts.js");
const {
  isER, commaArg, moreJSON, readStream, mkFileDir,
} = require("./utils.js");
const Module = require("module");
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const peggy = require("../lib/peg.js");
const util = require("util");
const GrammarError = require("../lib/grammar-error.js");

exports.CommanderError = CommanderError;
exports.InvalidArgumentError = InvalidArgumentError;

const MODULE_FORMATS = ["amd", "bare", "commonjs", "es", "globals", "umd"];

/**
 * @typedef {object} TTYWritable
 * @property {boolean} [isTTY]
 */

/**
 * @typedef {import("node:stream").Writable & TTYWritable} Writable
 */

/**
 * @typedef {object} Stdio
 * @property {import("./utils.js").Readable} in StdIn.
 * @property {Writable} out StdOut.
 * @property {Writable} err StdErr.
 */

/**
 * @typedef {object} PeggyErrorOptions
 * @property {peggy.SourceText[]} [sources=[]] Source text for formatting compile errors.
 * @property {Error} [error] Error to extract message from.
 * @property {string} [message] Error message, only used internally.
 */

/**
 * @typedef {import("commander").ErrorOptions & PeggyErrorOptions} ErrorOptions
 */

// Command line processing
class PeggyCLI extends Command {
  /**
   * Create a CLI environment.
   *
   * @param {Stdio} [stdio] Replacement streams for stdio, for testing.
   */
  constructor(stdio) {
    super("peggy");

    /** @type {Stdio} */
    this.std = {
      in: process.stdin,
      out: process.stdout,
      err: process.stderr,
      ...stdio,
    };

    /** @type {import("../lib/peg.js").SourceOptionsBase<"ast">} */
    this.parserOptions = Object.create(null);
    /** @type {import("./opts.js").ProgOptions} */
    this.progOptions = Object.create(null);
    /** @type {string=} */
    this.lastError = undefined;
    /** @type {import('./watcher.js')?} */
    this.watcher = null;

    this
      .version(peggy.VERSION, "-v, --version")
      .argument("[input_file...]", 'Grammar file(s) to read.  Use "-" to read stdin.  If multiple files are given, they are combined in the given order to produce a single output.  Use npm:"<packageName>/file.peggy" to import from an npm dependency.', ["-"])
      .allowExcessArguments(false)
      .addOption(
        new Option(
          "--allowed-start-rules <rules>",
          "Comma-separated list of rules the generated parser will be allowed to start parsing from.  Use '*' if you want any rule to be allowed as a start rule.  (Can be specified multiple times)"
        )
          .default([], "the first rule in the grammar")
          .argParser(commaArg)
      )
      .addOption(
        new Option(
          "--ast",
          "Output a grammar AST instead of a parser code"
        )
          .default(false)
          .conflicts(["dts", "test", "testFile", "sourceMap"])
      )
      .option(
        "--cache",
        "Make generated parser cache results",
        false
      )
      .option(
        "-d, --dependency <dependency>",
        "Comma-separated list of dependencies, either as a module name, or as `variable:module`. (Can be specified multiple times)",
        commaArg
      )
      .option(
        "-D, --dependencies <json>",
        "Dependencies, in JSON object format with variable:module pairs. (Can be specified multiple times).",
        moreJSON
      )
      .option(
        "--dts",
        "Create a .d.ts to describe the generated parser."
      )
      .option(
        "-e, --export-var <variable>",
        "Name of a global variable into which the parser object is assigned to when no module loader is detected."
      )
      .option(
        "--extra-options <options>",
        "Additional options (in JSON format as an object) to pass to peggy.generate",
        val => addExtraOptionsJSON(this, val, "extra-options")
      )
      .option(
        "-c, --extra-options-file <file>",
        "File with additional options (in JSON as an object or commonjs module format) to pass to peggy.generate",
        (val, /** @type {string[]} */prev) => (prev || []).concat(val)
      )
      .addOption(
        new Option(
          "--format <format>",
          "Format of the generated parser"
        )
          .choices(MODULE_FORMATS)
          .default("commonjs")
      )
      .addOption(new Option(
        "--library",
        "Run tests in library mode.  Maintainers only, for now."
      ).hideHelp())
      .addOption(new Option(
        "--testingHelp"
      ).argParser(() => {
        // Ensure help always wraps the same when unit testing.
        // It's 79 because of a small change in commander.
        this.configureHelp({
          helpWidth: 79,
        });
      }).hideHelp())
      .option("-o, --output <file>", "Output file for generated parser. Use '-' for stdout (the default is a file next to the input file with the extension change to '.js', unless a test is specified, in which case no parser is output without this option)")
      .option(
        "--plugin <module>",
        "Comma-separated list of plugins. (can be specified multiple times)",
        commaArg
      )
      .option(
        "-m, --source-map [mapfile]",
        "Generate a source map. If name is not specified, the source map will be named \"<input_file>.map\" if input is a file and \"source.map\" if input is a standard input. If the special filename `inline` is given, the sourcemap will be embedded in the output file as a data URI.  If the filename is prefixed with `hidden:`, no mapping URL will be included so that the mapping can be specified with an HTTP SourceMap: header.  This option conflicts with the `-t/--test` and `-T/--test-file` options unless `-o/--output` is also specified"
      )
      .option(
        "--return-types <typeInfo>",
        "Types returned for rules, as JSON object of the form {\"ruleName\": \"type\"}",
        moreJSON
      )
      .option(
        "-S, --start-rule <rule>",
        "When testing, use the given rule as the start rule.  If this rule is not in the allowed start rules, it will be added."
      )
      .option(
        "-t, --test <text>",
        "Test the parser with the given text, outputting the result of running the parser instead of the parser itself. If the input to be tested is not parsed, the CLI will exit with code 2"
      )
      .addOption(new Option(
        "-T, --test-file <filename>",
        "Test the parser with the contents of the given file, outputting the result of running the parser instead of the parser itself. If the input to be tested is not parsed, the CLI will exit with code 2. A filename of '-' will read from stdin."
      ).conflicts("test"))
      .option("--trace", "Enable tracing in generated parser", false)
      .option("-w,--watch", "Watch the input file for changes, generating the output once at the start, and again whenever the file changes.")
      .addOption(
        // Not interesting yet.  If it becomes so, unhide the help.
        new Option("--verbose", "Enable verbose logging")
          .hideHelp()
          .default(false)
      )
      .action(async (inputFiles, opts) => { // On parse()
        const {
          parserOptions,
          progOptions,
        } = await refineOptions(this, inputFiles, opts);
        this.parserOptions = parserOptions;
        this.progOptions = progOptions;
        this.verbose("PARSER OPTIONS:", parserOptions);
        this.verbose("PROGRAM OPTIONS:", progOptions);
      });
  }

  /**
   * Print error message to std.err, and either call process.exit or throw an
   * exception if exitOverride() has been called.  If opts.error is specified,
   * it will be used to generate the error message, rather than using the
   * message provided.
   *
   * @param {string} message The message to print.
   * @param {ErrorOptions} [opts] Options
   */
  // @ts-expect-error Commander has this returning `never`, which isn't quite right
  error(message, opts = {}) {
    opts = {
      code: "peggy.invalidArgument",
      exitCode: 1,
      error: undefined,
      sources: [],
      ...opts,
    };

    if (opts.error) {
      const er = /** @type {peggy.parser.SyntaxError} */(opts.error);
      if (typeof er.format === "function") {
        const fmt = er.format(/** @type {peggy.SourceText[]} */(opts.sources));
        message = `${message}\n${fmt}`;
      } else {
        message = (this.progOptions.verbose || !er.message)
          ? `${message}\n${er.stack}`
          : `${message}\n${er.message}`;
      }
    }
    if (!/^error/i.test(message)) {
      message = `Error ${message}`;
    }

    if (this.progOptions.watch) {
      this.lastError = message;
    } else {
      super.error(message, opts);
    }
  }

  /**
   * Print text and a newline to stdout, using util.format.
   *
   * @param {Writable} stream Stream to write to.
   * @param  {...any} args Format arguments.
   */
  static print(stream, ...args) {
    stream.write(util.formatWithOptions({
      colors: stream.isTTY,
      depth: Infinity,
      maxArrayLength: Infinity,
      maxStringLength: Infinity,
    }, ...args));
    stream.write("\n");
  }

  /**
   * If we are in verbose mode, print to stderr with a newline.
   *
   * @param {...any} args Format arguments.
   * @returns {boolean} On write, true.  Otherwise false.
   */
  verbose(...args) {
    if (!this.progOptions.verbose) {
      return false;
    }
    PeggyCLI.print(this.std.err, ...args);
    return true;
  }

  /**
   *
   * @returns {Promise<Writable | null>}
   */
  async openOutputStream() {
    if (this.progOptions.outputFile === "-") {
      // Note: empty string is a valid input for testText.
      // Don't just test for falsy.
      const hasTest = !this.progOptions.testFile && (typeof this.progOptions.testText !== "string");
      if (hasTest) {
        this.verbose("CLI writing to stdout");
        return this.std.out;
      }
      this.verbose("No grammar output");
      return null;
    }
    assert(this.progOptions.outputFile);
    await mkFileDir(this.progOptions.outputFile);
    return new Promise((resolve, reject) => {
      assert(this.progOptions.outputFile);
      this.verbose("CLI writing to '%s'", this.progOptions.outputFile);
      const outputStream = fs.createWriteStream(this.progOptions.outputFile);
      outputStream.on("error", reject);
      outputStream.on("open", () => resolve(outputStream));
    });
  }

  /**
   * Write a source map, and return the serialized plain text.
   *
   * @param {import("source-map-generator").SourceNode} source The SourceNode
   *   to serialize.
   * @returns {Promise<string>} The
   *   plain text output.
   */
  async writeSourceMap(source) {
    if (!this.progOptions.sourceMap) {
      return source.toString();
    }

    let hidden = false;
    assert(typeof this.progOptions.sourceMap === "string");
    if (this.progOptions.sourceMap.startsWith("hidden:")) {
      hidden = true;
      this.progOptions.sourceMap
        = this.progOptions.sourceMap.slice(7);
    }
    const inline = this.progOptions.sourceMap === "inline";
    assert(this.progOptions.outputJS);
    const mapDir = inline
      ? path.dirname(this.progOptions.outputJS)
      : path.dirname(this.progOptions.sourceMap);

    const file = path.relative(mapDir, this.progOptions.outputJS);
    const sourceMap = source.toStringWithSourceMap({ file });

    // According to specifications, paths in the "sources" array should be
    // relative to the map file. Compiler cannot generate right paths, because
    // it is unaware of the source map location
    const json = sourceMap.map.toJSON();
    json.sources = json
      .sources
      .filter(x => x)
      .map(src => path.relative(mapDir, src));

    if (inline) {
      // Note: hidden + inline makes no sense.
      const buf = Buffer.from(JSON.stringify(json));
      // Use \x23 instead of # so that Jest won't treat this as a real
      // source map URL for *this* file.
      return sourceMap.code + `\
//\x23 sourceMappingURL=data:application/json;charset=utf-8;base64,${buf.toString("base64")}
`;
    }

    this.verbose("CLI writing sourceMap '%s'", this.progOptions.sourceMap);
    await mkFileDir(this.progOptions.sourceMap);
    await fs.promises.writeFile(
      this.progOptions.sourceMap,
      JSON.stringify(json),
      "utf8"
    );
    if (hidden) {
      return sourceMap.code;
    }
    // Opposite direction from mapDir
    return sourceMap.code + `\
//\x23 sourceMappingURL=${path.relative(path.dirname(this.progOptions.outputJS), this.progOptions.sourceMap)}
`;
  }

  /**
   *
   * @param {Writable|null} outputStream
   * @param {string} source
   * @returns {Promise<void>}
   */
  writeOutput(outputStream, source) {
    return new Promise((resolve, reject) => {
      if (!outputStream) {
        resolve();
        return;
      }
      // Slightly odd formation in order to get test coverage without having to
      // mock the whole file system.
      outputStream.on("error", reject);
      if (outputStream === this.std.out) {
        outputStream.write(source, err => {
          if (!err) {
            resolve();
          }
        });
      } else {
        outputStream.end(source, (/** @type {unknown} */ err) => {
          if (!err) {
            resolve();
          }
        });
      }
    });
  }

  /**
   * @param {import("../lib/peg.js").ast.Grammar} ast
   * @returns {Promise<void>}
   */
  async writeDTS(ast) {
    if (!this.progOptions.dtsFile) {
      return;
    }
    const templateFile = path.join(__dirname, "generated_template.d.ts");
    this.verbose("CLI reading DTS template from '%s'", templateFile);
    let template = await fs.promises.readFile(templateFile, "utf8");
    let startRules = this.parserOptions.allowedStartRules
      || [ast.rules[0].name];
    if (startRules.includes("*")) {
      startRules = ast.rules.map(r => r.name);
    }
    const qsr = startRules.map(r => `"${r}"`);

    template = template.replace("$$$StartRules$$$", qsr.join(" | "));
    template = template.replace("$$$DefaultStartRule$$$", qsr[0]);

    this.verbose("CLI writing DTS to '%s'", this.progOptions.dtsFile);
    await mkFileDir(this.progOptions.dtsFile);
    const out = fs.createWriteStream(this.progOptions.dtsFile);
    out.write(template);

    const types = /** @type {Record<string, string>|undefined} */(
      this.progOptions.returnTypes
    ) || {};
    const resultTypes = new Set();
    for (const sr of startRules) {
      const typ = types[sr] || "any";
      resultTypes.add(typ);
      out.write(`
declare function ParseFunction<Options extends ParseOptions<"${sr}">>(
  input: string,
  options?: Options,
): ${typ};
`);
    }

    out.write(`
declare function ParseFunction<Options extends ParseOptions<StartRuleNames>>(
  input: string,
  options?: Options,
): ${[...resultTypes].join(" | ")};
`);
    await /** @type {Promise<void>} */(new Promise((resolve, reject) => {
      out.close(er => {
        if (er) {
          reject(er);
        } else {
          resolve();
        }
      });
    }));
  }

  /**
   * @param {string} source
   * @returns {Promise<void>}
   */
  async test(source) {
    if (this.progOptions.testFile) {
      if (this.progOptions.testFile === "-") {
        this.progOptions.testText = await readStream(this.std.in);
      } else {
        this.progOptions.testText = await fs.promises.readFile(this.progOptions.testFile, "utf8");
      }
    }
    if (typeof this.progOptions.testText === "string") {
      this.verbose("TEST TEXT:", this.progOptions.testText);

      // Create a module that exports the parser, then load it from the
      // correct directory, so that any modules that the parser requires will
      // be loaded from the correct place.
      const fromMem = require("@peggyjs/from-mem");

      assert(this.progOptions.outputJS);

      /** @type {import("../lib/peg.js").ParserOptions} */
      const opts = {
        grammarSource: this.progOptions.testGrammarSource,
        peg$library: this.progOptions.library,
      };

      const results = await fromMem(source, {
        filename: this.progOptions.outputJS,
        format: this.parserOptions.format,
        exportVar: this.parserOptions.exportVar,
        exec: `\
const results = IMPORTED.parse(arg[0], arg[1]);
const util = await import("node:util");
return util.inspect(results, {
  colors: arg[2],
  depth: Infinity,
  maxArrayLength: Infinity,
  maxStringLength: Infinity,
});
`,
        arg: [this.progOptions.testText, opts, this.std.out.isTTY],
      });

      PeggyCLI.print(this.std.out, results);
    }
  }

  /**
   * Process the command line once.
   *
   * @returns {Promise<number>}
   */
  async run() {
    /** @type {import("../lib/peg.js").SourceText[]} */
    const sources = [];

    let exitCode = 1;
    let errorText = "";
    let prevSource = process.cwd() + "/";
    try {
      for (const source of this.progOptions.inputFiles) {
        const input = { source, text: "" };
        errorText = `reading input "${source}"`;
        this.verbose("CLI", errorText);
        if (source === "-") {
          input.source = "stdin";
          this.std.in.resume();
          input.text = await readStream(this.std.in);
        } else if (source.startsWith("npm:")) {
          const req = Module.createRequire(prevSource);
          prevSource = req.resolve(source.slice(4)); // Skip "npm:"
          input.source = prevSource;
          input.text = await fs.promises.readFile(prevSource, "utf8");
        } else {
          prevSource = path.resolve(source);
          input.text = await fs.promises.readFile(source, "utf8");
        }
        sources.push(input);
      }

      // This is wrong.  It's a hack in place until source generation is fixed.
      this.parserOptions.grammarSource = sources[0].source;

      errorText = "parsing grammar";
      this.verbose("CLI", errorText);

      if (this.progOptions.verbose) {
        this.parserOptions.info = (pass, msg, loc, diag) => {
          if (loc) {
            const e = new GrammarError(`INFO(${pass}): ${msg}`, loc, diag);
            PeggyCLI.print(this.std.err, e.format(sources));
          } else {
            PeggyCLI.print(this.std.err, `INFO(${pass}): ${msg}`);
          }
        };
      }

      this.parserOptions.warning = (pass, msg, loc, diag) => {
        if (loc) {
          const e = new GrammarError(`WARN(${pass}): ${msg}`, loc, diag);
          PeggyCLI.print(this.std.err, e.format(sources));
        } else {
          PeggyCLI.print(this.std.err, `WARN(${pass}): ${msg}`);
        }
      };

      const source = peggy.generate(
        sources,
        this.parserOptions
      ); // All of the real work.

      errorText = "opening output stream";
      this.verbose("CLI maybe", errorText);
      const outputStream = await this.openOutputStream();

      // If option `--ast` is specified, `generate()` returns an AST object
      if (this.progOptions.ast) {
        this.verbose("CLI", errorText = "writing AST");
        await this.writeOutput(outputStream, JSON.stringify(source, null, 2));
      } else {
        assert(source.code);
        errorText = "writing sourceMap";
        this.verbose("CLI maybe", errorText);
        const mappedSource = await this.writeSourceMap(source.code);

        errorText = "maybe writing parser";
        this.verbose("CLI", errorText);
        await this.writeOutput(outputStream, mappedSource);

        errorText = "maybe writing .d.ts file";
        this.verbose("CLI", errorText);
        await this.writeDTS(source);

        exitCode = 2;
        errorText = "running test";
        this.verbose("CLI maybe", errorText);
        await this.test(mappedSource);
      }
    } catch (error) {
      isER(error);
      if (this.progOptions.testGrammarSource) {
        sources.push({
          source: this.progOptions.testGrammarSource,
          text: this.progOptions.testText || "",
        });
      }
      // Will either exit or throw.
      this.error(errorText, {
        error,
        exitCode,
        code: "peggy.cli",
        sources,
      });
    }
    return 0;
  }

  /**
   * Stops watching input file.
   */
  async stopWatching() {
    if (!this.watcher) {
      throw new Error("Not watching");
    }
    await this.watcher.close();
    this.watcher = null;
  }

  /**
   * @deprecated Use parseAsync instead
   * @param {string[]} [args] Arguments
   * @returns {never}
   */
  // eslint-disable-next-line class-methods-use-this
  parse(args) {
    // Put this here in case anyone was calling PeggyCLI by hand.
    // Remove in peggy@v5
    throw new Error(`Must call parseAsync: ${args}`);
  }

  /**
   * Entry point.  If in watch mode, does `run` in a loop, catching errors,
   * otherwise does `run` once.
   *
   * @returns {Promise<number>}
   */
  main() {
    if (this.progOptions.watch) {
      const Watcher = require("./watcher.js"); // Lazy: usually not needed.
      const hasTest = this.progOptions.test || this.progOptions.testFile;
      const watchFiles = [...this.progOptions.inputFiles];
      if (this.progOptions.testFile) {
        watchFiles.push(this.progOptions.testFile);
      }
      this.watcher = new Watcher(...watchFiles);

      this.watcher.on("change", async fn => {
        PeggyCLI.print(this.std.err, `"${fn}" changed...`);
        this.lastError = undefined;
        await this.run();

        if (this.lastError) {
          PeggyCLI.print(this.std.err, this.lastError);
          PeggyCLI.print(this.std.err, `Failed writing: "${this.progOptions.outputFile}"`);
        } else if (!hasTest) {
          PeggyCLI.print(this.std.err, `Wrote: "${this.progOptions.outputFile}"`);
        }
      });

      return new Promise((resolve, reject) => {
        this.watcher?.on("error", er => {
          reject(er);
        });
        this.watcher?.on("close", () => resolve(0));
      });
    } else {
      return this.run();
    }
  }
}

exports.PeggyCLI = PeggyCLI;
