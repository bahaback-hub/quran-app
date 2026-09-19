/**
 * Provider registry — a singleton mapping provider ids to implementations.
 *
 * Built-in providers are registered by the composition root (`api-client.ts`)
 * when it first loads. Tests and feature toggles can install an OVERRIDE for
 * any id; `getProvider` resolves the override first, then the built-in. This
 * is the "seam" the rest of the data layer uses: swapping a provider (e.g. a
 * different prayer API) is a single `overrideProvider` call.
 */

import type { JsonProvider } from './types.js';

const builtins = new Map<string, JsonProvider>();
const overrides = new Map<string, JsonProvider>();

/** Register a built-in provider. Re-registering an id replaces the previous one. */
export function registerProvider(provider: JsonProvider): void {
  builtins.set(provider.id, provider);
}

/**
 * Resolve the effective provider for an id. A registered override wins over
 * the built-in. Throws if no provider is known for the id.
 */
export function getProvider<T extends JsonProvider = JsonProvider>(id: string): T {
  const effective = overrides.get(id) ?? builtins.get(id);
  if (!effective) {
    throw new Error(`[Provider] No provider registered for "${id}".`);
  }
  return effective as T;
}

/** Install a temporary override for an id (tests, experiments, hot-swaps). */
export function overrideProvider(id: string, provider: JsonProvider): void {
  overrides.set(id, provider);
}

/** Remove the override for an id, restoring the built-in provider. */
export function clearOverride(id: string): void {
  overrides.delete(id);
}

/** Whether an id currently has an override installed. */
export function hasOverride(id: string): boolean {
  return overrides.has(id);
}

/** Clear every override, restoring all built-in providers. */
export function clearOverrides(): void {
  overrides.clear();
}

/** Reset overrides AND built-ins (test isolation). */
export function resetRegistry(): void {
  overrides.clear();
  builtins.clear();
}

/** Every known provider id (overrides first, deduped). */
export function listProviderIds(): string[] {
  return Array.from(new Set([...builtins.keys(), ...overrides.keys()]));
}
