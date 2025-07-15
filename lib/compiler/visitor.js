"use strict";

// Disabling some ESLint things for my temporary convenience during development.
// The goal of these is to make iteration easier -- and then anything relevant can be fixed for final merge.
{
  /* eslint-disable @stylistic/max-len */   // inconvenient during development
  /* eslint-disable no-warning-comments */  // inconvenient during deveopment (it's not worth tracking unless it's unfixed upon merge -- and maybe not even then)
  /* eslint-disable @stylistic/quotes */    // inconvenient during development (specifically for `...` usage)
  /* eslint-disable capitalized-comments */ // inconvenient during development (so I can comment things out as a test)

  // ESLint *also* complains if I disable a rule and then don't violate it.
  // I could not find a way to disable that one, as well... so here is a set of now-mandatory violations.
  const _eslint1_ = `It says "Unused eslint-disable directive (no problems were reported from '@stylistic/quotes')." -- now there is.`;
}

class VisitorUtils {
  static isNode(obj) {
    if (obj === null || obj === undefined) {
      return false;
    }

    if (typeof obj !== "object") {
      return false;
    }

    const typeIsExpected = typeof obj.type === "string";
    const locationIsExpected = typeof obj.location === "object";

    // TODO: This occurs in plugin-api.spec.js -- but seems to be counter to spec?
    const locationIsMissing = obj.location === undefined;

    // TODO: This check isn't great, but it's a good hook for typescript `obj is ast.Node<T>` assertions later.
    return typeIsExpected && (locationIsExpected || locationIsMissing);
  }

  static propToNodeArray(maybeNodes) {
    if (Array.isArray(maybeNodes)) {
      if (maybeNodes.every(maybeNode => VisitorUtils.isNode(maybeNode))) {
        return [...maybeNodes];
      }
    }

    if (VisitorUtils.isNode(maybeNodes)) {
      return [maybeNodes];
    }

    if (maybeNodes === null || maybeNodes === undefined) {
      return [];
    }

    throw new Error(`Prop was not node array ${JSON.stringify(maybeNodes, null, "  ")}`);
    // return [];
  }

  /** Produces a single nodeChild or  */
  static nodeChild(_node) {
    return undefined;
  }
}

// Simple AST node visitor builder.
class _Visitor {
  static build(functions) {
    return new _Visitor(functions);
  }
}

const originalVisitor = {
  build(functions) {
    function visit(node, ...args) {
      return functions[node.type](node, ...args);
    }

    function visitNop() {
      // Do nothing.
    }

    function visitExpression(node, ...args) {
      return visit(node.expression, ...args);
    }

    function visitChildren(property) {
      return function(node, ...args) {
        // We do not use .map() here, because if you need the result
        // of applying visitor to children you probable also need to
        // process it in some way, therefore you anyway have to override
        // this method. If you do not needed that, we do not waste time
        // and memory for creating the output array
        node[property].forEach(child => visit(child, ...args));
      };
    }

    const DEFAULT_FUNCTIONS = {
      grammar(node, ...args) {
        for (const imp of node.imports) {
          visit(imp, ...args);
        }

        if (node.topLevelInitializer) {
          for (const tli of VisitorUtils.propToNodeArray(node.topLevelInitializer)) {
            visit(tli, ...args);
          }
        }

        if (node.initializer) {
          for (const init of VisitorUtils.propToNodeArray(node.initializer)) {
            visit(init, ...args);
          }
        }

        for (const rule of VisitorUtils.propToNodeArray(node.rules)) {
          visit(rule, ...args);
        }
      },

      grammar_import: visitNop,
      top_level_initializer: visitNop,
      initializer: visitNop,
      rule: visitExpression,
      named: visitExpression,
      choice: visitChildren("alternatives"),
      action: visitExpression,
      sequence: visitChildren("elements"),
      labeled: visitExpression,
      text: visitExpression,
      simple_and: visitExpression,
      simple_not: visitExpression,
      optional: visitExpression,
      zero_or_more: visitExpression,
      one_or_more: visitExpression,
      repeated(node, ...args) {
        if (node.delimiter) {
          visit(node.delimiter, ...args);
        }

        return visit(node.expression, ...args);
      },
      group: visitExpression,
      semantic_and: visitNop,
      semantic_not: visitNop,
      rule_ref: visitNop,
      library_ref: visitNop,
      literal: visitNop,
      class: visitNop,
      any: visitNop,
    };

    Object.keys(DEFAULT_FUNCTIONS).forEach(type => {
      if (!Object.prototype.hasOwnProperty.call(functions, type)) {
        functions[type] = DEFAULT_FUNCTIONS[type];
      }
    });

    return visit;
  },
};

module.exports = originalVisitor;
