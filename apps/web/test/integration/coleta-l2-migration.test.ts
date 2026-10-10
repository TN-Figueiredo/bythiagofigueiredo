// @vitest-environment node
// Tabelas e função do lote L2, no banco local.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL, ANON_KEY } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe.skipIf(skipIfNoLocalDb())('coleta L2: schema (banco local)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId = ''
  let canal = ''
  const sufixo = randomUUID().slice(0, 8)
  const yt = `yt2-${sufixo}`
  const V = 'views_2025-03-31_a_2026-08-26'
  const alcance = (extra: Record<string, unknown> = {}) => ({
    youtube_video_id: yt, day_pt: '2026-09-25', site_id: siteId, video_id: null, channel_id: canal,
    thumbnail_impressions: 3, thumbnail_ctr: 0.33333333333333331,
    source_report_id: `rel-a-${sufixo}`, report_create_time: '2026-10-01T10:00:00.000Z', metric_version: V, ...extra,
  })
  const lerAlcance = async () =>
    (await sb.from('yt_own_video_reach_daily').select('thumbnail_impressions, thumbnail_ctr, source_report_id').eq('youtube_video_id', yt).single()).data

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    siteId = (await seedSite(sb)).siteId
    const ch = await sb.from('youtube_channels').insert({
      site_id: siteId, channel_id: `UCl2${sufixo}`, locale: 'pt', handle: `@l2${sufixo}`, name: 'Canal L2', uploads_playlist_id: `UUl2${sufixo}`,
    }).select('id').single()
    if (ch.error || !ch.data) throw new Error(ch.error?.message ?? 'canal não criado')
    canal = ch.data.id as string
  })
  afterAll(async () => {
    for (const t of ['yt_own_video_daily', 'yt_own_video_reach_daily']) await sb.from(t).delete().eq('site_id', siteId)
    await sb.from('sites').delete().eq('id', siteId)
  })

  it('diário: toda métrica nasce nula, a chave é (youtube_video_id, day_pt) e metric_version fora da lista é recusada', async () => {
    const base = { youtube_video_id: yt, day_pt: '2026-10-01', site_id: siteId, channel_id: canal, metric_version: V }
    expect((await sb.from('yt_own_video_daily').insert(base)).error).toBeNull()
    expect((await sb.from('yt_own_video_daily').insert(base)).error?.code).toBe('23505')
    const lido = await sb.from('yt_own_video_daily').select('views, engaged_views, avg_view_percentage, card_click_rate, source, video_id').eq('youtube_video_id', yt).single()
    expect(lido.data).toEqual({ views: null, engaged_views: null, avg_view_percentage: null, card_click_rate: null, source: 'analytics_api', video_id: null })
    const ruim = await sb.from('yt_own_video_daily').insert({ ...base, day_pt: '2026-10-02', metric_version: 'qualquer' })
    expect(ruim.error?.code).toBe('23514')
  })

  it('diário: upsert sem a coluna não apaga o valor que já estava gravado', async () => {
    const chave = { youtube_video_id: yt, day_pt: '2026-10-03', site_id: siteId, channel_id: canal, metric_version: V }
    expect((await sb.from('yt_own_video_daily').upsert({ ...chave, views: 7, avg_view_percentage: 41.5 }, { onConflict: 'youtube_video_id,day_pt' })).error).toBeNull()
    expect((await sb.from('yt_own_video_daily').upsert({ ...chave, views: 9 }, { onConflict: 'youtube_video_id,day_pt' })).error).toBeNull()
    const lido = await sb.from('yt_own_video_daily').select('views, avg_view_percentage').eq('youtube_video_id', yt).eq('day_pt', '2026-10-03').single()
    expect(lido.data).toEqual({ views: 9, avg_view_percentage: 41.5 })
  })

  it('yt_own_reach_apply: insere; relatório mais velho não sobrescreve; mais novo sobrescreve; o mesmo relatório sobrescreve', async () => {
    const a = await sb.rpc('yt_own_reach_apply', { p_rows: [alcance()] })
    expect(a.error).toBeNull()
    expect(a.data).toBe(1)
    expect(await lerAlcance()).toMatchObject({ thumbnail_impressions: 3, source_report_id: `rel-a-${sufixo}` })

    const velho = await sb.rpc('yt_own_reach_apply', { p_rows: [alcance({ thumbnail_impressions: 99, source_report_id: `rel-velho-${sufixo}`, report_create_time: '2026-09-30T10:00:00.000Z' })] })
    expect(velho.data).toBe(0)
    expect(await lerAlcance()).toMatchObject({ thumbnail_impressions: 3 })

    const novo = await sb.rpc('yt_own_reach_apply', { p_rows: [alcance({ thumbnail_impressions: 5, thumbnail_ctr: null, source_report_id: `rel-novo-${sufixo}`, report_create_time: '2026-10-02T10:00:00.000Z' })] })
    expect(novo.data).toBe(1)
    expect(await lerAlcance()).toEqual({ thumbnail_impressions: 5, thumbnail_ctr: null, source_report_id: `rel-novo-${sufixo}` })

    const mesmo = await sb.rpc('yt_own_reach_apply', { p_rows: [alcance({ thumbnail_impressions: 6, source_report_id: `rel-novo-${sufixo}`, report_create_time: '2026-10-02T10:00:00.000Z' })] })
    expect(mesmo.data).toBe(1)
    expect(await lerAlcance()).toMatchObject({ thumbnail_impressions: 6 })
  })

  it('yt_own_reach_apply com lista vazia devolve 0 e não dá erro', async () => {
    const r = await sb.rpc('yt_own_reach_apply', { p_rows: [] })
    expect(r.error).toBeNull()
    expect(r.data).toBe(0)
  })

  it('canal com linha no diário ou no alcance não pode ser apagado (23503) e conta como série coletada', async () => {
    const del = await sb.from('youtube_channels').delete().eq('id', canal)
    expect(del.error?.code).toBe('23503')
    const impacto = await sb.rpc('youtube_channel_removal_impact', { p_site_id: siteId, p_channel_id: canal })
    expect((impacto.data as { serie_coletada: number }).serie_coletada).toBeGreaterThanOrEqual(3)
  })

  it('anon não lê as tabelas nem chama a função', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    for (const tabela of ['yt_own_video_daily', 'yt_own_video_reach_daily']) {
      const r = await anon.from(tabela).select('*').limit(1)
      expect(r.error !== null || (r.data ?? []).length === 0, tabela).toBe(true)
    }
    expect((await anon.rpc('yt_own_reach_apply', { p_rows: [] })).error).not.toBeNull()
  })
})
