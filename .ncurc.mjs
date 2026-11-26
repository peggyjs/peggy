import { localCooldown } from "@cto.af/ncurc";

export default {
  "dep": ["prod", "dev", "packageManager"],
  "reject": [
    "chai", // Moved to es6
    "@types/chai", // Should match chai,
    "commander", // Breaks node 22 when updated
  ],
  "cooldown": await localCooldown(),
};
