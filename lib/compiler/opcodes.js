"use strict";

// Bytecode instruction opcodes.
const opcodes = {
  // Stack Manipulation

  /** @deprecated Unused */
  PUSH:              0,    // PUSH c
  PUSH_EMPTY_STRING: 35,   // PUSH_EMPTY_STRING
  PUSH_UNDEFINED:    1,    // PUSH_UNDEFINED
  PUSH_NULL:         2,    // PUSH_NULL
  PUSH_FAILED:       3,    // PUSH_FAILED
  PUSH_EMPTY_ARRAY:  4,    // PUSH_EMPTY_ARRAY
  PUSH_CURR_POS:     5,    // PUSH_CURR_POS
  POP:               6,    // POP
  POP_CURR_POS:      7,    // POP_CURR_POS
  POP_N:             8,    // POP_N n
  NIP:               9,    // NIP
  APPEND:            10,   // APPEND
  WRAP:              11,   // WRAP n
  TEXT:              12,   // TEXT
  PLUCK:             36,   // PLUCK n, k, p1, ..., pK

  // Conditions and Loops

  IF:                13,   // IF t, f
  IF_ERROR:          14,   // IF_ERROR t, f
  IF_NOT_ERROR:      15,   // IF_NOT_ERROR t, f
  IF_LT:             30,   // IF_LT min, t, f
  IF_GE:             31,   // IF_GE max, t, f
  IF_LT_DYNAMIC:     32,   // IF_LT_DYNAMIC min, t, f
  IF_GE_DYNAMIC:     33,   // IF_GE_DYNAMIC max, t, f
  WHILE_NOT_ERROR:   16,   // WHILE_NOT_ERROR b

  // Matching

  MATCH_ANY:        17,    // MATCH_ANY a, f, ...
  MATCH_STRING:     18,    // MATCH_STRING s, a, f, ...
  MATCH_STRING_IC:  19,    // MATCH_STRING_IC s, a, f, ...
  MATCH_CHAR_CLASS: 20,    // MATCH_CHAR_CLASS c, a, f, ...
  /** @deprecated Replaced with `MATCH_CHAR_CLASS` */
  MATCH_REGEXP:     20,    // MATCH_REGEXP r, a, f, ...
  ACCEPT_N:         21,    // ACCEPT_N n
  ACCEPT_STRING:    22,    // ACCEPT_STRING s
  FAIL:             23,    // FAIL e

  // Calls

  LOAD_SAVED_POS:    24,   // LOAD_SAVED_POS p
  UPDATE_SAVED_POS:  25,   // UPDATE_SAVED_POS
  CALL:              26,   // CALL f, n, pc, p1, p2, ..., pN

  // Rules

  RULE:              27,   // RULE r

  // Failure Reporting

  SILENT_FAILS_ON:   28,   // SILENT_FAILS_ON
  SILENT_FAILS_OFF:  29,   // SILENT_FAILS_OFF

  // Because the tests have hard-coded opcode numbers, don't renumber
  // existing opcodes.  New opcodes that have been put in the correct
  // sections above are repeated here in order to ensure we don't
  // reuse them.
  //
  // IF_LT: 30
  // IF_GE: 31
  // IF_LT_DYNAMIC: 32
  // IF_GE_DYNAMIC: 33
  // 34 reserved for @mingun
  // PUSH_EMPTY_STRING: 35
  // PLUCK: 36

  SOURCE_MAP_PUSH:         37,   // SOURCE_MAP_PUSH loc-index
  SOURCE_MAP_POP:          38,   // SOURCE_MAP_POP
  SOURCE_MAP_LABEL_PUSH:   39,   // SOURCE_MAP_LABEL_PUSH sp, literal-index, loc-index
  SOURCE_MAP_LABEL_POP:    40,   // SOURCE_MAP_LABEL_POP sp
};

module.exports = opcodes;
