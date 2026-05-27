// Stub for `next/cache` — Next.js server-only cache APIs.
// In tests, unstable_cache is a pass-through that simply calls the wrapped fn.
export function unstable_cache<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  _keyParts?: string[],
  _options?: { revalidate?: number; tags?: string[] },
): T {
  return fn
}

export function revalidatePath(_path: string): void {}
export function revalidateTag(_tag: string): void {}
export function unstable_noStore(): void {}
