"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/generate-bytecode");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |generateBytecode|", () => {
  function bytecodeDetails(bytecode) {
    return {
      rules: [{ bytecode }],
    };
  }

  function bytecodeLocationDetails(bytecode, locations) {
    return {
      rules: [{ bytecode }],
      locations,
    };
  }

  function constsDetails(literals, classes, expectations, functions) {
    return { literals, classes, expectations, functions };
  }

  describe("for grammar", () => {
    it("generates correct bytecode", () => {
      expect(pass).to.changeAST([
        "a = 'a'",
        "b = 'b'%'BB'",
        "c = 'c'i%'CC'",
        "d = 'd'%[]",
        "e = 'e'%['EE' 'FF']",
      ].join("\n"), {
        literals: ["a", "b", "BB", "c", "CC", "d", [], "e", ["EE", "FF"]],
        rules: [
          { bytecode: [18, 0, 2, 2, 22, 0, 23, 0] },
          { bytecode: [18, 1, 3, 2, 41, 2, 1, 23, 1] },
          { bytecode: [19, 3, 3, 2, 41, 4, 1, 23, 2] },
          { bytecode: [18, 5, 3, 2, 41, 6, 1, 23, 3] },
          { bytecode: [18, 7, 3, 2, 41, 8, 1, 23, 4] },
        ],
      });
    });

    it("defines correct constants", () => {
      expect(pass).to.changeAST([
        "a = 'a'",
        "b = 'b'%'BB'",
        "c = 'c'i%'CC'",
        "d = 'd'%[]",
        "e = 'e'%['EE' 'FF']",
      ].join("\n"), constsDetails(
        ["a", "b", "BB", "c", "CC", "d", [], "e", ["EE", "FF"]],
        [],
        [
          { type: "literal", value: "a", ignoreCase: false },
          { type: "literal", value: "b", ignoreCase: false },
          { type: "literal", value: "c", ignoreCase: true },
          { type: "literal", value: "d", ignoreCase: false },
          { type: "literal", value: "e", ignoreCase: false },
        ],
        []
      ));
    });

    it("generates correct source mapping", () => {
      expect(pass).to.changeAST([
        "a = 'a'",
      ].join("\n"), bytecodeLocationDetails(
        [37, 0, 18, 0, 2, 2, 22, 0, 23, 0, 38],
        [
          {
            source: "-",
            start: { offset: 4, line: 1, column: 5 },
            end: { offset: 7, line: 1, column: 8 },
          },
        ]
      ), {
        grammarSource: "-",
        output: "source-and-map",
      });
    });

    it("generates correct plucking bytecode", () => {
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
        3,                          //     PUSH_FAILED
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
        3,                           //     PUSH_FAILED
      ]));
    });
  });

  describe("for rule", () => {
    it("generates correct bytecode", () => {
      expect(pass).to.changeAST("start = 'a'", bytecodeDetails([
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
      ]));
    });
  });

  describe("for named", () => {
    const grammar = "start 'start' = 'a'";

    it("generates correct bytecode", () => {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        28,                          // SILENT_FAILS_ON
        18, 0, 2, 2, 22, 0, 23, 1,   // <expression>
        29,                          // SILENT_FAILS_OFF
        14, 2, 0,                    // IF_ERROR
        23, 0,                        //   * FAIL
      ]));
    });

    it("defines correct constants", () => {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [
          { type: "rule", value: "start" },
          { type: "literal", value: "a", ignoreCase: false },
        ],
        []
      ));
    });
  });

  describe("for choice", () => {
    it("generates correct bytecode and source mapping", () => {
      expect(pass).to.changeAST("start = 'a' / label:'b' / 'c'", bytecodeLocationDetails([
        37, 5,                       // SOURCE_MAP_PUSH 5
        37, 0,                       // SOURCE_MAP_PUSH 0
        18, 0, 2, 2, 22, 0, 23, 0,   // <alternatives[0]>
        38,                          // SOURCE_MAP_POP
        14, 36, 0,                   // IF_ERROR
        6,                           //   * POP
        37, 3,                       //     SOURCE_MAP_PUSH 3
        39, 0, 2,                    //     SOURCE_MAP_LABEL_PUSH 0 2
        2,                           //     PUSH_NULL
        37, 1,                       //     SOURCE_MAP_PUSH 1
        18, 1, 2, 2, 22, 1, 23, 1,   //     <alternatives[1]>
        38,                          //     SOURCE_MAP_POP
        40, 0,                       //     SOURCE_MAP_LABEL_POP 0
        38,                          //     SOURCE_MAP_POP
        14, 12, 0,                   //     IF_ERROR
        6,                           //       * POP
        37, 4,                       //          SOURCE_MAP_PUSH 2
        18, 3, 2, 2, 22, 3, 23, 2,   //          <alternatives[2]>
        38,                          //          SOURCE_MAP_POP
        38,                          // SOURCE_MAP_POP
      ], [
        {
          source: "-",
          start: { offset: 8, line: 1, column: 9 },
          end: { offset: 11, line: 1, column: 12 },
        },
        {
          source: "-",
          start: { offset: 20, line: 1, column: 21 },
          end: { offset: 23, line: 1, column: 24 },
        },
        {
          source: "-",
          start: { offset: 14, line: 1, column: 15 },
          end: { offset: 19, line: 1, column: 20 },
        },
        {
          source: "-",
          start: { offset: 14, line: 1, column: 15 },
          end: { offset: 23, line: 1, column: 24 },
        },
        {
          source: "-",
          start: { offset: 26, line: 1, column: 27 },
          end: { offset: 29, line: 1, column: 30 },
        },
        {
          source: "-",
          start: { offset: 8, line: 1, column: 9 },
          end: { offset: 29, line: 1, column: 30 },
        },
      ]), {
        grammarSource: "-",
        output: "source-and-map",
      });
    });
  });

  describe("for action", () => {
    describe("without labels", () => {
      const grammar = "start = 'a' { code }";

      it("generates correct bytecode", () => {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                           // PUSH_CURR_POS
          18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
          15, 6, 0,                    // IF_NOT_ERROR
          24, 1,                       //   * LOAD_SAVED_POS <1>
          26, 0, 1, 0,                 //     CALL <0>
          9,                            // NIP
        ]));
      });

      it("defines correct constants", () => {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a"],
          [],
          [{ type: "literal", value: "a", ignoreCase: false }],
          [{
            predicate: false,
            params: [],
            body: " code ",
            location: {
              source: undefined,
              start: { offset: 13, line: 1, column: 14 },
              end: { offset: 19, line: 1, column: 20 },
            },
          }]
        ));
      });
    });

    describe("with one label", () => {
      const grammar = "start = a:'a' { code }";

      it("generates correct bytecode", () => {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                           // PUSH_CURR_POS
          18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
          15, 7, 0,                    // IF_NOT_ERROR
          24, 1,                       //   * LOAD_SAVED_POS <1>
          26, 0, 1, 1, 0,              //     CALL <0>
          9,                            // NIP
        ]));
      });

      it("defines correct constants", () => {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a"],
          [],
          [{ type: "literal", value: "a", ignoreCase: false }],
          [{
            predicate: false,
            params: ["a"],
            body: " code ",
            location: {
              source: undefined,
              start: { offset: 15, line: 1, column: 16 },
              end: { offset: 21, line: 1, column: 22 },
            },
          }]
        ));
      });
    });

    describe("with multiple labels", () => {
      const grammar = "start = a:'a' b:'b' c:'c' { code }";

      it("generates correct bytecode", () => {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                           // PUSH_CURR_POS
          18, 0, 2, 2, 22, 0, 23, 0,   // <elements[0]>
          15, 39, 3,                   // IF_NOT_ERROR
          18, 1, 2, 2, 22, 1, 23, 1,   //   * <elements[1]>
          15, 24, 4,                   //     IF_NOT_ERROR
          18, 2, 2, 2, 22, 2, 23, 2,   //       * <elements[2]>
          15, 9, 4,                    //         IF_NOT_ERROR
          24, 3,                       //           * LOAD_SAVED_POS <3>
          26, 0, 4, 3, 2, 1, 0,        //             CALL <0>
          8, 3,                        //           * POP_N <3>
          7,                           //             POP_CURR_POS
          3,                           //             PUSH_FAILED
          8, 2,                        //       * POP_N <2>
          7,                           //         POP_CURR_POS
          3,                           //         PUSH_FAILED
          6,                           //   * POP
          7,                           //     POP_CURR_POS
          3,                            //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", () => {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a", "b", "c"],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false },
          ],
          [{
            predicate: false,
            params: ["a", "b", "c"],
            body: " code ",
            location: {
              source: undefined,
              start: { offset: 27, line: 1, column: 28 },
              end: { offset: 33, line: 1, column: 34 },
            },
          }]
        ));
      });
    });
  });

  describe("for sequence", () => {
    const grammar = "start = 'a' 'b' 'c'";

    it("generates correct bytecode", () => {
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
        3,                            //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", () => {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a", "b", "c"],
        [],
        [
          { type: "literal", value: "a", ignoreCase: false },
          { type: "literal", value: "b", ignoreCase: false },
          { type: "literal", value: "c", ignoreCase: false },
        ],
        []
      ));
    });
  });

  describe("for labeled", () => {
    it("generates correct bytecode", () => {
      expect(pass).to.changeAST("start = a:'a'", bytecodeDetails([
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
      ]));
    });
  });

  describe("for text", () => {
    it("generates correct bytecode", () => {
      expect(pass).to.changeAST("start = $'a'", bytecodeDetails([
        5,                           // PUSH_CURR_POS
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
        15, 2, 1,                    // IF_NOT_ERROR
        6,                           //   * POP
        12,                          //     TEXT
        9,                            //   * NIP
      ]));
    });
  });

  describe("for simple_and", () => {
    const grammar = "start = &'a'";

    it("generates correct bytecode", () => {
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
        3,                            //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", () => {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for simple_not", () => {
    const grammar = "start = !'a'";

    it("generates correct bytecode", () => {
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
        3,                            //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", () => {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for optional", () => {
    const grammar = "start = 'a'?";

    it("generates correct bytecode", () => {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
        14, 2, 0,                    // IF_ERROR
        6,                           //   * POP
        2,                            //     PUSH_NULL
      ]));
    });

    it("defines correct constants", () => {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for zero_or_more", () => {
    const grammar = "start = 'a'*";

    it("generates correct bytecode", () => {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        4,                           // PUSH_EMPTY_ARRAY
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
        16, 9,                       // WHILE_NOT_ERROR
        10,                          //   * APPEND
        18, 0, 2, 2, 22, 0, 23, 0,   //     <expression>
        6,                            // POP
      ]));
    });

    it("defines correct constants", () => {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for one_or_more", () => {
    const grammar = "start = 'a'+";

    it("generates correct bytecode", () => {
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
        3,                            //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", () => {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for repeated", () => {
    describe("without delimiter", () => {
      describe("| .. | (edge case -- no boundaries)", () => {
        const grammar = "start = 'a'| .. |";

        it("generates correct bytecode", () => {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            4,                            // PUSH_EMPTY_ARRAY
            18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
            16, 9,                        // WHILE_NOT_ERROR
            10,                           //   * APPEND
            18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
            6,                            // POP
          ]));
        });

        it("defines correct constants", () => {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            []
          ));
        });
      });

      describe("with constant boundaries", () => {
        describe("| ..3| (edge case -- no min boundary)", () => {
          const grammar = "start = 'a'| ..3|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 14,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              31, 3, 1, 8,                  //     IF_GE <3>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              6,                            // POP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              []
            ));
          });
        });

        describe("| ..1| (edge case -- no min boundary -- same as |optional|)", () => {
          const grammar = "start = 'a'| ..1|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 14,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              31, 1, 1, 8,                  //     IF_GE <1>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              6,                            // POP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              []
            ));
          });
        });

        describe("|2.. | (edge case -- no max boundary)", () => {
          const grammar = "start = 'a'|2.. |";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 9,                        // WHILE_NOT_ERROR
              10,                           //   * APPEND
              18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
              6,                            // POP
              30, 2, 3, 1,                  // IF_LT <2>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              []
            ));
          });
        });

        describe("|0.. | (edge case -- no max boundary -- same as |zero or more|)", () => {
          const grammar = "start = 'a'|0.. |";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 9,                        // WHILE_NOT_ERROR
              10,                           //   * APPEND
              18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
              6,                            // POP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              []
            ));
          });
        });

        describe("|1.. | (edge case -- no max boundary -- same as |one or more|)", () => {
          const grammar = "start = 'a'|1.. |";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 9,                        // WHILE_NOT_ERROR
              10,                           //   * APPEND
              18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
              6,                            // POP
              30, 1, 3, 1,                  // IF_LT <1>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              []
            ));
          });
        });

        describe("|2..3|", () => {
          const grammar = "start = 'a'|2..3|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 14,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              31, 3, 1, 8,                  //     IF_GE <3>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              6,                            // POP
              30, 2, 3, 1,                  // IF_LT <2>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              []
            ));
          });
        });

        describe("| 42 | (edge case -- exact repetitions)", () => {
          const grammar = "start = 'a'|42|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 14,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              31, 42, 1, 8,                 //     IF_GE <42>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              6,                            // POP
              30, 42, 3, 1,                 // IF_LT <42>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              []
            ));
          });
        });
      });

      describe("with variable boundaries", () => {
        describe("| ..x| (edge case -- no min boundary)", () => {
          const grammar = "start = max:('a'{return 42;}) 'a'| ..max|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              // 'a'{return 42;}
              5,                            // PUSH_CURR_POS
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              15, 6, 0,                     // IF_NOT_ERROR
              24, 1,                        //   * REPORT_SAVED_POS <1>
              26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
              9,                            // NIP

              15, 41, 3,                    // IF_NOT_ERROR
              // 'a'| ..max|
              4,                            //   * PUSH_EMPTY_ARRAY
              33, 1, 1, 8,                  //     IF_GE_DYNAMIC <1>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              16, 14,                       //     WHILE_NOT_ERROR
              10,                           //       * APPEND
              33, 1, 1, 8,                  //         IF_GE_DYNAMIC <1>
              3,                            //           * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //           * <expression>
              6,                            //     POP

              15, 3, 4,                     //     IF_NOT_ERROR
              11, 2,                        //       * WRAP <2>
              9,                            //         NIP
              8, 2,                         //       * POP_N <2>
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              [{ predicate: false, params: [], body: "return 42;" }]
            ));
          });
        });

        describe("|x.. | (edge case -- no max boundary)", () => {
          const grammar = "start = min:('a'{return 42;}) 'a'|min.. |";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              // 'a'{return 42;}
              5,                            // PUSH_CURR_POS
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              15, 6, 0,                     // IF_NOT_ERROR
              24, 1,                        //   * REPORT_SAVED_POS <1>
              26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
              9,                            // NIP

              15, 40, 3,                    // IF_NOT_ERROR
              // 'a'|min..|
              5,                            //   * PUSH_CURR_POS
              4,                            //     PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
              16, 9,                        //     WHILE_NOT_ERROR
              10,                           //       * APPEND
              18, 0, 2, 2, 22, 0, 23, 0,    //         <expression>
              6,                            //     POP
              32, 2, 3, 1,                  //     IF_LT_DYNAMIC <2>
              6,                            //       * POP
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              9,                            //       * NIP

              15, 3, 4,                     //     IF_NOT_ERROR
              11, 2,                        //       * WRAP <2>
              9,                            //         NIP
              8, 2,                         //       * POP_N <2>
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              [{ predicate: false, params: [], body: "return 42;" }]
            ));
          });
        });

        describe("|x..y|", () => {
          const grammar = "start = min:('a'{return 42;}) max:('a'{return 42;}) 'a'|min..max|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              // 'a'{return 42;}
              5,                            // PUSH_CURR_POS
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              15, 6, 0,                     // IF_NOT_ERROR
              24, 1,                        //   * REPORT_SAVED_POS <1>
              26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
              9,                            // NIP

              15, 77, 3,                    // IF_NOT_ERROR
              // 'a'{return 42;}
              5,                            //   * PUSH_CURR_POS
              18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
              15, 7, 0,                     //     IF_NOT_ERROR
              24, 1,                        //       * REPORT_SAVED_POS <1>
              26, 1, 1, 1, 2,               //         CALL <1>, pop 1, args [2]
              9,                            //     NIP
              15, 50, 4,                    //     IF_NOT_ERROR
              // 'a'|min..max|
              5,                            //       * PUSH_CURR_POS
              4,                            //         PUSH_EMPTY_ARRAY
              33, 2, 1, 8,                  //         IF_GE_DYNAMIC <2>
              3,                            //           * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //           * <expression>
              16, 14,                       //         WHILE_NOT_ERROR
              10,                           //           * APPEND
              33, 2, 1, 8,                  //             IF_GE_DYNAMIC <2>
              3,                            //               * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //               * <expression>
              6,                            //         POP
              32, 3, 3, 1,                  //         IF_LT_DYNAMIC <3>
              6,                            //           * POP
              7,                            //             POP_CURR_POS
              3,                            //             PUSH_FAILED
              9,                            //           * NIP

              15, 3, 4,                     //         IF_NOT_ERROR
              11, 3,                        //           * WRAP <3>
              9,                            //             NIP
              8, 3,                         //           * POP_N <3>
              7,                            //             POP_CURR_POS
              3,                            //             PUSH_FAILED
              8, 2,                         //       * WRAP <2>
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              6,                            // * POP
              7,                            //   POP_CURR_POS
              3,                            //   PUSH_FAILED
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              [
                { predicate: false, params: [],      body: "return 42;" },
                { predicate: false, params: ["min"], body: "return 42;" },
              ]
            ));
          });
        });

        describe("|exact| (edge case -- exact repetitions)", () => {
          const grammar = "start = exact:('a'{return 42;}) 'a'|exact|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              // 'a'{return 42;}
              5,                            // PUSH_CURR_POS
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              15, 6, 0,                     // IF_NOT_ERROR
              24, 1,                        //   * REPORT_SAVED_POS <1>
              26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
              9,                            // NIP

              15, 50, 3,                    // IF_NOT_ERROR
              // 'a'|exact|
              5,                            //   * PUSH_CURR_POS
              4,                            //     PUSH_EMPTY_ARRAY
              33, 2, 1, 8,                  //     IF_GE_DYNAMIC <2>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              16, 14,                       //     WHILE_NOT_ERROR
              10,                           //       * APPEND
              33, 2, 1, 8,                  //         IF_GE_DYNAMIC <2>
              3,                            //           * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //           * <expression>
              6,                            //     POP
              32, 2, 3, 1,                  //     IF_LT_DYNAMIC <2>
              6,                            //       * POP
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              9,                            //       * NIP

              15, 3, 4,                    //     IF_NOT_ERROR
              11, 2,                       //       * WRAP <2>
              9,                           //         NIP
              8, 2,                        //       * POP_N <2>
              7,                           //         POP_CURR_POS
              3,                           //         PUSH_FAILED
              6,                           // * POP
              7,                           //   POP_CURR_POS
              3,                           //   PUSH_FAILED
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              [{ predicate: false, params: [], body: "return 42;" }]
            ));
          });
        });
      });

      describe("with function boundaries", () => {
        describe("| ..x| (edge case -- no min boundary)", () => {
          const grammar = "start = 'a'| ..{return 42;}|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              26, 0, 0, 0,                  // CALL <0>, pop 0, args []

              4,                            // PUSH_EMPTY_ARRAY
              33, 1, 1, 8,                  // IF_GE_DYNAMIC <1>
              3,                            //   * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //   * <expression>
              16, 14,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              33, 1, 1, 8,                  //     IF_GE_DYNAMIC <1>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              6,                            // POP

              9,                            // NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              [{ predicate: true, params: [], body: "return 42;" }]
            ));
          });
        });

        describe("|x.. | (edge case -- no max boundary)", () => {
          const grammar = "start = 'a'|{return 42;}.. |";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              26, 0, 0, 0,                  // CALL <0>, pop 0, args []

              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 9,                        // WHILE_NOT_ERROR
              10,                           //   * APPEND
              18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
              6,                            // POP

              32, 2, 3, 1,                  // IF_LT_DYNAMIC <2>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP

              9,                            // NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              [{ predicate: true, params: [], body: "return 42;" }]
            ));
          });
        });

        describe("|x..y|", () => {
          const grammar = "start = 'a'|{return 41;}..{return 43;}|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              26, 0, 0, 0,                  // CALL <0>, pop 0, args []
              26, 1, 0, 0,                  // CALL <1>, pop 0, args []

              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              33, 2, 1, 8,                  // IF_GE_DYNAMIC <2>
              3,                            //   * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //   * <expression>
              16, 14,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              33, 2, 1, 8,                  //     IF_GE_DYNAMIC <2>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              6,                            // POP

              32, 3, 3, 1,                  // IF_LT_DYNAMIC <3>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP

              9,                            // NIP
              9,                            // NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              [
                { predicate: true, params: [], body: "return 41;" },
                { predicate: true, params: [], body: "return 43;" },
              ]
            ));
          });
        });

        describe("|exact| (edge case -- exact repetitions)", () => {
          const grammar = "start = 'a'|{return 42;}|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              26, 0, 0, 0,                  // CALL <0>, pop 0, args []

              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              33, 2, 1, 8,                  // IF_GE_DYNAMIC <2>
              3,                            //   * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //   * <expression>
              16, 14,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              33, 2, 1, 8,                  //     IF_GE_DYNAMIC <2>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              6,                            // POP

              32, 2, 3, 1,                  // IF_LT_DYNAMIC <2>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP

              9,                            // NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a"],
              [],
              [{ type: "literal", value: "a", ignoreCase: false }],
              [{ predicate: true, params: [], body: "return 42;" }]
            ));
          });
        });
      });
    });

    describe("with delimiter", () => {
      describe("| .. , delim| (edge case -- no boundaries)", () => {
        const grammar = "start = 'a'| .. , 'b'|";

        it("generates correct bytecode", () => {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            4,                            // PUSH_EMPTY_ARRAY
            18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
            16, 30,                       // WHILE_NOT_ERROR
            10,                           //   * APPEND
            5,                            //     PUSH_CURR_POS
            18, 1, 2, 2, 22, 1, 23, 1,    //     <delimiter>
            15, 16, 1,                    //     IF_NOT_ERROR
            6,                            //       * POP
            18, 0, 2, 2, 22, 0, 23, 0,    //         <expression>
            14, 3, 1,                     //         IF_ERROR
            6,                            //           * POP
            7,                            //             POP_CURR_POS
            3,                            //             PUSH_FAILED
            9,                            //           * NIP
            9,                            //        * NIP
            6,                            //     POP
          ]));
        });

        it("defines correct constants", () => {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a", "b"],
            [],
            [
              { type: "literal", value: "a", ignoreCase: false },
              { type: "literal", value: "b", ignoreCase: false },
            ],
            []
          ));
        });
      });

      describe("with constant boundaries", () => {
        describe("| ..3, delim| (edge case -- no min boundary)", () => {
          const grammar = "start = 'a'| ..3, 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 35,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              31, 3, 1, 29,                 //     IF_GE <3>
              3,                            //       * PUSH_FAILED
              5,                            //       * PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //         <delimiter>
              15, 16, 1,                    //         IF_NOT_ERROR
              6,                            //           * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
              14, 3, 1,                     //             IF_ERROR
              6,                            //               * POP
              7,                            //                 POP_CURR_POS
              3,                            //                 PUSH_FAILED
              9,                            //               * NIP
              9,                            //            * NIP
              6,                            //     POP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              []
            ));
          });
        });

        describe("| ..1, delim| (edge case -- no min boundary -- same as |optional|)", () => {
          const grammar = "start = 'a'| ..1, 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 35,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              31, 1, 1, 29,                 //     IF_GE <1>
              3,                            //       * PUSH_FAILED
              5,                            //       * PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //         <delimiter>
              15, 16, 1,                    //         IF_NOT_ERROR
              6,                            //           * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
              14, 3, 1,                     //             IF_ERROR
              6,                            //               * POP
              7,                            //                 POP_CURR_POS
              3,                            //                 PUSH_FAILED
              9,                            //               * NIP
              9,                            //            * NIP
              6,                            //     POP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              []
            ));
          });
        });

        describe("|2.. , delim| (edge case -- no max boundary)", () => {
          const grammar = "start = 'a'|2.. , 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 30,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              5,                            //     PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //     <delimiter>
              15, 16, 1,                    //     IF_NOT_ERROR
              6,                            //       * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //         <expression>
              14, 3, 1,                     //         IF_ERROR
              6,                            //           * POP
              7,                            //             POP_CURR_POS
              3,                            //             PUSH_FAILED
              9,                            //           * NIP
              9,                            //       * NIP
              6,                            //     POP
              30, 2, 3, 1,                  // IF_LT <2>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              []
            ));
          });
        });

        describe("|0.. , delim| (edge case -- no max boundary -- same as |zero or more|)", () => {
          const grammar = "start = 'a'|0.. , 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 30,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              5,                            //     PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //     <delimiter>
              15, 16, 1,                    //     IF_NOT_ERROR
              6,                            //       * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //         <expression>
              14, 3, 1,                     //         IF_ERROR
              6,                            //           * POP
              7,                            //             POP_CURR_POS
              3,                            //             PUSH_FAILED
              9,                            //           * NIP
              9,                            //       * NIP
              6,                            //     POP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              []
            ));
          });
        });

        describe("|1.. , delim| (edge case -- no max boundary -- same as |one or more|)", () => {
          const grammar = "start = 'a'|1.. , 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 30,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              5,                            //     PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //     <delimiter>
              15, 16, 1,                    //     IF_NOT_ERROR
              6,                            //       * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //         <expression>
              14, 3, 1,                     //         IF_ERROR
              6,                            //           * POP
              7,                            //             POP_CURR_POS
              3,                            //             PUSH_FAILED
              9,                            //           * NIP
              9,                            //       * NIP
              6,                            //     POP
              30, 1, 3, 1,                  // IF_LT <1>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              []
            ));
          });
        });

        describe("|2..3, delim|", () => {
          const grammar = "start = 'a'|2..3, 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 35,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              31, 3, 1, 29,                 //     IF_GE <3>
              3,                            //       * PUSH_FAILED
              5,                            //       * PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //         <delimiter>
              15, 16, 1,                    //         IF_NOT_ERROR
              6,                            //           * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
              14, 3, 1,                     //             IF_ERROR
              6,                            //               * POP
              7,                            //                 POP_CURR_POS
              3,                            //                 PUSH_FAILED
              9,                            //               * NIP
              9,                            //           * NIP
              6,                            //     POP
              30, 2, 3, 1,                  // IF_LT <2>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              []
            ));
          });
        });

        describe("| 42 , delim| (edge case -- exact repetitions)", () => {
          const grammar = "start = 'a'|42, 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 35,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              31, 42, 1, 29,                //     IF_GE <42>
              3,                            //       * PUSH_FAILED
              5,                            //       * PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //         <delimiter>
              15, 16, 1,                    //         IF_NOT_ERROR
              6,                            //           * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
              14, 3, 1,                     //             IF_ERROR
              6,                            //               * POP
              7,                            //                 POP_CURR_POS
              3,                            //                 PUSH_FAILED
              9,                            //               * NIP
              9,                            //           * NIP
              6,                            //     POP
              30, 42, 3, 1,                 // IF_LT <42>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              []
            ));
          });
        });
      });

      describe("with variable boundaries", () => {
        describe("| ..x, delim| (edge case -- no min boundary)", () => {
          const grammar = "start = max:(''{return 42;}) 'a'| ..max, 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              // ''{return 42;} - max
              5,                            // PUSH_CURR_POS
              35,                           // PUSH_EMPTY_STRING
              15, 6, 0,                     // IF_NOT_ERROR
              24, 1,                        //   * LOAD_SAVED_POS <1>
              26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
              9,                            // NIP

              15, 62, 3,                    // IF_NOT_ERROR
              // 'a'|..max|
              4,                            //   * PUSH_EMPTY_ARRAY
              33, 1, 1, 8,                  //     IF_GE_DYNAMIC <1>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              16, 35,                       //     WHILE_NOT_ERROR
              10,                           //       * APPEND
              33, 1, 1, 29,                 //         IF_GE_DYNAMIC <1>
              3,                            //           * PUSH_FAILED
              5,                            //           * PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //             <delimiter>
              15, 16, 1,                    //             IF_NOT_ERROR
              6,                            //               * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //                 <expression>
              14, 3, 1,                     //                 IF_ERROR
              6,                            //                   * POP
              7,                            //                     POP_CURR_POS
              3,                            //                     PUSH_FAILED
              9,                            //                   * NIP
              9,                            //               * NIP
              6,                            //     POP

              15, 3, 4,                     //     IF_NOT_ERROR
              11, 2,                        //       * WRAP <2>
              9,                            //         NIP
              8, 2,                         //       * POP_N <2>
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              [{ predicate: false, params: [], body: "return 42;" }]
            ));
          });
        });

        describe("|x.. , delim| (edge case -- no max boundary)", () => {
          const grammar = "start = min:(''{return 42;}) 'a'|min.. , 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              // ''{return 42;} - min
              5,                            // PUSH_CURR_POS
              35,                           // PUSH_EMPTY_STRING
              15, 6, 0,                     // IF_NOT_ERROR
              24, 1,                        //   * LOAD_SAVED_POS <1>
              26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
              9,                            // NIP

              15, 61, 3,                    // IF_NOT_ERROR
              // 'a'|min..|
              5,                            //   * PUSH_CURR_POS
              4,                            //     PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
              16, 30,                       //     WHILE_NOT_ERROR
              10,                           //       * APPEND
              5,                            //         PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //         <delimiter>
              15, 16, 1,                    //         IF_NOT_ERROR
              6,                            //           * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
              14, 3, 1,                     //             IF_ERROR
              6,                            //               * POP
              7,                            //                 POP_CURR_POS
              3,                            //                 PUSH_FAILED
              9,                            //               * NIP
              9,                            //           * NIP
              6,                            //     POP
              32, 2, 3, 1,                  //     IF_LT_DYNAMIC <2>
              6,                            //       * POP
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              9,                            //       * NIP

              15, 3, 4,                     //     IF_NOT_ERROR
              11, 2,                        //       * WRAP <2>
              9,                            //         NIP
              8, 2,                         //       * POP_N <2>
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              [{ predicate: false, params: [], body: "return 42;" }]
            ));
          });
        });

        describe("|x..y, delim|", () => {
          const grammar = "start = min:(''{return 42;}) max:(''{return 42;}) 'a'|min..max, 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              // ''{return 42;} - min
              5,                            // PUSH_CURR_POS
              35,                           // PUSH_EMPTY_STRING
              15, 6, 0,                     // IF_NOT_ERROR
              24, 1,                        //   * LOAD_SAVED_POS <1>
              26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
              9,                            // NIP

              15, 91, 3,                    // IF_NOT_ERROR
              // ''{return 42;} - max
              5,                            //   * PUSH_CURR_POS
              35,                           //     PUSH_EMPTY_STRING
              15, 7, 0,                     //     IF_NOT_ERROR
              24, 1,                        //       * LOAD_SAVED_POS <1>
              26, 1, 1, 1, 2,               //         CALL <1>, pop 1, args [2]
              9,                            //     NIP

              15, 71, 4,                    //     IF_NOT_ERROR
              // 'a'|min..max|
              5,                            //       * PUSH_CURR_POS
              4,                            //         PUSH_EMPTY_ARRAY
              33, 2, 1, 8,                  //         IF_GE_DYNAMIC <2>
              3,                            //           * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //           * <expression>
              16, 35,                       //         WHILE_NOT_ERROR
              10,                           //           * APPEND
              33, 2, 1, 29,                 //             IF_GE_DYNAMIC <2>
              3,                            //               * PUSH_FAILED
              5,                            //               * PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //                 <delimiter>
              15, 16, 1,                    //                 IF_NOT_ERROR
              6,                            //                   * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //                     <expression>
              14, 3, 1,                     //                     IF_ERROR
              6,                            //                       * POP
              7,                            //                         POP_CURR_POS
              3,                            //                         PUSH_FAILED
              9,                            //                       * NIP
              9,                            //                   * NIP
              6,                            //         POP
              32, 3, 3, 1,                  //         IF_LT_DYNAMIC <3>
              6,                            //           * POP
              7,                            //             POP_CURR_POS
              3,                            //             PUSH_FAILED
              9,                            //           * NIP

              15, 3, 4,                     //         IF_NOT_ERROR
              11, 3,                        //           * WRAP <3>
              9,                            //             NIP
              8, 3,                         //           * POP_N <3>
              7,                            //             POP_CURR_POS
              3,                            //             PUSH_FAILED
              8, 2,                         //       * POP_N <2>
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              [
                { predicate: false, params: [],      body: "return 42;" },
                { predicate: false, params: ["min"], body: "return 42;" },
              ]
            ));
          });
        });

        describe("|exact, delim| (edge case -- exact repetitions)", () => {
          const grammar = "start = exact:(''{return 42;}) 'a'|exact, 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              5,                            // PUSH_CURR_POS
              // ''{return 42;}
              5,                            // PUSH_CURR_POS
              35,                           // PUSH_EMPTY_STRING
              15, 6, 0,                     // IF_NOT_ERROR
              24, 1,                        //   * LOAD_SAVED_POS <1>
              26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
              9,                            // NIP

              15, 71, 3,                    // IF_NOT_ERROR
              // 'a'|exact|
              5,                            //   * PUSH_CURR_POS
              4,                            //     PUSH_EMPTY_ARRAY
              33, 2, 1, 8,                  //     IF_GE_DYNAMIC <2>
              3,                            //       * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //       * <expression>
              16, 35,                       //     WHILE_NOT_ERROR
              10,                           //       * APPEND
              33, 2, 1, 29,                 //         IF_GE_DYNAMIC <2>
              3,                            //           * PUSH_FAILED
              5,                            //           * PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //             <delimiter>
              15, 16, 1,                    //             IF_NOT_ERROR
              6,                            //               * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //                 <expression>
              14, 3, 1,                     //                 IF_ERROR
              6,                            //                   * POP
              7,                            //                     POP_CURR_POS
              3,                            //                     PUSH_FAILED
              9,                            //                   * NIP
              9,                            //               * NIP
              6,                            //     POP
              32, 2, 3, 1,                  //     IF_LT_DYNAMIC <2>
              6,                            //       * POP
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              9,                            //       * NIP

              15, 3, 4,                     //     IF_NOT_ERROR
              11, 2,                        //       * WRAP <2>
              9,                            //         NIP
              8, 2,                         //       * POP_N <2>
              7,                            //         POP_CURR_POS
              3,                            //         PUSH_FAILED
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              [{ predicate: false, params: [], body: "return 42;" }]
            ));
          });
        });

        describe("used in delimiter", () => {
          describe("delim|min..|", () => {
            const grammar = "start = min:(''{return 42;}) 'a'|.., 'b'|min..| |";

            it("generates correct bytecode", () => {
              expect(pass).to.changeAST(grammar, bytecodeDetails([
                5,                            // PUSH_CURR_POS

                // ''{return 42;} - min
                5,                            // PUSH_CURR_POS
                35,                           // PUSH_EMPTY_STRING
                15, 6, 0,                     // IF_NOT_ERROR
                24, 1,                        //   * LOAD_SAVED_POS <1>
                26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
                9,                            // NIP

                15, 74, 3,                    // IF_NOT_ERROR
                4,                            //   * PUSH_EMPTY_ARRAY
                18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
                16, 52,                       //     WHILE_NOT_ERROR
                10,                           //       * APPEND
                5,                            //         PUSH_CURR_POS

                // 'b'|min..|
                5,                            //         PUSH_CURR_POS
                4,                            //         PUSH_EMPTY_ARRAY
                18, 1, 2, 2, 22, 1, 23, 1,    //         <delimiter>
                16, 9,                        //         WHILE_NOT_ERROR
                10,                           //           * APPEND
                18, 1, 2, 2, 22, 1, 23, 1,    //             <delimiter>
                6,                            //         POP
                32, 4, 3, 1,                  //         IF_LT_DYNAMIC <4>
                6,                            //           * POP
                7,                            //             POP_CURR_POS
                3,                            //             PUSH_FAILED
                9,                            //           * NIP

                15, 16, 1,                    //         IF_NOT_ERROR - delimiter matched?
                6,                            //           * POP
                18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
                14, 3, 1,                     //             IF_ERROR
                6,                            //               * POP
                7,                            //                 POP_CURR_POS
                3,                            //                 PUSH_FAILED
                9,                            //               * NIP
                9,                            //         NIP
                6,                            //     POP
                15, 3, 4,                     //     IF_NOT_ERROR
                11, 2,                        //       * WRAP <2>
                9,                            //         NIP
                8, 2,                         //       * POP_N <2>
                7,                            //         POP_CURR_POS
                3,                            //         PUSH_FAILED
                6,                            //   * POP
                7,                            //     POP_CURR_POS
                3,                            //     PUSH_FAILED
              ]));
            });

            it("defines correct constants", () => {
              expect(pass).to.changeAST(grammar, constsDetails(
                ["a", "b"],
                [],
                [
                  { type: "literal", value: "a", ignoreCase: false },
                  { type: "literal", value: "b", ignoreCase: false },
                ],
                [{ predicate: false, params: [], body: "return 42;" }]
              ));
            });
          });

          describe("delim|..max|", () => {
            const grammar = "start = max:(''{return 42;}) 'a'|.., 'b'|..max| |";

            it("generates correct bytecode", () => {
              expect(pass).to.changeAST(grammar, bytecodeDetails([
                5,                            // PUSH_CURR_POS

                // ''{return 42;} - max
                5,                            // PUSH_CURR_POS
                35,                           // PUSH_EMPTY_STRING
                15, 6, 0,                     // IF_NOT_ERROR
                24, 1,                        //   * LOAD_SAVED_POS <1>
                26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
                9,                            // NIP

                15, 75, 3,                    // IF_NOT_ERROR
                4,                            //   * PUSH_EMPTY_ARRAY
                18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
                16, 53,                       //     WHILE_NOT_ERROR
                10,                           //       * APPEND

                // 'b'|..max|
                5,                            //         PUSH_CURR_POS
                4,                            //         PUSH_EMPTY_ARRAY
                33, 3, 1, 8,                  //         IF_GE_DYNAMIC <3>
                3,                            //           * PUSH_FAILED
                18, 1, 2, 2, 22, 1, 23, 1,    //           * <delimiter>
                16, 14,                       //         WHILE_NOT_ERROR
                10,                           //           * APPEND
                33, 3, 1, 8,                  //             IF_GE_DYNAMIC <3>
                3,                            //               * PUSH_FAILED
                18, 1, 2, 2, 22, 1, 23, 1,    //               * <delimiter>
                6,                            //         POP

                15, 16, 1,                    //         IF_NOT_ERROR - delimiter matched?
                6,                            //           * POP
                18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
                14, 3, 1,                     //             IF_ERROR
                6,                            //               * POP
                7,                            //                 POP_CURR_POS
                3,                            //                 PUSH_FAILED
                9,                            //               * NIP
                9,                            //         NIP
                6,                            //     POP
                15, 3, 4,                     //     IF_NOT_ERROR
                11, 2,                        //       * WRAP <2>
                9,                            //         NIP
                8, 2,                         //       * POP_N <2>
                7,                            //         POP_CURR_POS
                3,                            //         PUSH_FAILED
                6,                            //   * POP
                7,                            //     POP_CURR_POS
                3,                            //     PUSH_FAILED
              ]));
            });

            it("defines correct constants", () => {
              expect(pass).to.changeAST(grammar, constsDetails(
                ["a", "b"],
                [],
                [
                  { type: "literal", value: "a", ignoreCase: false },
                  { type: "literal", value: "b", ignoreCase: false },
                ],
                [{ predicate: false, params: [], body: "return 42;" }]
              ));
            });
          });

          describe("delim|exact|", () => {
            const grammar = "start = exact:(''{return 42;}) 'a'|.., 'b'|exact| |";

            it("generates correct bytecode", () => {
              expect(pass).to.changeAST(grammar, bytecodeDetails([
                5,                            // PUSH_CURR_POS

                // ''{return 42;} - exact
                5,                            // PUSH_CURR_POS
                35,                           // PUSH_EMPTY_STRING
                15, 6, 0,                     // IF_NOT_ERROR
                24, 1,                        //   * LOAD_SAVED_POS <1>
                26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
                9,                            // NIP

                15, 84, 3,                    // IF_NOT_ERROR
                4,                            //   * PUSH_EMPTY_ARRAY
                18, 0, 2, 2, 22, 0, 23, 0,    //     <expression>
                16, 62,                       //     WHILE_NOT_ERROR
                10,                           //       * APPEND
                5,                            //         PUSH_CURR_POS

                // 'b'|exact|
                5,                            //         PUSH_CURR_POS
                4,                            //         PUSH_EMPTY_ARRAY
                33, 4, 1, 8,                  //         IF_GE_DYNAMIC <4>
                3,                            //           * PUSH_FAILED
                18, 1, 2, 2, 22, 1, 23, 1,    //           * <delimiter>
                16, 14,                       //         WHILE_NOT_ERROR
                10,                           //           * APPEND
                33, 4, 1, 8,                  //             IF_GE_DYNAMIC <4>
                3,                            //               * PUSH_FAILED
                18, 1, 2, 2, 22, 1, 23, 1,    //               * <delimiter>
                6,                            //         POP
                32, 4, 3, 1,                  //         IF_LT_DYNAMIC <4>
                6,                            //           * POP
                7,                            //             POP_CURR_POS
                3,                            //             PUSH_FAILED
                9,                            //           * NIP

                15, 16, 1,                    //         IF_NOT_ERROR - delimiter matched?
                6,                            //           * POP
                18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
                14, 3, 1,                     //             IF_ERROR
                6,                            //               * POP
                7,                            //                 POP_CURR_POS
                3,                            //                 PUSH_FAILED
                9,                            //               * NIP
                9,                            //         NIP
                6,                            //     POP
                15, 3, 4,                     //     IF_NOT_ERROR
                11, 2,                        //       * WRAP <2>
                9,                            //         NIP
                8, 2,                         //       * POP_N <2>
                7,                            //         POP_CURR_POS
                3,                            //         PUSH_FAILED
                6,                            //   * POP
                7,                            //     POP_CURR_POS
                3,                            //     PUSH_FAILED
              ]));
            });

            it("defines correct constants", () => {
              expect(pass).to.changeAST(grammar, constsDetails(
                ["a", "b"],
                [],
                [
                  { type: "literal", value: "a", ignoreCase: false },
                  { type: "literal", value: "b", ignoreCase: false },
                ],
                [{ predicate: false, params: [], body: "return 42;" }]
              ));
            });
          });
        });
      });

      describe("with function boundaries", () => {
        describe("| ..x, delim| (edge case -- no min boundary)", () => {
          const grammar = "start = 'a'| ..{return 42;}, 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              26, 0, 0, 0,                  // CALL <0>, pop 0, args []

              4,                            // PUSH_EMPTY_ARRAY
              33, 1, 1, 8,                  // IF_GE_DYNAMIC <1>
              3,                            //   * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //   * <expression>
              16, 35,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              33, 1, 1, 29,                 //     IF_GE_DYNAMIC <1>
              3,                            //       * PUSH_FAILED
              5,                            //       * PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //         <delimiter>
              15, 16, 1,                    //         IF_NOT_ERROR
              6,                            //           * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
              14, 3, 1,                     //             IF_ERROR
              6,                            //               * POP
              7,                            //                 POP_CURR_POS
              3,                            //                 PUSH_FAILED
              9,                            //               * NIP
              9,                            //           * NIP
              6,                            // POP

              9,                            // NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              [{ predicate: true, params: [], body: "return 42;" }]
            ));
          });
        });

        describe("|x.. , delim| (edge case -- no max boundary)", () => {
          const grammar = "start = 'a'|{return 42;}.. , 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              26, 0, 0, 0,                  // CALL <0>, pop 0, args []

              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              18, 0, 2, 2, 22, 0, 23, 0,    // <expression>
              16, 30,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              5,                            //     PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //     <delimiter>
              15, 16, 1,                    //     IF_NOT_ERROR
              6,                            //       * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //         <expression>
              14, 3, 1,                     //         IF_ERROR
              6,                            //           * POP
              7,                            //             POP_CURR_POS
              3,                            //             PUSH_FAILED
              9,                            //           * NIP
              9,                            //       * NIP
              6,                            // POP

              32, 2, 3, 1,                  // IF_LT_DYNAMIC <2>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP

              9,                            // NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              [{ predicate: true, params: [], body: "return 42;" }]
            ));
          });
        });

        describe("|x..y, delim|", () => {
          const grammar = "start = 'a'|{return 41;}..{return 43;}, 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              26, 0, 0, 0,                  // CALL <0>, pop 0, args []
              26, 1, 0, 0,                  // CALL <1>, pop 0, args []

              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              33, 2, 1, 8,                  // IF_GE_DYNAMIC <2>
              3,                            //   * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //   * <expression>
              16, 35,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              33, 2, 1, 29,                 //     IF_GE_DYNAMIC <2>
              3,                            //       * PUSH_FAILED
              5,                            //       * PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //         <delimiter>
              15, 16, 1,                    //         IF_NOT_ERROR
              6,                            //           * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
              14, 3, 1,                     //             IF_ERROR
              6,                            //               * POP
              7,                            //                 POP_CURR_POS
              3,                            //                 PUSH_FAILED
              9,                            //               * NIP
              9,                            //           * NIP
              6,                            // POP

              32, 3, 3, 1,                  // IF_LT_DYNAMIC <3>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP

              9,                            // NIP
              9,                            // NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              [
                { predicate: true, params: [], body: "return 41;" },
                { predicate: true, params: [], body: "return 43;" },
              ]
            ));
          });
        });

        describe("|exact, delim| (edge case -- exact repetitions)", () => {
          const grammar = "start = 'a'|{return 42;}, 'b'|";

          it("generates correct bytecode", () => {
            expect(pass).to.changeAST(grammar, bytecodeDetails([
              26, 0, 0, 0,                  // CALL <0>, pop 0, args []

              5,                            // PUSH_CURR_POS
              4,                            // PUSH_EMPTY_ARRAY
              33, 2, 1, 8,                  // IF_GE_DYNAMIC <2>
              3,                            //   * PUSH_FAILED
              18, 0, 2, 2, 22, 0, 23, 0,    //   * <expression>
              16, 35,                       // WHILE_NOT_ERROR
              10,                           //   * APPEND
              33, 2, 1, 29,                 //     IF_GE_DYNAMIC <2>
              3,                            //       * PUSH_FAILED
              5,                            //       * PUSH_CURR_POS
              18, 1, 2, 2, 22, 1, 23, 1,    //         <delimiter>
              15, 16, 1,                    //         IF_NOT_ERROR
              6,                            //           * POP
              18, 0, 2, 2, 22, 0, 23, 0,    //             <expression>
              14, 3, 1,                     //             IF_ERROR
              6,                            //               * POP
              7,                            //                 POP_CURR_POS
              3,                            //                 PUSH_FAILED
              9,                            //               * NIP
              9,                            //           * NIP
              6,                            // POP

              32, 2, 3, 1,                  // IF_LT_DYNAMIC <2>
              6,                            //   * POP
              7,                            //     POP_CURR_POS
              3,                            //     PUSH_FAILED
              9,                            //   * NIP

              9,                            // NIP
            ]));
          });

          it("defines correct constants", () => {
            expect(pass).to.changeAST(grammar, constsDetails(
              ["a", "b"],
              [],
              [
                { type: "literal", value: "a", ignoreCase: false },
                { type: "literal", value: "b", ignoreCase: false },
              ],
              [{ predicate: true, params: [], body: "return 42;" }]
            ));
          });
        });
      });
    });
  });

  describe("for group", () => {
    const grammar = "start = ('a')";

    it("generates correct bytecode", () => {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        18, 0, 2, 2, 22, 0, 23, 0,   // <expression>
      ]));
    });

    it("defines correct constants", () => {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for semantic_and", () => {
    describe("without labels", () => {
      const grammar = "start = &{ code }";

      it("generates correct bytecode", () => {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          25,            // UPDATE_SAVED_POS
          26, 0, 0, 0,   // CALL <0>
          13, 2, 2,      // IF
          6,             //   * POP
          1,             //     PUSH_UNDEFINED
          6,             //   * POP
          3,              //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", () => {
        expect(pass).to.changeAST(
          grammar,
          constsDetails(
            [],
            [],
            [],
            [{
              predicate: true,
              params: [],
              body: " code ",
              location: {
                source: undefined,
                start: { offset: 10, line: 1, column: 11 },
                end: { offset: 16, line: 1, column: 17 },
              },
            }]
          )
        );
      });
    });

    describe("with labels", () => {
      const grammar = "start = a:'a' b:'b' c:'c' &{ code }";

      it("generates correct bytecode", () => {
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
          3,                            //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", () => {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a", "b", "c"],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false },
          ],
          [{
            predicate: true,
            params: ["a", "b", "c"],
            body: " code ",
            location: {
              source: undefined,
              start: { offset: 28, line: 1, column: 29 },
              end: { offset: 34, line: 1, column: 35 },
            },
          }]
        ));
      });
    });
  });

  describe("for semantic_not", () => {
    describe("without labels", () => {
      const grammar = "start = !{ code }";

      it("generates correct bytecode", () => {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          25,            // UPDATE_SAVED_POS
          26, 0, 0, 0,   // CALL <0>
          13, 2, 2,      // IF
          6,             //   * POP
          3,             //     PUSH_FAILED
          6,             //   * POP
          1,              //     PUSH_UNDEFINED
        ]));
      });

      it("defines correct constants", () => {
        expect(pass).to.changeAST(
          grammar,
          constsDetails(
            [],
            [],
            [],
            [{
              predicate: true,
              params: [],
              body: " code ",
              location: {
                source: undefined,
                start: { offset: 10, line: 1, column: 11 },
                end: { offset: 16, line: 1, column: 17 },
              },
            }]
          )
        );
      });
    });

    describe("with labels", () => {
      const grammar = "start = a:'a' b:'b' c:'c' !{ code }";

      it("generates correct bytecode", () => {
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
          3,                            //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", () => {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a", "b", "c"],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false },
          ],
          [{
            predicate: true,
            params: ["a", "b", "c"],
            body: " code ",
            location: {
              source: undefined,
              start: { offset: 28, line: 1, column: 29 },
              end: { offset: 34, line: 1, column: 35 },
            },
          }]
        ));
      });
    });
  });

  describe("for rule_ref", () => {
    it("generates correct bytecode", () => {
      expect(pass).to.changeAST([
        "start = other",
        "other = 'other'",
      ].join("\n"), {
        rules: [
          {
            bytecode: [27, 1],   // RULE <1>
          },
          {},
        ],
      });
    });
  });

  describe("for literal", () => {
    describe("empty", () => {
      const grammar = "start = ''";

      it("generates correct bytecode", () => {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          35,     // PUSH_EMPTY_STRING
        ]));
      });

      it("defines correct constants", () => {
        expect(pass).to.changeAST(grammar, constsDetails([], [], [], []));
      });
    });

    describe("non-empty case-sensitive", () => {
      const grammar = "start = 'a'";

      it("generates correct bytecode", () => {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          18, 0, 2, 2,   // MATCH_STRING
          22, 0,         //   * ACCEPT_STRING <0>
          23, 0,          //   * FAIL <0>
        ]));
      });

      it("defines correct constants", () => {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a"],
          [],
          [{ type: "literal", value: "a", ignoreCase: false }],
          []
        ));
      });
    });

    describe("non-empty case-insensitive", () => {
      const grammar = "start = 'A'i";

      it("generates correct bytecode", () => {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          19, 0, 2, 2,   // MATCH_STRING_IC
          21, 1,         //   * ACCEPT_N <1>
          23, 0,          //   * FAIL <0>
        ]));
      });

      it("defines correct constants", () => {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a"],
          [],
          [{ type: "literal", value: "A", ignoreCase: true }],
          []
        ));
      });
    });
  });

  describe("for class", () => {
    it("generates correct bytecode", () => {
      expect(pass).to.changeAST("start = [a]", bytecodeDetails([
        20, 0, 2, 2,   // MATCH_CHAR_CLASS <0>
        21, 1,         //   * ACCEPT_N <1>
        23, 0,          //   * FAIL <0>
      ]));
    });

    describe("non-inverted case-sensitive", () => {
      it("defines correct constants", () => {
        expect(pass).to.changeAST("start = [a]", constsDetails(
          [],
          [{ value: ["a"], ignoreCase: false, inverted: false }],
          [{ type: "class", value: ["a"], ignoreCase: false, inverted: false }],
          []
        ));
      });
    });

    describe("inverted case-sensitive", () => {
      it("defines correct constants", () => {
        expect(pass).to.changeAST("start = [^a]", constsDetails(
          [],
          [{ value: ["a"], ignoreCase: false, inverted: true }],
          [{ type: "class", value: ["a"], ignoreCase: false, inverted: true }],
          []
        ));
      });
    });

    describe("non-inverted case-insensitive", () => {
      it("defines correct constants", () => {
        expect(pass).to.changeAST("start = [a]i", constsDetails(
          [],
          [{ value: ["a"], ignoreCase: true, inverted: false }],
          [{ type: "class", value: ["a"], ignoreCase: true, inverted: false }],
          []
        ));
      });
    });

    describe("complex", () => {
      it("defines correct constants", () => {
        expect(pass).to.changeAST("start = [ab-def-hij-l]", constsDetails(
          [],
          [{ value: ["a", ["b", "d"], "e", ["f", "h"], "i", ["j", "l"]], ignoreCase: false, inverted: false }],
          [{ type: "class", value: ["a", ["b", "d"], "e", ["f", "h"], "i", ["j", "l"]], ignoreCase: false, inverted: false }],
          []
        ));
      });
    });
  });

  describe("for any", () => {
    const grammar = "start = .";

    it("generates bytecode", () => {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        17, 2, 2,   // MATCH_ANY
        21, 1,      //   * ACCEPT_N <1>
        23, 0,       //   * FAIL <0>
      ]));
    });

    it("defines correct constants", () => {
      expect(pass).to.changeAST(
        grammar,
        constsDetails([], [], [{ type: "any" }], [])
      );
    });
  });
});
