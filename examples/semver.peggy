/**
 * SemVer.org v2
 * https://semver.org/spec/v2.0.0.html
 * For unit tests see: https://github.com/dselman/peggy-semver
 */
semver
  = versionCore:versionCore
    pre:('-' @preRelease)?
    build:('+' @build)?
  {
    return { versionCore, pre, build };
  }

versionCore
  = major:$numericIdentifier '.' minor:$numericIdentifier '.' patch:$numericIdentifier
  {
    return {
      major: parseInt(major, 10),
      minor: parseInt(minor, 10),
      patch: parseInt(patch, 10),
    };
  }

preRelease
  = head:$preReleaseIdentifier tail:('.' @$preReleaseIdentifier)*
  {
    return [head, ...tail];
  }

build
  = head:$buildIdentifier tail:('.' @$buildIdentifier)*
  {
    return [head, ...tail];
  }

preReleaseIdentifier
  = alphanumericIdentifier
  / numericIdentifier

buildIdentifier
  = alphanumericIdentifier
  / digit+

alphanumericIdentifier
  = digit* nonDigit identifierChar*

numericIdentifier
  = '0' / (positiveDigit digit*)

identifierChar
  = [a-z0-9-]i

nonDigit
  = [a-z-]i

digit
  = [0-9]

positiveDigit
  = [1-9]