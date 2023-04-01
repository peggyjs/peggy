{{
import opts from "./options.mjs";
// Cause importModuleDynamically to fire
const opts2 = await import("./options.mjs");
}}

foo='1' { return [
  opts.cli_test.words,
  opts2.default.cli_test.words,
  // Needs to use import.meta to cause initializeImportMeta to fire.
  import.meta.url.length > 0
]; }
