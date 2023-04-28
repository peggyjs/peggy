JSSource = imports:ImportDeclarations code:BareCodeBlock {
  return [imports, {
    type: "top_level_initializer",
    code: code[0],
    codeLocation: code[1],
  }];
}

ImportDeclarations
  = code:$ImportDeclaration* {
    return {
      type: "top_level_initializer",
      code,
      codeLocation: location()
    };
  }

ImportDeclaration
  = __ "import" __ ImportClause __ FromClause __ ";"?
  / __ "import" __ ModuleSpecifier __ ";"?

ImportClause
  = ImportedDefaultBinding
  / NameSpaceImport
  / NamedImports
  / ImportedDefaultBinding __ "," __ (NameSpaceImport / NamedImports)

ImportedDefaultBinding = ImportedBinding
NameSpaceImport = "*" __ "as" __ ImportedBinding
NamedImports
  = "{" __ "}"
  / "{" __ ImportsList __ ","? __ "}"
FromClause = "from" __ ModuleSpecifier
ImportsList = ImportSpecifier|1.., __ "," __|
ImportSpecifier
  = ModuleExportName __ "as" __ ImportedBinding
  / ImportedBinding
ModuleSpecifier = StringLiteral
ImportedBinding
  = BindingIdentifier

ModuleExportName
  =  IdentifierName
  / StringLiteral

BindingIdentifier = id:IdentifierName &{
  return reservedWords.indexOf(id[0]) === -1
}
