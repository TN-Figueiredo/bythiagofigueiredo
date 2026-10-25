// @vitest-environment node
// M10a (Tarefa 7, passo 3): as três passadas do código novo contra o banco local, com 20 vídeos ativos e 40 congelados.
// O congelado não é lido, capturado nem regravado; nenhuma recusa `video_congelado` aparece; os 20 ativos seguem gravando.
// Banco: bythiago_int (54421/54422). O par de regressão documenta o custo de reverter o código depois de congelar.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import pg from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { M10A_EM_MIGRATION, m10aNoBanco } from './video-antigo-m10a-caminho'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn(async () => ({ url: 'https://blob.test/x.jpg' })) }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/youtube/thumb-fingerprint', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/youtube/thumb-fingerprint')>()
  return {
    ...real,
    probeThumb: vi.fn(async (youtubeId: string) => ({ etag: '"e1"', lastModified: null, dhash: '0000000000000000', bytes: Buffer.from('img'), url: real.thumbUrl(youtubeId) })),
    archiveThumb: vi.fn(async (videoUuid: string) => `https://blob.test/${videoUuid}.jpg`),
  }
})
import * as Sentry from '@sentry/nextjs'
import { syncCompetitorChannel, syncCompetitorWeekly, spDate } from '@/lib/youtube/competitor-sync'
import { captureItems } from '@/lib/youtube/competitor-capture'
import { addDays } from '@/lib/youtube/competitor-tiers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarCanaisDeTeste, apagarSitesDeTeste } from '../helpers/limpa-cena'

const pular = skipIfNoLocalDb() || (!M10A_EM_MIGRATION && !(await m10aNoBanco()))
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
if (!pular) vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 })

const H = 3_600_000
const sp = (day: string, hhmm: string): Date => new Date(`${day}T${hhmm}:00-03:00`)
interface FakeVideo { id: string; title: string; publishedAt: string; views: number }
const itemOf = (v: FakeVideo) => ({
  id: v.id,
  snippet: { title: v.title, description: 'descrição de ' + v.id, publishedAt: v.publishedAt, tags: ['t1'], categoryId: '22', thumbnails: { high: { url: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` } } },
  statistics: { viewCount: String(v.views), likeCount: String(Math.floor(v.views / 100)), commentCount: '2' },
  contentDetails: { duration: 'PT10M' },
})
const makeFetch = (channelId: string, videos: FakeVideo[], askedIds: string[]): typeof fetch => (async (input: RequestInfo | URL) => {
  const u = new URL(String(input))
  if (u.pathname.endsWith('/channels')) return Response.json({ items: [{ id: channelId, contentDetails: { relatedPlaylists: { uploads: 'UU' + channelId } }, snippet: { title: 'Canal', description: 'd', customUrl: '@c', country: 'BR', publishedAt: '2020-01-01T00:00:00Z', thumbnails: { default: { url: 'https://yt3.test/a.jpg' } } }, statistics: { subscriberCount: '1000', videoCount: String(videos.length), viewCount: '99999' } }] })
  if (u.pathname.endsWith('/playlistItems')) {
    const from = Number(u.searchParams.get('pageToken') ?? 0)
    return Response.json({ items: videos.slice(from, from + 50).map(v => ({ snippet: { resourceId: { videoId: v.id } } })), ...(from + 50 < videos.length ? { nextPageToken: String(from + 50) } : {}) })
  }
  if (u.pathname.endsWith('/videos')) {
    const ids = (u.searchParams.get('id') ?? '').split(',').filter(Boolean)
    askedIds.push(...ids)
    return Response.json({ items: ids.map(id => videos.find(v => v.id === id)).filter((v): v is FakeVideo => v !== undefined).map(itemOf) })
  }
  return new Response('inesperado ' + u.href, { status: 500 })
}) as typeof fetch

const OITO = ['competitor_video_versions', 'competitor_field_versions', 'competitor_raw', 'competitor_video_tier_spans', 'competitor_video_comment_snaps', 'competitor_hour_fold_log', 'competitor_changes', 'competitor_readings'] as const

describe.skipIf(pular)('M10a: a coleta com 20 ativos e 40 congelados (banco local)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let c: pg.Client
  let site = '', chId = ''
  const channelYt = 'UCm10acoleta'
  const frozenYt: string[] = [], activeYt: string[] = []
  let frozenIds: string[] = [], activeIds: string[] = []
  const videos: FakeVideo[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    c = new pg.Client({ connectionString: DB_URL })
    await c.connect()
    site = (await seedSite(sb)).siteId
    const r = await sb.from('competitor_channels').insert({ site_id: site, channel_id: channelYt, channel_name: 'm10a', video_limit: 10 }).select('id').single()
    expect(r.error).toBeNull()
    chId = r.data!.id as string
  })
  afterAll(async () => {
    try {
      if (site) {
        await c.query(`delete from public.competitor_changes where site_id = $1`, [site])
        await apagarCanaisDeTeste('site_id = any($1::uuid[])', [[site]])
        await sb.from('competitor_settings').delete().eq('site_id', site)
        await sb.from('youtube_quota_usage').delete().eq('site_id', site)
        await sb.from('audit_log').delete().eq('site_id', site)
        await sb.from('notifications').delete().eq('site_id', site)
        await apagarSitesDeTeste('id = any($1::uuid[])', [[site]])
      }
    } finally { await c.end() }
  })

  const snapshot = async () => {
    const out: Record<string, unknown> = {}
    for (const t of OITO) {
      const col = ['competitor_video_versions', 'competitor_field_versions', 'competitor_raw'].includes(t) ? ', max(last_seen_at) as m' : ''
      const r = await c.query(`select count(*)::int as n${col} from public.${t} where video_id = any($1::uuid[])`, [frozenIds])
      out[t] = r.rows[0]
    }
    out.linhas = (await c.query(`select id, row_to_json(v)::text as j from public.competitor_videos v where id = any($1::uuid[]) order by id`, [frozenIds])).rows
    out.total_canal = (await c.query(`select count(*)::int as n from public.competitor_videos where competitor_channel_id = $1`, [chId])).rows[0].n
    return out
  }
  const ativos = async () => ({
    versions: (await c.query(`select count(*)::int as n from public.competitor_video_versions where video_id = any($1::uuid[])`, [activeIds])).rows[0].n,
    raw: (await c.query(`select count(*)::int as n from public.competitor_raw where video_id = any($1::uuid[])`, [activeIds])).rows[0].n,
    spans: (await c.query(`select count(*)::int as n from public.competitor_video_tier_spans where video_id = any($1::uuid[])`, [activeIds])).rows[0].n,
  })

  it('20 ativos e 40 congelados: três passadas sem recusa, congelado intocado, ativos gravando; o total do canal não muda', async () => {
    const hoje = spDate(Date.now())
    const D1 = addDays(hoje, -10), D2 = addDays(D1, 1)
    const N1 = sp(D1, '12:00'), N2 = sp(D2, '12:00')
    // ordem da página de uploads: 2 congelados na frente, depois os 20 ativos, depois os 38 congelados restantes
    for (let i = 0; i < 40; i++) frozenYt.push('frz' + String(i).padStart(8, '0'))
    for (let i = 0; i < 20; i++) activeYt.push('act' + String(i).padStart(8, '0'))
    const pub = (hoursBefore: number) => new Date(N1.getTime() - hoursBefore * H).toISOString()
    const f = (i: number): FakeVideo => ({ id: frozenYt[i]!, title: 'Congelado ' + i, publishedAt: pub(24 * 100 + i), views: 500 + i })
    const a = (i: number): FakeVideo => ({ id: activeYt[i]!, title: 'Ativo ' + i, publishedAt: pub(24 * 5 + i), views: 900 + i })
    videos.push(f(0), f(1), ...activeYt.map((_, i) => a(i)), ...frozenYt.slice(2).map((_, i) => f(i + 2)))
    // 1) semeia pela própria sincronização (todos entram), depois congela os 40 por update direto
    await syncCompetitorChannel({ id: chId, channel_id: channelYt, site_id: site }, 'k', { now: N1, fetchImpl: makeFetch(channelYt, videos, []), deferBackfill: true })
    const jaTem = new Set((await c.query(`select video_id from public.competitor_videos where competitor_channel_id = $1`, [chId])).rows.map(r => r.video_id as string))
    for (const v of videos.filter(x => !jaTem.has(x.id))) await c.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, last_seen_at) values ($1, $2, $3, $4, now())`, [chId, v.id, v.title, v.publishedAt])
    const rows = (await c.query(`select id, video_id from public.competitor_videos where competitor_channel_id = $1`, [chId])).rows as Array<{ id: string; video_id: string }>
    expect(rows).toHaveLength(60)
    frozenIds = rows.filter(r => frozenYt.includes(r.video_id)).map(r => r.id)
    activeIds = rows.filter(r => activeYt.includes(r.video_id)).map(r => r.id)
    expect(frozenIds).toHaveLength(40)
    await c.query(`update public.competitor_videos set archive_frozen_at = now() where id = any($1::uuid[])`, [frozenIds])
    const antes = await snapshot()
    const ativosAntes = await ativos()
    vi.mocked(Sentry.captureException).mockClear()
    // 2) as três passadas com o conteúdo do YouTube mudado
    for (const v of videos) { v.views += 100; v.title += ' (v2)' } // o título novo abre campo e raw novos nos ativos; nos congelados não pode abrir nada
    const pedidos: string[] = []
    const fetchImpl = makeFetch(channelYt, videos, pedidos)
    const resultados: unknown[] = []
    resultados.push(await syncCompetitorChannel({ id: chId, channel_id: channelYt, site_id: site }, 'k', { now: N2, fetchImpl, deferBackfill: true })) // diária e página de uploads (2 congelados nela)
    for (let d = 0; d < 7; d++) resultados.push(await syncCompetitorWeekly({ id: chId, channel_id: channelYt, site_id: site }, 'k', { now: sp(addDays(D2, d), '12:00'), fetchImpl }))
    // nenhuma recusa video_congelado, nem no resultado, nem no Sentry
    expect(JSON.stringify(resultados)).not.toContain('video_congelado')
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls.map(x => String((x[0] as Error)?.message ?? x[0])))).not.toContain('video_congelado')
    // a lista da página de uploads cita os congelados em videos.list (é uma chamada de 50 ids); fora dela nenhuma passada os pede
    expect(pedidos.filter(id => frozenYt.includes(id)).length).toBeLessThanOrEqual(38)
    // os 20 ativos foram gravados
    const ativosDepois = await ativos()
    expect(ativosDepois.versions).toBeGreaterThan(ativosAntes.versions)
    expect(ativosDepois.raw).toBeGreaterThan(ativosAntes.raw)
    // os 40: mesmas contagens, mesmo max(last_seen_at), mesma linha byte a byte; o canal mantém 60 vídeos (V1)
    expect(await snapshot()).toEqual(antes)
  })

  it('par de regressão: captureItems com 1 congelado e 49 ativos lança e não grava nenhum dos 49 (custo de reverter o código depois de congelar)', async () => {
    const lote = [frozenIds[0]!, ...activeIds.slice(0, 19)]
    const extra = (await c.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at) select $1, 'reg' || lpad(g::text, 8, '0'), 'r', now() - interval '3 days' from generate_series(1, 30) g returning id`, [chId])).rows.map(r => r.id as string)
    const ids = [...lote, ...extra]
    expect(ids).toHaveLength(50)
    const antes = (await c.query(`select count(*)::int as n from public.competitor_field_versions where video_id = any($1::uuid[])`, [ids.slice(1)])).rows[0].n
    const itens = ids.map(id => ({ videoId: id, fields: [{ field: 'title', value: 'novo ' + id }], raw: null, prevSeenAt: null, weeklySince: null }))
    await expect(captureItems(sb as never, { siteId: site, channelId: chId, scope: 'video', items: itens as never, nowIso: new Date().toISOString() })).rejects.toThrow()
    const depois = (await c.query(`select count(*)::int as n from public.competitor_field_versions where video_id = any($1::uuid[])`, [ids.slice(1)])).rows[0].n
    expect(depois).toBe(antes)
  })
})
