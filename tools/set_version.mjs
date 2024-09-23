import fs from "node:fs";
import { packageExtract } from "package-extract";

const output = new URL("../lib/version.js", import.meta.url);

await packageExtract({
  commonJS: true,
  double: true,
  semi: true,
  output,
});

// Update links in docs.  This is why package-extract isn't called directly.
const pkgFile = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(fs.readFileSync(pkgFile));
const index_file = new URL("../docs/index.html", import.meta.url);
const index = fs.readFileSync(
  index_file,
  "utf8"
);

const updated = index.replace(/(https:\/\/unpkg.com\/peggy@)\d+\.\d+\.\d+/, `$1${pkg.version}`);
fs.writeFileSync(index_file, updated, "utf8");
