import "./lib.js" // Just initializers
import {} from "./lib.js" // Just initializers
import bar from "./lib.js" // Default rule
import {baz} from "./lib.js" // One rule imported into this namespace
import {
  boo, bab,
} from "../fixtures/lib.js"
import * as faz from "./lib.js"
import b1, * as b2 from "./lib.js"
import b3, { boo as b4 } from "./lib.js";
import { boo as b5 } from "./lib.js";
import { "floo" as b6 } from "./lib.js";

a
  = bar
  / baz
  / boo
  / bab
  / faz.fazboo
  / b1
  / b2.b2boo
  / b3
  / b4
  / b5
  / b6
