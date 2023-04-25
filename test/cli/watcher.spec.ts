// This is typescript so that it only runs in node contexts, not on the web

import Watcher from "../../bin/watcher.js";
import path from "path";

describe("watches files", () => {
  it("is safe to close twice", async() => {
    const w = new Watcher(__filename);
    await w.close();
    await w.close();
  });

  it("handles errors", () => {
    const w = new Watcher(__filename);
    const p = new Promise<void>(resolve => {
      w.on("error", () => {
        resolve();
      });
    });
    w.watcher.emit("error", new Error("Fake error"));
    return p;
  });

  it("debounces", done => {
    let count = 0;
    const fn = __filename;
    const base = path.basename(fn);
    const w = new Watcher(fn);
    w.on("change", () => count++);
    w.watcher.emit("change", "rename", base + "_ANOTHER");
    w.watcher.emit("change", "rename", base);
    setTimeout(() => {
      w.watcher.emit("change", "rename", base);
    }, Watcher.interval * 0.25);
    setTimeout(() => {
      expect(count).toBe(1);
      w.close().then(done);
    }, Watcher.interval * 1.25);
  });
});
