import {
  exampleGrammar,
  exampleInput,
  getEncodedSandboxUrl,
  getSandboxInitialState,
  saveSandboxCodeToStorage,
} from "../../docs/js/sandbox";

// Jest can implement localStorage using jsdom, but that is way overkill
// for this simple test suite, so we'll just use a simple in-memory
// mock implementation of local storage for now.
class LocalStorageMock {
  store: { [key: string]: string } = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new LocalStorageMock(),
});

describe("getSandboxInitialContents", () => {
  it("returns example grammar when nothing is stored locally or in the URL", () => {
    const url = new URL("https://peggyjs.org/online");
    expect(getSandboxInitialState(url)).toEqual({
      grammar: exampleGrammar,
      input: exampleInput,
    });
  });
  it("returns stored grammar when it is in local storage", () => {
    saveSandboxCodeToStorage({ grammar: "stored grammar", input: "test" });
    const url = new URL("https://peggyjs.org/online");
    expect(getSandboxInitialState(url)).toEqual({
      grammar: "stored grammar",
      input: "test",
    });
  });
  it("returns grammar stored in URL", () => {
    const url = new URL(
      "https://peggyjs.org/online#state/N4Ig5gTghgtjURALnNOCAEBnALgewgFMATDASwDsMBVAJQBkQAaESgBwFcdkQdDcQAXyA"
    );
    expect(getSandboxInitialState(url).grammar).toEqual(
      "grammar stored in URL"
    );
  });
  it("returns grammar in URL over stored grammar", () => {
    const url = new URL(
      "https://peggyjs.org/online#state/N4Ig5gTghgtjURALnNOCAEBnALgewgFMATDASwDsMBVAJQBkQAaESgBwFcdkQdDcQAXyA"
    );
    saveSandboxCodeToStorage({ grammar: "stored grammar", input: "test" });
    expect(getSandboxInitialState(url)).toEqual({
      grammar: "grammar stored in URL",
      input: "test",
    });
  });
});

describe("getEncodedSandboxUrl", () => {
  it("returns just a fragment if there is no base URL", () => {
    const grammar = "grammar stored in URL";
    expect(getEncodedSandboxUrl({ grammar, input: "test" })).toEqual(
      "#state/N4Ig5gTghgtjURALnNOCAEBnALgewgFMATDASwDsMBVAJQBkQAaESgBwFcdkQdDcQAXyA"
    );
  });
  it("prepends base URL if it exists", () => {
    const grammar = "grammar stored in URL";
    const url = "https://peggyjs.org/online";
    expect(getEncodedSandboxUrl({ grammar, input: "test" }, url)).toEqual(
      "https://peggyjs.org/online#state/N4Ig5gTghgtjURALnNOCAEBnALgewgFMATDASwDsMBVAJQBkQAaESgBwFcdkQdDcQAXyA"
    );
  });
  it("works with getSandboxInitialState", () => {
    const baseUrl = new URL("https://peggyjs.org/online");
    const grammar = "grammar which will be stored in URL";
    const url = new URL(
      getEncodedSandboxUrl({ grammar, input: "test" }, baseUrl)
    );
    expect(getSandboxInitialState(url)).toEqual({
      grammar,
      input: "test",
    });
  });
});
