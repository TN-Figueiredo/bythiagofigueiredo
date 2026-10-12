// @vitest-environment node
// A5 (E2), Tarefa 17b. O que o Lote 1 passa a gravar (faixa de cada vídeo, faixas no tempo, pontos semanais dos vídeos não
// observados, `series_tier`) não pode mudar NADA do que cada consumidor de `loadRows`/`rowsToDataset` mostra ou envia.
// Duas entradas com os mesmos vídeos, versões e série diária: `A`, as linhas como são hoje; `B`, as mesmas linhas MAIS o que o
// Lote 1 grava. Cada consumidor roda sobre as duas, e a saída tem de ser IDÊNTICA. Uma diferença é PARADA: o campo novo vazou
// para um caminho que as telas, o Cowork ou a fila da forja leem; não se ajusta a expectativa.
// Sem banco: as linhas da semente de e2e vêm de um cliente gravador em memória; os carregadores leem do falso de test/helpers.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { seedObservatory, ORACLE_NOW } from '../../../e2e/fixtures/observatorio-seed'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { buildTables } from './load-fixture'
import { loadRows, loadDataset, rowsToDataset, observedVideoIds, type ChannelRow, type VideoRow } from '@/lib/youtube/observatorio/load'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { buildSent } from '@/lib/youtube/observatorio/forja/sent'
import { listCompetitorOutliers, getCompetitorInsights } from '@/lib/pipeline/services/competitors'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { buildOutliersView } from '@/app/cms/(authed)/youtube/competitors/_outliers/view-model'
import { buildInsightsView } from '@/app/cms/(authed)/youtube/competitors/_insights/view-model'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'

const DAY = 864e5, H = 36e5
const spDate = (ms: number) => new Date(ms - 3 * H).toISOString().slice(0, 10)
const iso = (ms: number) => new Date(ms).toISOString()
const SITE = '5a5a5a5a-0000-4000-8000-00000000a5a5'

/* ------------------------------------------------------------------ as linhas da semente de e2e, sem banco */
/** Cliente que só GRAVA EM MEMÓRIA o que a semente de e2e insere (tabela → linhas). Não fala com banco nenhum. */
function recordingClient() {
  const tables = new Map<string, Record<string, unknown>[]>()
  const push = (t: string, rows: unknown) => { const a = tables.get(t) ?? []; a.push(...(Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[]); tables.set(t, a) }
  const done = { data: null, error: null }
  // toda cadeia (delete().eq().neq(), select().eq().not(), insert(), upsert()) termina num thenable que resolve { data: null, error: null }
  const chain = (): Record<string, unknown> => new Proxy({}, { get: (_t, k) => k === 'then' ? (ok: (v: typeof done) => unknown) => Promise.resolve(done).then(ok) : () => chain() })
  const client = {
    supabaseUrl: 'http://127.0.0.1:54321', // a guarda da semente lê este campo: é local, e nada sai da máquina
    from: (t: string) => ({ insert: (rows: unknown) => { push(t, rows); return chain() }, upsert: (rows: unknown) => { push(t, rows); return chain() }, delete: () => chain(), select: () => chain() }),
  }
  return { client: client as unknown as SupabaseClient, tables } // cast em arquivo de teste: fora do alcance da trava de dívida de tipo
}
/** `canalCompleto`: fixado antigo, vídeo sem data, `is_short` e `comment_count` nulos (o plano chama a semente com `{}`, mas pede um vídeo fixado). */
const seedRows = async (siteId: string) => { const r = recordingClient(); await seedObservatory(siteId, { canalCompleto: true }, r.client); return r.tables }

type Tables = Record<string, Row[]>
/** O que o banco devolve e a semente deixa para o default da coluna: id das linhas sem id, `is_hidden` false. */
function seedToTables(seed: Map<string, Record<string, unknown>[]>): Tables {
  const rows = (t: string): Row[] => (seed.get(t) ?? []).map(r => ({ ...r }))
  const withIds = (t: string, prefix: string) => rows(t).map((r, i) => ({ id: `${prefix}-${String(i).padStart(6, '0')}`, ...r }))
  return {
    competitor_settings: rows('competitor_settings'), competitor_channels: rows('competitor_channels'), competitor_videos: rows('competitor_videos'),
    competitor_video_versions: rows('competitor_video_versions'), competitor_video_daily: rows('competitor_video_daily'),
    competitor_changes: withIds('competitor_changes', 'chg'), competitor_channel_snapshots: withIds('competitor_channel_snapshots', 'snap'),
    competitor_video_tier_spans: [],
    youtube_channels: rows('youtube_channels'), youtube_videos: rows('youtube_videos').map(r => ({ is_hidden: false, ...r })),
    competitor_readings: rows('competitor_readings'), youtube_intelligence_tasks: rows('youtube_intelligence_tasks'),
    forja_heartbeat: rows('forja_heartbeat'), youtube_niches: rows('youtube_niches'),
  }
}

/** `B` = `A` + o que o Lote 1 grava: `series_tier` em todo vídeo, uma faixa aberta por vídeo (desde 30 dias antes do relógio), 8 pontos semanais por vídeo não observado. */
function withWeekly(a: Tables, now: number): Tables {
  const channels = a.competitor_channels as unknown as ChannelRow[], videos = a.competitor_videos as unknown as VideoRow[]
  const observed = new Set(observedVideoIds(channels, videos))
  const from = spDate(now - 30 * DAY)
  const tierOf = (id: string) => (observed.has(id) ? 'diaria' : 'semanal')
  const spans: Row[] = videos.map(v => ({ video_id: v.id, from_date: from, to_date: null, tier: tierOf(v.id) }))
  const weekly: Row[] = []
  for (const v of videos) {
    if (observed.has(v.id) || v.published_at == null) continue
    for (let i = 7; i >= 0; i--) weekly.push({ video_id: v.id, snap_date: spDate(now - i * 7 * DAY), views: 1000 + (7 - i) * 11, likes: null, comments: null, taken_at: iso(now - i * 7 * DAY) })
  }
  return {
    ...a,
    competitor_videos: a.competitor_videos.map(v => ({ ...v, series_tier: tierOf(v.id as string) })),
    competitor_video_tier_spans: spans,
    competitor_video_daily: [...a.competitor_video_daily, ...weekly],
  }
}

/** O maior canal sintético da Tarefa 17, com uma troca de descrição também num vídeo NÃO observado (o último de cada canal). */
function bigTables(now: number): Tables {
  const t = buildTables({ siteId: SITE, now, channels: 5, videosPerChannel: 120, limit: 30, days: 20, pinOldest: true })
  const extra: Row[] = []
  for (let c = 0; c < 5; c++) {
    const id = `${SITE}-ch${c}-v${100}`, seen = iso(now - 2 * H)
    extra.push({ id: id + '-d2', video_id: id, field: 'desc', value_text: 'linha um\nlinha dois\nlinha extra', value_hash: 'dx', has_text: true, thumb_blob_url: null, first_seen_at: iso(now - DAY), last_seen_at: seen, window_start: null, precision: 'min', is_current: true })
    const d1 = t.competitor_video_versions.find(v => v.id === id + '-d1')!
    d1.is_current = false; d1.last_seen_at = iso(now - DAY)
  }
  t.competitor_video_versions.push(...extra)
  // um vídeo em cada onze cresce 12 vezes mais depressa: há outliers para as telas, o Cowork e a forja
  for (const d of t.competitor_video_daily) if (/-v(\d+)$/.test(d.video_id as string) && Number(/-v(\d+)$/.exec(d.video_id as string)![1]) % 11 === 1) d.views = 1000 + ((d.views as number) - 1000) * 12
  return t
}

/* ------------------------------------------------------------------ as duas entradas */
interface Entry { name: string; now: number; a: Tables; b: Tables; needsWeeklyMark: boolean; rich: boolean }
interface Loaded { ds: Dataset; obs: Observatory; services: ServiceContext; tables: Tables }
const ctxOf = (tables: Tables): { ctx: ServiceContext; db: ReturnType<typeof fakeSupabase> } => {
  const db = fakeSupabase(tables)
  return { db, ctx: { siteId: SITE, permissions: [], supabase: db.client } }
}
async function load(e: Entry, tables: Tables): Promise<Loaded> {
  const { ctx, db } = ctxOf(tables)
  const rows = await loadRows({ siteId: SITE, now: e.now, supabase: db.client })
  const ds = rowsToDataset(rows, e.now)
  return { ds, obs: createObservatory(ds), services: ctx, tables }
}

/* ------------------------------------------------------------------ comparação */
/** Igual de verdade e, para o texto, byte a byte: `toEqual` mostra a diferença; a igualdade do JSON pega o que `toEqual` perdoa (`undefined`, ordem de chaves). */
function diffPath(a: unknown, b: unknown, at = '$'): string | null {
  if (Object.is(a, b)) return null
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as AnyRec), kb = Object.keys(b as AnyRec)
    if (Array.isArray(a) !== Array.isArray(b)) return at + ' (array x objeto)'
    if (ka.length !== kb.length) return at + ' (chaves: ' + ka.filter(k => !kb.includes(k)).concat(kb.filter(k => !ka.includes(k))).join(',') + ')'
    for (const k of ka) { const d = diffPath((a as AnyRec)[k], (b as AnyRec)[k], at + '.' + k); if (d) return d }
    return null
  }
  return at + ' (' + String(a) + ' x ' + String(b) + ')'
}
function same(label: string, a: unknown, b: unknown) {
  expect(diffPath(a, b), label).toBeNull()
  expect(b, label).toEqual(a)
  expect(JSON.stringify(b), label + ' (JSON)').toBe(JSON.stringify(a))
}
type AnyRec = Record<string, unknown>
const dropKeys = <T extends AnyRec>(o: T, keys: readonly string[]): AnyRec => { const c: AnyRec = { ...o }; for (const k of keys) delete c[k]; return c }
const NEW_VIDEO_FIELDS = ['tier', 'tierSpans', 'unobservedSeries'] as const
/**
 * Tira de uma estrutura que carrega objetos de vídeo/canal do conjunto de dados (o conjunto, `obs.channels` com os vídeos dentro, `obs.videos`,
 * os itens de outliers) os quatro campos novos: `tierSpans`, `unobservedSeries`, `weeklyOmitted` e `tier` quando vale `diaria` ou `semanal`
 * (o `tier` de outlier é S/A/B ou top/high/mid). Só estas estruturas passam por aqui: modelos de tela, Cowork e forja são comparados CRUS.
 */
function scrub(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(scrub)
  if (x && typeof x === 'object') {
    const out: AnyRec = {}
    for (const [k, v] of Object.entries(x as AnyRec)) {
      if (k === 'tierSpans' || k === 'unobservedSeries' || k === 'weeklyOmitted' || (k === 'tier' && (v === 'diaria' || v === 'semanal'))) continue
      out[k] = scrub(v)
    }
    return out
  }
  return x
}
const hasNew = (v: AnyRec) => NEW_VIDEO_FIELDS.some(k => v[k] != null)
/** O resultado de `outliers` leva duas funções (a ordem por critério): comparam-se os resultados delas, nos três critérios, no lugar das funções. */
function outliersOf(obs: Observatory, q?: Parameters<Observatory['outliers']>[0]) {
  const r = obs.outliers(q)
  const sorts = ['mult', 'vpd', 'recent'] as const
  return { ...(scrub(dropKeys(r as unknown as AnyRec, ['orderedIds', 'orderedGroups'])) as AnyRec), ids: sorts.map(o => r.orderedIds(o)), groups: sorts.map(o => r.orderedGroups(o)) }
}
const size = (x: unknown) => JSON.stringify(x).length

/* ------------------------------------------------------------------ a lista de consumidores, como asserção */
const SRC = path.resolve(__dirname, '../../../src')
function srcFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name)
    return d.isDirectory() ? srcFiles(p) : /\.(ts|tsx)$/.test(d.name) ? [p] : []
  })
}
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join('/')
/** `grep -rln "loadRows\|loadDataset\|rowsToDataset\|loadChannelRows" apps/web/src --include=*.ts --include=*.tsx`, rodado ao escrever este teste. */
const CONSUMIDORES = [
  'app/cms/(authed)/youtube/competitors/_chrome/page-data.ts',
  'app/cms/(authed)/youtube/competitors/actions.ts',
  'app/cms/(authed)/youtube/competitors/forja-actions.ts',
  'lib/pipeline/services/competitors.ts',
  'lib/pipeline/services/forja-queue.ts',
  'lib/youtube/observatorio/load-channel.ts',
  'lib/youtube/observatorio/load-page.ts',
  'lib/youtube/observatorio/load.ts',
]

describe('Lote 1: quem lê o que ele grava', () => {
  it('a lista de arquivos que chamam loadRows, loadDataset, rowsToDataset ou loadChannelRows é a esperada (consumidor novo = acrescente o `it` dele)', () => {
    const files = srcFiles(SRC).filter(p => /loadRows|loadDataset|rowsToDataset|loadChannelRows/.test(fs.readFileSync(p, 'utf8'))).map(rel).sort()
    expect(files).toEqual([...CONSUMIDORES].sort())
  })
  it('nenhum arquivo fora de lib/youtube/observatorio lê unobservedSeries, tierSpans ou weeklySeries (a E4 e a E5 mudam este teste, de propósito)', () => {
    const out = srcFiles(SRC).filter(p => !rel(p).startsWith('lib/youtube/observatorio/')).filter(p => /unobservedSeries|tierSpans|weeklySeries/.test(fs.readFileSync(p, 'utf8'))).map(rel)
    expect(out).toEqual([])
  })
})

describe('a semente de e2e entrega linhas (senão cada consumidor compararia vazio com vazio)', () => {
  it('a semente entregou linhas', async () => {
    const t = await seedRows(SITE)
    for (const name of ['competitor_channels', 'competitor_videos', 'competitor_video_daily', 'competitor_video_versions', 'competitor_changes', 'competitor_channel_snapshots', 'youtube_channels']) {
      expect(t.get(name)?.length ?? 0, name).toBeGreaterThan(0)
    }
    expect((t.get('competitor_videos') ?? []).some(v => v.pinned_at != null)).toBe(true)
    // troca legada (sem versão de origem) e vídeo sem data, os dois casos que o item 247 manda cobrir
    expect((t.get('competitor_changes') ?? []).some(c => c.from_version_id == null)).toBe(true)
    expect((t.get('competitor_videos') ?? []).some(v => v.published_at == null)).toBe(true)
  })
})

/* ------------------------------------------------------------------ os consumidores, sobre cada entrada */
let seedA: Tables
beforeAll(async () => { seedA = seedToTables(await seedRows(SITE)) })

const entries = (): Entry[] => {
  const bigNow = Date.now()
  const big = bigTables(bigNow)
  return [
    { name: 'semente de e2e (oráculo inteiro, canal próprio, fixados, trocas legadas)', now: ORACLE_NOW, a: seedA, b: withWeekly(seedA, ORACLE_NOW), needsWeeklyMark: false, rich: true },
    { name: 'fixture grande (5 canais x 120 vídeos)', now: bigNow, a: big, b: withWeekly(big, bigNow), needsWeeklyMark: true, rich: false },
  ]
}

const OLD_ENV = { e2e: process.env.OBS_E2E, now: process.env.OBS_NOW_OVERRIDE }
afterAll(() => {
  if (OLD_ENV.e2e === undefined) delete process.env.OBS_E2E; else process.env.OBS_E2E = OLD_ENV.e2e
  if (OLD_ENV.now === undefined) delete process.env.OBS_NOW_OVERRIDE; else process.env.OBS_NOW_OVERRIDE = OLD_ENV.now
})

// Cada entrada é montada na hora (a semente só existe depois do beforeAll): os dois `describe` têm a mesma forma.
for (const which of [0, 1] as const) {
  describe(which === 0 ? 'consumidores: semente de e2e' : 'consumidores: fixture grande', () => {
    let e!: Entry, A!: Loaded, B!: Loaded
    beforeAll(async () => {
      e = entries()[which]!
      // o relógio dos serviços do Cowork é o da entrada (observatoryNow lê este par de variáveis; só vale fora de produção)
      process.env.OBS_E2E = '1'; process.env.OBS_NOW_OVERRIDE = iso(e.now)
      A = await load(e, e.a); B = await load(e, e.b)
    })

    /** Vídeos de concorrente fora do acompanhamento (os que ganham série semanal em B), escolhidos em A: o mesmo conjunto com o motor de antes. */
    const unobservedSample = (n: number) => A.ds.videos.filter(v => !v.tracked && !v.pinned && !A.ds.channels.find(c => c.id === v.ch)!.own).slice(0, n)

    it('as duas entradas têm os mesmos vídeos; B leva o que o Lote 1 grava e A não leva nada disso', () => {
      expect(A.ds.videos.length).toBeGreaterThan(50)
      expect(B.ds.videos.map(v => v.id)).toEqual(A.ds.videos.map(v => v.id))
      expect(A.ds.videos.some(v => hasNew(v as unknown as AnyRec))).toBe(false)
      expect(B.ds.videos.filter(v => v.tier === 'semanal' && (v.unobservedSeries?.length ?? 0) >= 3 && (v.tierSpans?.length ?? 0) === 1).length).toBeGreaterThan(10)
      expect(B.ds.videos.filter(v => v.tier === 'diaria').length).toBeGreaterThan(10)
      // os vídeos de amostra das telas do vídeo e da fila da forja são, em B, vídeos com série semanal guardada
      expect(unobservedSample(5).length).toBe(5)
      for (const v of unobservedSample(5)) expect(B.ds.videos.find(x => x.id === v.id)!.unobservedSeries?.length ?? 0).toBeGreaterThan(2)
    })

    it('o conjunto de dados (rowsToDataset): tudo, tirando tier, tierSpans, unobservedSeries e weeklyOmitted', () => {
      same('dataset', scrub(A.ds), scrub(B.ds))
      // o que o scrub tira existe só em B, e só nos vídeos: nenhum outro campo novo apareceu no conjunto de dados
      for (const v of B.ds.videos) expect(Object.keys(v).filter(k => !(k in (A.ds.videos.find(x => x.id === v.id) ?? {})))).toEqual(Object.keys(v).filter(k => (NEW_VIDEO_FIELDS as readonly string[]).includes(k)))
    })

    it('a lista de canais (channels, channelStats de cada canal, cadência, sincronização): tudo', () => {
      same('channels', scrub(A.obs.channels), scrub(B.obs.channels))
      expect(A.obs.channels.length).toBeGreaterThan(1)
      for (const c of A.obs.channels) {
        for (const f of [undefined, 'long', 'short'] as const) same(`channelStats ${c.id} ${f}`, scrub(A.obs.channelStats(c.id, f)), scrub(B.obs.channelStats(c.id, f)))
        same('cadence ' + c.id, scrub(A.obs.cadence(c.id)), scrub(B.obs.cadence(c.id)))
        same('syncText ' + c.id, A.obs.syncText(c.id), B.obs.syncText(c.id))
      }
      same('SYNC', A.obs.SYNC, B.obs.SYNC); same('LAST_IDX', A.obs.LAST_IDX, B.obs.LAST_IDX)
      expect(A.obs.channels.some(c => A.obs.channelStats(c.id, 'long').vpdN > 0)).toBe(true)
    })

    it('as trocas (changes, changesIn, caveats) e o efeito de TODA troca: tudo, tirando weeklySeries; status, label e reason nunca mudam', () => {
      same('changes', A.obs.changes, B.obs.changes)
      same('changesIn', A.obs.changesIn(), B.obs.changesIn())
      same('changesIn 30', A.obs.changesIn({ days: 30 }), B.obs.changesIn({ days: 30 }))
      expect(A.obs.changes.length).toBeGreaterThan(5)
      let marked = 0
      for (const c of A.obs.changes) {
        const ea = A.obs.effect(c.id), eb = B.obs.effect(c.id)
        expect(ea, c.id).not.toBeNull(); expect(eb, c.id).not.toBeNull()
        same('effect ' + c.id, ea, dropKeys(eb as unknown as AnyRec, ['weeklySeries']))
        expect([eb!.status, eb!.label, eb!.reason]).toEqual([ea!.status, ea!.label, ea!.reason])
        expect(ea!.weeklySeries).toBeUndefined()
        if (eb!.weeklySeries) { marked++; expect(eb!.status).toBe('sem-serie') }
        same('effectAt ' + c.id, A.obs.effectAt(c.id, A.obs.LAST_IDX - 3), dropKeys(B.obs.effectAt(c.id, A.obs.LAST_IDX - 3) as unknown as AnyRec, ['weeklySeries']))
        same('caveats ' + c.id, A.obs.caveats(c.id), B.obs.caveats(c.id))
      }
      if (e.needsWeeklyMark) expect(marked, 'a fixture tem troca em vídeo não observado com série semanal: o marcador tem de aparecer').toBeGreaterThan(0)
    })

    it('a página do canal: multiplier, vpd e vpd7 de TODO vídeo, o cartão do multiplicador, as taxas por período e os outliers: tudo', () => {
      same('videos', scrub(A.obs.videos), scrub(B.obs.videos))
      expect(A.obs.videos.some(v => v.mult != null && v.vpd != null)).toBe(true)
      const from = A.obs.NOW - 30 * A.obs.DAY, to = A.obs.NOW
      for (const v of A.obs.videos) {
        same('multiplier ' + v.id, A.obs.multiplier(v.id), B.obs.multiplier(v.id))
        same('multiplierCard ' + v.id, A.obs.multiplierCard(v.id), B.obs.multiplierCard(v.id))
        same('periodRate ' + v.id, A.obs.periodRate(v.id, from, to), B.obs.periodRate(v.id, from, to))
        same('expectedCurve ' + v.id, A.obs.expectedCurve(v.id), B.obs.expectedCurve(v.id))
        same('phaseOf ' + v.id, A.obs.phaseOf(v.id), B.obs.phaseOf(v.id))
      }
      const queries = [undefined, { ages: 'all' }, { ages: 'all', fmt: 'short' }, { niche: 'viagem' }, { niche: 'ia', ages: 'all' }, { fmt: 'long', min: 1.5 }] as const
      for (const q of queries) same('outliers ' + JSON.stringify(q), outliersOf(A.obs, q as never), outliersOf(B.obs, q as never))
      for (const c of A.obs.channels.filter(x => !x.own)) same('outliers canal ' + c.id, outliersOf(A.obs, { channel: c.id, ages: 'all' }), outliersOf(B.obs, { channel: c.id, ages: 'all' }))
      same('tabCounts', A.obs.TAB_COUNTS, B.obs.TAB_COUNTS)
      expect(A.obs.outliers({ ages: 'all' }).count).toBeGreaterThan(0)
    })

    it('a página do vídeo: a série e as marcas do vídeo observado; a do não observado continua vazia (A e B)', () => {
      const unobserved = B.ds.videos.filter(v => (v.unobservedSeries?.length ?? 0) > 0)
      expect(unobserved.length).toBeGreaterThan(10)
      for (const v of unobserved) {
        expect(B.obs.seriesOf(v.id), 'série do não observado ' + v.id).toEqual([])
        same('seriesOf ' + v.id, A.obs.seriesOf(v.id), B.obs.seriesOf(v.id))
      }
      const observed = A.ds.videos.filter(v => v.series.length > 0)
      expect(observed.length).toBeGreaterThan(5)
      for (const v of A.ds.videos) {
        same('seriesOf ' + v.id, A.obs.seriesOf(v.id), B.obs.seriesOf(v.id))
        for (const idx of [0, 1, Math.floor(A.obs.LAST_IDX / 2), A.obs.LAST_IDX]) same(`viewsAt ${v.id} ${idx}`, A.obs.viewsAt(v.id, idx), B.obs.viewsAt(v.id, idx))
        same('versões ' + v.id, [A.obs.video(v.id)!.titles, A.obs.video(v.id)!.thumbs, A.obs.video(v.id)!.descs], [B.obs.video(v.id)!.titles, B.obs.video(v.id)!.thumbs, B.obs.video(v.id)!.descs])
      }
    })

    it('Cowork: o objeto devolvido por outliers e por insights, inteiro', async () => {
      const filters = [{}, { fmt: 'short' as const }, { tier: 'top' }, { tier: 'high', limit: 100 }, { limit: 3 }]
      for (const f of filters) {
        const ra = await listCompetitorOutliers(A.services, f), rb = await listCompetitorOutliers(B.services, f)
        same('outliers ' + JSON.stringify(f), ra, rb)
        expect(size(rb)).toBe(size(ra))
      }
      expect((await listCompetitorOutliers(A.services, { fmt: 'long' })).data.count).toBeGreaterThan(0)
      const ia = await getCompetitorInsights(A.services), ib = await getCompetitorInsights(B.services)
      same('insights', ia, ib)
      expect(ia.data.cadence.length).toBeGreaterThan(0)
      expect(size(ib)).toBe(size(ia))
    })

    it('fila da forja: buildSent (o pacote enviado ao modelo), inteiro e do mesmo tamanho em caracteres', async () => {
      // a fila lê o conjunto pelo mesmo caminho do serviço (loadDataset), uma vez por pedido
      const dsA = createObservatory(await loadDataset({ siteId: SITE, now: e.now, supabase: A.services.supabase }))
      const dsB = createObservatory(await loadDataset({ siteId: SITE, now: e.now, supabase: B.services.supabase }))
      const sample = [...unobservedSample(4), ...A.ds.videos.filter(v => v.tracked).slice(0, 4)].map(v => v.id)
      const targets: Array<[string, { niche?: 'viagem' | 'ia'; videoId?: string }]> = []
      for (const niche of ['viagem', 'ia'] as const) for (const type of ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas']) targets.push([type, { niche }])
      for (const videoId of sample) targets.push(['leitura-video', { videoId }])
      const run = (obs: Observatory, type: string, t: { niche?: 'viagem' | 'ia'; videoId?: string }) => {
        try { return { pack: buildSent(obs, type, t) } } catch (err) { return { erro: err instanceof Error ? err.message : String(err) } }
      }
      let ok = 0, noVideoPack = 0
      for (const [type, t] of targets) {
        const pa = run(dsA, type, t), pb = run(dsB, type, t)
        same(`buildSent ${type} ${JSON.stringify(t)}`, pa, pb)
        expect(JSON.stringify(pb).length, `tamanho ${type}`).toBe(JSON.stringify(pa).length)
        if ('pack' in pa) { ok++; if (type === 'leitura-video') noVideoPack++ }
      }
      expect(ok).toBeGreaterThan(3)
      expect(noVideoPack, 'ao menos um pacote de vídeo foi montado').toBeGreaterThan(0)
    })

    it('o que as páginas mandam ao cliente: o modelo de cada tela é igual e, em caracteres, B <= A + 2%', () => {
      const sample = [...unobservedSample(5), ...A.ds.videos.filter(v => v.tracked).slice(0, 5)].map(v => v.id)
      const views: Array<[string, (o: Observatory) => unknown]> = [
        ['Canais', o => buildCanaisView(o, { niche: 'todos', limit: 75 })],
        ['Canais (nicho)', o => buildCanaisView(o, { niche: 'viagem', limit: 75 })],
        ['Mudanças', o => buildMudancasView(o, { niche: 'todos' }, new Set())],
        ['Outliers', o => buildOutliersView(o, { niche: 'todos' })],
        ['Outliers (todas as idades)', o => buildOutliersView(o, { niche: 'todos', ages: 'all' })],
        ['Insights', o => buildInsightsView(o, { niche: 'todos' })],
        ['Insights (nicho)', o => buildInsightsView(o, { niche: 'viagem' })],
        ...A.obs.channels.filter(c => !c.own).map((c): [string, (o: Observatory) => unknown] => ['Canal ' + c.id, o => buildCanalView(o, c.id, {})]),
        ...sample.map((id): [string, (o: Observatory) => unknown] => ['Histórico ' + id, o => buildHistoricoView(o, id, { niche: 'todos' })]),
      ]
      let viewsWithData = 0
      for (const [name, build] of views) {
        const va = build(A.obs), vb = build(B.obs)
        same(name, va, vb)
        expect(size(vb), name).toBeLessThanOrEqual(Math.ceil(size(va) * 1.02))
        if (size(va) > 500) viewsWithData++
      }
      expect(viewsWithData).toBeGreaterThan(6)
      // nada do que é novo viaja para o cliente
      for (const [name, build] of views) expect(JSON.stringify(build(B.obs)), name).not.toMatch(/unobservedSeries|tierSpans|weeklySeries/)
    })
  })
}
