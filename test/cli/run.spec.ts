// This is typescript so that it only runs in node contexts, not on the web

import * as peggy from "../../lib/peg.js";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

type Options = {
  args?: string[];
  encoding?: BufferEncoding;
  env?: Record<string, string>;
  stdin?: string | Buffer;
};

const foobarbaz = `\
foo = '1'
bar = '2'
baz = '3'
`;

/** Execution failed */
class ExecError extends Error {
  /** Result error code, always non-zero */
  code: number;

  /** Stdout as a Buffer */
  buf: Buffer;

  /** Stdout as a string, decoded with opts.encoding */
  str: string;

  constructor(message: string, code: number, buf: Buffer, str: string) {
    super(`${message}: error code "${code}"
${str}`);
    this.name = "ExecError";
    Object.setPrototypeOf(this, ExecError.prototype);
    this.code = code;
    this.buf = buf;
    this.str = str;
  }
}

function exec(opts: Options = {}) {
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
        const err = new ExecError(`process fail, "${bin}"`, code, buf, str);
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

describe("Command Line Interface", () => {
  it("has help", async() => {
    const HELP = `\
Usage: peggy [options] [input_file]

Options:
  -v, --version                    output the version number
  --allowed-start-rules <rules>    Comma-separated list of rules the generated
                                   parser will be allowed to start parsing
                                   from.  (Can be specified multiple times)
                                   (default: the first rule in the grammar)
  --cache                          Make generated parser cache results
  -d, --dependency <dependency>    Comma-separated list of dependencies, either
                                   as a module name, or as \`variable:module\`.
                                   (Can be specified multiple times)
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
                                   for stdout (the default, unless a test is
                                   specified, in which case no parser is output
                                   without this option)
  --plugin <module>                Comma-separated list of plugins. (can be
                                   specified multiple times)
  -t, --test <text>                Test the parser with the given text,
                                   outputting the result of running the parser
                                   instead of the parser itself. If the input
                                   to be tested is not parsed, the CLI will
                                   exit with code 2
  -T, --test-file <filename>       Test the parser with the contents of the
                                   given file, outputting the result of running
                                   the parser instead of the parser itself. If
                                   the input to be tested is not parsed, the
                                   CLI will exit with code 2
  --trace                          Enable tracing in generated parser
  -h, --help                       display help for command
`;

    await expect(await exec({
      args: ["-h"],
    })).toBe(HELP);
    await expect(await exec({
      args: ["--help"],
    })).toBe(HELP);
  });

  it("rejects invalid options", async() => {
    const result = expect(exec({
      args: ["--invalid-option"],
    }));
    await result.rejects.toThrow(ExecError);
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("handles start rules", async() => {
    await expect(exec({
      args: ["--allowed-start-rules", "foo,bar,baz"],
      stdin: foobarbaz,
    })).resolves.toMatch(
      /startRuleFunctions = { foo: [^, ]+, bar: [^, ]+, baz: \S+ }/
    );

    const result = expect(exec({
      args: ["--allowed-start-rules"],
      stdin: "foo = '1'",
    }));
    await result.rejects.toThrow("option '--allowed-start-rules <rules>' argument missing");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("enables caching", async() => {
    await expect(exec({
      args: ["--cache"],
      stdin: "foo = '1'",
    })).resolves.toMatch(/^\s*var peg\$resultsCache/m);
  });

  it("prints version", async() => {
    await expect(exec({
      args: ["--version"],
    })).resolves.toMatch(peggy.VERSION);
    await expect(exec({
      args: ["-v"],
    })).resolves.toMatch(peggy.VERSION);
  });

  it("handles dependencies", async() => {
    await expect(exec({
      args: ["-d", "c:commander", "-d", "jest"],
      stdin: "foo = '1' { return new c.Command(); }",
    })).resolves.toMatch(/c = require\("commander"\)/);

    await expect(exec({
      args: ["-d", "c:commander,jest"],
      stdin: "foo = '1' { return new c.Command(); }",
    })).resolves.toMatch(/jest = require\("jest"\)/);

    let result = expect(exec({
      args: ["--dependency"],
      stdin: "foo = '1' { return new c.Command(); }",
    }));
    await result.rejects.toThrow("option '-d, --dependency <dependency>' argument missing");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["-d", "c:commander", "--format", "globals"],
      stdin: "foo = '1' { return new c.Command(); }",
    }));
    await result.rejects.toThrow("Can't use the -d/--dependency option with the \"globals\" module format.");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("handles exportVar", async() => {
    await expect(exec({
      args: ["--format", "globals", "-e", "football"],
      stdin: "foo = '1'",
    })).resolves.toMatch(/^\s*root\.football = /m);

    let result = expect(exec({
      args: ["--export-var"],
      stdin: "foo = '1'",
    }));
    await result.rejects.toThrow("option '-e, --export-var <variable>' argument missing");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["--export-var", "football"],
      stdin: "foo = '1'",
    }));
    await result.rejects.toThrow("Can't use the -e/--export-var option with the \"commonjs\" module format.");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("handles extra options", async() => {
    await expect(exec({
      args: ["--extra-options", '{"format": "amd"}'],
      stdin: 'foo = "1"',
    })).resolves.toMatch(/^define\(/m);

    let result = expect(exec({
      args: ["--extra-options"],
      stdin: 'foo = "1"',
    }));
    await result.rejects.toThrow("--extra-options <options>' argument missing");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["--extra-options", "{"],
      stdin: 'foo = "1"',
    }));
    await result.rejects.toThrow("Error parsing JSON:");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["--extra-options", "1"],
      stdin: 'foo = "1"',
    }));
    await result.rejects.toThrow("The JSON with extra options has to represent an object.");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("handles extra options in a file", async() => {
    const optFile = path.join(__dirname, "fixtures", "options.json");
    const optFileJS = path.join(__dirname, "fixtures", "options.js");

    const res = await exec({
      args: ["--extra-options-file", optFile],
      stdin: foobarbaz,
    });
    expect(res).toMatch(
      /startRuleFunctions = { foo: [^, ]+, bar: [^, ]+, baz: \S+ }/
    );
    expect(res).toMatch("(function(root, factory) {");

    // Intentional overwrite
    await expect(exec({
      args: ["-c", optFile, "--format", "amd"],
      stdin: foobarbaz,
    })).resolves.toMatch(/^define\(/m);

    let result = expect(exec({
      args: ["-c", optFileJS],
      stdin: "foo = zazzy:'1'",
    }));
    await result.rejects.toThrow("Error: Label can't be a reserved word \"zazzy\"");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["-c", optFile, "____ERROR____FILE_DOES_NOT_EXIST"],
      stdin: "foo = '1'",
    }));
    await result.rejects.toThrow("Do not specify input both on command line and in config file.");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["--extra-options-file"],
      stdin: 'foo = "1"',
    }));
    await result.rejects.toThrow("--extra-options-file <file>' argument missing");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["--extra-options-file", "____ERROR____FILE_DOES_NOT_EXIST"],
      stdin: 'foo = "1"',
    }));
    await result.rejects.toThrow("Can't read from file");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("handles formats", async() => {
    let result = expect(exec({
      args: ["--format"],
    }));
    await result.rejects.toThrow("option '--format <format>' argument missing");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["--format", "BAD_FORMAT"],
    }));
    await result.rejects.toThrow("option '--format <format>' argument 'BAD_FORMAT' is invalid. Allowed choices are amd, bare, commonjs, es, globals, umd.");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("doesn't fail with optimize", async() => {
    await expect(exec({
      args: ["--optimize", "anything"],
      stdin: 'foo = "1"',
    })).resolves.toMatch(/deprecated/);

    await expect(exec({
      args: ["-O", "anything"],
      stdin: 'foo = "1"',
    })).resolves.toMatch(/deprecated/);

    const result = expect(exec({
      args: ["-O"],
      stdin: 'foo = "1"',
    }));
    await result.rejects.toThrow("-O, --optimize <style>' argument missing");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("outputs to a file", async() => {
    const test_output = path.resolve(__dirname, "test_output.js");

    expect(() => {
      // Make sure the file isn't there before we start
      fs.statSync(test_output);
    }).toThrow();

    await expect(exec({
      args: ["-o", test_output],
      stdin: "foo = '1'",
    })).resolves.toBe("");
    expect(fs.statSync(test_output)).toBeInstanceOf(fs.Stats);
    fs.unlinkSync(test_output);

    let result = expect(exec({
      args: ["--output"],
      stdin: "foo = '1'",
    }));
    await result.rejects.toThrow("-o, --output <file>' argument missing");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["--output", "__DIRECTORY__/__DOES/NOT__/__EXIST__/none.js"],
      stdin: "foo = '1'",
    }));
    await result.rejects.toThrow("Can't write to file \"__DIRECTORY__/__DOES/NOT__/__EXIST__/none.js\"");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("handles plugins", async() => {
    // Plugin, starting with "./"
    const plugin = "./fixtures/plugin.js";
    const bad = "./fixtures/bad.js";

    await expect(exec({
      args: [
        "--plugin", plugin,
        "--extra-options", '{"cli_test": {"words": ["foo"]}}',
        "-t", "1",
      ],
      stdin: "var = bar:'1'",
    })).resolves.toMatch("'1'");

    await expect(exec({
      args: [
        "--plugin", `${plugin},${plugin}`,
        "--extra-options", '{"cli_test": {"words": ["foo"]}}',
        "-t", "1",
      ],
      stdin: "var = bar:'1'",
    })).resolves.toMatch("'1'");

    let result = expect(exec({
      args: [
        "--plugin", plugin,
        "--extra-options", '{"cli_test": {"words": ["foo"]}}',
      ],
      stdin: "var = foo:'1'",
    }));
    await result.rejects.toThrow("Label can't be a reserved word \"foo\"");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["--plugin"],
      stdin: "foo = '1'",
    }));
    await result.rejects.toThrow("--plugin <module>' argument missing");

    result = expect(exec({
      args: ["--plugin", "ERROR BAD MODULE DOES NOT EXIST"],
      stdin: "foo = '1'",
    }));
    await result.rejects.toThrow("Can't load module \"ERROR BAD MODULE DOES NOT EXIST\"");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["--plugin", bad],
      stdin: "foo = '1'",
    }));
    await result.rejects.toThrow("SyntaxError");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("handlers trace", async() => {
    await expect(exec({
      args: ["--trace"],
      stdin: "foo = '1'",
    })).resolves.toMatch("DefaultTracer: peg$DefaultTracer");
  });

  it("uses dash-dash", async() => {
    let result = expect(exec({
      args: ["--", "--trace"],
    }));
    await result.rejects.toThrow(
      /no such file or directory, open '[^']*--trace'/
    );
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["--", "--trace", "--format"],
    }));
    await result.rejects.toThrow("Too many arguments.");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));
  });

  it("handles input tests", async() => {
    await expect(exec({
      args: ["-t", "boo"],
      stdin: "foo = 'boo'",
    })).resolves.toMatch("'boo'");

    const grammarFile = path.join(__dirname, "..", "..", "examples", "json.pegjs");
    const testFile = path.join(__dirname, "..", "..", "package.json");

    await expect(exec({
      args: ["-T", testFile, grammarFile],
    })).resolves.toMatch("name: 'peggy'"); // Output is JS, not JSON

    let result = expect(exec({
      args: ["-T", "____ERROR____FILE_DOES_NOT_EXIST.js", grammarFile],
    }));
    await result.rejects.toThrow("Can't read from file \"____ERROR____FILE_DOES_NOT_EXIST.js\".");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["-t", "boo", "-T", "foo"],
    }));
    await result.rejects.toThrow("The -t/--test and -T/--test-file options are mutually exclusive.");
    await result.rejects.toThrow(expect.objectContaining({ code: 1 }));

    result = expect(exec({
      args: ["-t", "2"],
      stdin: "foo='1'",
    }));
    await result.rejects.toThrow('Expected "1" but "2" found');
    await result.rejects.toThrow(expect.objectContaining({ code: 2 }));

    result = expect(exec({
      args: ["-t", "1"],
      stdin: "foo='1' { throw new Error('bar') }",
    }));
    await result.rejects.toThrow("Error: bar");
    await result.rejects.toThrow(expect.objectContaining({ code: 2 }));

    result = expect(exec({
      args: ["-t", "1", "--verbose"],
      stdin: "foo='1' { throw new Error('bar') }",
    }));
    await result.rejects.toThrow("Error: bar");
    await result.rejects.toThrow(expect.objectContaining({ code: 2 }));
  });
});
