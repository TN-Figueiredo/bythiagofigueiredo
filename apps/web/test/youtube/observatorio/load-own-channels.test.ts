// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('server-only', () => ({}))
import { readOwnChannels, ObservatoryLoadError } from '@/lib/youtube/observatorio/load'

type Res = { data: unknown; error: { code?: string; message: string } | null }
function fake(results: Res[]) {
  const cols: string[] = []
  const sb = {
    from: (table: string) => ({
      select: (c: string) => {
        cols.push(table + ':' + c)
        const q = { eq: () => q, order: () => q, range: async () => results[Math.min(cols.length, results.length) - 1]! }
        return q
      },
    }),
  } as unknown as SupabaseClient
  return { sb, cols }
}
const row = { id: 'o1', channel_id: 'UC1', name: 'tn', handle: '@tn', subscriber_count: 1, last_synced_at: null }
const missing = (code: string): Res => ({ data: null, error: { code, message: 'column youtube_channels.niche does not exist' } })

describe('readOwnChannels', () => {
  it('first read passes → rows come with niche, and the select asked for niche', async () => {
    const { sb, cols } = fake([{ data: [{ ...row, niche: 'ia' }], error: null }])
    expect(await readOwnChannels(sb, 's1')).toEqual([{ ...row, niche: 'ia' }])
    expect(cols).toHaveLength(1)
    expect(cols[0]).toContain('niche')
  })
  it.each(['42703', 'PGRST204'])('%s → rereads without niche and returns the rows', async code => {
    const { sb, cols } = fake([missing(code), { data: [row], error: null }])
    expect(await readOwnChannels(sb, 's1')).toEqual([row])
    expect(cols).toHaveLength(2)
    expect(cols[0]).toContain('niche'); expect(cols[1]).not.toContain('niche')
  })
  it('another error code throws ObservatoryLoadError for youtube_channels (no retry)', async () => {
    const { sb, cols } = fake([{ data: null, error: { code: '57014', message: 'timeout' } }])
    const e = await readOwnChannels(sb, 's1').catch(x => x)
    expect(e).toBeInstanceOf(ObservatoryLoadError)
    expect(e.table).toBe('youtube_channels')
    expect(cols).toHaveLength(1)
  })
  it('42703 on the second read too → throws', async () => {
    const { sb } = fake([missing('42703'), missing('42703')])
    await expect(readOwnChannels(sb, 's1')).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
})
