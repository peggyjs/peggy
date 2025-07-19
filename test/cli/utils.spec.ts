import * as path from "node:path";
import { mkFileDir } from "../../bin/utils.js";

describe("cli utilities", () => {
  it("ensureDirectoryExists", async () => {
    await expect(() => mkFileDir(
      path.join(__filename, "BAD_FILE")
    )).rejects.toThrow(/exists and is not a directory/);
  });
});
