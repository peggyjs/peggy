"use strict";

function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }
exports.hex = hex;

function stringEscape(s) {
  // ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
  // literal except for the closing quote character, backslash, carriage
  // return, line separator, paragraph separator, and line feed. Any character
  // may appear in the form of an escape sequence.
  //
  // For portability, we also escape all control and non-ASCII characters.
  return s
    .replace(/\\/g,   "\\\\")   // Backslash
    .replace(/"/g,    "\\\"")   // Closing double quote
    .replace(/\0/g,   "\\0")    // Null
    .replace(/\x08/g, "\\b")    // Backspace
    .replace(/\t/g,   "\\t")    // Horizontal tab
    .replace(/\n/g,   "\\n")    // Line feed
    .replace(/\v/g,   "\\v")    // Vertical tab
    .replace(/\f/g,   "\\f")    // Form feed
    .replace(/\r/g,   "\\r")    // Carriage return
    .replace(/[\x00-\x0F]/g,          ch => "\\x0" + hex(ch))
    .replace(/[\x10-\x1F\x7F-\xFF]/g, ch => "\\x"  + hex(ch))
    .replace(/[\u0100-\u0FFF]/g,      ch => "\\u0" + hex(ch))
    .replace(/[\u1000-\uFFFF]/g,      ch => "\\u"  + hex(ch));
}
exports.stringEscape = stringEscape;

function regexpClassEscape(s) {
  // Based on ECMA-262, 5th ed., 7.8.5 & 15.10.1.
  //
  // For portability, we also escape all control and non-ASCII characters.
  return s
    .replace(/\\/g,   "\\\\")   // Backslash
    .replace(/\//g,   "\\/")    // Closing slash
    .replace(/]/g,    "\\]")    // Closing bracket
    .replace(/\^/g,   "\\^")    // Caret
    .replace(/-/g,    "\\-")    // Dash
    .replace(/\0/g,   "\\0")    // Null
    .replace(/\x08/g, "\\b")    // Backspace
    .replace(/\t/g,   "\\t")    // Horizontal tab
    .replace(/\n/g,   "\\n")    // Line feed
    .replace(/\v/g,   "\\v")    // Vertical tab
    .replace(/\f/g,   "\\f")    // Form feed
    .replace(/\r/g,   "\\r")    // Carriage return
    .replace(/[\x00-\x0F]/g,          ch => "\\x0" + hex(ch))
    .replace(/[\x10-\x1F\x7F-\xFF]/g, ch => "\\x"  + hex(ch))
    .replace(/[\u0100-\u0FFF]/g,      ch => "\\u0" + hex(ch))
    .replace(/[\u1000-\uFFFF]/g,      ch => "\\u"  + hex(ch));
}
exports.regexpClassEscape = regexpClassEscape;

/**
 * Base64 encode a Uint8Array.  Needed for browser compatibility where
 * the Buffer class is not available.
 *
 * @param {Uint8Array} u8 Bytes to encode
 * @returns {string} Base64 encoded string
 */
function base64(u8) {
  // Note: btoa has the worst API, and even mentioning Buffer here will
  // cause rollup to suck it in.

  // See RFC4648, sec. 4.
  // https://datatracker.ietf.org/doc/html/rfc4648#section-4
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const rem = u8.length % 3;
  const len = u8.length - rem;
  let res = "";

  for (let i = 0; i < len; i += 3) {
    res += A[u8[i] >> 2];
    res += A[((u8[i] & 0x3) << 4) | (u8[i + 1] >> 4)];
    res += A[((u8[i + 1] & 0xf) << 2) | (u8[i + 2] >> 6)];
    res += A[u8[i + 2] & 0x3f];
  }
  if (rem === 1) {
    res += A[u8[len] >> 2];
    res += A[(u8[len] & 0x3) << 4];
    res += "==";
  } else if (rem === 2) {
    res += A[u8[len] >> 2];
    res += A[((u8[len] & 0x3) << 4) | (u8[len + 1] >> 4)];
    res += A[(u8[len + 1] & 0xf) << 2];
    res += "=";
  }

  return res;
}
exports.base64 = base64;
