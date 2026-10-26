/**
 * Integração (C1 do portão M6): getAbDraftById contra o PostgREST real.
 * ab_tests tem duas FKs para ab_test_variants (test_id e winner_variant_id); sem a dica `!test_id` o embed dá
 * PGRST201 e a função devolvia null (os testes com cliente falso não pegam isso).
 *
 * Run: HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/ab-m6-rascunho-leitura.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'
import { apagarSitesDeTeste } from '../helpers/limpa-cena'

let _siteId = 'unset'
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(async () => ({ siteId: _siteId, orgId: 'org-mock', defaultLocale: 'pt-BR', timezone: 'America/Sao_Paulo' })),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 't@t.com' } } }) } }),
  requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'user-mock' } })),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { getAbDraftById } from '@/app/cms/(authed)/youtube/ab-lab/queries'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

describe.skipIf(skipIfNoLocalDb())('getAbDraftById (PostgREST real)', () => {
  let siteId = ''
  let draftId = ''

  beforeAll(async () => {
    siteId = (await seedSite(supabase)).siteId
    _siteId = siteId
    const suffix = randomUUID().replace(/-/g, '').slice(0, 22)
    const { data: ch, error: e1 } = await supabase.from('youtube_channels').insert({
      site_id: siteId, channel_id: `UC${suffix}`, locale: 'pt', handle: `@t-${suffix.slice(0, 8)}`, name: 'Canal', uploads_playlist_id: `UU${suffix}`,
    }).select('id').single()
    if (e1 || !ch) throw new Error(`canal: ${e1?.message}`)
    const { data: vid, error: e2 } = await supabase.from('youtube_videos').insert({
      site_id: siteId, channel_id: ch.id, youtube_video_id: suffix.slice(0, 11), title: 'Vídeo', published_at: new Date().toISOString(), duration_seconds: 300,
    }).select('id').single()
    if (e2 || !vid) throw new Error(`vídeo: ${e2?.message}`)
    const { data: t, error: e3 } = await supabase.from('ab_tests').insert({
      site_id: siteId, youtube_video_id: vid.id, name: 'Test: Meu vídeo', test_type: 'combo', status: 'draft',
      original_thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg',
    }).select('id').single()
    if (e3 || !t) throw new Error(`teste: ${e3?.message}`)
    draftId = t.id
    const { error: e4 } = await supabase.from('ab_test_variants').insert([
      { test_id: draftId, label: 'B', is_original: false, sort_order: 1, blob_url: 'https://blob/B.jpg', title_text: 'Fila de 3 h' },
      { test_id: draftId, label: 'original', is_original: true, sort_order: 0, blob_url: 'https://blob/A.jpg', title_text: null },
    ])
    if (e4) throw new Error(`variantes: ${e4.message}`)
  })

  afterAll(async () => {
    if (draftId) {
      await supabase.from('ab_test_variants').delete().eq('test_id', draftId)
      await supabase.from('ab_tests').delete().eq('id', draftId)
    }
    if (siteId) await supabase.from('youtube_videos').delete().eq('site_id', siteId)
    if (siteId) await supabase.from('youtube_channels').delete().eq('site_id', siteId)
    if (siteId) await apagarSitesDeTeste('id = any($1::uuid[])', [[siteId]])
  })

  it('devolve o rascunho com as variantes em ordem (não null por PGRST201)', async () => {
    const r = await getAbDraftById(draftId)
    expect(r).not.toBeNull()
    expect(r?.variants.map(v => v.label)).toEqual(['original', 'B'])
    expect(r?.variants[1]).toMatchObject({ thumbUrl: 'https://blob/B.jpg', titleText: 'Fila de 3 h' })
  })
})
