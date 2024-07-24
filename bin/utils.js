"use strict";

/**
 * @fileoverview Utility functions for CLI
 */

const { InvalidArgumentError } = require("commander");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

/**
 * @typedef {import("node:stream").Readable} Readable
 */

/**
 * Realistically, in a catch block, the caught thing is an instance of Error.
 * When errors are thrown from inside a node vm however, `instanceof` doesn't
 * work like we would prefer.  Is "er" sufficiently Error-like?  If not,
 * throw.
 *
 * @param {unknown} er
 * @returns {asserts er is Error}
 */
function isER(er) {
  assert(er);
  assert.equal(typeof er, "object");
  assert(Object.prototype.hasOwnProperty.call(er, "message"));
}

/**
 * Is this error a node ErrnoException?
 *
 * @param {unknown} er
 * @returns {er is NodeJS.ErrnoException}
 */
function isErrno(er) {
  return (Boolean(er)
    && (typeof er === "object")
    && (Object.prototype.hasOwnProperty.call(er, "code")));
}

/**
 * Select certain properties from an object, deleting those properties from
 * the original object as we go.
 *
 * @template {object} T
 * @param {T} obj Object to select from
 * @param {string[]} sel
 * @returns {Pick<T, sel>}
 */
function select(obj, sel) {
  const ret = Object.create(null);
  for (const s of sel) {
    if (Object.prototype.hasOwnProperty.call(obj, s)) {
      // @ts-expect-error Object is not a map
      ret[s] = obj[s];
      // @ts-expect-error Object is not a map
      delete obj[s];
    }
  }
  return ret;
}

/**
 * Add comma-separated values to array.
 *
 * @param {string} val Comma-separated
 * @param {string[]?} prev Previous value
 * @returns {string[]}
 */
function commaArg(val, prev) {
  return (prev || []).concat(val.split(",").map(x => x.trim()));
}

/**
 * Take a blob of JSON-formatted text, parse it, and add it to an existing
 * object.
 *
 * @param {string} val
 * @param {object} [prev = {}]
 * @returns {object}
 */
function moreJSON(val, prev = {}) {
  try {
    const v = JSON.parse(val);
    return Object.assign(prev, v);
  } catch (e) {
    isER(e);
    throw new InvalidArgumentError(
      `Error parsing JSON: ${e.message}`
    );
  }
}

// Files

/**
 * Read a UTF8-encoded binary stream to completion.
 *
 * @param {Readable} inputStream
 * @returns {Promise<string>}
 */
function readStream(inputStream) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const input = [];
    inputStream.on("data", data => { input.push(data); });
    inputStream.on("end", () => resolve(Buffer.concat(input).toString()));
    inputStream.on("error", reject);
  });
}

/**
 * Ensure that a directory exists that will eventually contain a file of a
 * given name.
 *
 * @param {string} filename
 * @returns {Promise<void>}
 */
async function mkFileDir(filename) {
  const dir = path.dirname(filename);
  try {
    const stats = await fs.promises.stat(dir);
    if (!stats.isDirectory()) {
      throw new Error(`"${dir}" exists and is not a directory`);
    }
  } catch (er) {
    if (!isErrno(er) || (er.code !== "ENOENT")) {
      throw er;
    }
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

/**
 * Replace the file extension on a file with the given one.
 *
 * @param {string} filename
 * @param {string} ext
 * @returns {string}
 */
function replaceExt(filename, ext) {
  return filename.slice(
    0,
    filename.length - path.extname(filename).length
  ) + ext;
}

module.exports = {
  commaArg,
  mkFileDir,
  isER,
  isErrno,
  moreJSON,
  readStream,
  replaceExt,
  select,
};
