const LZString = require("../vendor/lz-string/lz-string");

// The key used to store the sandbox in local/session storage
const codeStorageKey = `sandbox-code`;

// The example grammar to use when there is no saved code in the URL or local storage
const exampleGrammar = `
// ==========================
//
// Accepts expressions like "2 * (3 + 4)" and computes their value.

Expression
  = head:Term tail:(_ ("+" / "-") _ Term)* {
      return tail.reduce(function(result, element) {
        if (element[1] === "+") { return result + element[3]; }
        if (element[1] === "-") { return result - element[3]; }
      }, head);
    }

Term
  = head:Factor tail:(_ ("*" / "/") _ Factor)* {
      return tail.reduce(function(result, element) {
        if (element[1] === "*") { return result * element[3]; }
        if (element[1] === "/") { return result / element[3]; }
      }, head);
    }

Factor
  = "(" _ expr:Expression _ ")" { return expr; }
  / Integer

Integer "integer"
  = _ [0-9]+ { return parseInt(text(), 10); }

_ "whitespace"
  = [ \\t\\n\\r]*
`;

/**
 * @param {URL} url
 * @returns {string | null}
 */
function getSandboxInitialContents(url) {
  if (url.hash.startsWith("#code/")) {
    const code = url.hash.substring(6);
    const decodedCode = LZString.decompressFromEncodedURIComponent(code);
    return decodedCode;
  }

  const storedCode = localStorage.getItem(codeStorageKey);
  if (storedCode) {
    return storedCode;
  }

  return exampleGrammar;
}

/**
 * @param {string} code
 * @param {URL | string | undefined} baseUrl
 * @returns {string}
 */
function getEncodedSandboxUrl(code, baseUrl = undefined) {
  const encodedCode = LZString.compressToEncodedURIComponent(code);
  if (baseUrl) {
    return `${
      typeof baseUrl === "string" ? baseUrl : baseUrl.toString()
    }#code/${encodedCode}`;
  } else {
    return `#code/${encodedCode}`;
  }
}

module.exports = {
  getSandboxInitialContents,
  getEncodedSandboxUrl,
  exampleGrammar,
  codeStorageKey,
};
