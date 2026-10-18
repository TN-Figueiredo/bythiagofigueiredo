// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerVideoForaDosCem } from '../src/app/cms/(authed)/youtube/ab-lab/new/video-fora'

const U = '0b4c1e6a-1111-4222-8333-444455556666'

function fake(video: unknown, abertos: unknown[], calls: string[][] = []) {
  const q = (tabela: string, resultado: unknown) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'limit']) b[m] = (...a: unknown[]) => { calls.push([tabela, m, ...a.map(String)]); return b }
    b.maybeSingle = async () => ({ data: resultado, error: null })
    b.then = (ok: (v: unknown) => unknown) => ok({ data: resultado, error: null })
    return b
  }
  return { from: (t: string) => (t === 'youtube_videos' ? q(t, video) : q(t, abertos)) } as unknown as SupabaseClient
}
const v = (o: object = {}) => ({ id: U, title: 'T', thumbnail_url: 'u', thumbnail_hq_url: 'hq', duration_seconds: 600, youtube_channels: { handle: '@x' }, ...o })

describe('lerVideoForaDosCem', () => {
  it('vídeo do site fora dos 100 entra', async () => {
    const calls: string[][] = []
    const r = await lerVideoForaDosCem(fake(v(), [], calls), 's1', U)
    expect(r).toMatchObject({ id: U, hasActiveTest: false, channelHandle: '@x' })
    expect(calls).toContainEqual(['youtube_videos', 'eq', 'site_id', 's1'])
    expect(calls).toContainEqual(['ab_tests', 'in', 'status', 'draft,active,paused,queued'])
  })
  it('outro site (nada lido) mantém o aviso', async () => expect(await lerVideoForaDosCem(fake(null, []), 's1', U)).toBeNull())
  it('Short mantém o aviso', async () => expect(await lerVideoForaDosCem(fake(v({ duration_seconds: 45 }), []), 's1', U)).toBeNull())
  it('sem thumb HQ mantém o aviso', async () => expect(await lerVideoForaDosCem(fake(v({ thumbnail_hq_url: null }), []), 's1', U)).toBeNull())
  it('teste aberto (inclui queued) marca hasActiveTest', async () => {
    expect((await lerVideoForaDosCem(fake(v(), [{ id: 'a' }]), 's1', U))?.hasActiveTest).toBe(true)
  })
  it('não uuid não consulta', async () => expect(await lerVideoForaDosCem(fake(v(), []), 's1', 'dQw4w9WgXcQ')).toBeNull())
})
