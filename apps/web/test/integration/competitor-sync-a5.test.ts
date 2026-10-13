// @vitest-environment node
// apps/web/test/integration/competitor-sync-a5.test.ts
// A5 E1 e E2, Tarefa 14a: a junção TypeScript × SQL. `syncCompetitorChannel` e `syncCompetitorWeekly` rodam DE VERDADE contra o banco
// local (nome dos parâmetros, forma dos jsonb, `upsert … ignoreDuplicates … select`, a trava com `.or()`), com um `fetch` fixo: nenhuma
// chamada ao YouTube sai da máquina. A sonda de miniatura e o arquivo são falsos. O falso do banco das Tarefas 6b a 11c não executa filtro
// nem guarda estado: tudo o que está aqui só se prova com o Postgres.
//
// Cada cenário semeia o PRÓPRIO site (as provas SQL contam o site inteiro). Nada escreve fora dos sites semeados; o fim limpa tudo e
// confere que as contagens das tabelas de fora são as de antes.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'
import { skipIfNoLocalDb, localSupabaseUrl } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'

vi.mock('@vercel/blob', () => ({ put: vi.fn(async () => ({ url: 'https://blob.test/x.jpg' })) }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
// A sonda de miniatura e o arquivo são falsos (nenhuma requisição sai): a mesma imagem sempre, o endereço do "Blob" é derivado do vídeo.
vi.mock('@/lib/youtube/thumb-fingerprint', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/youtube/thumb-fingerprint')>()
  return {
    ...real,
    probeThumb: vi.fn(async (youtubeId: string) => ({ etag: '"e1"', lastModified: null, dhash: '0000000000000000', bytes: Buffer.from('img'), url: real.thumbUrl(youtubeId) })),
    archiveThumb: vi.fn(async (videoUuid: string) => `https://blob.test/${videoUuid}.jpg`),
  }
})
import { syncCompetitorChannel, syncCompetitorWeekly, spDate, type SyncResult, type WeeklyResult } from '@/lib/youtube/competitor-sync'
import { captureItems } from '@/lib/youtube/competitor-capture'
import { readSiteHealth, schemaReady, parseCaptureHealth, parseSeriesHealth, healthVerdict } from '@/lib/youtube/competitor-health'
import { pacificDate } from '@/lib/youtube/competitor-quota'
import { weekSlotOf, dayNumber, addDays } from '@/lib/youtube/competitor-tiers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// ── contagem de idas ao banco: o cliente do Supabase resolve o `fetch` global na criação, então o embrulho entra antes de qualquer cliente ──
const dbCalls = { n: 0 }
const realFetch = globalThis.fetch
const RUN = !skipIfNoLocalDb()
if (RUN) vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })
if (RUN) {
  globalThis.fetch = ((...a: Parameters<typeof fetch>) => {
    if (String(a[0]).startsWith(localSupabaseUrl())) dbCalls.n++
    return realFetch(...a)
  }) as typeof fetch
}

const sp = (day: string, hhmm: string): Date => new Date(`${day}T${hhmm}:00-03:00`)
const H = 3_600_000
const TODAY = spDate(Date.now())

// ── o YouTube de mentira ─────────────────────────────────────────────────────────────────────────
interface FakeVideo {
  id: string; title: string; description?: string; publishedAt: string; tags?: string[]
  /** contagem de views; indefinido com `stats` indefinido = 1000. `stats: null` = a parte statistics não vem. */
  views?: number; stats?: Record<string, string> | null
  /** o YouTube não devolve mais (continua na página de uploads, como um vídeo que sumiu de videos.list) */
  gone?: boolean
}
interface World {
  channelId: string
  channelSnippet: Record<string, unknown> | null
  channelStats: Record<string, string> | null
  videos: FakeVideo[]
  /** resposta fixa de videos.list (200 sem items, com error…) */
  videosBody?: unknown
  channelsBody?: unknown
  calls: { channels: number; playlist: number; videos: number; videoIds: string[][] }
}
const world = (channelId: string, videos: FakeVideo[]): World => ({
  channelId, videos,
  channelSnippet: { title: 'Canal ' + channelId, description: 'canal de teste', customUrl: '@' + channelId.toLowerCase(), country: 'BR', publishedAt: '2020-01-01T00:00:00Z', thumbnails: { default: { url: 'https://yt3.test/a.jpg' } } },
  channelStats: { subscriberCount: '1000', videoCount: String(videos.length), viewCount: '99999' },
  calls: { channels: 0, playlist: 0, videos: 0, videoIds: [] },
})
function itemOf(v: FakeVideo) {
  const stats = v.stats === null ? undefined : (v.stats ?? { viewCount: String(v.views ?? 1000), likeCount: String(Math.floor((v.views ?? 1000) / 100)), commentCount: '2' })
  return {
    id: v.id,
    snippet: { title: v.title, description: v.description ?? 'descrição de ' + v.id, publishedAt: v.publishedAt, tags: v.tags ?? ['t1'], categoryId: '22', thumbnails: { high: { url: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` } } },
    ...(stats ? { statistics: stats } : {}),
    contentDetails: { duration: 'PT10M' },
  }
}
function makeFetch(w: World): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const u = new URL(String(input))
    if (u.pathname.endsWith('/channels')) {
      w.calls.channels++
      if (w.channelsBody !== undefined) return Response.json(w.channelsBody)
      return Response.json({ items: [{ id: w.channelId, contentDetails: { relatedPlaylists: { uploads: 'UU' + w.channelId } }, ...(w.channelSnippet ? { snippet: w.channelSnippet } : {}), ...(w.channelStats ? { statistics: w.channelStats } : {}) }] })
    }
    if (u.pathname.endsWith('/playlistItems')) {
      w.calls.playlist++
      const from = Number(u.searchParams.get('pageToken') ?? 0)
      const page = w.videos.slice(from, from + 50)
      return Response.json({ items: page.map(v => ({ snippet: { resourceId: { videoId: v.id } } })), ...(from + 50 < w.videos.length ? { nextPageToken: String(from + 50) } : {}) })
    }
    if (u.pathname.endsWith('/videos')) {
      w.calls.videos++
      const ids = (u.searchParams.get('id') ?? '').split(',').filter(Boolean)
      w.calls.videoIds.push(ids)
      if (w.videosBody !== undefined) return Response.json(w.videosBody)
      return Response.json({ items: ids.map(id => w.videos.find(v => v.id === id)).filter((v): v is FakeVideo => v !== undefined && !v.gone).map(itemOf) })
    }
    return new Response('inesperado ' + u.href, { status: 500 })
  }) as typeof fetch
}

// ── o banco ──────────────────────────────────────────────────────────────────────────────────────
type Sb = ReturnType<typeof getSupabaseServiceClient>
let sb: Sb
const sites: string[] = []
const mkSite = async (): Promise<string> => { const s = (await seedSite(sb)).siteId; sites.push(s); return s }
interface Ch { id: string; channel_id: string; site_id: string }
const mkChannel = async (site: string, tag: string, extra: Record<string, unknown> = {}): Promise<Ch> => {
  const channel_id = 'UC' + tag
  const r = await sb.from('competitor_channels').insert({ site_id: site, channel_id, channel_name: tag, video_limit: 50, ...extra }).select('id').single()
  expect(r.error).toBeNull()
  return { id: r.data!.id as string, channel_id, site_id: site }
}
const OPTS = { deferBackfill: true } as const
const sync = (c: Ch, w: World, now: Date): Promise<SyncResult> => syncCompetitorChannel(c, 'k', { now, fetchImpl: makeFetch(w), ...OPTS })
const weekly = (c: Ch, w: World, now: Date, extra: { deadline?: () => boolean } = {}): Promise<WeeklyResult> => syncCompetitorWeekly(c, 'k', { now, fetchImpl: makeFetch(w), ...extra })

const countOf = async (table: string, col: string, val: string | string[]): Promise<number> => {
  const base = sb.from(table).select('*', { count: 'exact', head: true })
  const r = await (Array.isArray(val) ? base.in(col, val) : base.eq(col, val))
  expect(r.error).toBeNull()
  return r.count ?? 0
}
const vidMap = async (ch: Ch): Promise<Record<string, string>> => {
  const r = await sb.from('competitor_videos').select('id, video_id').eq('competitor_channel_id', ch.id)
  expect(r.error).toBeNull()
  return Object.fromEntries((r.data ?? []).map(x => [x.video_id as string, x.id as string]))
}
/** As contagens que "nenhuma linha nova" compara. */
const tally = async (ch: Ch) => {
  const m = await vidMap(ch), ids = Object.values(m)
  return {
    videos: ids.length,
    raw: await countOf('competitor_raw', 'competitor_channel_id', ch.id),
    fields: await countOf('competitor_field_versions', 'competitor_channel_id', ch.id),
    spans: ids.length ? await countOf('competitor_video_tier_spans', 'video_id', ids) : 0,
    versions: ids.length ? await countOf('competitor_video_versions', 'video_id', ids) : 0,
    daily: ids.length ? await countOf('competitor_video_daily', 'video_id', ids) : 0,
    early: ids.length ? await countOf('competitor_video_early', 'video_id', ids) : 0,
  }
}
const rowOf = async (table: string, id: string, cols: string): Promise<Record<string, unknown>> => {
  const r = await sb.from(table).select(cols).eq('id', id).single()
  expect(r.error).toBeNull()
  return r.data as unknown as Record<string, unknown>
}
const vrow = (id: string, cols: string) => rowOf('competitor_videos', id, cols)
const crow = (id: string, cols: string) => rowOf('competitor_channels', id, cols)
const pointsOf = async (videoId: string): Promise<Array<{ snap_date: string; views: number | null }>> => {
  const r = await sb.from('competitor_video_daily').select('snap_date, views').eq('video_id', videoId).order('snap_date')
  expect(r.error).toBeNull()
  return (r.data ?? []) as Array<{ snap_date: string; views: number | null }>
}
const quotaRow = async (site: string, day: string) => (await sb.from('youtube_quota_usage').select('units_used, operations').eq('site_id', site).eq('date', day).maybeSingle()).data as { units_used: number; operations: Record<string, number> } | null
const iso = (d: Date) => d.toISOString()
const fieldRows = async (videoId: string, field: string): Promise<Array<{ value: unknown; is_current: boolean }>> => {
  const r = await sb.from('competitor_field_versions').select('value, is_current').eq('video_id', videoId).eq('field', field).order('id')
  expect(r.error).toBeNull()
  return (r.data ?? []) as Array<{ value: unknown; is_current: boolean }>
}

const OUTSIDE = ['competitor_channels', 'competitor_videos', 'youtube_channels', 'youtube_videos', 'sites', 'audit_log'] as const
const outsideCounts = async (): Promise<Record<string, number>> => {
  const out: Record<string, number> = {}
  for (const t of OUTSIDE) out[t] = (await sb.from(t).select('*', { count: 'exact', head: true })).count ?? -1
  return out
}
let before: Record<string, number> = {}
const perf: Record<string, unknown> = {}
let cleaned = false
const cleanup = async (): Promise<void> => {
  if (cleaned || !sites.length) return
  await sb.from('competitor_changes').delete().in('site_id', sites)
  await sb.from('competitor_removed_items').delete().in('site_id', sites)
  await sb.from('competitor_channels').delete().in('site_id', sites)
  await sb.from('competitor_settings').delete().in('site_id', sites)
  await sb.from('youtube_quota_usage').delete().in('site_id', sites)
  await sb.from('audit_log').delete().in('site_id', sites)
  await sb.from('notifications').delete().in('site_id', sites)
  await sb.from('sites').delete().in('id', sites)
  cleaned = true
}

describe.skipIf(skipIfNoLocalDb())('A5 E1 e E2: a junção do sync com o banco local', () => {
  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    before = await outsideCounts()
  })
  afterAll(async () => {
    await cleanup()
    globalThis.fetch = realFetch
    if (Object.keys(perf).length) writeFileSync(process.env.A5_PERF_OUT ?? '/dev/null', JSON.stringify(perf, null, 2))
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // O fluxo principal (passos 1 a 7 do plano, no mesmo canal: o estado de um é a entrada do seguinte)
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('fluxo principal', () => {
    let site = '', ch: Ch, w: World
    let m: Record<string, string> = {}
    const WK = 'wkvid000001', D1 = 'dayvid00001', D2 = 'dayvid00002'
    // DAY0: o dia fixo do vídeo semanal; o ciclo todo (DAY0 a DAY14) fica no passado
    let DAY0 = addDays(TODAY, -40)
    while (dayNumber(DAY0) % 7 !== weekSlotOf(WK)) DAY0 = addDays(DAY0, 1)
    const day = (n: number) => addDays(DAY0, n)
    const N1 = sp(DAY0, '12:00')
    let afterStep1 = { videos: 0, raw: 0, fields: 0, spans: 0, versions: 0, daily: 0, early: 0 }
    let r1: SyncResult

    beforeAll(async () => {
      site = await mkSite()
      ch = await mkChannel(site, 'a5main', { video_limit: 2 })
      w = world(ch.channel_id, [
        { id: D1, title: 'Diário 1', publishedAt: iso(new Date(N1.getTime() - 6 * H)), views: 1000, tags: ['a'] },
        { id: D2, title: 'Diário 2', publishedAt: iso(new Date(N1.getTime() - 30 * H)), views: 800, tags: ['a', 'b'] },
        { id: WK, title: 'Semanal', publishedAt: iso(new Date(N1.getTime() - 60 * 86_400_000)), views: 4000 },
      ])
    })

    it('1. primeira sincronização às 12:00: linha de base de campos e raw, faixas, pontos diários, cota', async () => {
      r1 = await sync(ch, w, N1)
      m = await vidMap(ch)
      expect(Object.keys(m).sort()).toEqual([D1, D2, WK].sort())
      afterStep1 = await tally(ch)
      expect(afterStep1.videos).toBe(3)
      expect(afterStep1.raw).toBe(4) // 3 vídeos + o canal
      expect(afterStep1.fields).toBe(3 * 10 + 7) // 10 campos por vídeo, 7 do canal
      expect(afterStep1.versions).toBe(9) // título, descrição e miniatura de cada vídeo
      expect(afterStep1.spans).toBe(3)
      expect(afterStep1.daily).toBe(2) // os diários
      for (const id of Object.values(m)) {
        const v = await vrow(id, 'discovered_at, last_checked_at, last_seen_at, series_tier, series_tier_since, miss_streak, views_hidden')
        expect(v.discovered_at).not.toBeNull()
        expect(Date.parse(String(v.last_checked_at))).toBe(N1.getTime())
        expect(Date.parse(String(v.last_seen_at))).toBe(N1.getTime())
        expect(v.series_tier_since).toBe(DAY0)
        expect(v.miss_streak).toBe(0)
      }
      expect((await vrow(m[D1]!, 'series_tier')).series_tier).toBe('diaria')
      expect((await vrow(m[D2]!, 'series_tier')).series_tier).toBe('diaria')
      expect((await vrow(m[WK]!, 'series_tier')).series_tier).toBe('semanal')
      const open = await sb.from('competitor_video_tier_spans').select('video_id, tier, from_date').in('video_id', Object.values(m)).is('to_date', null)
      expect((open.data ?? []).length).toBe(3)
      expect((open.data ?? []).every(s => s.from_date === DAY0)).toBe(true)
      const cur = await sb.from('competitor_raw').select('video_id').eq('competitor_channel_id', ch.id).eq('is_current', true)
      expect((cur.data ?? []).length).toBe(4)
      expect((cur.data ?? []).filter(x => x.video_id === null)).toHaveLength(1)
      const chRow = await crow(ch.id, 'sync_status, last_ok_synced_at, last_seen_at, youtube_video_count, subscriber_count')
      expect(chRow).toMatchObject({ sync_status: 'idle', youtube_video_count: 3, subscriber_count: 1000 })
      expect(Date.parse(String(chRow.last_ok_synced_at))).toBe(N1.getTime())
      expect(Date.parse(String(chRow.last_seen_at))).toBe(N1.getTime())
      const snap = await sb.from('competitor_channel_snapshots').select('snapshot_date, video_count, view_count').eq('competitor_channel_id', ch.id)
      expect(snap.data).toEqual([{ snapshot_date: DAY0, video_count: 3, view_count: 99999 }])
      expect(r1.dailyRecorded).toBe(2)
      expect(r1.unitsUsed).toBe(4) // channels, playlistItems, videos (página), videos (passada diária)
      const q = await quotaRow(site, pacificDate(N1.getTime()))
      expect(q!.operations.competitors).toBe(r1.unitsUsed)
      expect(q!.units_used).toBe(r1.unitsUsed)
      expect((await sb.from('competitor_settings').select('series_started_at').eq('site_id', site).single()).data!.series_started_at).not.toBeNull()
    })

    it('7. as primeiras horas: o vídeo recém-descoberto tem uma leitura; o upsert com ignoreDuplicates não duplica nem lança (mutante R)', async () => {
      // D1 foi publicado 6 h antes da descoberta; D2 (30 h) e WK (60 dias) ficam fora
      const early = await sb.from('competitor_video_early').select('video_id, taken_at, views, site_id').in('video_id', Object.values(m))
      expect(early.data).toHaveLength(1)
      expect(early.data![0]).toMatchObject({ video_id: m[D1], views: 1000, site_id: site })
      expect(Date.parse(String(early.data![0]!.taken_at))).toBe(N1.getTime())
      expect(r1.earlyRecorded).toBe(1)
    })

    it('2. segunda sincronização 6 h depois, nada mudou: ZERO linha nova em raw, campos, faixas e versões; last_seen_at avançou', async () => {
      const N2 = new Date(N1.getTime() + 6 * H)
      const r = await sync(ch, w, N2)
      const t = await tally(ch)
      expect({ raw: t.raw, fields: t.fields, spans: t.spans, versions: t.versions, videos: t.videos, daily: t.daily })
        .toEqual({ raw: afterStep1.raw, fields: afterStep1.fields, spans: afterStep1.spans, versions: afterStep1.versions, videos: 3, daily: afterStep1.daily })
      expect(r).toMatchObject({ dailyRecorded: 0, changesDetected: 0 })
      expect(r.fieldsOpened ?? 0).toBe(0); expect(r.rawOpened ?? 0).toBe(0); expect(r.tierChanges ?? 0).toBe(0)
      for (const id of Object.values(m)) expect(Date.parse(String((await vrow(id, 'last_seen_at')).last_seen_at))).toBe(N2.getTime())
      // a mesma leitura repetida (mesmo `now`): a primeira hora do D1 já tem a linha de N2, e o upsert ignora o duplicado
      const earlyBefore = (await tally(ch)).early
      const again = await sync(ch, w, N2)
      expect(again.earlyRecorded).toBe(1) // o código "enviou" a linha; o banco ignorou
      const t2 = await tally(ch)
      expect(t2.early).toBe(earlyBefore)
      expect({ raw: t2.raw, fields: t2.fields, spans: t2.spans, versions: t2.versions }).toEqual({ raw: afterStep1.raw, fields: afterStep1.fields, spans: afterStep1.spans, versions: afterStep1.versions })
    })

    it('3. uma tag muda num vídeo: versão fechada e aberta (6h, janela desde a última leitura) e raw novo só nele', async () => {
      const t0 = await tally(ch)
      const prevSeen = String((await vrow(m[D2]!, 'last_seen_at')).last_seen_at)
      w.videos.find(v => v.id === D2)!.tags = ['a', 'b', 'c']
      const N3 = sp(day(1), '00:00')
      await sync(ch, w, N3)
      const f = await sb.from('competitor_field_versions').select('value, is_current, precision, window_start').eq('video_id', m[D2]!).eq('field', 'tags').order('id')
      expect(f.data).toHaveLength(2)
      expect(f.data![0]).toMatchObject({ value: ['a', 'b'], is_current: false })
      expect(f.data![1]).toMatchObject({ value: ['a', 'b', 'c'], is_current: true, precision: '6h' })
      expect(Date.parse(String(f.data![1]!.window_start))).toBe(Date.parse(prevSeen))
      const raws = await sb.from('competitor_raw').select('is_current').eq('video_id', m[D2]!).order('id')
      expect(raws.data!.map(r => r.is_current)).toEqual([false, true])
      expect(await countOf('competitor_raw', 'video_id', m[D1]!)).toBe(1)
      expect(await countOf('competitor_raw', 'video_id', m[WK]!)).toBe(1)
      const t1 = await tally(ch)
      expect(t1.raw).toBe(t0.raw + 1)
      expect(t1.fields).toBe(t0.fields + 1)
      expect(t1.versions).toBe(t0.versions)
    })

    it('3b. o título muda: a versão anterior fecha e a nova abre (6h); um só "atual" por campo; uma linha de mudança', async () => {
      w.videos.find(v => v.id === D1)!.title = 'Diário 1 (novo título)'
      const r = await sync(ch, w, sp(day(1), '00:30'))
      expect(r.changesDetected).toBe(1)
      const vs = await sb.from('competitor_video_versions').select('field, value_text, is_current, precision').eq('video_id', m[D1]!).order('first_seen_at')
      const titles = (vs.data ?? []).filter(x => x.field === 'title')
      expect(titles.map(x => [x.value_text, x.is_current, x.precision])).toEqual([['Diário 1', false, 'first'], ['Diário 1 (novo título)', true, '6h']])
      for (const f of ['title', 'desc', 'thumb']) expect((vs.data ?? []).filter(x => x.field === f && x.is_current)).toHaveLength(1)
      const chg = await sb.from('competitor_changes').select('change_type, old_title, new_title, precision').eq('video_id', m[D1]!)
      expect(chg.data).toEqual([{ change_type: 'title', old_title: 'Diário 1', new_title: 'Diário 1 (novo título)', precision: '6h' }])
    })

    it('4. um vídeo deixa de vir (D2): 1ª falta marca, a 2ª (3 h depois) grava missing_since e a versão sumiu; nada é apagado; ao voltar, zera', async () => {
      const gone = w.videos.find(v => v.id === D2)!
      gone.gone = true
      const t0 = await tally(ch)
      await sync(ch, w, sp(day(1), '06:00'))
      let v = await vrow(m[D2]!, 'miss_streak, missing_since')
      expect(v).toMatchObject({ miss_streak: 1, missing_since: null })
      const r2 = await sync(ch, w, sp(day(1), '09:00')) // exatamente 3 h depois
      v = await vrow(m[D2]!, 'miss_streak, missing_since')
      expect(v).toMatchObject({ miss_streak: 2, missing_since: day(1) })
      expect(r2).toMatchObject({ missed: 1, newlyMissing: 1 })
      expect(await countOf('competitor_field_versions', 'video_id', m[D2]!)).toBeGreaterThan(0)
      expect((await fieldRows(m[D2]!, 'availability')).map(x => x.value)).toEqual(['no_ar', 'sumiu'])
      const r3 = await sync(ch, w, sp(day(1), '11:00')) // continua ausente: a versão não abre de novo
      expect(r3.newlyMissing ?? 0).toBe(0)
      expect((await fieldRows(m[D2]!, 'availability')).filter(x => x.value === 'sumiu')).toHaveLength(1)
      const tMid = await tally(ch)
      expect(tMid.videos).toBe(t0.videos); expect(tMid.raw).toBe(t0.raw); expect(tMid.daily).toBe(t0.daily)
      // volta a vir
      gone.gone = false
      const r4 = await sync(ch, w, sp(day(1), '11:45'))
      expect(r4.returned).toBe(1)
      v = await vrow(m[D2]!, 'miss_streak, miss_first_at, missing_since')
      expect(v).toMatchObject({ miss_streak: 0, miss_first_at: null, missing_since: null })
      expect((await fieldRows(m[D2]!, 'availability')).map(x => [x.value, x.is_current])).toEqual([['no_ar', false], ['sumiu', false], ['no_ar', true]])
      const tEnd = await tally(ch)
      expect(tEnd.videos).toBe(t0.videos); expect(tEnd.raw).toBe(t0.raw)
    })

    it('5. a leitura semanal no dia fixo do vídeo: ponto, carimbo do canal, cota própria, o canal não muda de estado', async () => {
      const before5 = await crow(ch.id, 'sync_status, last_synced_at, weekly_pass_date')
      const calls0 = w.calls.videos
      const sh0 = parseSeriesHealth((await sb.rpc('competitor_series_health', { p_site_id: site, p_now: iso(sp(day(7), '12:40')) })).data)!
      const r = await weekly(ch, w, sp(day(7), '12:40'))
      expect(r).toMatchObject({ due: 1, recorded: 1, complete: true, deferred: 0 })
      expect(w.calls.videos - calls0).toBe(1)
      expect(await pointsOf(m[WK]!)).toEqual([{ snap_date: day(7), views: 4000 }])
      const after = await crow(ch.id, 'sync_status, last_synced_at, weekly_pass_date')
      expect(after.weekly_pass_date).toBe(day(7))
      expect(after.sync_status).toBe(before5.sync_status)
      expect(after.last_synced_at).toBe(before5.last_synced_at)
      const q = await quotaRow(site, pacificDate(sp(day(7), '12:40').getTime()))
      expect(q!.operations.competitors_semanal).toBe(1)
      // a miniatura: a versão do semanal tem a cópia
      const th = await sb.from('competitor_video_versions').select('thumb_blob_url').eq('video_id', m[WK]!).eq('field', 'thumb').eq('is_current', true).single()
      expect(th.data!.thumb_blob_url).toBe(`https://blob.test/${m[WK]}.jpg`)
      // a prova da série: o devido de hoje era 1 e cai a 0
      expect(sh0.semanal_devidos_hoje).toBe(1)
      const sh1 = parseSeriesHealth((await sb.rpc('competitor_series_health', { p_site_id: site, p_now: iso(sp(day(7), '12:41')) })).data)!
      expect(sh1.semanal_devidos_hoje).toBe(0)
    })

    it('6. a leitura semanal de novo no mesmo dia não chama o YouTube nem grava; 7 dias depois, o 2º ponto e a promoção (daily_until = hoje + 28)', async () => {
      const t0 = await tally(ch)
      const calls0 = w.calls.videos
      const again = await weekly(ch, w, sp(day(7), '16:00'))
      expect(w.calls.videos).toBe(calls0)
      expect(again).toMatchObject({ due: 0, recorded: 0, complete: true })
      expect(await tally(ch)).toEqual(t0)

      // daily de DAY11 a DAY14 (as provas cobram buraco de 3 dias nos diários), depois a semanal do dia fixo com 9.000 views
      for (const n of [11, 12, 13, 14]) await sync(ch, w, sp(day(n), '12:00'))
      w.videos.find(v => v.id === WK)!.views = 9000
      // (portão final, dados I-3) o título muda entre duas leituras e só a leitura semanal o vê (as sincronizações da página já passaram)
      w.videos.find(v => v.id === WK)!.title = 'Semanal (novo título)'
      const hashBefore = (await vrow(m[WK]!, 'title, description_hash')).description_hash
      const r = await weekly(ch, w, sp(day(14), '12:40'))
      expect(r).toMatchObject({ due: 1, recorded: 1, promoted: 1 })
      const rowAfter = await vrow(m[WK]!, 'title, description_hash')
      expect(rowAfter.title).toBe('Semanal (novo título)') // a linha acompanha a versão gravada (o leitor das telas prefere a linha)
      expect(rowAfter.description_hash).toBe(hashBefore) // a descrição não mudou: o hash é o mesmo
      const tv = await sb.from('competitor_video_versions').select('value_text').eq('video_id', m[WK]!).eq('field', 'title').eq('is_current', true).single()
      expect(tv.data!.value_text).toBe('Semanal (novo título)')
      expect(await pointsOf(m[WK]!)).toEqual([{ snap_date: day(7), views: 4000 }, { snap_date: day(14), views: 9000 }])
      expect((await vrow(m[WK]!, 'daily_until')).daily_until).toBe(addDays(day(14), 28))
      // reexecução no mesmo dia: a data não muda
      const again2 = await weekly(ch, w, sp(day(14), '15:00'))
      expect(again2.promoted).toBe(0)
      expect((await vrow(m[WK]!, 'daily_until')).daily_until).toBe(addDays(day(14), 28))
      // a sincronização seguinte põe o vídeo na faixa diária (promovido): a faixa semanal fecha, a diária abre
      await sync(ch, w, sp(day(14), '18:00'))
      expect((await vrow(m[WK]!, 'series_tier')).series_tier).toBe('diaria')
      const spans = await sb.from('competitor_video_tier_spans').select('tier, from_date, to_date').eq('video_id', m[WK]!).order('from_date')
      expect(spans.data).toEqual([{ tier: 'semanal', from_date: DAY0, to_date: addDays(day(14), -1) }, { tier: 'diaria', from_date: day(14), to_date: null }])
    })

    it('7b. as duas provas, lidas às 19:30 do último dia: ok, sem problema; os números batem com o que o teste gravou; checkCompetitorHealth real', async () => {
      const nowIso = iso(sp(day(14), '19:30'))
      const v = await readSiteHealth(sb, site, nowIso, { slotDone: true, e2: true })
      expect(v.problems).toEqual([])
      expect(v.ok).toBe(true)
      const cap = parseCaptureHealth((await sb.rpc('competitor_capture_health', { p_site_id: site, p_now: nowIso })).data)!
      const ser = parseSeriesHealth((await sb.rpc('competitor_series_health', { p_site_id: site, p_now: nowIso })).data)!
      expect(cap).toMatchObject({ videos_vistos_sem_raw: 0, canais_vistos_sem_raw: 0, canais_vistos_dia_pacifico: 1, videos_ausentes: 0, canais_ausentes: 0, canais_em_erro_12h: 0, canais_em_erro_3d: 0 })
      const q = await quotaRow(site, pacificDate(sp(day(14), '19:30').getTime()))
      expect(cap.cota_dia_pacifico).toBe(q!.units_used)
      expect(ser).toMatchObject({ hoje: day(14), hora_sp: 19, fora_da_prova: 0, sem_faixa: 0, diaria_sem_ponto_hoje: 0, diaria_buracos_3d: 0, semanal_atrasados: 0, semanal_atrasados_9d: 0, semanal_devidos_hoje: 0, sem_miniatura_9d: 0, diaria_total: 3, semanal_total: 0 })
    })

    it('11c. vermelho com um vídeo lido sem raw (o veredito real, não o falso)', async () => {
      const del = await sb.from('competitor_raw').delete().eq('video_id', m[D1]!)
      expect(del.error).toBeNull()
      const nowIso = iso(sp(day(14), '19:30'))
      const v = await readSiteHealth(sb, site, nowIso, { slotDone: true, e2: true })
      expect(v.ok).toBe(false)
      expect(v.problems).toContain('1 vídeo lido sem resposta guardada')
      expect(parseCaptureHealth((await sb.rpc('competitor_capture_health', { p_site_id: site, p_now: nowIso })).data)!.videos_vistos_sem_raw).toBe(1)
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // 2. Texto que o Postgres rejeita (NUL e substituto solitário)
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('texto com NUL e substituto solitário', () => {

    it('o contraste: o Postgres rejeita o texto cru (NUL em text e em jsonb; substituto solitário em jsonb)', async () => {
      const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' })
      await pg.connect()
      const attempt = async (sql: string, param: string): Promise<string> => {
        await pg.query('begin')
        try { await pg.query(sql, [param]); return 'aceito' } catch (e) { return e instanceof Error ? e.message : String(e) } finally { await pg.query('rollback') }
      }
      try {
        const out = {
          nulText: await attempt('select $1::text', 'a\u0000b'),
          nulJsonb: await attempt('select $1::jsonb', '{"a":"x\\u0000y"}'),
          loneJsonb: await attempt('select $1::jsonb', '{"a":"x\\ud800y"}'),
          loneText: await attempt('select convert_to($1::text, \'UTF8\')', 'x\ud800y'),
        }
        // o mesmo texto cru pelo caminho que o sync usa (PostgREST): é a mensagem que o canal veria
        const probeSite = await mkSite(), probe = await mkChannel(probeSite, 'a5contrast')
        const viaRest = async (title: string) => (await sb.from('competitor_videos').insert({ competitor_channel_id: probe.id, video_id: 'contrast001', title })).error?.message ?? 'aceito'
        const rest = { nul: await viaRest('a\u0000b'), lone: await viaRest('a\ud800b') }
        perf.nulContrast = { ...out, viaPostgrest: rest }
        expect(rest.nul).not.toBe('aceito')
        expect(rest.lone).not.toBe('aceito')
        expect(out.nulText).not.toBe('aceito')
        expect(out.nulJsonb).not.toBe('aceito')
        expect(out.loneJsonb).not.toBe('aceito')
      } finally { await pg.end() }
    })

    // cada caminho de gravação em seu próprio canal e teste: se um quebra, os outros continuam provados
    const BAD = ['x\u0000y', 'x\ud800y', 'x\udc00y']
    type Case = { name: string; apply: (w: World, bad: string) => void; read: (ch: Ch, m: Record<string, string>) => Promise<unknown> }
    const VID = 'nulvid00001'
    const cases: Case[] = [
      { name: 'título do vídeo', apply: (w, bad) => { w.videos[0]!.title = 'T' + bad }, read: async (_c, m) => [await vrow(m[VID]!, 'title'), (await sb.from('competitor_video_versions').select('value_text').eq('video_id', m[VID]!)).data] },
      { name: 'descrição do vídeo', apply: (w, bad) => { w.videos[0]!.description = 'D' + bad + ' \ud83d\ude00' }, read: async (_c, m) => (await sb.from('competitor_video_versions').select('value_text').eq('video_id', m[VID]!)).data },
      { name: 'tag do vídeo', apply: (w, bad) => { w.videos[0]!.tags = ['t' + bad, 'ok'] }, read: async (_c, m) => [await vrow(m[VID]!, 'tags'), (await fieldRows(m[VID]!, 'tags'))] },
      { name: 'nome do canal', apply: (w, bad) => { w.channelSnippet = { ...w.channelSnippet!, title: 'N' + bad } }, read: async c => crow(c.id, 'channel_name') },
      { name: 'descrição do canal', apply: (w, bad) => { w.channelSnippet = { ...w.channelSnippet!, description: 'C' + bad } }, read: async c => crow(c.id, 'description') },
      { name: 'custom_url do canal', apply: (w, bad) => { w.channelSnippet = { ...w.channelSnippet!, customUrl: '@u' + bad } }, read: async c => crow(c.id, 'custom_url') },
    ]
    const now = sp(addDays(TODAY, -30), '12:00')
    let site = ''
    beforeAll(async () => { site = await mkSite() })
    let n = 0
    // ACHADO da Tarefa 14a (consertado): título e descrição do vídeo e nome do canal iam ao banco sem limpeza. Agora toda resposta da API é limpa
    // UMA vez, logo depois do json() (ponto único de entrada em competitor-sync.ts). O conjunto fica vazio: se um dia voltar uma lacuna, entra aqui.
    const KNOWN_RED = new Set<string>()
    for (const c of cases) for (const bad of BAD) {
      const label = bad.includes('\u0000') ? 'NUL' : bad.includes('\ud800') ? 'substituto alto solitário' : 'substituto baixo solitário'
      if (KNOWN_RED.has(c.name)) { it.todo(`${c.name} com ${label}: ACHADO, ver relatório`); continue }
      it(`${c.name} com ${label}: a gravação não falha e o que fica não tem NUL`, async () => {
        const ch = await mkChannel(site, 'a5nul' + ++n, { video_limit: 5 })
        const w = world(ch.channel_id, [{ id: VID, title: 'ok', publishedAt: iso(new Date(now.getTime() - 3 * H)), views: 10 }])
        c.apply(w, bad)
        await sync(ch, w, now)
        const m = await vidMap(ch)
        expect((await crow(ch.id, 'sync_status, sync_error'))).toEqual({ sync_status: 'idle', sync_error: null })
        const stored = JSON.stringify([await c.read(ch, m), (await sb.from('competitor_raw').select('raw').eq('competitor_channel_id', ch.id)).data, (await sb.from('competitor_field_versions').select('value').eq('competitor_channel_id', ch.id)).data])
        expect(stored.includes('\\u0000')).toBe(false)
      })
    }
    it('o par válido (emoji) na descrição fica inteiro', async () => {
      const ch = await mkChannel(site, 'a5nulemoji', { video_limit: 5 })
      const w = world(ch.channel_id, [{ id: VID, title: 'ok', description: 'a \ud83d\ude00 b', publishedAt: iso(new Date(now.getTime() - 3 * H)), views: 10 }])
      await sync(ch, w, now)
      const m = await vidMap(ch)
      const vs = await sb.from('competitor_video_versions').select('value_text').eq('video_id', m[VID]!).eq('field', 'desc')
      expect(JSON.stringify(vs.data)).toContain('\ud83d\ude00')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // 3. Ausência: a regra das 3 horas e a data de São Paulo da primeira falta
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('ausência', () => {
    it('1ª falta marca, antes de 3 h não conta, depois de 3 h grava a data de SP da PRIMEIRA; a versão abre uma vez; ao voltar os três campos zeram', async () => {
      const site = await mkSite(), ch = await mkChannel(site, 'a5miss', { video_limit: 5 })
      const d = addDays(TODAY, -20)
      const w = world(ch.channel_id, [
        { id: 'missvid0001', title: 'M1', publishedAt: iso(sp(addDays(d, -100), '10:00')), views: 50 },
        { id: 'missvid0002', title: 'M2', publishedAt: iso(sp(addDays(d, -100), '11:00')), views: 60 },
      ])
      await sync(ch, w, sp(d, '21:00'))
      const m = await vidMap(ch)
      w.videos[0]!.gone = true
      await sync(ch, w, sp(d, '22:00')) // 1ª falta, 22:00 do dia d (SP)
      expect(await vrow(m['missvid0001']!, 'miss_streak, missing_since')).toMatchObject({ miss_streak: 1, missing_since: null })
      expect(await vrow(m['missvid0002']!, 'miss_streak')).toMatchObject({ miss_streak: 0 })
      await sync(ch, w, sp(d, '23:30')) // 1 h 30 depois: não conta
      expect(await vrow(m['missvid0001']!, 'miss_streak, missing_since')).toMatchObject({ miss_streak: 1, missing_since: null })
      const r = await sync(ch, w, sp(addDays(d, 1), '01:00')) // 3 h depois da primeira, já no dia seguinte em SP
      expect(await vrow(m['missvid0001']!, 'miss_streak, missing_since')).toMatchObject({ miss_streak: 2, missing_since: d })
      expect(r).toMatchObject({ missed: 1, newlyMissing: 1 })
      const r2 = await sync(ch, w, sp(addDays(d, 1), '03:00'))
      expect(r2.newlyMissing ?? 0).toBe(0)
      expect((await vrow(m['missvid0001']!, 'miss_streak, missing_since'))).toMatchObject({ miss_streak: 3, missing_since: d })
      expect((await fieldRows(m['missvid0001']!, 'availability')).filter(x => x.value === 'sumiu')).toHaveLength(1)
      w.videos[0]!.gone = false
      const r3 = await sync(ch, w, sp(addDays(d, 1), '04:00'))
      expect(r3.returned).toBe(1)
      expect(await vrow(m['missvid0001']!, 'miss_streak, miss_first_at, missing_since')).toMatchObject({ miss_streak: 0, miss_first_at: null, missing_since: null })
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // 4. Resposta 200 sem `items` ou com `error`: ninguém é marcado ausente, nada vira zero
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('resposta sem a lista', () => {
    it('videos.list 200 `{}` e com error (na sincronização), channels.list 200 `{}` e a semanal: nada de ausente, nada de zero', async () => {
      const site = await mkSite(), ch = await mkChannel(site, 'a5empty', { video_limit: 1 })
      const d = addDays(TODAY, -15)
      const w = world(ch.channel_id, [
        { id: 'emptvid0001', title: 'E1', publishedAt: iso(sp(addDays(d, -1), '10:00')), views: 321 },
        { id: 'emptvid0002', title: 'E2', publishedAt: iso(sp(addDays(d, -200), '10:00')), views: 654 },
      ])
      await sync(ch, w, sp(d, '12:00'))
      const m = await vidMap(ch)
      const snapshot = async () => ({ v1: await vrow(m['emptvid0001']!, 'view_count, miss_streak, missing_since'), v2: await vrow(m['emptvid0002']!, 'view_count, miss_streak, missing_since'), c: await crow(ch.id, 'miss_streak, missing_since, youtube_video_count'), t: await tally(ch) })
      const ref = await snapshot()
      for (const body of [{}, { error: { code: 403, message: 'quota' } }]) {
        w.videosBody = body
        await expect(sync(ch, w, sp(addDays(d, 1), '12:00'))).rejects.toThrow(/sem a lista de vídeos/)
        const s = await snapshot()
        expect(s.v1).toEqual(ref.v1); expect(s.v2).toEqual(ref.v2)
        expect(s.t.videos).toBe(ref.t.videos); expect(s.t.raw).toBe(ref.t.raw); expect(s.t.daily).toBe(ref.t.daily)
        expect((await crow(ch.id, 'sync_status')).sync_status).toBe('error')
      }
      w.videosBody = undefined
      // a semanal: o vídeo semanal (E2) vira devido no dia fixo dele
      let slotDay = addDays(d, 2); while (dayNumber(slotDay) % 7 !== weekSlotOf('emptvid0002')) slotDay = addDays(slotDay, 1)
      await sync(ch, w, sp(slotDay, '06:00')) // limpa o erro, põe os dois com faixa
      const ref2 = await snapshot()
      w.videosBody = {}
      await expect(weekly(ch, w, sp(slotDay, '12:40'))).rejects.toThrow(/sem a lista de vídeos/)
      expect((await snapshot()).v2).toEqual(ref2.v2)
      expect(await pointsOf(m['emptvid0002']!)).toEqual([])
      expect((await crow(ch.id, 'weekly_pass_date')).weekly_pass_date).toBeNull()
      w.videosBody = undefined
      // channels.list 200 `{}`: o canal não é marcado ausente
      w.channelsBody = {}
      await expect(sync(ch, w, sp(addDays(slotDay, 1), '12:00'))).rejects.toThrow(/resposta sem o canal/)
      expect(await crow(ch.id, 'miss_streak, missing_since')).toEqual({ miss_streak: 0, missing_since: null })
      w.channelsBody = { error: { code: 500 } }
      await expect(sync(ch, w, sp(addDays(slotDay, 1), '13:00'))).rejects.toThrow(/resposta sem o canal/)
      expect(await crow(ch.id, 'miss_streak, missing_since')).toEqual({ miss_streak: 0, missing_since: null })
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // 5. Contagem ausente = nulo no banco, '0' = zero
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('contagem ausente', () => {
    it('as três contagens do vídeo, youtube_video_count e o retrato diário do canal ficam nulos; a contagem "0" grava 0', async () => {
      const site = await mkSite(), ch = await mkChannel(site, 'a5null', { video_limit: 5 })
      const d = addDays(TODAY, -12)
      const w = world(ch.channel_id, [
        { id: 'nullvid0001', title: 'N1', publishedAt: iso(sp(addDays(d, -3), '10:00')), stats: {} },
        { id: 'nullvid0002', title: 'N2', publishedAt: iso(sp(addDays(d, -3), '11:00')), stats: { viewCount: '0', likeCount: '0' } },
        { id: 'nullvid0003', title: 'N3', publishedAt: iso(sp(addDays(d, -3), '12:00')), stats: null },
      ])
      w.channelStats = { subscriberCount: '10', videoCount: '5', viewCount: '77' }
      await sync(ch, w, sp(d, '12:00'))
      const m = await vidMap(ch)
      expect((await crow(ch.id, 'youtube_video_count')).youtube_video_count).toBe(5)
      expect(await vrow(m['nullvid0001']!, 'view_count, like_count, comment_count, views_hidden, likes_hidden, comments_disabled')).toEqual({ view_count: null, like_count: null, comment_count: null, views_hidden: true, likes_hidden: true, comments_disabled: true })
      expect(await vrow(m['nullvid0002']!, 'view_count, like_count, comment_count, views_hidden, likes_hidden, comments_disabled')).toEqual({ view_count: 0, like_count: 0, comment_count: null, views_hidden: false, likes_hidden: false, comments_disabled: true })
      expect(await vrow(m['nullvid0003']!, 'view_count, like_count, comment_count')).toEqual({ view_count: null, like_count: null, comment_count: null })
      // sem contagem não há ponto; com '0' há ponto em zero
      expect(await pointsOf(m['nullvid0001']!)).toEqual([])
      expect(await pointsOf(m['nullvid0002']!)).toEqual([{ snap_date: d, views: 0 }])
      // o retrato do canal: contagem ausente = nulo; um valor bom anterior é substituído por "não medido", nunca por 0
      w.channelStats = { subscriberCount: '10' }
      await sync(ch, w, sp(addDays(d, 1), '12:00'))
      expect((await crow(ch.id, 'youtube_video_count')).youtube_video_count).toBeNull()
      const s1 = await sb.from('competitor_channel_snapshots').select('snapshot_date, subscriber_count, video_count, view_count').eq('competitor_channel_id', ch.id).eq('snapshot_date', addDays(d, 1)).single()
      expect(s1.data).toEqual({ snapshot_date: addDays(d, 1), subscriber_count: 10, video_count: null, view_count: null })
      // statistics presente e vazio: sem linha de retrato (não é "dia medido em zero")
      w.channelStats = {}
      await sync(ch, w, sp(addDays(d, 2), '12:00'))
      expect(await countOf('competitor_channel_snapshots', 'competitor_channel_id', ch.id)).toBe(2)
      expect((await crow(ch.id, 'youtube_video_count')).youtube_video_count).toBeNull()
      // '0' medido é 0
      w.channelStats = { subscriberCount: '10', videoCount: '0', viewCount: '0' }
      await sync(ch, w, sp(addDays(d, 3), '12:00'))
      expect((await crow(ch.id, 'youtube_video_count')).youtube_video_count).toBe(0)
      const s3 = await sb.from('competitor_channel_snapshots').select('video_count, view_count').eq('competitor_channel_id', ch.id).eq('snapshot_date', addDays(d, 3)).single()
      expect(s3.data).toEqual({ video_count: 0, view_count: 0 })
      // a contagem do vídeo que some depois vira nulo, não 0
      w.videos[1]!.stats = {}
      await sync(ch, w, sp(addDays(d, 3), '18:00'))
      expect((await vrow(m['nullvid0002']!, 'view_count')).view_count).toBeNull()
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // 6 e 10 do plano. Faixas: o dia do deploy, canal carimbado antes de ter faixas
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('faixas no dia do deploy (fecho F-1)', () => {
    it('vídeos gravados sem faixa: a defesa não carimba; a 1ª sincronização grava as faixas, os pontos de antes e reabre o canal; o carimbo da semanal só volta com a leitura; troca nenhuma não reabre', async () => {
      const site = await mkSite()
      const F = 'deplvid0003'
      let day0 = addDays(TODAY, -10)
      while (dayNumber(day0) % 7 !== weekSlotOf(F)) day0 = addDays(day0, 1)
      const ch = await mkChannel(site, 'a5deploy', { video_limit: 2, weekly_pass_date: addDays(day0, -1) })
      const N = sp(day0, '12:00')
      const ins = await sb.from('competitor_videos').insert([
        { competitor_channel_id: ch.id, video_id: 'deplvid0001', published_at: iso(new Date(N.getTime() - 2 * 86_400_000)) },
        { competitor_channel_id: ch.id, video_id: 'deplvid0002', published_at: iso(new Date(N.getTime() - 3 * 86_400_000)) },
        { competitor_channel_id: ch.id, video_id: F, published_at: iso(new Date(N.getTime() - 90 * 86_400_000)) },
      ])
      expect(ins.error).toBeNull()
      const w = world(ch.channel_id, [
        { id: 'deplvid0001', title: 'P1', publishedAt: iso(new Date(N.getTime() - 2 * 86_400_000)), views: 100 },
        { id: 'deplvid0002', title: 'P2', publishedAt: iso(new Date(N.getTime() - 3 * 86_400_000)), views: 200 },
        { id: F, title: 'P3', publishedAt: iso(new Date(N.getTime() - 90 * 86_400_000)), views: 300 },
      ])
      // a defesa: nada é pedido ao YouTube e o carimbo de ontem continua
      const r0 = await weekly(ch, w, sp(day0, '11:00'))
      expect(r0).toMatchObject({ complete: false, due: 0 })
      expect(w.calls.videos).toBe(0)
      expect((await crow(ch.id, 'weekly_pass_date')).weekly_pass_date).toBe(addDays(day0, -1))
      // o pior caso: carimbado hoje sem ter faixa
      await sb.from('competitor_channels').update({ weekly_pass_date: day0 }).eq('id', ch.id)
      await sync(ch, w, N)
      const m = await vidMap(ch)
      for (const id of Object.values(m)) expect((await vrow(id, 'series_tier')).series_tier).not.toBeNull()
      expect((await vrow(m[F]!, 'series_tier')).series_tier).toBe('semanal')
      expect((await crow(ch.id, 'weekly_pass_date')).weekly_pass_date).toBeNull() // a MG2 reabriu
      // "os vídeos de antes ganham o ponto do dia": os dois diários
      expect(await pointsOf(m['deplvid0001']!)).toEqual([{ snap_date: day0, views: 100 }])
      expect(await pointsOf(m['deplvid0002']!)).toEqual([{ snap_date: day0, views: 200 }])
      expect(await countOf('competitor_video_tier_spans', 'video_id', Object.values(m))).toBe(3)
      // reexecução não duplica faixa
      await sync(ch, w, new Date(N.getTime() + 1 * H))
      expect(await countOf('competitor_video_tier_spans', 'video_id', Object.values(m))).toBe(3)
      // a semanal no dia fixo
      const r1 = await weekly(ch, w, sp(day0, '12:40'))
      expect(r1).toMatchObject({ due: 1, recorded: 1, complete: true })
      expect(await pointsOf(m[F]!)).toEqual([{ snap_date: day0, views: 300 }])
      expect((await crow(ch.id, 'weekly_pass_date')).weekly_pass_date).toBe(day0)
      // outra sincronização 6 h depois, sem troca de faixa: o carimbo continua
      await sync(ch, w, sp(day0, '18:40'))
      expect((await crow(ch.id, 'weekly_pass_date')).weekly_pass_date).toBe(day0)
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // 8. O relógio fecha a meio da leitura semanal
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('leitura semanal cortada pelo relógio', () => {
    it('só o vídeo conferido tem ponto, o canal não é carimbado, e a visita seguinte lê o resto sem reler o conferido', async () => {
      const site = await mkSite(), ch = await mkChannel(site, 'a5clock', { video_limit: 1 })
      const d = addDays(TODAY, -25)
      const old = (n: number) => iso(sp(addDays(d, -n), '10:00'))
      const ids = ['clckvid0001', 'clckvid0002', 'clckvid0003']
      const w = world(ch.channel_id, [
        { id: 'clckrecent1', title: 'R', publishedAt: iso(sp(d, '08:00')), views: 10 },
        ...ids.map((id, i) => ({ id, title: 'V' + i, publishedAt: old(100 + i), views: 100 * (i + 1) })),
      ])
      await sync(ch, w, sp(d, '12:00')) // põe as faixas: os 3 antigos em semanal, desde d
      const m = await vidMap(ch)
      const later = addDays(d, 7)
      expect((await vrow(m[ids[0]!]!, 'series_tier')).series_tier).toBe('semanal')
      let calls = 0
      const r1 = await weekly(ch, w, sp(later, '12:40'), { deadline: () => ++calls >= 3 }) // chamada, vídeo 1, e no vídeo 2 o relógio fecha
      expect(r1).toMatchObject({ due: 3, recorded: 1, complete: false })
      expect(r1.deferred).toBeGreaterThan(0)
      const withPoint: string[] = []
      for (const id of ids) if ((await pointsOf(m[id]!)).length) withPoint.push(id)
      expect(withPoint).toHaveLength(1)
      expect((await crow(ch.id, 'weekly_pass_date')).weekly_pass_date).toBeNull()
      const readFirst = w.calls.videoIds.at(-1)!
      expect(readFirst).toHaveLength(3)
      // a visita seguinte: pede só os dois que faltam
      const r2 = await weekly(ch, w, sp(later, '13:10'))
      expect(r2).toMatchObject({ due: 2, recorded: 2, complete: true })
      expect(new Set(w.calls.videoIds.at(-1))).toEqual(new Set(ids.filter(id => !withPoint.includes(id))))
      expect((await crow(ch.id, 'weekly_pass_date')).weekly_pass_date).toBe(later)
      for (const id of ids) expect(await pointsOf(m[id]!)).toHaveLength(1)
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // 9. Promoção e extensão
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('promoção e extensão', () => {
    it('o vídeo promovido que continua crescendo ganha mais 28 dias; reexecutar no mesmo dia não muda a data', async () => {
      const site = await mkSite(), ch = await mkChannel(site, 'a5extend', { video_limit: 1 })
      const d = addDays(TODAY, -9)
      const w = world(ch.channel_id, [
        { id: 'extvid00001', title: 'R', publishedAt: iso(sp(addDays(d, -1), '09:00')), views: 50 },
        { id: 'extvid00002', title: 'P', publishedAt: iso(sp(addDays(d, -80), '09:00')), views: 10_000 },
      ])
      await sync(ch, w, sp(addDays(d, -6), '12:00')) // põe o vídeo antigo na semanal e grava um 1º ponto, há 6 dias
      const m = await vidMap(ch)
      // o vídeo antigo teve o ponto de 6 dias atrás por ser o 1º dia? (ele é semanal: sem ponto na sincronização); o ponto de antes é gravado como a promoção o gravaria
      await sb.from('competitor_video_daily').upsert({ video_id: m['extvid00002']!, snap_date: addDays(d, -6), views: 10_000, taken_at: iso(sp(addDays(d, -6), '12:00')) }, { onConflict: 'video_id,snap_date' })
      await sb.from('competitor_videos').update({ daily_until: addDays(d, 1) }).eq('id', m['extvid00002']!) // vence amanhã
      w.videos[1]!.views = 20_000
      const r = await sync(ch, w, sp(d, '12:00'))
      expect(r.promotionExtended).toBe(1)
      expect((await vrow(m['extvid00002']!, 'series_tier, daily_until'))).toEqual({ series_tier: 'diaria', daily_until: addDays(d, 28) })
      const again = await sync(ch, w, sp(d, '12:00'))
      expect(again.promotionExtended ?? 0).toBe(0) // já tem daily_until além de amanhã: não é candidato
      expect((await vrow(m['extvid00002']!, 'daily_until')).daily_until).toBe(addDays(d, 28))
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // 10. Cota
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('cota', () => {
    it('soma na linha do dia do PACÍFICO; duas execuções somam; duas execuções SOBREPOSTAS não perdem unidade', async () => {
      const site = await mkSite()
      const a = await mkChannel(site, 'a5quota1', { video_limit: 5 }), b = await mkChannel(site, 'a5quota2', { video_limit: 5 })
      const d = addDays(TODAY, -8)
      const wa = world(a.channel_id, [{ id: 'quotvid0001', title: 'Q1', publishedAt: iso(sp(addDays(d, -100), '10:00')), views: 5 }])
      const wb = world(b.channel_id, [{ id: 'quotvid0002', title: 'Q2', publishedAt: iso(sp(addDays(d, -100), '10:00')), views: 5 }])
      // 02:00 em SP = 22:00 do dia anterior no Pacífico: a linha da cota é do dia ANTERIOR
      const at = (h: string) => sp(d, h)
      const pdate = pacificDate(at('02:00').getTime())
      expect(pdate).toBe(addDays(d, -1))
      const ra = await sync(a, wa, at('02:00'))
      expect((await quotaRow(site, pdate))!.units_used).toBe(ra.unitsUsed)
      const rb = await sync(b, wb, at('02:10'))
      expect((await quotaRow(site, pdate))).toMatchObject({ units_used: ra.unitsUsed + rb.unitsUsed, operations: { competitors: ra.unitsUsed + rb.unitsUsed } })
      expect(await quotaRow(site, d)).toBeNull()
      const [rc, rd] = await Promise.all([sync(a, wa, at('02:20')), sync(b, wb, at('02:20'))])
      const total = ra.unitsUsed + rb.unitsUsed + rc.unitsUsed + rd.unitsUsed
      expect(rc.quotaError).toBeUndefined(); expect(rd.quotaError).toBeUndefined()
      expect(await quotaRow(site, pdate)).toMatchObject({ units_used: total, operations: { competitors: total } })
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // 9 do plano. Canal de outro site
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('canal de outro site', () => {
    it('as funções de plano recusam o canal que não é do site e nada é gravado', async () => {
      const site = await mkSite(), other = await mkSite()
      const ch = await mkChannel(site, 'a5xsite', { video_limit: 5 })
      const t0 = await tally(ch)
      await expect(captureItems(sb, { siteId: other, channelId: ch.id, scope: 'canal', nowIso: iso(new Date()), items: [{ videoId: null, fields: [{ field: 'name', value: 'X' }], raw: null, prevSeenAt: null, weeklySince: null }] })).rejects.toThrow(/site/)
      expect(await tally(ch)).toEqual(t0)
      const tier = await sb.rpc('apply_competitor_tier_plan', { p_site_id: other, p_channel_id: ch.id, p_changes: [], p_today: TODAY })
      expect(tier.error?.message).toMatch(/não é do site/)
      expect(await tally(ch)).toEqual(t0)
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // 11 e 12. A guarda de schema e os dois defeitos conhecidos do SQL (MG2b)
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('guarda de schema e as provas', () => {
    it('12. schemaReady real: pronto nos dois modos', async () => {
      expect(await schemaReady(sb, 'e1')).toBeNull()
      expect(await schemaReady(sb, 'e1e2')).toBeNull()
    })

    it('11. estado limpo (site vazio): verde nas duas provas', async () => {
      const site = await mkSite()
      const v = await readSiteHealth(sb, site, iso(new Date()), { slotDone: true, e2: true })
      expect(v.ok).toBe(true)
    })

    // MG2b aplicada (migration 20261012000004). Sem nenhum `raw` no site, as contas valem DESDE o rastro mais antigo que só o código novo deixa
    // (primeira versão de campo, primeira faixa de série, primeira linha de cota): antes de qualquer rastro valem 0 (o estado legítimo entre o
    // deploy e a primeira sincronização), depois dele a captura que nunca gravou o primeiro `raw` fica vermelha.
    it('MG2b (a): videos_vistos_sem_raw e canais_vistos_sem_raw: sem rastro do código novo valem 0; com uma linha de cota e nenhum raw valem o que foi lido', async () => {
      const site = await mkSite(), ch = await mkChannel(site, 'a5defa', { last_ok_synced_at: iso(new Date()) })
      const ins = await sb.from('competitor_videos').insert({ competitor_channel_id: ch.id, video_id: 'defavid0001', last_checked_at: iso(new Date()) })
      expect(ins.error).toBeNull()
      const capOf = async () => parseCaptureHealth((await sb.rpc('competitor_capture_health', { p_site_id: site, p_now: iso(new Date()) })).data)!
      const sem = await capOf()
      expect(sem.videos_vistos_sem_raw).toBe(0) // vídeo lido pelo código ANTIGO (às 12:00 do deploy): sem raw e sem rastro, é o estado esperado
      expect(sem.canais_vistos_sem_raw).toBe(0)
      const q = await sb.rpc('youtube_quota_add', { p_site_id: site, p_day: pacificDate(Date.now()), p_units: 3, p_add: { competitors: 3 }, p_max: {} })
      expect(q.error).toBeNull()
      const com = await capOf()
      expect(com.videos_vistos_sem_raw).toBe(1) // o código novo já rodou (a cota é gravada por caminho independente da captura) e o raw nunca nasceu
      expect(com.canais_vistos_sem_raw).toBe(1)
    })

    it('MG2b (b): diaria_sem_ponto_hoje NÃO conta o vídeo com miss_streak > 0 (foi pedido e não veio)', async () => {
      const site = await mkSite(), ch = await mkChannel(site, 'a5defb', { last_ok_synced_at: iso(new Date()) })
      const ins = await sb.from('competitor_videos').insert({ competitor_channel_id: ch.id, video_id: 'defbvid0001', series_tier: 'diaria', series_tier_since: TODAY, miss_streak: 1 }).select('id').single()
      expect(ins.error).toBeNull()
      const ser = parseSeriesHealth((await sb.rpc('competitor_series_health', { p_site_id: site, p_now: iso(new Date()) })).data)!
      expect(ser.diaria_sem_ponto_hoje).toBe(0)
      // o veredito às 19:00 de SP com a faixa terminada não fica vermelho por causa dele
      const cap = parseCaptureHealth((await sb.rpc('competitor_capture_health', { p_site_id: site, p_now: iso(new Date()) })).data)
      const v = healthVerdict(cap, { ...ser, hora_sp: 19 }, { slotDone: true, e2: true })
      expect(v.problems.some(p => p.includes('sem ponto hoje'))).toBe(false)
    })
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // A primeira medida real do custo do código novo (50 e 200 vídeos)
  // ════════════════════════════════════════════════════════════════════════════════════════════
  describe('custo medido', () => {
    for (const size of [50, 200]) {
      it(`sincronização de um canal com ${size} vídeos (tempo e idas ao banco)`, async () => {
        const site = await mkSite(), ch = await mkChannel(site, 'a5perf' + size, { video_limit: size })
        const d = addDays(TODAY, -6)
        const w = world(ch.channel_id, Array.from({ length: size }, (_, i) => ({ id: 'perf' + String(size).padStart(3, '0') + String(i).padStart(4, '0'), title: 'V' + i, publishedAt: iso(sp(addDays(d, -1 - Math.floor(i / 4)), '09:00')), views: 1000 + i })))
        const timed = async (label: string, now: Date) => {
          const n0 = dbCalls.n, y0 = w.calls.channels + w.calls.playlist + w.calls.videos, t0 = performance.now()
          const r = await sync(ch, w, now)
          return { label, ms: Math.round(performance.now() - t0), dbCalls: dbCalls.n - n0, youtubeCalls: w.calls.channels + w.calls.playlist + w.calls.videos - y0, videosChecked: r.videosChecked, unitsUsed: r.unitsUsed, dailyRecorded: r.dailyRecorded }
        }
        const first = await timed('1ª sincronização (tudo novo, 12:00)', sp(d, '12:00'))
        const steady = await timed('seguinte 6 h depois (nada mudou)', sp(d, '18:00'))
        const nextDay = await timed('dia seguinte às 12:00 (passada diária sobre todos)', sp(addDays(d, 1), '12:00'))
        perf['sync' + size] = [first, steady, nextDay]
        expect(first.videosChecked).toBe(size)
        expect((await tally(ch)).videos).toBe(size)
      })
    }
  })

  // ════════════════════════════════════════════════════════════════════════════════════════════
  it('a limpeza: as contagens das tabelas de fora são as de antes', async () => {
    await cleanup()
    const after = await outsideCounts()
    perf.outsideBefore = before; perf.outsideAfter = after
    expect(after).toEqual(before)
  })
})
