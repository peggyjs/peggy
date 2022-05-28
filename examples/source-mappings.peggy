// See https://sourcemaps.info/spec.html
// This grammar only parses the "mapping" field.
{{
  const BASE64u = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  // ub64.A = 0, etc.
  const ub64 = [...BASE64u].reduce((p, v, i) => {
    p[v] = i
    return p
  }, {})
}}

// each group representing a line in the generated file is separated by a ”;”
mappings = head:line? tail:(";" @line)* { return head ? [head, ...tail] : tail; }

// each segment is separated by a “,”
line = head:segment? tail:("," @segment)* { return head ? [head, ...tail] : tail; }

/*
  gen_col: The zero-based starting column of the line in the generated code
  that the segment represents. If this is the first field of the first
  segment, or the first segment following a new generated line (“;”), then
  this field holds the whole base 64 VLQ. Otherwise, this field contains a
  base 64 VLQ that is relative to the previous occurrence of this field. Note
  that this is different than the fields below because the previous value is
  reset after every generated line.

  source: If present, an zero-based index into the “sources” list. This field
  is a base 64 VLQ relative to the previous occurrence of this field, unless
  this is the first occurrence of this field, in which case the whole value is
  represented.

  source_line: If present, the zero-based starting line in the original source
  represented. This field is a base 64 VLQ relative to the previous occurrence
  of this field, unless this is the first occurrence of this field, in which
  case the whole value is represented. Always present if there is a source
  field.

  source_col: If present, the zero-based starting column of the line in the
  source represented. This field is a base 64 VLQ relative to the previous
  occurrence of this field, unless this is the first occurrence of this field,
  in which case the whole value is represented. Always present if there is a
  source field.

  name: If present, the zero-based index into the “names” list associated with
  this segment. This field is a base 64 VLQ relative to the previous
  occurrence of this field, unless this is the first occurrence of this field,
  in which case the whole value is represented.
*/

// each segment is made up of 1,4 or 5 variable length fields
segment = gen_col:field sf:source_fields? {
  const s = sf || {}
  s.gen_col = gen_col
  return s
}

source_fields = source:field source_line:field source_col:field name:field? {
  const ret = { gen_col:0, source, source_line, source_col }
  if (name) {
    ret.name = name
  }
  return ret
}

field = run:vlq_continue* end:vlq_end {
  // Lowest bit of end is the sign
  const sign = (end & 0x1) ? -1 : 1
  // Last 4 bits come from the top 4 bits of the end byte
  const last4 = (end & 0x1e) >> 1
  // Each continue byte has 5 bits.
  return sign * ((run.reduce((p, v) => (p << 5) + v, 0) << 4) + last4)
}

// The top bit (bit 5) set means "continue". ub64.g = 32, which is the first of those.
vlq_continue = c:[ghijklmnopqrstuvwxyz0123456789+/] { return ub64[c]; }
vlq_end = c:[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef] { return ub64[c]; }
