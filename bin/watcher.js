"use strict";

const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

// This may have to be tweaked based on experience.
const DEBOUNCE_MS = 100;
const CLOSING = Symbol("CLOSING");
const ERROR = Symbol("ERROR");

/**
 * Relatively feature-free file watcher that deals with some of the
 * idiosyncrasies of fs.watch.  On some OS's, change notifications are doubled
 * up.  Watch the owning directory instead of the file, so that when the file
 * doesn't exist then gets created we get a change notification instead of an
 * error.  When the file is moved in or out of the directory, don't track the
 * inode of the original file.  No notification is given on file deletion,
 * just when the file is ready to be read.
 */
class Watcher extends EventEmitter {
  /**
   * Creates an instance of Watcher.  This only works for files in a small
   * number of directories.
   *
   * @param {string[]} filenames The files to watch.  Should be one or more
   *   strings, each of which is the name of a plain file, not a directory,
   *   pipe, etc.
   */
  constructor(...filenames) {
    super();

    const resolved = new Set(filenames.map(fn => path.resolve(fn)));
    const dirs = new Set([...resolved].map(fn => path.dirname(fn)));

    this.timeout = null;
    this.watchers = [];

    for (const dir of dirs) {
      // eslint-disable-next-line func-style -- Needs "this"
      const changed = (_typ, fn) => {
        if (typeof this.timeout === "symbol") {
          return;
        }
        const filename = path.join(dir, fn);
        // Might be a different file changing in one of the target dirs
        if (resolved.has(filename)) {
          if (!this.timeout) {
            fs.stat(filename, (er, stats) => {
              if (!er && stats.isFile()) {
                this.emit("change", filename, stats);
              }
            });
          } else {
            clearTimeout(this.timeout);
          }

          // De-bounce, across all files
          this.timeout = setTimeout(() => {
            this.timeout = null;
          }, Watcher.interval);
        }
      };

      const w = fs.watch(dir);
      w.on("error", er => {
        const t = this.timeout;
        this.timeout = ERROR;
        if (t && (typeof t !== "symbol")) {
          clearTimeout(t);
        }
        this.emit("error", er);
        this.close();
      });
      w.on("change", changed);
      this.watchers.push(w);
    }

    // Fire initial time if file exists.
    setImmediate(() => {
      if (this.watchers.length > 0) {
        // First watcher will correspond to the directory of the first filename.
        const w = this.watchers[0];
        w.emit("change", "initial", path.basename([...resolved][0]));
      }
    });
  }

  /**
   * Close the watcher.  Safe to call multiple times.
   *
   * @returns {Promise<void>} Always resolves.
   */
  close() {
    // Stop any more events from firing, immediately
    const t = this.timeout;

    if (t) {
      if (typeof t !== "symbol") {
        this.timeout = CLOSING;
        clearTimeout(t);
      }
    }

    const p = [];
    for (const w of this.watchers) {
      p.push(new Promise(resolve => {
        w.once("close", resolve);
      }));
      w.close();
    }
    return Promise.all(p).then(() => {
      this.watchers = [];
      if (t !== ERROR) {
        this.emit("close");
      }
    });
  }
}

Watcher.interval = DEBOUNCE_MS;
module.exports = Watcher;
