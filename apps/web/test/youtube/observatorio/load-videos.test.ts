// @vitest-environment node
// apps/web/test/youtube/observatorio/load-videos.test.ts — the videos read asks for pinned_at and fails loudly without it.
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('server-only', () => ({}))
import { readVideos, loadRows, rowsToDataset, ObservatoryLoadError } from '@/lib/youtube/observatorio/load'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { buildTables, ids } from './load-fixture'

const S = 'a', NOW = Date.now()

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

describe('rowsToDataset · nulo nunca vira padrão (spec de telas 5.10)', () => {
  const montar = async (mexer: (t: Record<string, Row[]>) => void) => {
    const tables = buildTables({ siteId: S, now: NOW, channels: 1, videosPerChannel: 4 })
    mexer(tables)
    return rowsToDataset(await loadRows({ siteId: S, now: NOW, supabase: fakeSupabase(tables).client }), NOW)
  }
  const video = (t: Record<string, Row[]>, k: number) => t.competitor_videos!.find(v => v.id === ids.video(S, 0, k))!

  it('comment_count nulo fica nulo', async () => {
    const ds = await montar(t => { video(t, 0).comment_count = null })
    expect(ds.videos.find(v => v.id === ids.video(S, 0, 0))!.comments).toBeNull()
  })
  it('is_short nulo fica nulo em isShort; o fmt continua "long" para o motor', async () => {
    const ds = await montar(t => { video(t, 1).is_short = null })
    const v = ds.videos.find(x => x.id === ids.video(S, 0, 1))!
    expect(v.isShort).toBeNull()
    expect(v.fmt).toBe('long')
  })
  it('is_short verdadeiro e falso passam como estão', async () => {
    const ds = await montar(t => { video(t, 1).is_short = true; video(t, 2).is_short = false })
    expect(ds.videos.find(x => x.id === ids.video(S, 0, 1))!.isShort).toBe(true)
    expect(ds.videos.find(x => x.id === ids.video(S, 0, 2))!.isShort).toBe(false)
  })
  it('vídeo sem data não some: sai de videos e entra em channel.undated, com os campos brutos', async () => {
    const ds = await montar(t => { const v = video(t, 3); v.published_at = null; v.comment_count = null; v.is_short = null })
    expect(ds.videos.some(v => v.id === ids.video(S, 0, 3))).toBe(false)
    const u = ds.channels[0]!.undated
    expect(u).toHaveLength(1)
    expect(u[0]).toMatchObject({ id: ids.video(S, 0, 3), isShort: null, comments: null, pinned: false })
    expect(u[0]!.url).toContain(u[0]!.ytId)
  })
  it('canal sem vídeo sem data: lista vazia, nunca ausente', async () => {
    const ds = await montar(() => {})
    expect(ds.channels[0]!.undated).toEqual([])
  })
})
