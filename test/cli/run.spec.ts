/* eslint-disable mocha/no-setup-in-describe */
/* eslint-disable mocha/max-top-level-suites */
// This is typescript so that it only runs in node contexts, not on the web

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as peggy from "../../lib/peg.js";
import { CommanderError, PeggyCLI } from "../../bin/peggy.js";
import { Transform, TransformCallback, TransformOptions } from "stream";
import { SourceMapConsumer } from "source-map";
import { isER } from "../../bin/utils.js";
import { promisify } from "util";
import { spawn } from "child_process";

const peggyPath = path.resolve(__dirname, "..", "..", "bin", "peggy.js");
const foobarbaz = `\
foo = '1'
bar = '2'
baz = '3'
`;

const fixtures = path.resolve(__dirname, "fixtures");
const packageJson = path.resolve(__dirname, "..", "..", "package.json");
const grammarFile = path.resolve(__dirname, "..", "..", "examples", "json.pegjs");
let tmpDir = "";

// eslint-disable-next-line mocha/no-top-level-hooks
beforeAll(async() => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "run-spec-"));
});

// eslint-disable-next-line mocha/no-top-level-hooks
afterAll(async() => {
  await fs.promises.rm(tmpDir, { recursive: true });
});

interface ErrorWritableOptions extends TransformOptions {
  name?: string;
  errorsToThrow?: Error[];
}

interface CodeObject {
  code: number | string;
  exitCode: number;
}

/** Capture stdin/stdout. */
class MockStream extends Transform {
  public name?: string;

  private errorsToThrow: Error[];

  public constructor(opts: ErrorWritableOptions = {}) {
    const { name, errorsToThrow, ...others } = opts;
    super(others);
    this.name = name;
    this.errorsToThrow = errorsToThrow || [];
  }

  public static create(
    src?: Buffer | string,
    opts: ErrorWritableOptions = {}
  ): MockStream {
    const b = new MockStream(opts);
    b.end(src);
    return b;
  }

  public _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const er = this.errorsToThrow.shift();
    if (er) {
      callback(er);
    } else {
      this.push(chunk, encoding);
      callback();
    }
  }
}

/** Execution failed */
class ExecError extends Error {
  /** Result error code, always non-zero */
  public code: number;

  /** Stdout as a string, decoded with opts.encoding */
  public str: string;

  /** Stdout as a Buffer */
  public buf?: Buffer;

  public constructor(
    message: string,
    code: number,
    str: string,
    buf?: Buffer
  ) {
    super(`${message}: error code "${code}"
${str}`);
    this.name = "ExecError";
    Object.setPrototypeOf(this, ExecError.prototype);
    this.code = code;
    this.buf = buf;
    this.str = str;
  }
}

interface Options {
  args?: string[];
  encoding?: BufferEncoding;
  env?: { [variable: string]: string };
  stdin?: Buffer | MockStream | string;
  stdout?: MockStream;
  stderr?: MockStream;
  error?: any;
  errorCode?: number | string;
  exitCode?: number;
  expected?: any;
  onstdout?(s: string, cli: PeggyCLI): void;
  onstderr?(s: string, cli: PeggyCLI): void;
}

/**
 * "Execute" the CLI by calling it as the wrapper would, but substituting
 * our own stdin, stdout, stderr.
 */
async function exec(opts: Options = {}): Promise<string> {
  opts = {
    args: [],
    encoding: "utf8",
    env: {},
    exitCode: 0,
    ...opts,
  };

  try {
    const stdin = (opts.stdin instanceof MockStream)
      ? opts.stdin
      : MockStream.create(opts.stdin, { name: "stdin" });
    const out = opts.stdout || new MockStream({
      name: "stdout",
      encoding: opts.encoding,
    });
    const err = opts.stderr || out;
    const outputBuffers: (Buffer | string)[] = [];
    out.on("data", buf => outputBuffers.push(buf));

    // All of the errors we want to capture go into this promise.
    const p = (async(): Promise<number> => {
      const cli = new PeggyCLI({ in: stdin, out, err })
        .exitOverride()
        .configureOutput({
          writeOut: (c: string) => out.write(c),
          writeErr: (c: string) => err.write(c),
        })
        .configureHelp({ helpWidth: 80 });
      if (opts.onstdout) {
        const oso = opts.onstdout; // Snapshot
        out.on("data", buf => oso(buf, cli));
      }

      if (opts.onstderr) {
        const ose = opts.onstderr; // Snapshot
        err.on("data", buf => ose(buf, cli));
      }
      await cli.parseAsync([
        process.execPath,
        "peggy",
        ...(opts.args || []),
      ]);
      return cli.main();
    })();

    let waited = false;
    if (opts.error !== undefined) {
      waited = true;
      await expect(p).rejects.toThrow(opts.error);
    }
    if (opts.errorCode !== undefined) {
      waited = true;
      try {
        await expect(p).rejects.toThrow(
          expect.objectContaining({ code: opts.errorCode })
        );
      } catch (e) {
        // It's hard to figure these out sometimes.  Give ourselves a little help.
        try {
          await p;
        } catch (realErr) {
          console.log("RECEIVED ERROR CODE:", (realErr as CodeObject).code);
        }
        throw e;
      }
    }
    if (opts.exitCode) {
      waited = true;
      try {
        await expect(p).rejects.toThrow(
          expect.objectContaining({ exitCode: opts.exitCode })
        );
      } catch (e) {
        // It's hard to figure these out sometimes.  Give ourselves a little help.
        try {
          await p;
        } catch (realErr) {
          console.log("RECEIVED EXIT CODE:", (realErr as CodeObject).exitCode);
        }
        throw e;
      }
    }

    if (!waited) {
      // Make sure to include opts.error or opts.errorCode if you're expecting
      // an exception.
      const exitCode = await p;
      expect(exitCode).toBe(0);
    }

    let outputString = "";
    if (outputBuffers.length > 0) {
      if (typeof outputBuffers[0] === "string") {
        outputString = outputBuffers.join("");
      } else {
        outputString = Buffer.concat(outputBuffers as Buffer[])
          .toString(opts.encoding);
      }
    }
    if (opts.expected instanceof RegExp) {
      expect(outputString).toMatch(opts.expected);
    } else if (typeof opts.expected === "string") {
      expect(outputString).toBe(opts.expected);
    }
    return outputString;
  } catch (er) {
    isER(er);
    er.message = `${peggyPath} ${opts.args ? opts.args.map(a => JSON.stringify(a)).join(" ") : "with no args"}\n${er.message}`;
    if (opts.stdin) {
      er.message = `printf ${JSON.stringify(opts.stdin)} | ${er.message}`;
    }

    throw er;
  }
}

function forkExec(opts: Options = {}): Promise<string> {
  opts = {
    args: [],
    encoding: "utf8",
    env: {},
    ...opts,
  };
  return new Promise((resolve, reject) => {
    let bin = path.join(__dirname, "..", "..", "bin", "peggy.js");
    const env = {
      ...process.env,
      ...opts.env,
    };

    // On Windows, use "node" to launch, rather than relying on shebang. In
    // real-world usage, `npm install` will also write a .cmd file so "node"
    // isn't required.
    const args = opts.args ? opts.args : [];
    if (process.platform === "win32") {
      args.unshift(bin);
      [bin] = process.argv;
    }

    const c = spawn(bin, args, {
      cwd: __dirname,
      stdio: "pipe",
      env,
    });
    c.on("error", reject);
    const bufs: Buffer[] = [];
    c.stdout.on("data", b => bufs.push(b));
    c.stderr.on("data", b => bufs.push(b));
    c.on("close", code => {
      const buf = Buffer.concat(bufs);
      const str = buf.toString(opts.encoding);
      if (code) {
        const err = new ExecError(`process fail, "${bin}"`, code, str, buf);
        reject(err);
      } else {
        resolve(str);
      }
    });
    if (opts.stdin) {
      c.stdin.write(opts.stdin);
    }
    c.stdin.end();
  });
}

/**
 * Helper for testing source-map support.
 *
 * @param sourceMap Path to the file with source map. That file shouldn't exist
 *        before calling this function
 * @param args CLI arguments
 * @param error If specified, CLI should ends with an error that contains that text,
 *        and error code was 2, otherwise CLI should ends with success. In any case
 *        source map should be generated and contain a valid source map
 */
async function checkSourceMap(
  sourceMap: string,
  args: string[],
  error?: string
): Promise<void> {
  expect(() => {
    // Make sure the file isn't there before we start
    fs.statSync(sourceMap);
    console.log(`Delete file: "${sourceMap}"`);
  }).toThrow();

  await exec({
    args,
    stdin: "foo = '1' { return 42; }",
    exitCode: error ? 2 : undefined,
    error,
  });

  expect(await fs.promises.stat(sourceMap)).toBeInstanceOf(fs.Stats);

  await expect(new SourceMapConsumer(
    await fs.promises.readFile(sourceMap, { encoding: "utf8" })
  )).resolves.toBeInstanceOf(SourceMapConsumer);

  await fs.promises.unlink(sourceMap);
}

describe("MockStream", () => {
  it("Accepts input larger than highwaterMark", async() => {
    const s = new MockStream({ highWaterMark: 1 });
    const recv: Buffer[] = [];
    // Note: before adding this callback, the write's below would block
    // unless the highwaterMark above was changed to 3 or more.
    s.on("data", d => recv.push(d));

    // This should be promisify<string>, but TS can't figure out how to
    // use the correct overload.
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- Workaround
    const write = promisify<string, void>(s.write.bind(s));
    await write("ab");
    await write("c");
    expect(Buffer.concat(recv).toString()).toBe("abc");
  });
});

describe("Command Line Interface", () => {
  it("has help", async() => {
    const HELP = `\
Usage: peggy [options] [input_file...]

Arguments:
  input_file                       Grammar file(s) to read.  Use "-" to read
                                   stdin.  If multiple files are given, they
                                   are combined in the given order to produce a
                                   single output.  Use
                                   npm:"<packageName>/file.peggy" to import
                                   from an npm dependency. (default: ["-"])

Options:
  -v, --version                    output the version number
  --allowed-start-rules <rules>    Comma-separated list of rules the generated
                                   parser will be allowed to start parsing
                                   from.  Use '*' if you want any rule to be
                                   allowed as a start rule.  (Can be specified
                                   multiple times) (default: the first rule in
                                   the grammar)
  --ast                            Output a grammar AST instead of a parser
                                   code (default: false)
  --cache                          Make generated parser cache results
                                   (default: false)
  -d, --dependency <dependency>    Comma-separated list of dependencies, either
                                   as a module name, or as \`variable:module\`.
                                   (Can be specified multiple times)
  -D, --dependencies <json>        Dependencies, in JSON object format with
                                   variable:module pairs. (Can be specified
                                   multiple times).
  --dts                            Create a .d.ts to describe the generated
                                   parser.
  -e, --export-var <variable>      Name of a global variable into which the
                                   parser object is assigned to when no module
                                   loader is detected.
  --extra-options <options>        Additional options (in JSON format as an
                                   object) to pass to peggy.generate
  -c, --extra-options-file <file>  File with additional options (in JSON as an
                                   object or commonjs module format) to pass to
                                   peggy.generate
  --format <format>                Format of the generated parser (choices:
                                   "amd", "bare", "commonjs", "es", "globals",
                                   "umd", default: "commonjs")
  -o, --output <file>              Output file for generated parser. Use '-'
                                   for stdout (the default is a file next to
                                   the input file with the extension change to
                                   '.js', unless a test is specified, in which
                                   case no parser is output without this
                                   option)
  --plugin <module>                Comma-separated list of plugins. (can be
                                   specified multiple times)
  -m, --source-map [mapfile]       Generate a source map. If name is not
                                   specified, the source map will be named
                                   "<input_file>.map" if input is a file and
                                   "source.map" if input is a standard input.
                                   If the special filename \`inline\` is given,
                                   the sourcemap will be embedded in the output
                                   file as a data URI.  If the filename is
                                   prefixed with \`hidden:\`, no mapping URL will
                                   be included so that the mapping can be
                                   specified with an HTTP SourceMap: header.
                                   This option conflicts with the \`-t/--test\`
                                   and \`-T/--test-file\` options unless
                                   \`-o/--output\` is also specified
  --return-types <typeInfo>        Types returned for rules, as JSON object of
                                   the form {"ruleName": "type"}
  -S, --start-rule <rule>          When testing, use the given rule as the
                                   start rule.  If this rule is not in the
                                   allowed start rules, it will be added.
  -t, --test <text>                Test the parser with the given text,
                                   outputting the result of running the parser
                                   instead of the parser itself. If the input
                                   to be tested is not parsed, the CLI will
                                   exit with code 2
  -T, --test-file <filename>       Test the parser with the contents of the
                                   given file, outputting the result of running
                                   the parser instead of the parser itself. If
                                   the input to be tested is not parsed, the
                                   CLI will exit with code 2. A filename of '-'
                                   will read from stdin.
  --trace                          Enable tracing in generated parser (default:
                                   false)
  -w,--watch                       Watch the input file for changes, generating
                                   the output once at the start, and again
                                   whenever the file changes.
  -h, --help                       display help for command
`;

    await exec({
      args: ["-h", "--testingHelp"],
      error: CommanderError,
      errorCode: "commander.helpDisplayed",
      exitCode: 0, // This is the commander default
      expected: HELP,
    });
    await exec({
      args: ["--help", "--testingHelp"],
      error: CommanderError,
      errorCode: "commander.helpDisplayed",
      exitCode: 0, // This is the commander default
      expected: HELP,
    });
    await expect(forkExec({
      args: ["--help", "--testingHelp"],
    })).resolves.toBe(HELP);
  });

  it("rejects invalid options", async() => {
    await exec({
      args: ["--invalid-option"],
      error: CommanderError,
      errorCode: "commander.unknownOption",
      exitCode: 1,
    });
  });

  it("handles start rules", async() => {
    await exec({
      args: ["--allowed-start-rules", "foo,bar,baz"],
      stdin: foobarbaz,
      expected: /startRuleFunctions = { foo: [^, ]+, bar: [^, ]+, baz: \S+ }/,
    });

    await exec({
      args: [
        "--allowed-start-rules", "foo",
        "--allowed-start-rules", "bar",
        "--extra-options", '{"allowedStartRules": ["baz"]}',
      ],
      stdin: foobarbaz,
      expected: /startRuleFunctions = { foo: [^, ]+, bar: [^, ]+, baz: \S+ }/,
    });

    await exec({
      args: ["--allowed-start-rules"],
      stdin: "foo = '1'",
      errorCode: "commander.optionMissingArgument",
      exitCode: 1,
      error: "option '--allowed-start-rules <rules>' argument missing",
    });
  });

  it("enables caching", async() => {
    await exec({
      args: ["--cache"],
      stdin: "foo = '1'",
      expected: /^\s*var peg\$resultsCache/m,
    });
  });

  it("prints version", async() => {
    await exec({
      args: ["--version"],
      errorCode: "commander.version",
      exitCode: 0, // This is the commander default
      error: peggy.VERSION,
    });
    await exec({
      args: ["-v"],
      errorCode: "commander.version",
      exitCode: 0, // This is the commander default
      error: peggy.VERSION,
    });
  });

  it("handles dependencies", async() => {
    await exec({
      args: ["-d", "c:commander", "-d", "jest"],
      stdin: "foo = '1' { return new c.Command(); }",
      expected: /c = require\("commander"\)/,
    });

    await exec({
      args: ["-d", "c:commander,jest"],
      stdin: "foo = '1' { return new c.Command(); }",
      expected: /jest = require\("jest"\)/,
    });

    await exec({
      args: ["--dependency"],
      stdin: "foo = '1' { return new c.Command(); }",
      errorCode: "commander.optionMissingArgument",
      exitCode: 1,
      error: "option '-d, --dependency <dependency>' argument missing",
    });

    await exec({
      args: ["-d", "c:commander", "--format", "globals"],
      stdin: "foo = '1' { return new c.Command(); }",
      errorCode: "peggy.invalidArgument",
      exitCode: 1,
      error: "Can't use the -d/--dependency or -D/--dependencies options with the \"globals\" module format.",
    });

    await exec({
      args: ["-D", '{"c": "commander", "jest": "jest"}'],
      stdin: "foo = '1' { return new c.Command(); }",
      expected: /c = require\("commander"\)/,
    });

    await exec({
      args: ["-D", '{"c": "commander", "jest": "jest"}', "--format", "amd"],
      stdin: "foo = '1' { return new c.Command(); }",
      expected: /define\(\["commander", "jest"\]/,
    });

    await exec({
      args: ["-D", '{"c": "commander", "jest": "jest"}', "--format", "umd", "-e", "foo"],
      stdin: "foo = '1' { return new c.Command(); }",
      expected: /define\(\["commander", "jest"\]/,
    });

    await exec({
      args: ["-D", '{"c": "commander"}', "-d", "c:jest"],
      stdin: "foo = '1' { return c.run(); }",
      expected: /c = require\("jest"\)/,
    });

    await exec({
      args: [
        "-D", '{"c": "commander"}',
        "--extra-options", '{"dependencies": {"c": "jest"}}',
      ],
      stdin: "foo = '1' { return c.run(); }",
      expected: /c = require\("jest"\)/,
    });

    await exec({
      args: ["-D", "{{{"],
      stdin: "foo = '1' { return new c.Command(); }",
      errorCode: "commander.invalidArgument",
      exitCode: 1,
      error: "Error parsing JSON",
    });
  });

  it("handles exportVar", async() => {
    await exec({
      args: ["--format", "globals", "-e", "football"],
      stdin: "foo = '1'",
      expected: /^\s*root\.football = /m,
    });

    await exec({
      args: ["--format", "globals"],
      stdin: "foo = '1'",
      exitCode: 1,
      expected: "Error parsing grammar\nNo export variable defined for format 'globals'.\n",
    });

    await exec({
      args: ["--export-var"],
      stdin: "foo = '1'",
      errorCode: "commander.optionMissingArgument",
      exitCode: 1,
      error: "option '-e, --export-var <variable>' argument missing",
    });

    await exec({
      args: ["--export-var", "football"],
      stdin: "foo = '1'",
      errorCode: "peggy.invalidArgument",
      exitCode: 1,
      error: "Can't use the -e/--export-var option with the \"commonjs\" module format.",
    });
  });

  it("handles extra options", async() => {
    await exec({
      args: ["-d", "fs", "--extra-options", '{"format": "amd"}'],
      stdin: 'foo = "1"',
      expected: /^define\(/m,
    });

    await exec({
      args: ["--extra-options"],
      stdin: 'foo = "1"',
      errorCode: "commander.optionMissingArgument",
      exitCode: 1,
      error: "--extra-options <options>' argument missing",
    });

    await exec({
      args: ["--extra-options", "{"],
      stdin: 'foo = "1"',
      errorCode: "commander.invalidArgument",
      exitCode: 1,
      error: "Error parsing JSON:",
    });

    await exec({
      args: ["--extra-options", "1"],
      stdin: 'foo = "1"',
      errorCode: "commander.invalidArgument",
      exitCode: 1,
      error: "The JSON with extra options has to represent an object.",
    });
  });

  it("handles extra options in a file", async() => {
    const optFile = path.join(fixtures, "options.json");
    const optFileJS = path.join(fixtures, "options.js");
    const optFileMJS = path.join(fixtures, "options.mjs");

    const res = await exec({
      args: ["--extra-options-file", optFile],
      stdin: foobarbaz,
      expected: /startRuleFunctions = { foo: [^, ]+, bar: [^, ]+, baz: \S+ }/,
    });
    expect(res).toMatch("(function(root, factory) {");

    await exec({
      args: ["--extra-options-file", optFileJS],
      stdin: foobarbaz,
      expected: /startRuleFunctions = { foo: [^, ]+, bar: [^, ]+, baz: \S+ }/,
    });

    // Intentional overwrite
    await exec({
      args: ["-c", optFile, "--format", "amd"],
      stdin: foobarbaz,
      expected: /^define\(/m,
    });

    await exec({
      args: ["-c", optFileJS],
      stdin: "foo = zazzy:'1'",
      errorCode: "peggy.cli",
      exitCode: 1,
      error: 'Error: Label can\'t be a reserved word "zazzy"',
    });

    await exec({
      args: ["-c", optFileMJS],
      stdin: "foo = zazzy:'1'",
      errorCode: "peggy.cli",
      exitCode: 1,
      error: 'Error: Label can\'t be a reserved word "zazzy"',
    });

    await exec({
      args: ["-c", optFile, "____ERROR____FILE_DOES_NOT_EXIST"],
      stdin: "foo = '1'",
      errorCode: "peggy.cli",
      exitCode: 1,
      error: "Error reading input \"____ERROR____FILE_DOES_NOT_EXIST\"",
    });

    await exec({
      args: ["--extra-options-file"],
      stdin: 'foo = "1"',
      errorCode: "commander.optionMissingArgument",
      exitCode: 1,
      error: "--extra-options-file <file>' argument missing",
    });

    await exec({
      args: ["--extra-options-file", "____ERROR____FILE_DOES_NOT_EXIST"],
      stdin: 'foo = "1"',
      error: CommanderError,
      exitCode: 1,
      expected: /Error reading/,
    });

    await exec({
      args: ["--extra-options-file", "____ERROR____FILE_DOES_NOT_EXIST.js"],
      stdin: 'foo = "1"',
      error: CommanderError,
      exitCode: 1,
      expected: /Error importing config/,
    });
  });

  it("handles formats", async() => {
    await exec({
      args: ["--format"],
      errorCode: "commander.optionMissingArgument",
      exitCode: 1,
      error: "option '--format <format>' argument missing",
    });

    await exec({
      args: ["--format", "BAD_FORMAT"],
      errorCode: "commander.invalidArgument",
      exitCode: 1,
      error: "option '--format <format>' argument 'BAD_FORMAT' is invalid. Allowed choices are amd, bare, commonjs, es, globals, umd.",
    });
  });

  describe("--ast option", () => {
    it("conflicts with --test/--test-file/--source-map", async() => {
      await exec({
        args: ["--ast", "--test", "1"],
        stdin: 'foo = "1"',
        error: CommanderError,
        errorCode: "commander.conflictingOption",
        exitCode: 1,
        expected: "error: option '--ast' cannot be used with option '-t, --test <text>'\n",
      });
      await exec({
        args: ["--ast", "--test-file", "file"],
        stdin: 'foo = "1"',
        error: CommanderError,
        errorCode: "commander.conflictingOption",
        exitCode: 1,
        expected: "error: option '--ast' cannot be used with option '-T, --test-file <filename>'\n",
      });
      await exec({
        args: ["--ast", "--source-map"],
        stdin: 'foo = "1"',
        error: CommanderError,
        errorCode: "commander.conflictingOption",
        exitCode: 1,
        expected: "error: option '--ast' cannot be used with option '-m, --source-map [mapfile]'\n",
      });
      await exec({
        args: ["--ast", "--source-map", "file"],
        stdin: 'foo = "1"',
        error: CommanderError,
        errorCode: "commander.conflictingOption",
        exitCode: 1,
        expected: "error: option '--ast' cannot be used with option '-m, --source-map [mapfile]'\n",
      });
    });

    it("produces AST", async() => {
      const output = await exec({
        args: ["--ast"],
        stdin: 'foo = "1"',
      });

      // Do not check exact location information and concrete values of some other fields
      expect(JSON.parse(output)).toMatchObject({
        type: "grammar",
        topLevelInitializer: null,
        initializer: null,
        location: {},
        rules: [{
          type: "rule",
          name: "foo",
          location: {},
          expression: {
            type: "literal",
            value: "1",
            ignoreCase: false,
            location: {},
          },
        }],
        code: expect.anything(),
      });
    });
  });

  it("outputs to a file", async() => {
    const test_output = "test_output.js";

    expect(() => {
      // Make sure the file isn't there before we start
      fs.statSync(test_output);
    }).toThrow();

    await exec({
      args: ["-o", test_output],
      stdin: "foo = '1'",
      expected: null,
    });

    expect(fs.statSync(test_output)).toBeInstanceOf(fs.Stats);
    fs.unlinkSync(test_output);

    await exec({
      args: ["-o", "create/new/dir/output.js"],
      stdin: "foo = '1'",
      expected: null,
    });
    expect(fs.statSync("create/new/dir/output.js")).toBeInstanceOf(fs.Stats);
    await fs.promises.rm("create", { recursive: true });

    await exec({
      args: ["--output"],
      stdin: "foo = '1'",
      errorCode: "commander.optionMissingArgument",
      exitCode: 1,
      error: "-o, --output <file>' argument missing",
    });

    await exec({
      args: ["--output", `${fixtures}/imp.peggy/none.js`],
      stdin: "foo = '1'",
      errorCode: "peggy.cli",
      exitCode: 1,
      error: "Error opening output stream",
    });
  });

  it("handles plugins", async() => {
    // Plugin, starting with "./"
    const plugin = path.join(fixtures, "plugin.js");
    const pluginMjs = path.join(fixtures, "plugin.mjs");
    const plugin2Mjs = path.join(fixtures, "plugin2.mjs");
    const pluginCjs = path.join(fixtures, "plugin.cjs");
    const bad = path.join(fixtures, "bad.js");
    const optFileJS = path.join(fixtures, "options.js");

    await exec({
      args: [
        "--plugin", plugin,
        "--extra-options", '{"cli_test": {"words": ["foo"]}}',
        "-t", "1",
      ],
      stdin: "var = bar:'1'",
      expected: "'1'\n",
    });

    await exec({
      args: [
        "--plugin", pluginMjs,
        "--extra-options", '{"cli_test": {"words": ["foo"]}}',
        "-t", "1",
      ],
      stdin: "var = bar:'1'",
      expected: "'1'\n",
    });

    await exec({
      args: [
        "--plugin", plugin2Mjs,
        "--extra-options", '{"cli_test": {"words": ["foo"]}}',
        "-t", "1",
      ],
      stdin: "var = bar:'1'",
      expected: "'1'\n",
    });

    await exec({
      args: [
        "--plugin", pluginCjs,
        "--extra-options", '{"cli_test": {"words": ["foo"]}}',
        "-t", "1",
      ],
      stdin: "var = bar:'1'",
      expected: "'1'\n",
    });

    await exec({
      args: [
        "--plugin", `${plugin},${plugin}`,
        "--extra-options", '{"cli_test": {"words": ["foo"]}}',
        "-t", "1",
      ],
      stdin: "var = bar:'1'",
      expected: "'1'\n",
    });

    await exec({
      args: [
        "--plugin", plugin,
        "--extra-options", '{"cli_test": {"words": ["foo"]}}',
      ],
      stdin: "var = foo:'1'",
      errorCode: "peggy.cli",
      exitCode: 1,
      error: "Label can't be a reserved word \"foo\"",
    });

    await exec({
      args: ["--plugin"],
      stdin: "foo = '1'",
      errorCode: "commander.optionMissingArgument",
      exitCode: 1,
      error: "--plugin <module>' argument missing",
    });

    await exec({
      args: ["--plugin", "ERROR BAD MODULE DOES NOT EXIST"],
      stdin: "foo = '1'",
      errorCode: "peggy.invalidArgument",
      exitCode: 1,
      error: /Error importing/,
    });

    await exec({
      args: ["--plugin", optFileJS],
      stdin: "foo = '1'",
      errorCode: "peggy.invalidArgument",
      exitCode: 1,
      error: "no `use()` function",
    });

    await exec({
      args: ["--plugin", bad],
      stdin: "foo = '1'",
      errorCode: "peggy.invalidArgument",
      exitCode: 1,
      error: "Unexpected token",
    });

    // Warnings
    await exec({
      args: [
        "--plugin", plugin,
        "--extra-options", '{"cli_test": { "warning": true }}',
      ],
      stdin: "foo = '1'",
      expected: /WARN\(check\): I WARN YOU/,
    });
  });

  it("handlers trace", async() => {
    await expect(exec({
      args: ["--trace"],
      stdin: "foo = '1'",
    })).resolves.toMatch("DefaultTracer: peg$DefaultTracer");
  });

  it("handles multiple files", async() => {
    const input1 = path.join(__dirname, "fixtures", "imports1.peggy");
    const input2 = path.join(__dirname, "fixtures", "imports2.peggy");
    const out = path.join(__dirname, "fixtures", "imports1.js");

    await expect(exec({
      args: [input1, input2],
      exitCode: 0,
    })).resolves.toBe("");
    fs.unlinkSync(out);

    await expect(exec({
      args: ["--extra-options", `{"input": [${JSON.stringify(input1)}, ${JSON.stringify(input2)}]}`],
      exitCode: 0,
    })).resolves.toBe("");
    fs.unlinkSync(out);
  });

  it("handles npm: sources", async() => {
    let input1 = path.join(__dirname, "fixtures", "useFrags", "identifier.peggy");
    let out = path.join(__dirname, "fixtures", "useFrags", "identifier.js");
    await expect(exec({
      args: ["--format", "es", input1, "npm:frags/unicode.peggy"],
      exitCode: 0,
    })).resolves.toBe("");

    fs.unlinkSync(out);

    input1 = path.join(__dirname, "fixtures", "useFrags", "fs.peggy");
    out = path.join(__dirname, "fixtures", "useFrags", "fs.js");
    await expect(exec({
      args: ["--format", "es", input1, "npm:frags/path.peggy"],
      exitCode: 0,
    })).resolves.toBe("");

    fs.unlinkSync(out);

    out = path.join(__dirname, "..", "..", "path.js");
    await expect(exec({
      args: ["--format", "es", "npm:frags/path.peggy"],

      exitCode: 0,
    })).resolves.toBe("");

    fs.unlinkSync(out);
  });

  describe("handles source map", () => {
    describe("with default name without --output", () => {
      const sourceMap = path.resolve(__dirname, "..", "..", "source.map");

      it("generates a source map 1", async() => {
        await checkSourceMap(sourceMap, ["--source-map"]);
        await checkSourceMap(sourceMap, ["-m"]);
      });

      it("emits an error if used with --test/--test-file", async() => {
        expect(() => {
          // Make sure the file isn't there before we start
          fs.statSync(sourceMap);
        }).toThrow();

        await expect(exec({
          args: ["-t", "1", "--source-map"],
          stdin: "foo = '1' { return 42; }",
        })).rejects.toThrow("Generation of the source map is not useful if you don't output a parser file, perhaps you forgot to add an `-o/--output` option?");
        expect(() => {
          // Make sure the file isn't there
          fs.statSync(sourceMap);
        }).toThrow();

        await expect(exec({
          args: ["-t", "1", "-m"],
          stdin: "foo = '1' { return 42; }",
        })).rejects.toThrow("Generation of the source map is not useful if you don't output a parser file, perhaps you forgot to add an `-o/--output` option?");
        expect(() => {
          // Make sure the file isn't there
          fs.statSync(sourceMap);
        }).toThrow();
      });
    });

    describe("with default name with --output", () => {
      const FILENAME = "output-with-default-map.js";
      const testOutput = path.resolve(__dirname, FILENAME);
      const sourceMap = path.resolve(__dirname, `${FILENAME}.map`);

      it("generates a source map 2", async() => {
        expect(() => {
          // Make sure the file isn't there before we start
          fs.statSync(testOutput);
          console.log(`Delete "${testOutput}"`);
        }).toThrow();

        await checkSourceMap(sourceMap, ["--output", testOutput, "--source-map"]);
        expect(fs.statSync(testOutput)).toBeInstanceOf(fs.Stats);
        fs.unlinkSync(testOutput);

        await checkSourceMap(sourceMap, ["--output", testOutput, "-m"]);
        expect(fs.statSync(testOutput)).toBeInstanceOf(fs.Stats);
        fs.unlinkSync(testOutput);
      });

      it("worked together with --test/--test-file", async() => {
        expect(() => {
          // Make sure the file isn't there before we start
          fs.statSync(testOutput);
        }).toThrow();

        await checkSourceMap(sourceMap, ["-o", testOutput, "-t", "1", "--source-map"]);
        expect(fs.statSync(testOutput)).toBeInstanceOf(fs.Stats);
        fs.unlinkSync(testOutput);

        await checkSourceMap(sourceMap, ["-o", testOutput, "-t", "1", "-m"]);
        expect(fs.statSync(testOutput)).toBeInstanceOf(fs.Stats);
        fs.unlinkSync(testOutput);

        await checkSourceMap(
          sourceMap,
          ["-o", testOutput, "-t", "2", "--source-map"],
          'Error: Expected "1" but "2" found'
        );
        expect(fs.statSync(testOutput)).toBeInstanceOf(fs.Stats);
        fs.unlinkSync(testOutput);

        await checkSourceMap(
          sourceMap,
          ["-o", testOutput, "-t", "2", "-m"],
          'Error: Expected "1" but "2" found'
        );
        expect(fs.statSync(testOutput)).toBeInstanceOf(fs.Stats);
        fs.unlinkSync(testOutput);

        const testFile = path.join(tmpDir, "testFile");
        await fs.promises.writeFile(testFile, "2");
        await checkSourceMap(
          sourceMap,
          ["-o", testOutput, "-T", testFile, "-m"],
          'Error: Expected "1" but "2" found'
        );
        await fs.promises.rm(testFile);

        expect(fs.statSync(testOutput)).toBeInstanceOf(fs.Stats);
        fs.unlinkSync(testOutput);
      });

      it("emits an error with hidden:inline", async() => {
        await expect(exec({
          args: ["-m", "hidden:inline", "-o", testOutput],
          stdin: "foo = '1' { return 42; }",
          errorCode: "peggy.invalidArgument",
          exitCode: 1,
          error: "hidden + inline sourceMap makes no sense.",
        }));
      });

      it("hides sourceMap with hidden:", async() => {
        await checkSourceMap(
          sourceMap,
          ["-o", testOutput, "-m", "hidden:" + sourceMap]
        );
        expect(fs.statSync(testOutput)).toBeInstanceOf(fs.Stats);
        const output = fs.readFileSync(testOutput, "utf8");
        expect(output).not.toMatch(/# sourceMappingURL=/);
        fs.unlinkSync(testOutput);
      });
    });

    describe("with specified name", () => {
      const sourceMap = path.resolve(__dirname, "specified-name.map");

      it("generates a source map 3", async() => {
        await exec({
          args: ["--source-map", `${fixtures}/imp.peggy/none.js.map`],
          stdin: "foo = '1' { return 42; }",
          exitCode: 1,
          errorCode: "peggy.cli",
          error: "Error writing sourceMap",
        });

        await checkSourceMap(sourceMap, ["--source-map", sourceMap]);
        await checkSourceMap(sourceMap, ["-m", sourceMap]);
      });

      it("emits an error if used with --test/--test-file", async() => {
        expect(() => {
          // Make sure the file isn't there before we start
          fs.statSync(sourceMap);
        }).toThrow();

        await expect(exec({
          args: ["-t", "1", "--source-map", sourceMap],
          stdin: "foo = '1' { return 42; }",
        })).rejects.toThrow("Generation of the source map is not useful if you don't output a parser file, perhaps you forgot to add an `-o/--output` option?");
        expect(() => {
          // Make sure the file isn't there
          fs.statSync(sourceMap);
        }).toThrow();

        await expect(exec({
          args: ["-t", "1", "-m", sourceMap],
          stdin: "foo = '1' { return 42; }",
        })).rejects.toThrow("Generation of the source map is not useful if you don't output a parser file, perhaps you forgot to add an `-o/--output` option?");
        expect(() => {
          // Make sure the file isn't there
          fs.statSync(sourceMap);
        }).toThrow();
      });
    });

    describe("with inline map", () => {
      it("generates map inline", async() => {
        await exec({
          args: ["-m", "inline"],
          stdin: "foo = '1'",
          expected: /^\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,./m,
        });
      });
    });
  });

  it("uses dash-dash", async() => {
    await exec({
      args: ["--", "--trace"],
      errorCode: "peggy.cli",
      exitCode: 1,
      error: /no such file or directory, open '[^']*--trace'/,
    });
  });

  it("handles input tests", async() => {
    await exec({
      args: ["-t", "boo"],
      stdin: "foo = 'boo'",
      expected: "'boo'\n",
    });

    // Start rule
    await exec({
      args: ["-t", "2", "-S", "bar"],
      stdin: `\
foo='1' { throw new Error('bar') }
bar = '2'
`,
      expected: "'2'\n",
    });

    await exec({
      args: ["-T", packageJson, grammarFile],
      expected: /name: 'peggy',$/m, // Output is JS, not JSON
    });

    await exec({
      args: [grammarFile, "-T", "-"],
      stdin: '{"foo": null}',
      expected: "{ foo: null }\n", // Still JS, not JSON
    });

    await exec({
      args: ["-T", "____ERROR____FILE_DOES_NOT_EXIST.js", grammarFile],
      errorCode: "peggy.cli",
      exitCode: 2,
      error: "Error running test",
    });

    await exec({
      args: ["-t", "boo", "-T", "foo"],
      errorCode: "commander.conflictingOption",
      exitCode: 1,
      error: "error: option '-T, --test-file <filename>' cannot be used with option '-t, --test <text>'",
    });

    await exec({
      args: ["-t", "2"],
      stdin: "foo='1'",
      errorCode: "peggy.cli",
      exitCode: 2,
      error: 'Expected "1" but "2" found',
    });

    await exec({
      args: ["-t", "1"],
      stdin: "foo='1' { throw new Error('bar') }",
      errorCode: "peggy.cli",
      exitCode: 2,
      error: "Error running test",
    });

    await exec({
      args: ["-t", "1", "--verbose"],
      stdin: "foo='1' { throw new Error('bar') }",
      errorCode: "peggy.cli",
      exitCode: 2,
      error: "Error running test",
    });

    // Abusing template literals to ensure we have a trailing space.
    await exec({
      args: ["-t", ""],
      stdin: "foo='1'",
      errorCode: "peggy.cli",
      exitCode: 2,
      error: `\
Error running test
Error: Expected "1" but end of input found.
 --> command line:1:1
  |
1 |${" "}
  | ^`,
    });
  });

  it("handles stdout errors", async() => {
    const stderr = new MockStream({ name: "stderr", encoding: "utf8" });
    const stdout = new MockStream({
      name: "stdout",
      errorsToThrow: [new Error("Bad write")],
      encoding: "utf8",
    });
    stdout.on("error", () => {
      // No-op, to prevent uncaught error.
    });

    await exec({
      stdin: "foo='1'",
      stdout,
      stderr,
      exitCode: 1,
      errorCode: "peggy.cli",
      error: "Bad write",
    });
  });

  it("handles tests that require other modules", async() => {
    const grammar = path.join(__dirname, "fixtures", "req.peggy");
    await exec({
      args: ["-t", "1", grammar],
      expected: "[ 'zazzy' ]\n",
    });
  });

  it("handles tests that import other modules", async() => {
    if ((await import("vm")).SourceTextModule) {
      const grammar = path.join(__dirname, "fixtures", "imp.peggy");
      try {
        await exec({
          args: ["--format", "es", "-t", "1", grammar],
          expected: "[ [ 'zazzy' ], [ 'zazzy' ], true ]\n",
        });
      } catch (e) {
        expect((e as Error).message).toMatch("Requires node.js 20.8+ or 21");
      }
      await exec({
        args: ["--format", "amd", "-t", "1", grammar],
        error: /Unsupported output format/,
      });
      await exec({
        args: ["--format", "globals", "-e", "foo", "-t", "1", grammar],
        error: /Unsupported output format/,
      });
      await exec({
        args: ["--format", "bare", "-t", "1"],
        stdin: "foo = '1'\n",
        expected: "'1'\n",
      });
    } else {
      throw new Error("Use --experimental-vm-modules");
    }
  });

  it("handles grammar errors", async() => {
    await exec({
      stdin: "foo=unknownRule",
      errorCode: "peggy.cli",
      exitCode: 1,
      error: `\
Error parsing grammar
error: Rule "unknownRule" is not defined
 --> stdin:1:5
  |
1 | foo=unknownRule
  |     ^^^^^^^^^^^`,
    });
  });

  it("handles imports", async() => {
    const lib = path.join(__dirname, "fixtures", "lib.peggy");
    const imps = path.join(__dirname, "fixtures", "imports_peggy.peggy");
    const impjs = path.join(__dirname, "fixtures", "imports_peggy.js");

    await exec({
      args: [lib, "--allowed-start-rules", "*"],
    });
    await exec({
      args: [imps],
    });

    const { parse } = await import(impjs);
    expect(parse("baz")).toBe("baz");

    await exec({
      args: [imps, "--format", "globals"],
      exitCode: 1,
      expected: "Error parsing grammar\nDependencies not supported in format 'globals'.\n",
    });

    await exec({
      args: [imps, "--format", "bare"],
      exitCode: 1,
      expected: "Error parsing grammar\nDependencies not supported in format 'bare'.\n",
    });

    await exec({
      args: [imps, "--format", "amd"],
      exitCode: 1,
      expected: "Error parsing grammar\nImports are not supported in format 'amd'.\n",
    });

    await exec({
      args: [imps, "--format", "umd"],
      exitCode: 1,
      expected: "Error parsing grammar\nImports are not supported in format 'umd'.\n",
    });
  });

  it("produces library-style output", async() => {
    await exec({
      args: ["-t", "boo", "--library"],
      stdin: "foo = 'boo'",
      expected: `\
{
  'peg$result': 'boo',
  'peg$currPos': 3,
  'peg$FAILED': {},
  'peg$maxFailExpected': [],
  'peg$maxFailPos': 0
}\n`,
    });
  });

  describe("--watch option", () => {
    it("rejects stdin for watching", async() => {
      await exec({
        args: ["-w"],
        errorCode: "peggy.invalidArgument",
      });

      await exec({
        args: ["--watch", "-"],
        errorCode: "peggy.invalidArgument",
      });
    });

    it("errors when stopWatching is invalid", async() => {
      const cli = new PeggyCLI();
      await expect(cli.stopWatching()).rejects.toThrow();
    });

    it("handles grammar errors but keeps going", async() => {
      const bad = path.join(__dirname, "fixtures", "bad.js");

      let count = 0;
      await exec({
        args: ["-w", bad],
        exitCode: 0,
        onstderr(_s, cli) {
          // This is brittle.  Stderr gets the "file added" message, then
          // the error, then a newline.
          if (++count === 4) {
            cli.stopWatching();
          }
        },
      });
    });

    it("watches", async() => {
      const grammar = path.join(__dirname, "fixtures", "simple.peggy");
      let count = 0;
      await exec({
        args: ["-w", grammar],
        exitCode: 0,
        expected: /Wrote:/,
        onstdout(_s, cli) {
          if (++count === 3) {
            cli.stopWatching();
          }
        },
      });
    });

    it("watches with tests", async() => {
      const grammar = path.join(__dirname, "fixtures", "simple.peggy");
      let count = 0;
      await exec({
        args: ["-w", "-t", "1", grammar],
        exitCode: 0,
        onstdout(_s, cli) {
          if (++count === 2) {
            cli.stopWatching();
          }
        },
      });
    });

    it("watches with test file", async() => {
      const grammar = path.join(__dirname, "fixtures", "simple.peggy");
      const testFile = path.join(__dirname, "fixtures", "simple.txt");
      let count = 0;
      await exec({
        args: ["-w", "-T", testFile, grammar],
        exitCode: 0,
        onstdout(_s, cli) {
          if (++count === 2) {
            cli.stopWatching();
          }
        },
      });
    });

    it("handles watcher errors", async() => {
      const grammar = path.join(__dirname, "fixtures", "simple.peggy");
      let count = 0;
      await exec({
        args: ["-w", grammar],
        error: "Fake error",
        onstdout(_s, cli) {
          if (++count === 3) {
            cli.watcher?.watchers[0].emit("error", new Error("Fake error"));
          }
        },
      });
    });

    afterAll(() => {
      const out = path.join(__dirname, "fixtures", "simple.js");
      fs.unlinkSync(out);
    });
  });

  it("throws on parse now", () => {
    const cli = new PeggyCLI();

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(() => cli.parse([])).toThrow();
  });

  describe(".d.ts", () => {
    const opts = path.join(__dirname, "fixtures", "options.mjs");
    const grammar = path.join(__dirname, "fixtures", "simple.peggy");
    const grammarJS = path.join(__dirname, "fixtures", "simple.js");
    const grammarDTS = path.join(__dirname, "fixtures", "simple.d.ts");

    beforeAll(() => {
      fs.unlink(grammarJS, () => {
        // Ignored
      });
      fs.unlink(grammarDTS, () => {
        // Ignored
      });
    });

    it("creates .d.ts files", async() => {
      await exec({
        args: ["--dts", grammar],
        exitCode: 0,
      });
      const dts = await fs.promises.readFile(grammarDTS, "utf8");
      expect(dts).toMatch(/: any;\n$/);
    });

    it("uses returnTypes", async() => {
      await exec({
        args: ["--dts", "-c", opts, grammar],
        exitCode: 0,
      });
      const dts = await fs.promises.readFile(grammarDTS, "utf8");
      expect(dts).toMatch(/: string;\n$/);
    });

    it("generates overloads for allowed-start-rules='*'", async() => {
      await exec({
        args: ["--dts", "-c", opts, "--allowed-start-rules", "*", grammar],
        exitCode: 0,
      });
      const dts = await fs.promises.readFile(grammarDTS, "utf8");
      expect(dts).toMatch(/: string;\n$/);
    });

    it("errors with dts for stdin", async() => {
      await exec({
        args: ["--dts"],
        stdin: "foo = '1'",
        exitCode: 1,
        error: /Must supply output file with --dts/,
      });
    });

    afterAll(() => {
      fs.unlink(grammarJS, () => {
        // Ignored
      });
      fs.unlink(grammarDTS, () => {
        // Ignored
      });
    });
  });
});
