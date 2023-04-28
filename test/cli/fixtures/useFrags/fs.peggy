{{
  // From fs.peggy
  import {readFileSync as rfs1} from "fs";

  const FS = "fs";
}}

{
  // From fs.peggy
  const pk = JSON.parse(rfs1('package.json', 'utf8'));
  console.log({name: pk.name})
}

pkg
  = p:$.* &{ return p === pk.name }
  / pth
