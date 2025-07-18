"use strict";

module.exports = {
  "dep": ["prod", "dev", "packageManager"],
  "reject": [
    "chai", // Moved to es6
    "@types/chai", // Should match chai,
  ],
};
