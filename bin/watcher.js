"use strict";

const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

// This may have to be tweaked based on experience.
const DEBOUNCE_MS = 100;

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
   * Creates an instance of Watcher.
   *
   * @param {string} filename The file to watch.  Should be a plain file,
   *   not a directory, pipe, etc.
   */
  constructor(filename) {
    super();

    const rfile = path.resolve(filename);
    const { dir, base } = path.parse(rfile);
    let timeout = null;

    // eslint-disable-next-line func-style -- Needs this.
    const changed = (typ, fn) => {
      if (fn === base) {
        if (!timeout) {
          fs.stat(rfile, (er, stats) => {
            if (!er && stats.isFile()) {
              this.emit("change", stats);
            }
          });
        } else {
          clearTimeout(timeout);
        }

        // De-bounce
        timeout = setTimeout(() => {
          timeout = null;
        }, Watcher.interval);
      }
    };
    const closed = () => this.emit("close");

    this.watcher = fs.watch(dir);
    this.watcher.on("error", er => {
      this.watcher.off("close", closed);
      this.watcher.once("close", () => this.emit("error", er));
      this.watcher.close();
      this.watcher = null;
    });
    this.watcher.on("close", closed);
    this.watcher.on("change", changed);

    // Fire initial time if file exists.
    setImmediate(() => changed("rename", base));
  }

  /**
   * Close the watcher.  Safe to call multiple times.
   *
   * @returns {Promise<void>} Always resolves.
   */
  close() {
    return new Promise(resolve => {
      if (this.watcher) {
        this.watcher.once("close", resolve);
        this.watcher.close();
      } else {
        resolve();
      }
      this.watcher = null;
    });
  }
}
Watcher.interval = DEBOUNCE_MS;
module.exports = Watcher;
