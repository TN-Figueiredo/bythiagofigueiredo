// @vitest-environment node
// apps/web/test/youtube/observatorio/load-videos.test.ts — the videos read asks for pinned_at and fails loudly without it.
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('server-only', () => ({}))
import { readVideos, ObservatoryLoadError } from '@/lib/youtube/observatorio/load'

type Res = { data: unknown; error: { code?: string; message: string } | null }
function fake(results: Res[]) {
  const cols: string[] = []
  const sb = {
    from: (table: string) => ({
      select: (c: string) => {
        cols.push(table + ':' + c)
        const q = { in: () => q, order: () => q, range: async () => results[Math.min(cols.length, results.length) - 1]! }
        return q
      },
    }),
  } as unknown as SupabaseClient
  return { sb, cols }
}

describe('readVideos', () => {
  it('pede pinned_at e devolve as linhas', async () => {
    const row = { id: 'v1', competitor_channel_id: 'ch1', video_id: 'yt1', pinned_at: null }
    const { sb, cols } = fake([{ data: [row], error: null }])
    expect(await readVideos(sb, ['ch1'])).toEqual([row])
    expect(cols).toHaveLength(1)
    expect(cols[0]).toContain('pinned_at')
  })
  it('sem canais (o dado não existe): nenhuma leitura, lista vazia', async () => {
    const { sb, cols } = fake([{ data: [], error: null }])
    expect(await readVideos(sb, [])).toEqual([])
    expect(cols).toHaveLength(0)
  })
  it.each(['42703', 'PGRST204'])('coluna pinned_at ausente (%s): lança ObservatoryLoadError de competitor_videos, sem reler sem a coluna', async code => {
    const { sb, cols } = fake([{ data: null, error: { code, message: 'column competitor_videos.pinned_at does not exist' } }, { data: [], error: null }])
    const e = await readVideos(sb, ['ch1']).catch(x => x)
    expect(e).toBeInstanceOf(ObservatoryLoadError)
    expect(e.table).toBe('competitor_videos')
    expect(e.code).toBe(code)
    expect(cols).toHaveLength(1)
  })
})
