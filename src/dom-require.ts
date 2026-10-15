/**
 * Strict accessors for cached DOM elements.
 *
 * The shared {@link dom} map (see `dom.ts`) starts with every value `null`
 * and is filled by `cacheDom()`, which never verifies that an element exists.
 * Scattering `dom.foo!` across features therefore asserts at compile time
 * something the runtime cannot prove: rename one id in `overlays.ts` and the
 * build still passes while the first open of that feature throws a vague
 * `TypeError`.
 *
 * These helpers replace those assertions with a single gate that fails loudly,
 * naming the offending id, so DOM drift surfaces immediately and in one place.
 *
 * Kept in a separate module from `dom.ts` on purpose: test suites globally
 * mock `dom.js` to supply element stubs, and a guard exported from there would
 * vanish in those mocks. This module reads the (mockable) `dom` binding but is
 * itself never mocked, so the gate stays live everywhere.
 */

import { dom, type DomMap } from './dom.js';

/**
 * Assert that a value is neither `null` nor `undefined` and return it,
 * throwing a descriptive error otherwise. Useful for locally-scoped element
 * maps as well as the shared {@link dom} map.
 */
export function requireEl<T>(el: T | null | undefined, id: string): NonNullable<T> {
  if (el === null || el === undefined) {
    throw new Error(`[dom] required element #${id} is missing — DOM init order is broken`);
  }
  return el as NonNullable<T>;
}

/**
 * Strict lookup into the shared {@link dom} map.
 */
export function requireDom<K extends keyof DomMap>(key: K): NonNullable<DomMap[K]> {
  return requireEl(dom[key], key);
}
