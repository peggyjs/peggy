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
    const bin = path.join(__dirname, "..", "..", "bin", "peggy.js");
    const env = {
      ...process.env,
      ...opts.env,
    };
    const c = spawn(bin, opts.args, {
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
Usage: peggy [options] [--] [<input_file>]

Options:
      --allowed-start-rules <rules>  comma-separated list of rules the generated
                                     parser will be allowed to start parsing
                                     from (default: the first rule in the
                                     grammar)
      --cache                        make generated parser cache results
  -d, --dependency <dependency>      use specified dependency (can be specified
                                     multiple times)
  -e, --export-var <variable>        name of a global variable into which the
                                     parser object is assigned to when no module
                                     loader is detected
      --extra-options <options>      additional options (in JSON format) to pass
                                     to peg.generate
      --extra-options-file <file>    file with additional options (in JSON
                                     format) to pass to peg.generate
      --format <format>              format of the generated parser: amd,
                                     commonjs, globals, umd (default: commonjs)
  -h, --help                         print help and exit
  -o, --output <file>                output file
      --plugin <plugin>              use a specified plugin (can be specified
                                     multiple times)
      --trace                        enable tracing in generated parser
  -v, --version                      print version information and exit
`;

    expect(await exec({
      args: ["-h"],
    })).toBe(HELP);
    expect(await exec({
      args: ["--help"],
    })).toBe(HELP);
  });

  it("rejects invalid options", async() => {
    await expect(exec({
      args: ["--invalid-option"],
    })).rejects.toThrow(ExecError);
  });

  it("handles start rules", async() => {
    await expect(exec({
      args: ["--allowed-start-rules", "foo,bar,baz"],
      stdin: `\
foo = "1"
bar = "2"
baz = "3"
`,
    })).resolves.toMatch(
      /startRuleFunctions = { foo: [^, ]+, bar: [^, ]+, baz: \S+ }/
    );

    await expect(exec({
      args: ["--allowed-start-rules"],
      stdin: "foo = '1'",
    })).rejects.toThrow("Missing parameter of the --allowed-start-rules option");
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
      args: ["--dependency"],
      stdin: "foo = '1' { return new c.Command(); }",
    })).rejects.toThrow("Missing parameter of the -d/--dependency option.");

    await expect(exec({
      args: ["-d", "c:commander", "--format", "globals"],
      stdin: "foo = '1' { return new c.Command(); }",
    })).rejects.toThrow("Can't use the -d/--dependency option with the \"globals\" module format.");
  });

  it("handles exportVar", async() => {
    await expect(exec({
      args: ["--format", "globals", "-e", "football"],
      stdin: "foo = '1'",
    })).resolves.toMatch(/^\s*root\.football = /m);

    await expect(exec({
      args: ["--export-var"],
      stdin: "foo = '1'",
    })).rejects.toThrow("Missing parameter of the -e/--export-var option.");

    await expect(exec({
      args: ["--export-var", "football"],
      stdin: "foo = '1'",
    })).rejects.toThrow("Can't use the -e/--export-var option with the \"commonjs\" module format.");
  });

  it("handles extra options", async() => {
    await expect(exec({
      args: ["--extra-options", '{"format": "amd"}'],
      stdin: 'foo = "1"',
    })).resolves.toMatch(/^define\(/m);

    await expect(exec({
      args: ["--extra-options"],
      stdin: 'foo = "1"',
    })).rejects.toThrow("Missing parameter of the --extra-options option.");

    await expect(exec({
      args: ["--extra-options", "{"],
      stdin: 'foo = "1"',
    })).rejects.toThrow("Error parsing JSON:");

    await expect(exec({
      args: ["--extra-options", "1"],
      stdin: 'foo = "1"',
    })).rejects.toThrow("The JSON with extra options has to represent an object.");
  });

  it("handles extra options in a file", async() => {
    const optFile = path.join(__dirname, "fixtures", "options.json");
    await expect(exec({
      args: ["--extra-options-file", optFile],
      stdin: "foo = '1'",
    })).resolves.toMatch(
      /startRuleFunctions = { foo: [^, ]+, bar: [^, ]+, baz: \S+ }/
    );

    await expect(exec({
      args: ["--extra-options-file"],
      stdin: 'foo = "1"',
    })).rejects.toThrow("Missing parameter of the --extra-options-file option.");

    await expect(exec({
      args: ["--extra-options-file", "____ERROR____FILE_DOES_NOT_EXIST"],
      stdin: 'foo = "1"',
    })).rejects.toThrow("Can't read from file");
  });

  it("handles formats", async() => {
    await expect(exec({
      args: ["--format"],
    })).rejects.toThrow("Missing parameter of the --format option.");

    await expect(exec({
      args: ["--format", "BAD_FORMAT"],
    })).rejects.toThrow("Module format must be one of");
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

    await expect(exec({
      args: ["-O"],
      stdin: 'foo = "1"',
    })).rejects.toThrow("Missing parameter of the -O/--optimize option.");
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

    await expect(exec({
      args: ["--output"],
      stdin: "foo = '1'",
    })).rejects.toThrow("Missing parameter of the -o/--output option.");

    await expect(exec({
      args: ["--output", "__DIRECTORY__/__DOES/NOT__/__EXIST__/none.js"],
      stdin: "foo = '1'",
    })).rejects.toThrow("Can't write to file \"__DIRECTORY__/__DOES/NOT__/__EXIST__/none.js\"");
  });

  it("handles plugins", async() => {
    // Plugin, starting with "./"
    const plugin = "./" + path.relative(
      process.cwd(),
      path.resolve(__dirname, "./fixtures/plugin.js")
    );

    await expect(exec({
      args: [
        "--plugin", plugin,
        "--extra-options", '{"cli_test": {"words": ["foo"]}}',
      ],
      stdin: "var = foo:'1'",
    })).rejects.toThrow("Label can't be a reserved word \"foo\"");

    await expect(exec({
      args: ["--plugin"],
      stdin: "foo = '1'",
    })).rejects.toThrow("Missing parameter of the --plugin option.");

    await expect(exec({
      args: ["--plugin", "ERROR BAD MODULE DOES NOT EXIST"],
      stdin: "foo = '1'",
    })).rejects.toThrow("Can't load module \"ERROR BAD MODULE DOES NOT EXIST\"");
  });

  it("handlers trace", async() => {
    await expect(exec({
      args: ["--trace"],
      stdin: "foo = '1'",
    })).resolves.toMatch("DefaultTracer: peg$DefaultTracer");
  });

  it("uses dash-dash", async() => {
    await expect(exec({
      args: ["--", "--trace"],
    })).rejects.toThrow("no such file or directory, open '--trace'");

    await expect(exec({
      args: ["--", "--trace", "--format"],
    })).rejects.toThrow("Too many arguments.");
  });
});
