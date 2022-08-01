import {
  getSandboxInitialContents,
  exampleGrammar,
  codeStorageKey,
} from "../js/sandbox";

// Jest can implement localStorage using jsdom, but that is way overkill
// for this simple test suite, so we'll just use a simple in-memory
// mock implementation of local storage for now.
class LocalStorageMock {
  store: Record<string, string> = {};

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
    const url = new URL("https://peggyjs.org/");
    expect(getSandboxInitialContents(url)).toEqual(exampleGrammar);
  });
  it("returns stored grammar when it is in local storage", () => {
    localStorage.setItem(codeStorageKey, "stored grammar");
    const url = new URL("https://peggyjs.org/");
    expect(getSandboxInitialContents(url)).toEqual("stored grammar");
  });
  it("returns grammar stored in URL", () => {
    const url = new URL(
      "https://peggyjs.org/online#code/OYJwhgthYgBAzgFwPYgKYBNYEsB2sBVAJQBkg"
    );
    expect(getSandboxInitialContents(url)).toEqual("grammar stored in URL");
  });
  it("returns grammar in URL over stored grammar", () => {
    const url = new URL(
      "https://peggyjs.org/online#code/OYJwhgthYgBAzgFwPYgKYBNYEsB2sBVAJQBkg"
    );
    localStorage.setItem(codeStorageKey, "stored grammar");
    expect(getSandboxInitialContents(url)).toEqual("grammar stored in URL");
  });
});
