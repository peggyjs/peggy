{{
  import path from 'node:path';
}}

{
  const c = 'too';
}
IdentifierName
  = $(IdentifierStart IdentifierPart*)

IdentifierStart
  = UnicodeIDStart
  / "$"
  / "_"
  / "\\" UnicodeEscapeSequence

IdentifierPart
  = UnicodeIDContinue
  / "$"
  / "\\" UnicodeEscapeSequence
  / "\u200C"
  / "\u200D"

UnicodeEscapeSequence
  = "u" Hex4Digits
  / "u{" CodePoint "}"

CodePoint
   = HexDigits ?{ return parseInt(n, 16) <= 0x10FFFF }

Hex4Digits
  = HexDigit HexDigit HexDigit HexDigit

HexDigits
  = HexDigit+

HexDigit = [0-9a-f]i


UnicodeIDStart = ID_Start

UnicodeIDContinue = ID_Continue

// Separator, Space
Zs = c:SourceCharacter &{ return /\p{Zs}/u.test(c) }

ID_Start
  = c:SourceCharacter &{ return /\p{ID_Start}/u.test(c) }

ID_Continue
  = c:SourceCharacter &{ return /\p{ID_Continue}/u.test(c) }

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
