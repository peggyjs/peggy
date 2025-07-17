"use strict";

// {
//   /* eslint-disable @stylistic/max-len */
//   /* eslint-disable no-unused-vars */
//   /* eslint-disable no-warning-comments */
//   /* eslint-disable @stylistic/quotes */
//   /* eslint-disable class-methods-use-this */
//   /* eslint-disable no-useless-constructor */
//   /* eslint-disable no-empty-function */
//   /* eslint-disable @stylistic/no-trailing-spaces */
// }

/**
 * Each one of these evaluates to {@see ast.AllNodes}, basically.
 * But perhaps later this can be more specific.
 *
 * Later iteration (thru {@link VisitorUtils}) and {@link Object.entries} generally follows the order below.
 */
const NODE_PROPS_THAT_CAN_BE_CHECKED = {
  imports: true,
  topLevelInitializer: true,
  initializer: true,
  rules: true,

  delimiter: true,
  expression: true,
  alternatives: true,
  elements: true,
};

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

    // This occurs in plugin-api.spec.js -- but seems to be counter to spec?
    const locationIsMissing = obj.location === undefined;

    // This check isn't great, but it's a good hook for typescript `obj is ast.Node<T>` assertions later.
    return typeIsExpected && (locationIsExpected || locationIsMissing);
  }

  static singularizeResultOrThrow(maybeResultArray) {
    if (!Array.isArray(maybeResultArray)) {
      return maybeResultArray;
    }

    if (maybeResultArray.length === 1) {
      return maybeResultArray[0];
    }

    throw new Error("Result of expression could not be singularized.");
  }

  static asSingleNodeOrThrow(maybeNode) {
    if (maybeNode === null || maybeNode === undefined) {
      return maybeNode;
    }

    if (Array.isArray(maybeNode)) {
      throw new Error(`Prop was array ${JSON.stringify(maybeNode, null, "  ")}`);
    }

    if (VisitorUtils.isNode(maybeNode)) {
      return maybeNode;
    }

    throw new Error(`Prop was not undefined, null, or node -- ${JSON.stringify(maybeNode, null, "  ")}`);
  }

  static asNodeArrayOrThrow(maybeNodes) {
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
  }

  static propToNodeArrayOrThrow(node, maybeProp) {
    try {
      return VisitorUtils.asNodeArrayOrThrow(node[maybeProp]);
    } catch (ex) {
      throw new Error(`[${node.type}.${maybeProp}] ${ex.message}`);
    }
  }

  static propsToChildNodes(
    node,
    propsToCheck = NODE_PROPS_THAT_CAN_BE_CHECKED
  ) {
    const outcome = {};

    for (const [prop, wantToCheck] of Object.entries(propsToCheck)) {
      const canCheck = NODE_PROPS_THAT_CAN_BE_CHECKED[prop];
      if (canCheck && wantToCheck) {
        outcome[prop] = VisitorUtils.propToNodeArrayOrThrow(node, prop);
      }
    }

    return outcome;
  }

  /** Produces a single nodeChild or  */
  static nodeChild(_node) {
    return undefined;
  }
}

const TYPE_TO_PROPS = {
  grammar: {
    imports: true,
    topLevelInitializer: true,
    initializer: true,
    rules: true,
  },
};

class VisitorBase {
  visit(node, ...args) {
    return this.visitAllChildNodes(node, ...args);
  }

  visitAllChildNodes(node, ...args) {
    const childNodesObj = VisitorUtils.propsToChildNodes(node);
    return this.visitChildrenByNodeObj(childNodesObj, ...args);
  }

  visitChildByProp(prop, node, ...args) {
    const childNode = VisitorUtils.asSingleNodeOrThrow(node[prop]);
    return this.visit(childNode, ...args);
  }

  visitChildrenByProp(prop, node, ...args) {
    const childNodes = VisitorUtils.asNodeArrayOrThrow(node[prop]);
    return childNodes.map(childNode => this.visit(childNode, ...args));
  }

  visitChildrenByProps(whichPropsObj, node, ...args) {
    const childNodesObj = VisitorUtils.propsToChildNodes(node, whichPropsObj);
    return this.visitChildrenByNodeObj(childNodesObj, ...args);
  }

  visitChildrenByNodeObj(childNodesObj, ...args) {
    const outputs = {};

    for (const [key, childNode] of Object.entries(childNodesObj)) {
      outputs[key] = childNode.map(child => this.visit(child, ...args));
    }

    return outputs;
  }
}

// Simple AST node visitor builder.
class VisitorAdapter extends VisitorBase {
  constructor(functions) {
    super();
    this.functions = functions;
  }

  visit(node, ...args) {
    const visitorOverride = this.functions[node.type];
    if (visitorOverride) { return visitorOverride(node, ...args); }

    return this.visitAdaptations(node, ...args);
  }

  visitAdaptations(node, ...args) {
    switch (node.type) {
      case "grammar":
        return super.visitChildrenByProps(
          TYPE_TO_PROPS.grammar, node, ...args
        );

      case "rule":
      case "named":
      case "action":
      case "labeled":
      case "text":
      case "simple_and":
      case "simple_not":
      case "optional":
      case "zero_or_more":
      case "one_or_more":
      case "group":
        // Expressions are a special case for backwards compat -- some callers expect it to return a singular value
        return super.visitChildByProp("expression", node, ...args);

      case "choice": // Originally: visitChildren("alternatives"),
        return super.visitChildrenByProp("alternatives", node, ...args);

      case "sequence": // Originally: visitChildren("elements"),
        return super.visitChildrenByProp("elements", node, ...args);

      // Leaf Nodes. Originally called to `visitNop` which does nothing.
      case "grammar_import":
      case "top_level_initializer":
      case "initializer":
      case "semantic_and":
      case "semantic_not":
      case "rule_ref":
      case "library_ref":
      case "literal":
      case "class":
      case "any":
        return undefined;

      case "repeated": // Originally: visit (node.delimiter)? -> node.expression
        return [
          ...this.visitChildrenByProp("delimiter", node, ...args),
          this.visitChildByProp("expression", node, ...args),
        ];

      // By default, attempt to recurse into all known recurse-able sub-properties
      default:
        throw new Error(`[${node.type}] Node type not part of adapted specification.`);
    }
  }

  static build(functions) {
    const adapter = new VisitorAdapter(functions);
    return (node, ...args) => adapter.visit(node, ...args);
  }
}

module.exports = VisitorAdapter;
