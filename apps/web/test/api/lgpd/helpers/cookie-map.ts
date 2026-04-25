/**
 * Shared mutable cookie store for LGPD route tests.
 * Used by vi.mock('next/headers', async () => { ... }) factories which are
 * hoisted and cannot close over test-file-level variables.
 */
let map: Record<string, string> = {};

export function getCookieMap(): Record<string, string> {
  return map;
}

export function setCookieMap(values: Record<string, string>): void {
  map = { ...map, ...values };
}

export function clearCookieMap(): void {
  map = {};
}
