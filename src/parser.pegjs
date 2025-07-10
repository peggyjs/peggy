// Peggy Grammar
// ==============
//
// Peggy grammar syntax is designed to be simple, expressive, and similar to
// JavaScript where possible. This means that many rules, especially in the
// lexical part, are based on the grammar from ECMA-262, 5.1 Edition [1]. Some
// are directly taken or adapted from the JavaScript example grammar (see
// examples/javascript.pegjs).
//
// Limitations:
//
//   * Non-BMP characters are completely ignored to avoid surrogate pair
//     handling.
//
//   * One can create identifiers containing illegal characters using Unicode
//     escape sequences. For example, "abcd\u0020efgh" is not a valid
//     identifier, but it is accepted by the parser.
//
// Both limitations could be resolved, but the costs would likely outweigh
// the benefits.
//
// [1] http://www.ecma-international.org/publications/standards/Ecma-262.htm

{{
const OPS_TO_PREFIXED_TYPES = {
  "$": "text",
  "&": "simple_and",
  "!": "simple_not",
};

const OPS_TO_SUFFIXED_TYPES = {
  "?": "optional",
  "*": "zero_or_more",
  "+": "one_or_more",
};

const OPS_TO_SEMANTIC_PREDICATE_TYPES = {
  "&": "semantic_and",
  "!": "semantic_not",
};
}}
{
  const reservedWords = new Set(options.reservedWords);
}
// ---- Syntactic Grammar -----

Grammar
  = imports:ImportDeclarations topLevelInitializer:(__ @TopLevelInitializer)? initializer:(__ @Initializer)? __ rules:(@Rule __)+ {
      return {
        type: "grammar",
        imports,
        topLevelInitializer,
        initializer,
        rules,
        location: location(),
      };
    }

// Alternate entry point to split JS into imports and not-imports.
ImportsAndSource
  = imports:ImportsAsText body:GrammarBody {
      return [imports, body];
    }

// Everything after the imports.
GrammarBody
  = code:$.* {
      return {
        type: "top_level_initializer",
        code,
        codeLocation: location(),
      };
    }

ImportsAsText
  = code:$ImportDeclarations {
      return {
        type: "top_level_initializer",
        code,
        codeLocation: location(),
      };
    }

ImportDeclarations
  = ImportDeclaration*

ImportDeclaration
  = __ "import" __ what:ImportClause __ from:FromClause (__ ";")? {
      return {
        type: "grammar_import", what, from, location: location(),
      };
    }
  / __ "import" __ from:ModuleSpecifier (__ ";")? {
      return {
        type: "grammar_import", what: [], from, location: location(),
      };
    } // Intializers only

ImportClause
  = NameSpaceImport
  / NamedImports
  / first:ImportedDefaultBinding others:(__ "," __ @(NameSpaceImport / NamedImports))? {
      if (!others) {
        return [first];
      }
      // 'others' is always an array.
      others.unshift(first);
      return others;
    }

ImportedDefaultBinding
  = binding:ImportedBinding {
      return {
        type: "import_binding_default",
        binding: binding[0],
        location: binding[1],
      };
    }

NameSpaceImport
  = "*" __ "as" __ binding:ImportedBinding {
      return [{
        type: "import_binding_all",
        binding: binding[0],
        location: binding[1],
      }];
    }

NamedImports
  = "{" __ "}" { return []; } // Can't have bare comma
  / "{" __ @ImportsList __ ("," __)? "}"

FromClause
  = "from" __ @ModuleSpecifier

ImportsList
  = ImportSpecifier|1.., __ "," __|

ImportSpecifier
  = rename:ModuleExportName __ "as" __ binding:ImportedBinding {
      return {
        type: "import_binding_rename",
        rename: rename[0],
        renameLocation: rename[1],
        binding: binding[0],
        location: binding[1],
      };
    }
  / binding:ImportedBinding {
      return {
        type: "import_binding",
        binding: binding[0],
        location: binding[1],
      };
    }

ModuleSpecifier
  = module:StringLiteral {
      return { type: "import_module_specifier", module, location: location() };
    }

ImportedBinding
  = id:BindingIdentifier { return [id, location()]; }

ModuleExportName
  = IdentifierName
  / id:StringLiteral { return [id, location()]; }

BindingIdentifier
  = id:IdentifierName {
      if (reservedWords.has(id[0])) {
        error(`Binding identifier can't be a reserved word "${id[0]}"`, id[1]);
      }
      return id[0];
    }

TopLevelInitializer
  = "{" code:CodeBlock "}" EOS {
      return {
        type: "top_level_initializer",
        code: code[0],
        codeLocation: code[1],
        location: location(),
      };
    }

Initializer
  = code:CodeBlock EOS {
      return {
        type: "initializer",
        code: code[0],
        codeLocation: code[1],
        location: location(),
      };
    }

Rule
  = name:IdentifierName __
    displayName:(@StringLiteral __)?
    "=" __
    expression:Expression EOS
    {
      return {
        type: "rule",
        name: name[0],
        nameLocation: name[1],
        expression: displayName !== null
          ? {
              type: "named",
              name: displayName,
              expression,
              location: location(),
            }
          : expression,
        location: location(),
      };
    }

Expression
  = ChoiceExpression

ChoiceExpression
  = head:ActionExpression tail:(__ "/" __ @ActionExpression)* {
      return tail.length > 0
        ? {
            type: "choice",
            alternatives: [head].concat(tail),
            location: location(),
          }
        : head;
    }

ActionExpression
  = expression:SequenceExpression code:(__ @CodeBlock)? {
      return code !== null
        ? {
            type: "action",
            expression,
            code: code[0],
            codeLocation: code[1],
            location: location(),
          }
        : expression;
    }

SequenceExpression
  = head:LabeledExpression tail:(__ @LabeledExpression)* {
      return ((tail.length > 0) || (head.type === "labeled" && head.pick))
        ? {
            type: "sequence",
            elements: [head].concat(tail),
            location: location(),
          }
        : head;
    }

LabeledExpression
  = pluck:Pluck label:LabelColon? expression:PrefixedExpression {
      if (expression.type.startsWith("semantic_")) {
        error("\"@\" cannot be used on a semantic predicate", pluck);
      }
      return {
        type: "labeled",
        label: label !== null ? label[0] : null,
        // Use location of "@" if label is unavailable
        labelLocation: label !== null ? label[1] : pluck,
        pick: true,
        expression,
        location: location(),
      };
    }
  / label:LabelColon expression:PrefixedExpression {
      return {
        type: "labeled",
        label: label[0],
        labelLocation: label[1],
        expression,
        location: location(),
      };
    }
  / PrefixedExpression

Pluck
  = "@" { return location(); }

LabelColon
  = label:IdentifierName __ ":" __ {
      if (reservedWords.has(label[0])) {
        error(`Label can't be a reserved word "${label[0]}"`, label[1]);
      }

      return label;
    }

PrefixedExpression
  = operator:PrefixedOperator __ expression:SuffixedExpression {
      return {
        type: OPS_TO_PREFIXED_TYPES[operator],
        expression,
        location: location(),
      };
    }
  / SuffixedExpression

PrefixedOperator
  = "$"
  / "&"
  / "!"

SuffixedExpression
  = expression:PrimaryExpression __ operator:SuffixedOperator {
      return {
        type: OPS_TO_SUFFIXED_TYPES[operator],
        expression,
        location: location(),
      };
    }
  / RepeatedExpression
  / PrimaryExpression

SuffixedOperator
  = "?"
  / "*"
  / "+"

RepeatedExpression
  = expression:PrimaryExpression __ "|" __ boundaries:Boundaries __ delimiter:("," __ @Expression __)? "|" {
      const min = boundaries[0];
      const max = boundaries[1];
      if (max.type === "constant" && max.value === 0) {
        error("The maximum count of repetitions of the rule must be > 0", max.location);
      }

      return {
        type: "repeated",
        min,
        max,
        expression,
        delimiter,
        location: location(),
      };
    }

Boundaries
  = min:Boundary? __ ".." __ max:Boundary? {
    return [
      min !== null ? min : { type: "constant", value: 0 },
      max !== null ? max : { type: "constant", value: null },
    ];
  }
  / exact:Boundary { return [null, exact]; }

Boundary
  = value:Integer { return { type: "constant", value, location: location() }; }
  / value:IdentifierName { return { type: "variable", value: value[0], location: location() }; }
  / value:CodeBlock {
    return {
      type: "function",
      value: value[0],
      codeLocation: value[1],
      location: location(),
    };
  }

PrimaryExpression
  = LiteralMatcher
  / CharacterClassMatcher
  / AnyMatcher
  / RuleReferenceExpression
  / SemanticPredicateExpression
  / "(" __ expression:Expression __ ")" {
      // The purpose of the "group" AST node is just to isolate label scope. We
      // don't need to put it around nodes that can't contain any labels or
      // nodes that already isolate label scope themselves. This leaves us with
      // "labeled" and "sequence".
      return expression.type === "labeled" || expression.type === "sequence"
        ? { type: "group", expression, location: location() }
        : expression;
    }

RuleReferenceExpression
  = library:IdentifierName "." name:IdentifierName {
      return {
        type: "library_ref",
        name: name[0],
        library: library[0],
        libraryNumber: -1,
        location: location(),
      };
    }
  / name:IdentifierName !(__ (StringLiteral __)? "=") {
      return { type: "rule_ref", name: name[0], location: location() };
    }

SemanticPredicateExpression
  = operator:SemanticPredicateOperator __ code:CodeBlock {
      return {
        type: OPS_TO_SEMANTIC_PREDICATE_TYPES[operator],
        code: code[0],
        codeLocation: code[1],
        location: location(),
      };
    }

SemanticPredicateOperator
  = "&"
  / "!"

// ---- Lexical Grammar -----

SourceCharacter
 = SourceCharacterLow
  / SourceCharacterHigh

// Not surrogates
SourceCharacterLow
  = [\u0000-\uD7FF\uE000-\uFFFF]

// Can be properly-matched surrogates or lone surrogates.
SourceCharacterHigh
  = $([\uD800-\uDBFF][\uDC00-\uDFFF]) // Surrogate pair
  / [\uD800-\uDBFF] // Lone first surrogate
  / [\uDC00-\uDFFF] // Lone second surrogate

WhiteSpace "whitespace"
  = "\t"
  / "\v"
  / "\f"
  / " "
  / "\u00A0"
  / "\uFEFF"
  / [\p{Zs}]

LineTerminator
  = [\n\r\u2028\u2029]

LineTerminatorSequence "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028"
  / "\u2029"

Comment "comment"
  = MultiLineComment
  / SingleLineComment

MultiLineComment
  = "/*" (!"*/" SourceCharacter)* "*/"

MultiLineCommentNoLineTerminator
  = "/*" (!("*/" / LineTerminator) SourceCharacter)* "*/"

SingleLineComment
  = "//" (!LineTerminator SourceCharacter)*

IdentifierName "identifier"
  = head:IdentifierStart tail:IdentifierPart* {
      return [head + tail.join(""), location()];
    }

IdentifierStart
  = [\p{ID_Start}]
  / "_"
  / "\\" @UnicodeEscapeSequence

IdentifierPart
  = [\p{ID_Continue}]
  / "$"

LiteralMatcher "literal"
  = value:StringLiteral ignoreCase:"i"? {
      return {
        type: "literal",
        value,
        ignoreCase: ignoreCase !== null,
        location: location(),
      };
    }

StringLiteral "string"
  = '"' chars:DoubleStringCharacter* '"' { return chars.join(""); }
  / "'" chars:SingleStringCharacter* "'" { return chars.join(""); }

DoubleStringCharacter
  = $(!('"' / "\\" / LineTerminator) SourceCharacter)
  / "\\" @EscapeSequence
  / LineContinuation

SingleStringCharacter
  = $(!("'" / "\\" / LineTerminator) SourceCharacter)
  / "\\" @EscapeSequence
  / LineContinuation

CharacterClassMatcher "character class"
  = "["
    inverted:"^"?
    parts:(AtomEscape / ClassCharacterRange / ClassCharacter)*
    "]"
    flags:ClassFlags
    {
      // [^]u is like . but for a codepoint: not-nothing.
      if (inverted && (parts.length === 0)) {
        if (flags.unicode) {
          parts = [["\ud800", "\udfff"]];
        } else {
          return {
            type: "any",
            location: location(),
          };
        }
      }
      return {
        type: "class",
        parts: parts.filter(part => part !== ""),
        inverted: Boolean(inverted),
        ignoreCase: Boolean(flags.ignoreCase),
        location: location(),
        unicode: Boolean(flags.unicode) || parts.flat().some(
          c => ((typeof c === "object") && c.unicode) || (c.codePointAt(0) > 0xffff)
        ),
      };
    }

AtomEscape
  = "\\" @CharacterClassEscape

CharacterClassEscape
  = value:$("p"i "{" UnicodePropertyValueExpression "}") {
    try {
      new RegExp(`[\\${value}]`, "u");
    } catch (er) {
      error("Invalid Unicode property escape");
    }
    return {
      type: "classEscape",
      value,
      unicode: true,
      location: location(),
    };
  }

UnicodePropertyValueExpression
  = UnicodePropertyName "=" UnicodePropertyValue
  / LoneUnicodePropertyNameOrValue

UnicodePropertyName
  = $UnicodePropertyNameCharacter+

UnicodePropertyValue
  = $UnicodePropertyValueCharacter+

LoneUnicodePropertyNameOrValue
  = $UnicodePropertyValueCharacter+

UnicodePropertyValueCharacter
  = UnicodePropertyNameCharacter
  / DecimalDigit

UnicodePropertyNameCharacter
  = AsciiLetter / "_"

AsciiLetter
  = [a-z]i

ClassFlags
  = flags:ClassFlag* {
      const ret = Object.fromEntries(flags);
      if (Object.keys(ret).length !== flags.length) {
        error("Invalid flags");
      }
      return ret;
    }
ClassFlag
  = "i" { return ["ignoreCase", true]; }
  / "u" { return ["unicode", true]; }

ClassCharacterRange
  = begin:ClassCharacter "-" end:ClassCharacter {
      if (begin.codePointAt(0) > end.codePointAt(0)) {
        error(
          "Invalid character range: " + text() + "."
        );
      }

      return [begin, end];
    }

ClassCharacter
  = $(!("]" / "\\" / LineTerminator) SourceCharacter)
  / "\\" @EscapeSequence
  / LineContinuation

LineContinuation
  = "\\" LineTerminatorSequence { return ""; }

EscapeSequence
  = CharacterEscapeSequence
  / "0" !DecimalDigit { return "\0"; }
  / HexEscapeSequence
  / UnicodeEscapeSequence

CharacterEscapeSequence
  = SingleEscapeCharacter
  / NonEscapeCharacter

SingleEscapeCharacter
  = "'"
  / '"'
  / "\\"
  / "b"  { return "\b"; }
  / "f"  { return "\f"; }
  / "n"  { return "\n"; }
  / "r"  { return "\r"; }
  / "t"  { return "\t"; }
  / "v"  { return "\v"; }

NonEscapeCharacter
  = $(!(EscapeCharacter / LineTerminator) SourceCharacter)

EscapeCharacter
  = SingleEscapeCharacter
  / DecimalDigit
  / "x"
  / "u"
  / "p"

HexEscapeSequence
  = "x" digits:$(HexDigit HexDigit) {
      return String.fromCharCode(parseInt(digits, 16));
    }

UnicodeEscapeSequence
  = "u" digits:$(HexDigit HexDigit HexDigit HexDigit) {
      return String.fromCharCode(parseInt(digits, 16));
    }
  / "u" "{" digits:$HexDigit+ "}" {
    return String.fromCodePoint(parseInt(digits, 16));
  }

DecimalDigit
  = [0-9]

HexDigit
  = [0-9a-f]i

AnyMatcher
  = "." { return { type: "any", location: location() }; }

CodeBlock "code block"
  = "{" @BareCodeBlock "}"

BareCodeBlock
  = code:Code { return [code, location()]; }

Code
  = $((![{}] SourceCharacter)+ / "{" Code "}")*

Integer
  = digits:$DecimalDigit+ { return parseInt(digits, 10); }

__
  = (WhiteSpace / LineTerminatorSequence / Comment)*

_
  = (WhiteSpace / MultiLineCommentNoLineTerminator)*

// Automatic Semicolon Insertion

EOS
  = (__ ";")+
  / _ SingleLineComment? LineTerminatorSequence
  / __ EOF

EOF
  = !.
