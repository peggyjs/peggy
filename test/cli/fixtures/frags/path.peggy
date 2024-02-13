{{
  // From path.peggy
  import path from "path";

  const PATH = "path";
}}

{
  const PATH2 = "path2";
}

pth = p:$.* &{ return p === path.resolve(p) }
