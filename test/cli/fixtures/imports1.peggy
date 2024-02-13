{{
  // imports1 topLevelInitializer import
  import {
    basename,
    dirname,
    parse
  } from "path"
  // imports1 topLevelInitializer code
  const tli1 = dirname(__filename);
}}

{
  // imports1 initializer
  const pf = path.parse(__filename);
}
full
  = '/'
  / f:('/' segment )+ '/'? { return parse(f) }
