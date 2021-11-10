import { Command, CommanderError, InvalidArgumentError, Option } from "commander";
import fs from "fs";
import path from "path";
import { default as peggy } from "../lib/peg.js";
import util from "util";

export { CommanderError, InvalidArgumentError };

// Options that aren't for the API directly:
const PROG_OPTIONS = ["input", "output", "sourceMap", "test", "testFile", "verbose"];
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
    inputStream.on("error", er => {
      // Stack isn't filled in on this error for some reason.
      Error.captureStackTrace(er);
      reject(er);
    });
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

/**
 * @typedef {object} Stdio
 * @property {stream.Readable} [in] StdIn.
 * @property {stream.Writable} [out] StdOut.
 * @property {stream.Writable} [err] StdErr.
 */

// Command line processing
export class PeggyCLI extends Command {
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
    this.colors = this.std.err.isTTY;
    /** @type {string?} */
    this.inputFile = null;
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

    this
      .version(peggy.VERSION, "-v, --version")
      .argument("[input_file]", 'Grammar file to read.  Use "-" to read stdin.', "-")
      .allowExcessArguments(false)
      .addOption(
        new Option(
          "--allowed-start-rules <rules>",
          "Comma-separated list of rules the generated parser will be allowed to start parsing from.  (Can be specified multiple times)"
        )
          .default([], "the first rule in the grammar")
          .argParser(commaArg)
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
      .option("-o, --output <file>", "Output file for generated parser. Use '-' for stdout (the default, unless a test is specified, in which case no parser is output without this option)")
      .option(
        "--plugin <module>",
        "Comma-separated list of plugins. (can be specified multiple times)",
        commaArg
      )
      .option(
        "-m, --source-map [mapfile]",
        "Generate a source map. If name is not specified, the source map will be named \"<input_file>.map\" if input is a file and \"source.map\" if input is a standard input. This option conflicts with the `-t/--test` and `-T/--test-file` options unless `-o/--output` is also specified"
      )
      .option(
        "-t, --test <text>",
        "Test the parser with the given text, outputting the result of running the parser instead of the parser itself. If the input to be tested is not parsed, the CLI will exit with code 2"
      )
      .option(
        "-T, --test-file <filename>",
        "Test the parser with the contents of the given file, outputting the result of running the parser instead of the parser itself. If the input to be tested is not parsed, the CLI will exit with code 2"
      )
      .option("--trace", "Enable tracing in generated parser", false)
      .addOption(
        // Not interesting yet.  If it becomes so, unhide the help.
        new Option("--verbose", "Enable verbose logging")
          .hideHelp()
          .default(false)
      )
      .addOption(
        new Option("-O, --optimize <style>")
          .hideHelp()
          .argParser(() => {
            this.print(this.std.err, "Option --optimize is deprecated from 1.2.0 and has no effect anymore.");
            this.print(this.std.err, "It will be deleted in 2.0.");
            this.print(this.std.err, "Parser will be generated in the former \"speed\" mode.");
            return "speed";
          })
      )
      .action((inputFile, opts) => { // On parse()
        this.inputFile = inputFile;
        this.argv = opts;

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
            && (MODULE_FORMATS_WITH_DEPS.indexOf(this.argv.format) === -1)) {
          this.error(`Can't use the -d/--dependency option with the "${this.argv.format}" module format.`);
        }

        if ((this.argv.exportVar !== undefined)
            && (MODULE_FORMATS_WITH_GLOBAL.indexOf(this.argv.format) === -1)) {
          this.error(`Can't use the -e/--export-var option with the "${this.argv.format}" module format.`);
        }

        this.progOptions = select(this.argv, PROG_OPTIONS);
        this.argv.output = "source";
        if ((this.args.length === 0) && this.progOptions.input) {
          // Allow command line to override config file.
          this.inputFile = this.progOptions.input;
        }
        this.outputFile = this.progOptions.output;

        if (!this.outputFile) {
          if ((this.inputFile !== "-")
            && !this.progOptions.test
            && !this.progOptions.testFile) {
            this.outputFile = this.inputFile.substr(
              0,
              this.inputFile.length - path.extname(this.inputFile).length
            ) + ".js";
          } else {
            this.outputFile = "-";
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
        }

        if (this.progOptions.test && this.progOptions.testFile) {
          this.error("The -t/--test and -T/--test-file options are mutually exclusive.");
        }
        if (this.progOptions.test) {
          this.testText = this.progOptions.test;
          this.testGrammarSource = "command line";
        }
        if (this.progOptions.testFile) {
          this.testFile = this.progOptions.testFile;
          this.testGrammarSource = this.progOptions.testFile;
        }
        this.verbose("PARSER OPTIONS:", this.argv);
        this.verbose("PROGRAM OPTIONS:", this.progOptions);
        this.verbose('INPUT: "%s"', this.inputFile);
        this.verbose('OUTPUT: "%s"', this.outputFile);
        if (this.progOptions.verbose) {
          this.argv.info = (pass, msg) => this.print(this.std.err, `INFO(${pass}): ${msg}`);
        }
        this.argv.warning = (pass, msg) => this.print(this.std.err, `WARN(${pass}): ${msg}`);
      });
  }

  /**
   * Print error message to std.err, and either call process.exit or throw an
   * exception if exitOverride() has been called.
   *
   * @param {string} message The message to print.
   * @param {object} [opts] Options
   * @param {string} [opts.code="peggy.invalidArgument"] Code for exception if
   *   throwing.
   * @param {number} [opts.exitCode=1] Exit code if exiting.
   * @param {peggy.SourceText[]} [opts.sources=[]] Source text for formatting compile errors.
   * @param {Error} [opts.error] Error to extract message from.
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

    // Internal API, subject to change.  See:
    // https://github.com/tj/commander.js/issues/1632
    this._displayError(opts.exitCode, opts.code, `Error ${message}`);
  }

  print(stream, ...args) {
    stream.write(util.formatWithOptions({
      colors: this.colors,
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
    this.print(this.std.err, ...args);
    return true;
  }

  addExtraOptionsJSON(json, source) {
    let extraOptions;

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
      return Promise.resolve(
        (!this.testFile && !this.testText) ? this.std.out : null
      );
    }
    return new Promise((resolve, reject) => {
      const outputStream = fs.createWriteStream(this.outputFile);
      outputStream.on("error", er => {
        // Stack isn't filled in on this error for some reason.
        Error.captureStackTrace(er);
        reject(er);
      });
      outputStream.on("open", () => resolve(outputStream));
    });
  }

  /**
   * Write a source map, and return the serialized plain text.
   *
   * @param {import("source-map-generator").SourceNode} source The SourceNode
   *   to serialize.
   * @returns {Promise<string>} The plain text output.
   */
  writeSourceMap(source) {
    return new Promise((resolve, reject) => {
      if (!this.progOptions.sourceMap) {
        resolve(source);
        return;
      }

      const mapDir = path.dirname(this.progOptions.sourceMap);

      const file = (this.outputFile === "-")
        ? null
        : path.relative(mapDir, this.outputFile);
      const sourceMap = source.toStringWithSourceMap({ file });

      // According to specifications, paths in the "sources" array should be
      // relative to the map file. Compiler cannot generate right paths, because
      // it is unaware of the source map location
      const json = sourceMap.map.toJSON();
      json.sources = json.sources.map(
        src => (src === null) ? null : path.relative(mapDir, src)
      );

      fs.writeFile(
        this.progOptions.sourceMap,
        JSON.stringify(json),
        "utf8",
        err => {
          if (err) {
            // Stack isn't filled in on this error for some reason.
            Error.captureStackTrace(err);
            reject(err);
          } else {
            resolve(sourceMap.code);
          }
        }
      );
    });
  }

  writeParser(outputStream, source) {
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

  test(source) {
    if (this.testFile) {
      this.testText = fs.readFileSync(this.testFile, "utf8");
    }
    if (typeof this.testText === "string") {
      this.verbose("TEST TEXT:", this.testText);
      const exec = eval(source);
      const results = exec.parse(this.testText, {
        grammarSource: this.testGrammarSource,
      });
      this.print(this.std.out, util.inspect(results, {
        depth: Infinity,
        colors: this.colors,
        maxArrayLength: Infinity,
        maxStringLength: Infinity,
      }));
    }
  }

  async main() {
    let inputStream;

    if (this.inputFile === "-") {
      this.std.in.resume();
      inputStream = this.std.in;
      this.argv.grammarSource = "stdin";
    } else {
      this.argv.grammarSource = this.inputFile;
      inputStream = fs.createReadStream(this.inputFile);
    }

    let exitCode = 1;
    let errorText = "";
    let input = "";
    try {
      this.verbose("CLI", errorText = "reading input stream");
      input = await readStream(inputStream);

      this.verbose("CLI", errorText = "parsing grammar");
      const source = peggy.generate(input, this.argv); // All of the real work.

      this.verbose("CLI", errorText = "writing to output file");
      const outputStream = await this.openOutputStream();

      this.verbose("CLI", errorText = "writing sourceMap");
      const mappedSource = await this.writeSourceMap(source);

      this.verbose("CLI", errorText = "writing parser");
      await this.writeParser(outputStream, mappedSource);

      exitCode = 2;
      this.verbose("CLI", errorText = "running test");
      this.test(mappedSource);
    } catch (error) {
      // Will either exit or throw.
      this.error(errorText, {
        error,
        exitCode,
        code: "peggy.cli",
        sources: [{
          source: this.argv.grammarSource,
          text: input,
        }],
      });
    }
    return 0;
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
