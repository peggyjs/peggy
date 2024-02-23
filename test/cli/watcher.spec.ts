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
    w.watchers[0].emit("error", new Error("Fake error"));
    return p;
  });

  it("debounces", done => {
    let count = 0;
    const fn = __filename;
    const base = path.basename(fn);
    const w = new Watcher(fn);
    w.on("change", () => count++);
    w.watchers[0].emit("change", "rename", base + "_ANOTHER");
    w.watchers[0].emit("change", "rename", base);
    setTimeout(() => {
      w.watchers[0].emit("change", "rename", base);
    }, Watcher.interval * 0.25);
    setTimeout(() => {
      expect(count).toBe(1);
      w.watchers[0].emit("change", "rename", base);
      setTimeout(() => {
        expect(count).toBe(2);
        w.close().then(done);
      }, Watcher.interval * 0.5);
    }, Watcher.interval * 5);
  });

  it("closes after an error", done => {
    let count = 0;
    const fn = __filename;
    const base = path.basename(fn);
    const w = new Watcher(fn);
    w.on("change", () => count++);
    w.on("error", () => {
      // Ignored
    });
    const firstWatcher = w.watchers[0];
    // Emits error, then closes.  w.timeout = ERROR
    firstWatcher.emit("error", new Error("Fake error"));
    setTimeout(() => {
      // Simulate an out-of-order file change while multiple watchers are
      // closing.
      firstWatcher.emit("change", "rename", base);
    }, Watcher.interval * 0.25);
    setTimeout(() => {
      expect(count).toBe(0);
      done();
    }, Watcher.interval * 0.5);
  });
});
