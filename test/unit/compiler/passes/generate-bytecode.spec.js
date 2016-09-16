"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/generate-bytecode");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |generateBytecode|", function() {
  function bytecodeDetails(bytecode) {
    return {
      rules: [{ bytecode }]
    };
  }

  function constsDetails(literals, classes, expectations, functions) {
    return { literals, classes, expectations, functions };
  }

  describe("for grammar", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST([
        "a = 'a'",
        "b = 'b'",
        "c = 'c'"
      ].join("\n"), {
        rules: [
          { bytecode: [18, 0, 2, 2, 22, 0, 23, 0] },
          { bytecode: [18, 1, 2, 2, 22, 1, 23, 1] },
          { bytecode: [18, 2, 2, 2, 22, 2, 23, 2] }
        ]
      });
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST([
        "a = 'a'",
        "b = 'b'",
        "c = 'c'"
      ].join("\n"), constsDetails(
        ["\"a\"", "\"b\"", "\"c\""],
        [],
        [
          { type: "literal", value: "a", ignoreCase: false },
          { type: "literal", value: "b", ignoreCase: false },
          { type: "literal", value: "c", ignoreCase: false }
        ],
        []
      ));
    });

    it("generates correct plucking bytecode", function() {
      expect(pass).to.changeAST("start = 'a' @'b' 'c'", bytecodeDetails([
        5,                         // PUSH_CURR_POS
        18, 0, 2, 2, 22, 0, 23, 0, // <expression>
        15, 34, 3,                 // IF_NOT_ERROR
        18, 1, 2, 2, 22, 1, 23, 1, //   * <expression>
        15, 19, 4,                 //     IF_NOT_ERROR
        18, 2, 2, 2, 22, 2, 23, 2, //       * <expression>
        15, 4, 4,                  //         IF_NOT_ERROR
        36, 4, 1, 1,               //           * PLUCK <pop 4, push [1]>
        8, 3,                      //           * POP_N <3>
        7,                         //             POP_CURR_POS
        3,                         //             PUSH_FAILED
        8, 2,                      //       * POP_N <2>
        7,                         //         POP_CURR_POS
        3,                         //         PUSH_FAILED
        6,                         //   * POP
        7,                         //     POP_CURR_POS
        3                          //     PUSH_FAILED
      ]));

      expect(pass).to.changeAST("start = 'a' @'b' @'c'", bytecodeDetails([
        5,                          // PUSH_CURR_POS
        18, 0, 2, 2, 22, 0, 23, 0,  // <expression>
        15, 35, 3,                  // IF_NOT_ERROR
        18, 1, 2, 2, 22, 1, 23, 1,  //   * <expression>
        15, 20, 4,                  //     IF_NOT_ERROR
        18, 2, 2, 2, 22, 2, 23, 2,  //       * <expression>
        15, 5, 4,                   //         IF_NOT_ERROR
        36, 4, 2, 1, 0,             //           * PLUCK <pop 4, push [1, 0]>
        8, 3,                       //           * POP_N <3>
        7,                          //             POP_CURR_POS
        3,                          //             PUSH_FAILED
        8, 2,                       //       * POP_N <2>
        7,                          //         POP_CURR_POS
        3,                          //         PUSH_FAILED
        6,                          //   * POP
        7,                          //     POP_CURR_POS
        3                           //     PUSH_FAILED
      ]));
    });
  });

  describe("for rule", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST("start = 'a'", bytecodeDetails([
        18, 0, 2, 2, 22, 0, 23, 0   // <expression>
      ]));
    });
  });

  describe("for named", function() {
    const grammar = "start 'start' = 'a'";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        28,                          // SILENT_FAILS_ON
        18, 0, 2, 2, 22, 0, 23, 1,   // <expression>
        29,                          // SILENT_FAILS_OFF
        14, 2, 0,                    // IF_ERROR
        23, 0                        //   * FAIL
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["\"a\""],
        [],
        [
          { type: "rule", value: "start" },
          { type: "literal", value: "a", ignoreCase: false }
        ],
        []
      ));
    });
  });

  describe("for choice", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST("start = 'a' / 'b' / 'c'", bytecodeDetails([
        18, 0, 2, 2, 22, 0, 23, 0,   // <alternatives[0]>
        14, 21, 0,                   // IF_ERROR
        6,                           //   * POP
        18, 1, 2, 2, 22, 1, 23, 1,   //     <alternatives[1]>
        14, 9, 0,                    //     IF_ERROR
        6,                           //       * POP
        18, 2, 2, 2, 22, 2, 23, 2    //         <alternatives[2]>
      ]));
    });
  });

  describe("for action", function() {
    describe("without labels", function() {
      const grammar = "start = 'a' { code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                           // PUSH_CURR_POS
          18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
          15, 6, 0,                    // IF_NOT_ERROR
          24, 1,                       //   * LOAD_SAVED_POS
          26, 0, 1, 0,                 //     CALL <0>
          9                            // NIP
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["\"a\""],
          [],
          [{ type: "literal", value: "a", ignoreCase: false }],
          [{ predicate: false, params: [], body: " code " }]
        ));
      });
    });

    describe("with one label", function() {
      const grammar = "start = a:'a' { code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                           // PUSH_CURR_POS
          18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
          15, 7, 0,                    // IF_NOT_ERROR
          24, 1,                       //   * LOAD_SAVED_POS
          26, 0, 1, 1, 0,              //     CALL <0>
          9                            // NIP
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["\"a\""],
          [],
          [{ type: "literal", value: "a", ignoreCase: false }],
          [{ predicate: false, params: ["a"], body: " code " }]
        ));
      });
    });

    describe("with multiple labels", function() {
      const grammar = "start = a:'a' b:'b' c:'c' { code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                           // PUSH_CURR_POS
          18, 0, 2, 2, 22, 0, 23, 0,   // <elements[0]>
          15, 39, 3,                   // IF_NOT_ERROR
          18, 1, 2, 2, 22, 1, 23, 1,   //   * <elements[1]>
          15, 24, 4,                   //     IF_NOT_ERROR
          18, 2, 2, 2, 22, 2, 23, 2,   //       * <elements[2]>
          15, 9, 4,                    //         IF_NOT_ERROR
          24, 3,                       //           * LOAD_SAVED_POS
          26, 0, 4, 3, 2, 1, 0,        //             CALL <0>
          8, 3,                        //           * POP_N <3>
          7,                           //             POP_CURR_POS
          3,                           //             PUSH_FAILED
          8, 2,                        //       * POP_N <2>
          7,                           //         POP_CURR_POS
          3,                           //         PUSH_FAILED
          6,                           //   * POP
          7,                           //     POP_CURR_POS
          3                            //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["\"a\"", "\"b\"", "\"c\""],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false }
          ],
          [{ predicate: false, params: ["a", "b", "c"], body: " code " }]
        ));
      });
    });
  });

  describe("for sequence", function() {
    const grammar = "start = 'a' 'b' 'c'";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        5,                           // PUSH_CURR_POS
        18, 0, 2, 2, 22, 0, 23, 0,   // <elements[0]>
        15, 33, 3,                   // IF_NOT_ERROR
        18, 1, 2, 2, 22, 1, 23, 1,   //   * <elements[1]>
        15, 18, 4,                   //     IF_NOT_ERROR
        18, 2, 2, 2, 22, 2, 23, 2,   //       * <elements[2]>
        15, 3, 4,                    //         IF_NOT_ERROR
        11, 3,                       //           * WRAP <3>
        9,                           //             NIP
        8, 3,                        //           * POP_N <3>
        7,                           //             POP_CURR_POS
        3,                           //             PUSH_FAILED
        8, 2,                        //       * POP_N <2>
        7,                           //         POP_CURR_POS
        3,                           //         PUSH_FAILED
        6,                           //   * POP
        7,                           //     POP_CURR_POS
        3                            //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["\"a\"", "\"b\"", "\"c\""],
        [],
        [
          { type: "literal", value: "a", ignoreCase: false },
          { type: "literal", value: "b", ignoreCase: false },
          { type: "literal", value: "c", ignoreCase: false }
        ],
        []
      ));
    });
  });

  describe("for labeled", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST("start = a:'a'", bytecodeDetails([
        18, 0, 2, 2, 22, 0, 23, 0   // <expression>
      ]));
    });
  });

  describe("for text", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST("start = $'a'", bytecodeDetails([
        5,                           // PUSH_CURR_POS
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
        15, 2, 1,                    // IF_NOT_ERROR
        6,                           //   * POP
        12,                          //     TEXT
        9                            //   * NIP
      ]));
    });
  });

  describe("for simple_and", function() {
    const grammar = "start = &'a'";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        5,                           // PUSH_CURR_POS
        28,                          // SILENT_FAILS_ON
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
        29,                          // SILENT_FAILS_OFF
        15, 3, 3,                    // IF_NOT_ERROR
        6,                           //   * POP
        7,                           //     POP_CURR_POS
        1,                           //     PUSH_UNDEFINED
        6,                           //   * POP
        6,                           //     POP
        3                            //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["\"a\""],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for simple_not", function() {
    const grammar = "start = !'a'";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        5,                           // PUSH_CURR_POS
        28,                          // SILENT_FAILS_ON
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
        29,                          // SILENT_FAILS_OFF
        14, 3, 3,                    // IF_ERROR
        6,                           //   * POP
        6,                           //     POP
        1,                           //     PUSH_UNDEFINED
        6,                           //   * POP
        7,                           //     POP_CURR_POS
        3                            //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["\"a\""],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for optional", function() {
    const grammar = "start = 'a'?";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
        14, 2, 0,                    // IF_ERROR
        6,                           //   * POP
        2                            //     PUSH_NULL
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["\"a\""],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for zero_or_more", function() {
    const grammar = "start = 'a'*";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        4,                           // PUSH_EMPTY_ARRAY
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
        16, 9,                       // WHILE_NOT_ERROR
        10,                          //   * APPEND
        18, 0, 2, 2, 22, 0, 23, 0,   //     <expression>
        6                            // POP
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["\"a\""],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for one_or_more", function() {
    const grammar = "start = 'a'+";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        4,                           // PUSH_EMPTY_ARRAY
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
        15, 12, 3,                   // IF_NOT_ERROR
        16, 9,                       //   * WHILE_NOT_ERROR
        10,                          //       * APPEND
        18, 0, 2, 2, 22, 0, 23, 0,   //         <expression>
        6,                           //     POP
        6,                           //   * POP
        6,                           //     POP
        3                            //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["\"a\""],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for group", function() {
    const grammar = "start = ('a')";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        18, 0, 2, 2, 22, 0, 23, 0   // <expression>
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["\"a\""],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for semantic_and", function() {
    describe("without labels", function() {
      const grammar = "start = &{ code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          25,            // UPDATE_SAVED_POS
          26, 0, 0, 0,   // CALL <0>
          13, 2, 2,      // IF
          6,             //   * POP
          1,             //     PUSH_UNDEFINED
          6,             //   * POP
          3              //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(
          grammar,
          constsDetails(
            [],
            [],
            [],
            [{ predicate: true, params: [], body: " code " }]
          )
        );
      });
    });

    describe("with labels", function() {
      const grammar = "start = a:'a' b:'b' c:'c' &{ code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                           // PUSH_CURR_POS
          18, 0, 2, 2, 22, 0, 23, 0,   // <elements[0]>
          15, 55, 3,                   // IF_NOT_ERROR
          18, 1, 2, 2, 22, 1, 23, 1,   //   * <elements[1]>
          15, 40, 4,                   //     IF_NOT_ERROR
          18, 2, 2, 2, 22, 2, 23, 2,   //       * <elements[2]>
          15, 25, 4,                   //         IF_NOT_ERROR
          25,                          //           * UPDATE_SAVED_POS
          26, 0, 0, 3, 2, 1, 0,        //             CALL <0>
          13, 2, 2,                    //             IF
          6,                           //               * POP
          1,                           //                 PUSH_UNDEFINED
          6,                           //               * POP
          3,                           //                 PUSH_FAILED
          15, 3, 4,                    //             IF_NOT_ERROR
          11, 4,                       //               * WRAP <4>
          9,                           //                 NIP
          8, 4,                        //               * POP_N <4>
          7,                           //                 POP_CURR_POS
          3,                           //                 PUSH_FAILED
          8, 3,                        //           * POP_N <3>
          7,                           //             POP_CURR_POS
          3,                           //             PUSH_FAILED
          8, 2,                        //       * POP_N <2>
          7,                           //         POP_CURR_POS
          3,                           //         PUSH_FAILED
          6,                           //   * POP
          7,                           //     POP_CURR_POS
          3                            //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["\"a\"", "\"b\"", "\"c\""],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false }
          ],
          [{ predicate: true, params: ["a", "b", "c"], body: " code " }]
        ));
      });
    });
  });

  describe("for semantic_not", function() {
    describe("without labels", function() {
      const grammar = "start = !{ code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          25,            // UPDATE_SAVED_POS
          26, 0, 0, 0,   // CALL <0>
          13, 2, 2,      // IF
          6,             //   * POP
          3,             //     PUSH_FAILED
          6,             //   * POP
          1              //     PUSH_UNDEFINED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(
          grammar,
          constsDetails(
            [],
            [],
            [],
            [{ predicate: true, params: [], body: " code " }]
          )
        );
      });
    });

    describe("with labels", function() {
      const grammar = "start = a:'a' b:'b' c:'c' !{ code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                           // PUSH_CURR_POS
          18, 0, 2, 2, 22, 0, 23, 0,   // <elements[0]>
          15, 55, 3,                   // IF_NOT_ERROR
          18, 1, 2, 2, 22, 1, 23, 1,   //   * <elements[1]>
          15, 40, 4,                   //     IF_NOT_ERROR
          18, 2, 2, 2, 22, 2, 23, 2,   //       * <elements[2]>
          15, 25, 4,                   //         IF_NOT_ERROR
          25,                          //           * UPDATE_SAVED_POS
          26, 0, 0, 3, 2, 1, 0,        //             CALL <0>
          13, 2, 2,                    //             IF
          6,                           //               * POP
          3,                           //                 PUSH_FAILED
          6,                           //               * POP
          1,                           //                 PUSH_UNDEFINED
          15, 3, 4,                    //             IF_NOT_ERROR
          11, 4,                       //               * WRAP
          9,                           //                 NIP
          8, 4,                        //               * POP_N <4>
          7,                           //                 POP_CURR_POS
          3,                           //                 PUSH_FAILED
          8, 3,                        //           * POP_N <3>
          7,                           //             POP_CURR_POS
          3,                           //             PUSH_FAILED
          8, 2,                        //       * POP_N <2>
          7,                           //         POP_CURR_POS
          3,                           //         PUSH_FAILED
          6,                           //   * POP
          7,                           //     POP_CURR_POS
          3                            //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["\"a\"", "\"b\"", "\"c\""],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false }
          ],
          [{ predicate: true, params: ["a", "b", "c"], body: " code " }]
        ));
      });
    });
  });

  describe("for rule_ref", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST([
        "start = other",
        "other = 'other'"
      ].join("\n"), {
        rules: [
          {
            bytecode: [27, 1]   // RULE <1>
          },
          { }
        ]
      });
    });
  });

  describe("for literal", function() {
    describe("empty", function() {
      const grammar = "start = ''";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          0, 0   // PUSH
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(["\"\""], [], [], []));
      });
    });

    describe("non-empty case-sensitive", function() {
      const grammar = "start = 'a'";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          18, 0, 2, 2,   // MATCH_STRING
          22, 0,         //   * ACCEPT_STRING <0>
          23, 0          //   * FAIL <0>
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["\"a\""],
          [],
          [{ type: "literal", value: "a", ignoreCase: false }],
          []
        ));
      });
    });

    describe("non-empty case-insensitive", function() {
      const grammar = "start = 'A'i";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          19, 0, 2, 2,   // MATCH_STRING_IC
          21, 1,         //   * ACCEPT_N <1>
          23, 0          //   * FAIL <0>
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["\"a\""],
          [],
          [{ type: "literal", value: "A", ignoreCase: true }],
          []
        ));
      });
    });
  });

  describe("for class", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST("start = [a]", bytecodeDetails([
        20, 0, 2, 2,   // MATCH_REGEXP
        21, 1,         //   * ACCEPT_N <1>
        23, 0          //   * FAIL <0>
      ]));
    });

    describe("non-inverted case-sensitive", function() {
      it("defines correct constants", function() {
        expect(pass).to.changeAST("start = [a]", constsDetails(
          [],
          ["/^[a]/"],
          [{ type: "class", value: ["a"], ignoreCase: false, inverted: false }],
          []
        ));
      });
    });

    describe("inverted case-sensitive", function() {
      it("defines correct constants", function() {
        expect(pass).to.changeAST("start = [^a]", constsDetails(
          [],
          ["/^[^a]/"],
          [{ type: "class", value: ["a"], ignoreCase: false, inverted: true }],
          []
        ));
      });
    });

    describe("non-inverted case-insensitive", function() {
      it("defines correct constants", function() {
        expect(pass).to.changeAST("start = [a]i", constsDetails(
          [],
          ["/^[a]/i"],
          [{ type: "class", value: ["a"], ignoreCase: true, inverted: false }],
          []
        ));
      });
    });

    describe("complex", function() {
      it("defines correct constants", function() {
        expect(pass).to.changeAST("start = [ab-def-hij-l]", constsDetails(
          [],
          ["/^[ab-def-hij-l]/"],
          [{ type: "class", value: ["a", ["b", "d"], "e", ["f", "h"], "i", ["j", "l"]], ignoreCase: false, inverted: false }],
          []
        ));
      });
    });
  });

  describe("for any", function() {
    const grammar = "start = .";

    it("generates bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        17, 2, 2,   // MATCH_ANY
        21, 1,      //   * ACCEPT_N <1>
        23, 0       //   * FAIL <0>
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(
        grammar,
        constsDetails([], [], [{ type: "any" }], [])
      );
    });
  });
});
