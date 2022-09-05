import LZString from "../vendor/lz-string/lz-string.js";

/**
 * @typedef {Object} SandboxState
 * @property {string} grammar
 * @property {string} input
 */

// The key used to store the sandbox in local/session storage
export const stateStorageKey = `sandbox-code`;

/**
 * @param {SandboxState} state
 */
export const saveSandboxCodeToStorage = (state) => {
  localStorage.setItem(stateStorageKey, JSON.stringify(state));
};

// The example grammar to use when there is no saved code in the URL or local storage
export const exampleGrammar = `
// Simple Arithmetics Grammar
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

export const exampleInput = `2 * (3 + 4)`;

/**
 * @param {URL} url
 * @returns {SandboxState}
 */
export function getSandboxInitialState(url) {
  if (url.hash.startsWith("#state/")) {
    const state = url.hash.substring(7);
    const decodedState = JSON.parse(
      LZString.decompressFromEncodedURIComponent(state)
    );
    return decodedState;
  }

  const storedStateRaw = localStorage.getItem(stateStorageKey);
  if (storedStateRaw !== null) {
    /** @type {SandboxState} */
    const storedState = JSON.parse(localStorage.getItem(stateStorageKey));
    return storedState;
  }

  return {
    grammar: exampleGrammar,
    input: exampleInput,
  };
}

/**
 * @param {SandboxState} state
 * @param {URL | string | undefined} baseUrl
 * @returns {string}
 */
export function getEncodedSandboxUrl(state, baseUrl = undefined) {
  const encodedState = LZString.compressToEncodedURIComponent(
    JSON.stringify(state)
  );
  if (baseUrl) {
    return `${
      typeof baseUrl === "string" ? baseUrl : baseUrl.toString()
    }#state/${encodedState}`;
  } else {
    return `#state/${encodedState}`;
  }
}
