// A faithful next/cache for loader tests. The global stub (test/__stubs__/next-cache.ts) makes unstable_cache a
// pass-through: with it a hit, a tag invalidation and the 2 MB entry limit are never exercised. Use with
// vi.doMock('next/cache', () => cache.module) before importing the module under test.
export const NEXT_ENTRY_LIMIT = 2 * 1024 * 1024

export interface FakeNextCache {
  module: {
    unstable_cache: <A extends unknown[], R>(cb: (...args: A) => Promise<R>, keyParts?: string[], options?: { tags?: string[]; revalidate?: number | false }) => (...args: A) => Promise<R>
    revalidateTag: (tag: string, profile?: string | { expire?: number }) => void
    updateTag: (tag: string) => void
    revalidatePath: (path: string, type?: string) => void
  }
  /** key → stored body and tags. */
  entries: Map<string, { body: string; tags: string[] }>
  /** Keys whose callback ran. */
  misses: string[]
  /** Keys computed but NOT stored: over the limit, as Next does (incremental-cache/index.js, "items over 2MB"). */
  rejected: string[]
  invalidated: string[]
}

export function createFakeNextCache(): FakeNextCache {
  const entries = new Map<string, { body: string; tags: string[] }>()
  const misses: string[] = [], rejected: string[] = [], invalidated: string[] = []
  const unstable_cache = <A extends unknown[], R>(cb: (...args: A) => Promise<R>, keyParts: string[] = [], options: { tags?: string[]; revalidate?: number | false } = {}) =>
    async (...args: A): Promise<R> => {
      // same recipe as next/dist/server/web/spec-extension/unstable-cache.js (fixedKey + JSON.stringify(args))
      const key = cb.toString() + '-' + keyParts.join(',') + '-' + JSON.stringify(args)
      const hit = entries.get(key)
      if (hit) return JSON.parse(hit.body) as R
      misses.push(key)
      // a throwing callback stores nothing: the error goes up
      const result = await cb(...args)
      const body = JSON.stringify(result)
      const size = JSON.stringify({ kind: 'FETCH', data: { headers: {}, body, status: 200, url: '' }, revalidate: options.revalidate ?? 31_536_000 }).length
      if (size > NEXT_ENTRY_LIMIT) rejected.push(key)
      else entries.set(key, { body, tags: options.tags ?? [] })
      return result
    }
  const revalidateTag = (tag: string) => { invalidated.push(tag); for (const [k, e] of entries) if (e.tags.includes(tag)) entries.delete(k) }
  return { entries, misses, rejected, invalidated, module: { unstable_cache, revalidateTag, updateTag: revalidateTag, revalidatePath: () => {} } }
}
