"use strict";

const {
  Command, CommanderError, InvalidArgumentError, Option,
} = require("commander");
const Module = require("module");
const fs = require("fs");
const path = require("path");
const peggy = require("../lib/peg.js");
const util = require("util");

exports.CommanderError = CommanderError;
exports.InvalidArgumentError = InvalidArgumentError;

// Options that aren't for the API directly:
const PROG_OPTIONS = ["ast", "input", "output", "sourceMap", "startRule", "test", "testFile", "verbose"];
const MODULE_FORMATS = ["amd", "bare", "commonjs", "es", "globals", "umd"];
const MODULE_FORMATS_WITH_DEPS = ["amd", "commonjs", "es", "umd"];
const MODULE_FORMATS_WITH_GLOBAL = ["globals", "umd"];

// Helpers

function select(obj, sel) {
  const ret = {};
  for (const s of sel) {
    if (Object.prototype.hasOwnProperty.call(obj, s)) {
      ret[s] = obj[s];
      delete obj[s];
    }
  }
  return ret;
}

function commaArg(val, prev) {
  return (prev || []).concat(val.split(",").map(x => x.trim()));
}

// Files

function readStream(inputStream) {
  return new Promise((resolve, reject) => {
    const input = [];
    inputStream.on("data", data => { input.push(data); });
    inputStream.on("end", () => resolve(Buffer.concat(input).toString()));
    inputStream.on("error", reject);
  });
}

function readFile(name) {
  let f = null;
  try {
    f = fs.readFileSync(name, "utf8");
  } catch (e) {
    throw new InvalidArgumentError(`Can't read from file "${name}".`, e);
  }
  return f;
}

async function ensureDirectoryExists(filename) {
  const dir = path.dirname(filename);
  try {
    const stats = await fs.promises.stat(dir);
    if (!stats.isDirectory()) {
      throw new Error(`"${dir}" exists and is not a directory`);
    }
  } catch (er) {
    if (er.code !== "ENOENT") {
      throw er;
    }
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

/**
 * @typedef {object} Stdio
 * @property {stream.Readable} [in] StdIn.
 * @property {stream.Writable} [out] StdOut.
 * @property {stream.Writable} [err] StdErr.
 */

/**
 * @typedef {object} ErrorOptions
 * @property {string} [code="peggy.invalidArgument"] Code for exception if
 *   throwing.
 * @property {number} [exitCode=1] Exit code if exiting.
 * @property {peggy.SourceText[]} [sources=[]] Source text for formatting compile errors.
 * @property {Error} [error] Error to extract message from.
 * @property {string} [message] Error message, only used internally.
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

    /** @type {peggy.BuildOptionsBase} */
    this.argv = {};
    /** @type {string[]} */
    this.inputFiles = [];
    /** @type {string?} */
    this.outputFile = null;
    /** @type {object} */
    this.progOptions = {};
    /** @type {string?} */
    this.testFile = null;
    /** @type {string?} */
    this.testGrammarSource = null;
    /** @type {string?} */
    this.testText = null;
    /** @type {string?} */
    this.outputJS = null;
    /** @type {string?} */
    this.lastError = null;
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
          .conflicts(["test", "testFile", "sourceMap"])
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
        (val, prev = {}) => {
          let v = null;
          try {
            v = JSON.parse(val);
          } catch (e) {
            throw new InvalidArgumentError(`Error parsing JSON: ${e.message}`);
          }
          return Object.assign(prev, v);
        }
      )
      .option(
        "-e, --export-var <variable>",
        "Name of a global variable into which the parser object is assigned to when no module loader is detected."
      )
      .option(
        "--extra-options <options>",
        "Additional options (in JSON format as an object) to pass to peggy.generate",
        val => this.addExtraOptionsJSON(val, "extra-options")
      )
      .option(
        "-c, --extra-options-file <file>",
        "File with additional options (in JSON as an object or commonjs module format) to pass to peggy.generate",
        val => {
          if (/\.c?js$/.test(val)) {
            return this.addExtraOptions(require(path.resolve(val)), "extra-options-file");
          } else {
            return this.addExtraOptionsJSON(readFile(val), "extra-options-file");
          }
        }
      )
      .addOption(
        new Option(
          "--format <format>",
          "Format of the generated parser"
        )
          .choices(MODULE_FORMATS)
          .default("commonjs")
      )
      .addOption(new Option("--library").hideHelp(), "Run tests in library mode.  Maintainers only, for now.")
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
      .action((inputFiles, opts) => { // On parse()
        this.inputFiles = inputFiles;
        this.argv = opts;

        if (this.argv.library) {
          this.peg$library = true;
          delete this.argv.library;
        }

        if ((typeof this.argv.startRule === "string")
          && !this.argv.allowedStartRules.includes(this.argv.startRule)) {
          this.argv.allowedStartRules.push(this.argv.startRule);
        }

        if (this.argv.allowedStartRules.length === 0) {
          // [] is an invalid input, as is null
          // undefined doesn't work as a default in commander
          delete this.argv.allowedStartRules;
        }

        // Combine plugin/plugins
        if ((this.argv.plugin && (this.argv.plugin.length > 0))
            || (this.argv.plugins && (this.argv.plugins.length > 0))) {
          this.argv.plugins = [
            ...(this.argv.plugins || []),
            ...(this.argv.plugin || []),
          ].map(val => {
            if (typeof val !== "string") {
              return val;
            }
            // If this is an absolute or relative path (not a module name)
            const id = (path.isAbsolute(val) || /^\.\.?[/\\]/.test(val))
              ? path.resolve(val)
              : val;
            let mod = null;
            try {
              mod = require(id);
            } catch (e) {
              if (e.code !== "MODULE_NOT_FOUND") {
                this.error(`requiring:\n${e.stack}`);
              } else {
                this.error(`requiring "${id}": ${e.message}`);
              }
            }
            return mod;
          });
        }
        delete this.argv.plugin;

        // Combine dependency/dependencies
        this.argv.dependencies = this.argv.dependencies || {};
        if (this.argv.dependency) {
          if (this.argv.dependency.length > 0) {
            for (const dep of this.argv.dependency) {
              const [name, val] = dep.split(":");
              this.argv.dependencies[name] = val ? val : name;
            }
          }
          delete this.argv.dependency;
        }

        if ((Object.keys(this.argv.dependencies).length > 0)
            && !MODULE_FORMATS_WITH_DEPS.includes(this.argv.format)) {
          this.error(`Can't use the -d/--dependency or -D/--dependencies options with the "${this.argv.format}" module format.`);
        }

        if ((this.argv.exportVar !== undefined)
            && !MODULE_FORMATS_WITH_GLOBAL.includes(this.argv.format)) {
          this.error(`Can't use the -e/--export-var option with the "${this.argv.format}" module format.`);
        }

        this.progOptions = select(this.argv, PROG_OPTIONS);
        this.argv.output = "source";
        if ((this.args.length === 0) && this.progOptions.input) {
          // Allow command line to override config file.
          this.inputFiles = Array.isArray(this.progOptions.input)
            ? this.progOptions.input
            : [this.progOptions.input];
        }
        this.outputFile = this.progOptions.output;
        this.outputJS = this.progOptions.output;

        if ((this.inputFiles.includes("-")) && this.argv.watch) {
          this.argv.watch = false; // Make error throw.
          this.error("Can't watch stdin");
        }

        if (!this.outputFile) {
          if (!this.inputFiles.includes("-")) {
            let inFile = this.inputFiles[0];
            // You might just want to run a fragment grammar as-is,
            // particularly with a specified start rule.
            const m = inFile.match(/^npm:.*\/([^/]+)$/);
            if (m) {
              inFile = m[1];
            }
            this.outputJS = inFile.slice(
              0,
              inFile.length
                - path.extname(inFile).length
            ) + ".js";

            this.outputFile = ((typeof this.progOptions.test !== "string")
                               && !this.progOptions.testFile)
              ? this.outputJS
              : "-";
          } else {
            this.outputFile = "-";
            // Synthetic
            this.outputJS = path.join(process.cwd(), "stdout.js");
          }
        }
        // If CLI parameter was defined, enable source map generation
        if (this.progOptions.sourceMap !== undefined) {
          if (!this.progOptions.output
              && (this.progOptions.test || this.progOptions.testFile)) {
            this.error("Generation of the source map is not useful if you don't output a parser file, perhaps you forgot to add an `-o/--output` option?");
          }

          this.argv.output = "source-and-map";

          // If source map name is not specified, calculate it
          if (this.progOptions.sourceMap === true) {
            this.progOptions.sourceMap = this.outputFile === "-" ? "source.map" : this.outputFile + ".map";
          }

          if (this.progOptions.sourceMap === "hidden:inline") {
            this.error("hidden + inline sourceMap makes no sense.");
          }
        }

        if (this.progOptions.ast) {
          this.argv.output = "ast";
        }

        // Empty string is a valid test input.  Don't just test for falsy.
        if (typeof this.progOptions.test === "string") {
          this.testText = this.progOptions.test;
          this.testGrammarSource = "command line";
        }
        if (this.progOptions.testFile) {
          this.testFile = this.progOptions.testFile;
          this.testGrammarSource = this.progOptions.testFile;
        }
        this.verbose("PARSER OPTIONS:", this.argv);
        this.verbose("PROGRAM OPTIONS:", this.progOptions);
        this.verbose('INPUT: "%s"', this.inputFiles);
        this.verbose('OUTPUT: "%s"', this.outputFile);
        if (this.progOptions.verbose) {
          this.argv.info = (pass, msg) => PeggyCLI.print(this.std.err, `INFO(${pass}): ${msg}`);
        }
        this.argv.warning = (pass, msg) => PeggyCLI.print(this.std.err, `WARN(${pass}): ${msg}`);
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
  error(message, opts = {}) {
    opts = {
      code: "peggy.invalidArgument",
      exitCode: 1,
      error: null,
      sources: [],
      ...opts,
    };

    if (opts.error) {
      if (typeof opts.error.format === "function") {
        message = `${message}\n${opts.error.format(opts.sources)}`;
      } else {
        message = (this.progOptions.verbose || !opts.error.message)
          ? `${message}\n${opts.error.stack}`
          : `${message}\n${opts.error.message}`;
      }
    }
    if (!/^error/i.test(message)) {
      message = `Error ${message}`;
    }

    if (this.argv.watch) {
      this.lastError = message;
    } else {
      super.error(message, opts);
    }
  }

  static print(stream, ...args) {
    stream.write(util.formatWithOptions({
      colors: stream.isTTY,
      depth: Infinity,
      maxArrayLength: Infinity,
      maxStringLength: Infinity,
    }, ...args));
    stream.write("\n");
  }

  verbose(...args) {
    if (!this.progOptions.verbose) {
      return false;
    }
    PeggyCLI.print(this.std.err, ...args);
    return true;
  }

  addExtraOptionsJSON(json, source) {
    let extraOptions = undefined;

    try {
      extraOptions = JSON.parse(json);
    } catch (e) {
      throw new InvalidArgumentError(`Error parsing JSON: ${e.message}`);
    }

    return this.addExtraOptions(extraOptions, source);
  }

  addExtraOptions(extraOptions, source) {
    if ((extraOptions === null)
        || (typeof extraOptions !== "object")
        || Array.isArray(extraOptions)) {
      throw new InvalidArgumentError("The JSON with extra options has to represent an object.");
    }
    for (const [k, v] of Object.entries(extraOptions)) {
      const prev = this.getOptionValue(k);
      if ((this.getOptionValueSource(k) === "default")
          || (prev === "null")
          || (typeof prev !== "object")) {
        // Overwrite
        this.setOptionValueWithSource(k, v, source);
      } else {
        // Combine with previous if it's a non-default, non-null object.
        if (Array.isArray(prev)) {
          prev.push(...v);
        } else {
          Object.assign(prev, v);
        }
      }
    }
    return null;
  }

  openOutputStream() {
    // If there is a valid outputFile, write the parser to it.  Otherwise,
    // if no test and no outputFile, write to stdout.

    if (this.outputFile === "-") {
      // Note: empty string is a valid input for testText.
      // Don't just test for falsy.
      const hasTest = !this.testFile && (typeof this.testText !== "string");
      return Promise.resolve(hasTest ? this.std.out : null);
    }
    return ensureDirectoryExists(this.outputFile)
      .then(() => new Promise((resolve, reject) => {
        const outputStream = fs.createWriteStream(this.outputFile);
        outputStream.on("error", reject);
        outputStream.on("open", () => resolve(outputStream));
      }));
  }

  /**
   * Write a source map, and return the serialized plain text.
   *
   * @param {import("source-map-generator").SourceNode} source The SourceNode
   *   to serialize.
   * @returns {Promise<string>} The plain text output.
   */
  async writeSourceMap(source) {
    if (!this.progOptions.sourceMap) {
      return source;
    }

    let hidden = false;
    if (this.progOptions.sourceMap.startsWith("hidden:")) {
      hidden = true;
      this.progOptions.sourceMap = this.progOptions.sourceMap.slice(7);
    }
    const inline = this.progOptions.sourceMap === "inline";
    const mapDir = inline
      ? path.dirname(this.outputJS)
      : path.dirname(this.progOptions.sourceMap);

    const file = path.relative(mapDir, this.outputJS);
    const sourceMap = source.toStringWithSourceMap({ file });

    // According to specifications, paths in the "sources" array should be
    // relative to the map file. Compiler cannot generate right paths, because
    // it is unaware of the source map location
    const json = sourceMap.map.toJSON();
    json.sources = json.sources.map(
      src => ((src === null) ? null : path.relative(mapDir, src))
    );

    if (inline) {
      // Note: hidden + inline makes no sense.
      const buf = Buffer.from(JSON.stringify(json));
      // Use \x23 instead of # so that Jest won't treat this as a real
      // source map URL for *this* file.
      return sourceMap.code + `\
//\x23 sourceMappingURL=data:application/json;charset=utf-8;base64,${buf.toString("base64")}
`;
    }
    await ensureDirectoryExists(this.progOptions.sourceMap);
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
//# sourceMappingURL=${path.relative(path.dirname(this.outputJS), this.progOptions.sourceMap)}
`;
  }

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
        outputStream.end(source, err => {
          if (!err) {
            resolve();
          }
        });
      }
    });
  }

  async test(source) {
    if (this.testFile) {
      if (this.testFile === "-") {
        this.testText = await readStream(this.std.in);
      } else {
        this.testText = await fs.promises.readFile(this.testFile, "utf8");
      }
    }
    if (typeof this.testText === "string") {
      this.verbose("TEST TEXT:", this.testText);

      // Create a module that exports the parser, then load it from the
      // correct directory, so that any modules that the parser requires will
      // be loaded from the correct place.
      const filename = this.outputJS
        ? path.resolve(this.outputJS)
        : path.join(process.cwd(), "stdout.js"); // Synthetic

      const fromMem = require("@peggyjs/from-mem");
      const exec = await fromMem(source, {
        filename,
        format: this.argv.format,
        globalExport: this.argv.exportVar,
      });

      const opts = {
        grammarSource: this.testGrammarSource,
        peg$library: this.peg$library,
      };
      if (typeof this.progOptions.startRule === "string") {
        opts.startRule = this.progOptions.startRule;
      }
      const results = exec.parse(this.testText, opts);
      PeggyCLI.print(this.std.out, "%O", results);
    }
  }

  /**
   * Process the command line once.
   *
   * @returns {Promise<number>}
   */
  async run() {
    const sources = [];

    let exitCode = 1;
    let errorText = "";
    let prevSource = process.cwd() + "/";
    try {
      for (const source of this.inputFiles) {
        const input = { source, text: null };
        this.verbose("CLI", errorText = `reading input "${source}"`);
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
      this.argv.grammarSource = sources[0].source;

      this.verbose("CLI", errorText = "parsing grammar");
      const source = peggy.generate(sources, this.argv); // All of the real work.

      this.verbose("CLI", errorText = "opening output stream");
      const outputStream = await this.openOutputStream();

      // If option `--ast` is specified, `generate()` returns an AST object
      if (this.progOptions.ast) {
        this.verbose("CLI", errorText = "writing AST");
        await this.writeOutput(outputStream, JSON.stringify(source, null, 2));
      } else {
        this.verbose("CLI", errorText = "writing sourceMap");
        const mappedSource = await this.writeSourceMap(source);

        this.verbose("CLI", errorText = "writing parser");
        await this.writeOutput(outputStream, mappedSource);

        exitCode = 2;
        this.verbose("CLI", errorText = "running test");
        await this.test(mappedSource);
      }
    } catch (error) {
      if (this.testGrammarSource) {
        sources.push({
          source: this.testGrammarSource,
          text: this.testText,
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
   * Entry point.  If in watch mode, does `run` in a loop, catching errors,
   * otherwise does `run` once.
   *
   * @returns {Promise<number>}
   */
  main() {
    if (this.argv.watch) {
      const Watcher = require("./watcher.js"); // Lazy: usually not needed.
      const hasTest = this.progOptions.test || this.progOptions.testFile;
      const watchFiles = [...this.inputFiles];
      if (this.progOptions.testFile) {
        watchFiles.push(this.progOptions.testFile);
      }
      this.watcher = new Watcher(...watchFiles);

      this.watcher.on("change", async fn => {
        PeggyCLI.print(this.std.err, `"${fn}" changed...`);
        this.lastError = null;
        await this.run();

        if (this.lastError) {
          PeggyCLI.print(this.std.err, this.lastError);
        } else if (!hasTest) {
          PeggyCLI.print(this.std.err, `Wrote: "${this.outputFile}"`);
        }
      });

      return new Promise((resolve, reject) => {
        this.watcher.on("error", er => {
          reject(er);
        });
        this.watcher.on("close", () => resolve(0));
      });
    } else {
      return this.run();
    }
  }

  // For some reason, after running through rollup, typescript can't see
  // methods from the base class.

  /**
   * @param {string[]} [argv] - optional, defaults to process.argv
   * @param {Object} [parseOptions] - optionally specify style of options with from: node/user/electron
   * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
   * @return {PeggyCLI} `this` command for chaining
   */
  parse(argv, parseOptions) {
    return super.parse(argv, parseOptions);
  }

  /**
   * @param {Object} [configuration] - configuration options
   * @return {PeggyCLI} `this` command for chaining, or stored configuration
   */
  configureHelp(configuration) {
    return super.configureHelp(configuration);
  }

  /**
   * @param {Object} [configuration] - configuration options
   * @return {PeggyCLI} `this` command for chaining, or stored configuration
   */
  configureOutput(configuration) {
    return super.configureOutput(configuration);
  }

  /**
   * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
   * @return {PeggyCLI} `this` command for chaining
   */
  exitOverride(fn) {
    return super.exitOverride(fn);
  }
}

exports.PeggyCLI = PeggyCLI;
