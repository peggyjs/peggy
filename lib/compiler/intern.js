// @ts-check
"use strict";

/**
 * Intern strings or objects, so there is only one copy of each, by value.
 * Objects may need to be converted to another representation before storing.
 * Each inputs corresponds to a number, starting with 0.
 *
 * @template [T=string],[V=T]
 */
class Intern {
  /**
   * @typedef {object} InternOptions
   * @property {(input: V) => string} [stringify=String] Represent the
   *   converted input as a string, for value comparison.
   * @property {(input: T) => V} [convert=(x) => x] Convert the input to its
   *   stored form.  Required if type V is not the same as type T.  Return
   *   falsy value to have this input not be added; add() will return -1 in
   *   this case.
   */

  /**
   * @param {InternOptions} [options]
   */
  constructor(options) {
    /** @type {Required<InternOptions>} */
    this.options = {
      stringify: String,
      convert: x => /** @type {V} */ (/** @type {unknown} */ (x)),
      ...options,
    };
    /** @type {V[]} */
    this.items = [];
    /** @type {Record<string, number>} */
    this.offsets = Object.create(null);
  }

  /**
   * Intern an item, getting it's asssociated number.  Returns -1 for falsy
   * inputs. O(1) with constants tied to the convert and stringify options.
   *
   * @param {T} input
   * @return {number}
   */
  add(input) {
    const c = this.options.convert(input);
    if (!c) {
      return -1;
    }
    const s = this.options.stringify(c);
    let num = this.offsets[s];
    if (num === undefined) {
      num = this.items.push(c) - 1;
      this.offsets[s] = num;
    }
    return num;
  }

  /**
   * @param {number} i
   * @returns {V}
   */
  get(i) {
    return this.items[i];
  }

  /**
   * @template U
   * @param {(value: V, index: number, array: V[]) => U} fn
   * @returns {U[]}
   */
  map(fn) {
    return this.items.map(fn);
  }
}

module.exports = Intern;
