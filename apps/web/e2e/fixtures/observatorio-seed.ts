/**
 * Fidelity seed: the approved mockup's ORACLE dataset (test/fixtures/observatorio/dados.cjs) → rows of the local DB.
 * The round trip DB → loadDataset → engine must give the mockup's numbers (tabCounts('todos') = 14/18/11).
 *
 * Mapping (DB ← oracle):
 *  - competitor_settings: series_started_at = SERIES_START, channel_limit = opts.channelLimit ?? 75;
 *  - competitor_channels: sync columns derived from sync.state (erro → sync_status 'error' + the oracle message, which
 *    humanizeSyncError turns into the oracle label; atrasado → last_ok_synced_at = sync.last; backfill → never an OK
 *    sync, youtube_video_count = backfill.total so the progress is tracked/total);
 *  - competitor_videos + competitor_video_daily (snap_date = SP date of the 12:00 snapshot of each index);
 *  - competitor_video_versions from titles/thumbs/descs (thumbnail: value_hash = the oracle key, thumb_blob_url = null;
 *    'publicacao'/'desde-arquivo' → precision 'first');
 *  - competitor_changes: pre-series TITLE changes as legacy rows (from_version_id null — what production has from before
 *    the series), every other change with its version ids (the loader ignores those; they mirror production);
 *  - competitor_channel_snapshots; os canais próprios do preset (opts.ownPreset; sem ele, o único canal do oráculo) as
 *    youtube_channels (com `niche` e `slug` = o id do oráculo) + youtube_videos (no series: production has none). Dois
 *    canais próprios podem ter o mesmo idioma (multi-canal): os presets '5', 'mix' e 'zero' são semeados como os outros;
 *  - youtube_niches: os nichos criados pelo dono (opts.extraNiche / opts.extraNiches), com os concorrentes indicados
 *    movidos para eles — o que n-nichos.js faz no mockup de 04/10 com OBS.setNiche. Viagem e IA já existem em todo site;
 *  - competitor_readings (model 'Gemma 12B'; oracle ids inside are rewritten to the seeded uuids; the latest `temas`
 *    reading per niche carries the video → theme evidence the loader reads);
 *  - youtube_intelligence_tasks: the oracle's history requests always; with opts.forjaState, also the requests of
 *    O.forja.requestScenario(state, { niche: 'todos', type }) (columns as requestStateOf reads them);
 *  - forja_heartbeat: the oracle's last poll, or the scenario machine's when opts.forjaState is set.
 *
 * Ids are deterministic (uuid from siteId + oracle id), so a screen URL is stable across seeds.
 * Safety: refuses any Supabase URL that is not local — apps/web/.env.local points at PRODUCTION.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RequestState } from '../../src/lib/youtube/observatorio/types'
import { OWN_PRESETS, OWN_EXTRA_IDS, applyOwnPreset, type OwnPreset } from '../../test/fixtures/observatorio/own-presets'

export interface SeedOptions {
  /** A request state of the forja (P4 screens): writes the scenario's requests and machine. */
  forjaState?: RequestState | null
  /** task_type of the scenario requests (default 'padroes-titulo'). */
  forjaType?: string
  channelLimit?: number
  /** The own channel without a long video in the last 90 days (the mockup's 'own-empty' scenario). */
  ownEmpty?: boolean
  /** Only the competitor channels whose sync is not ok ("Só canais com problema"). */
  onlyProblems?: boolean
  /**
   * Not a data state: the mockup's empty windows ("Janela sem outliers", "Vazio em 90 dias") are FILTERS over the same
   * data. Put them in MockupState.query. Passing true throws, so a spec never believes it seeded an empty window.
   */
  emptyWindow?: boolean
  /** Named mockup scenario: only 'own-empty' (= ownEmpty) exists in the oracle. */
  scenario?: string
  /**
   * No forja reading at all (Insights "ainda não há leitura"). The video themes come from the latest temas reading's
   * evidence in production, so they go too: the screen then has no themed video (R49's honest coverage text).
   */
  noReadings?: boolean
  /** Canais próprios do estado do mockup novo (mockup.js PRESETS). Ausente = o seed de antes: um canal próprio, sem os extras. */
  ownPreset?: OwnPreset
  /** Um nicho criado pelo dono, com UM concorrente (id do oráculo) movido para ele. Atalho de extraNiches com um item. */
  extraNiche?: { slug: string; label: string; channel: string }
  /** Nichos criados pelo dono, na ordem de criação (sort_order 30, 40, …; cores da paleta em ciclo, ou `tone`). */
  extraNiches?: ExtraNiche[]
  /**
   * Fase 4 (histórico com muitas versões): acrescenta a matt-wolfe UM vídeo com 24 períodos de thumbnail (5 imagens),
   * 9 títulos e 3 descrições, todos dentro da janela do oráculo (04/10 a 23/10/2026). Id do oráculo: MANY_VERSIONS_ID.
   */
  manyVersions?: boolean
  /**
   * A página do canal (A1, tarefa 10): o canal matt-wolfe, que já tem 259 vídeos além dos `video_limit` acompanhados, ganha os casos
   * que o oráculo não tem: um vídeo antigo fixado, um vídeo sem data de publicação, um com `is_short` nulo e um com `comment_count`
   * nulo. As duas trocas no mesmo vídeo já existem (matt-opus55: 3 títulos e 4 thumbnails).
   */
  canalCompleto?: boolean
  /**
   * Dado PRIVADO do PRIMEIRO canal próprio do preset (alcance e diário por vídeo, só no banco local). Ausente = nenhuma linha (as telas dizem
   * "ainda sem relatório"). Os perfis estão em `PERFIS_L2`: `cheio` (29 dias de relatório, 11 com impressão, 8 vazios, 10 `listado`),
   * `curto` (2 dias), `parado` (29 relatórios vazios e diário de zeros) e, além do brief, `ativo` (como `cheio`, mas sem CTR nulo e com views na
   * maioria dos longos: a mediana de views por dia não é zero) e `velho` (como `cheio`, terminando 12 dias antes do relógio: a coleta "parou").
   */
  ownL2?: OwnL2
}
export type OwnL2 = 'cheio' | 'curto' | 'parado' | 'ativo' | 'velho' | 'grande' | 'lacunas' | 'retencao' | 'recente'
/** Os ids de oráculo que `canalCompleto` mexe, em matt-wolfe. */
export const CANAL_COMPLETO = { canal: 'matt-wolfe', fixadoAntigo: 'matt-wolfe-l150', shortNulo: 'matt-wolfe-l5', comentariosNulo: 'matt-wolfe-l6', semData: 'canal-completo-sem-data' } as const
export type NicheTone = 'ameixa' | 'rosa' | 'lima' | 'ardosia'
export interface ExtraNiche { slug: string; label: string; tone?: NicheTone; /** concorrentes (ids do oráculo) movidos para o nicho; vazio = nicho recém-criado */ channels?: string[] }
/** A paleta aprovada dos nichos criados (a do CHECK de youtube_niches e de n-nichos.js), na ordem do ciclo. */
export const NICHE_TONES: Record<NicheTone, { dark: string; light: string }> = {
  ameixa: { dark: '#D29AE8', light: '#7B2A91' }, rosa: { dark: '#F293C2', light: '#A3216B' },
  lima: { dark: '#B9CB62', light: '#55650B' }, ardosia: { dark: '#AAB4C0', light: '#4B5563' },
}
const TONE_CYCLE: NicheTone[] = ['ameixa', 'rosa', 'lima', 'ardosia']
const BUILTIN_SLUGS = ['viagem', 'ia']
/**
 * Cópia de EXTRA / PRESETS de n-nichos.js (docs/superpowers/mockups/2026-10-04-multi-canal/observatorio-n-nichos):
 * os nichos de cada estado "Nichos do site" (?nichos=3|4|6) e os concorrentes que o mockup move para eles.
 */
const MOCK_NICHES: Record<string, ExtraNiche> = {
  jogos: { slug: 'jogos', label: 'Jogos', tone: 'ameixa', channels: ['preguica-artificial', 'the-ai-advantage'] },
  pessoal: { slug: 'pessoal', label: 'Pessoal', tone: 'rosa', channels: [] },
  culinaria: { slug: 'culinaria', label: 'Culinária', tone: 'lima', channels: ['paddy-doyle'] },
  financas: { slug: 'financas', label: 'Finanças', tone: 'ardosia', channels: [] },
}
export const NICHE_PRESETS: Record<'3' | '4' | '6', ExtraNiche[]> = {
  '3': [MOCK_NICHES.jogos!], '4': [MOCK_NICHES.jogos!, MOCK_NICHES.pessoal!],
  '6': [MOCK_NICHES.jogos!, MOCK_NICHES.pessoal!, MOCK_NICHES.culinaria!, MOCK_NICHES.financas!],
}

/** The mockup clock (dados.js NOW_ISO). Also the webServer's OBS_NOW_OVERRIDE. */
export const ORACLE_NOW_ISO = '2026-10-24T15:02:00-03:00'
export const ORACLE_NOW = Date.parse(ORACLE_NOW_ISO)

/* ------------------------------------------------------------------ oracle shapes (only what the seed reads) */
type OPrec = 'publicacao' | 'desde-arquivo' | 'min' | '6h' | '1d'
interface OVersion { id: string; first_seen: number; last_seen: number; current: boolean; prec: OPrec; window: [number, number] | null }
interface OTitle extends OVersion { text: string }
interface OThumb extends OVersion { key: string }
interface ODesc extends OVersion { lines: string[] | null; hasText: boolean }
interface OSync { state: 'ok' | 'atrasado' | 'erro' | 'backfill'; last: number | null; msg: string | null; errorSince: number | null; added: number | null; backfill: { done: number; total: number } | null }
interface OChannel { id: string; name: string; niche: string | null; own: boolean; lang: string; subs: number; video_limit: number; handle: string; sync: OSync; snapshots: Array<{ date: string; subs: number; views: number }> }
interface OVideo {
  id: string; ch: string; niche?: string | null; fmt: 'long' | 'short'; pub: number; ageDays: number; dur: string; ytId: string; title: string; theme: string | null
  views: number | null; viewsAt: number | null; likes: number | null; comments: number | null
  series: Array<{ idx: number; t: number; views: number }>; titles: OTitle[]; thumbs: OThumb[]; descs: ODesc[]
}
interface ORequest {
  id: string; scenario?: boolean; type: string; niche: 'viagem' | 'ia'; status: string; attempt?: number
  target: { kind: 'niche' | 'video'; video?: string; fmt?: 'long' | 'short' }
  createdAt: number; claimedAt: number | null; publishedAt: number | null; releasedAt?: number | null; releasedBy?: string | null
  failedAt?: number | null; refusedAt?: number | null; refusedReason?: string | null; failReason?: string | null
  readingId?: string | null
}
interface OReading {
  id: string; type: string; niche: 'viagem' | 'ia'; fmt?: 'long' | 'short'; target?: { kind: string; video?: string }; generatedAt: number; sent: Record<string, unknown>; analysis: unknown; text: unknown
  base?: unknown; effects?: unknown; viewsThen?: number | null
}
interface OracleData {
  NOW: number; SERIES_START: number; OBS_START: number
  channels: OChannel[]; videos: OVideo[]
  forja: {
    readings: OReading[]; requests: ORequest[]; queue: { lastPollAt: number }
    requestScenario(state: string, target: { niche: string; type: string }): { requests: ORequest[]; machine: { lastPollAt: number | null } } | null
    /** The readings a published scenario request produced ("…-cenario"), keyed by type|niche|video||at. */
    scenarioReadings?: Record<string, OReading>
  }
}

/**
 * Same as test/youtube/observatorio/oracle.ts loadOracle(), which cannot be imported here: it locates the fixture with
 * import.meta.url, and Playwright compiles this package (no "type": "module") to CommonJS, where import.meta is a
 * SyntaxError. __dirname works under both Playwright and Vitest.
 */
function loadOracleData(preset?: OwnPreset): { O: OracleData; nicheOf: Map<string, string> } {
  const ctx: Record<string, unknown> = { console: { log() {}, error() {} } }
  const dir = path.resolve(__dirname, '../../test/fixtures/observatorio')
  vm.createContext(ctx)
  // with a preset: segundo-canal.cjs BEFORE dados.cjs, in the same context (as test/youtube/observatorio/oracle.ts loadOracleOwns)
  if (preset) vm.runInContext(fs.readFileSync(path.join(dir, 'segundo-canal.cjs'), 'utf8'), ctx)
  vm.runInContext(fs.readFileSync(path.join(dir, 'dados.cjs'), 'utf8'), ctx)
  const O = ctx.OBS as OracleData
  if (preset) {
    const have = new Set(O.channels.map(c => c.id)), missing = OWN_EXTRA_IDS.filter(id => !have.has(id))
    if (!ctx.__SEGUNDO_CANAL || missing.length) throw new Error('observatorio-seed: segundo-canal.cjs não injetou os canais extras' + (missing.length ? ': ' + missing.join(', ') : ''))
  }
  // the oracle's own niche of every channel, kept before the preset empties it for the channels "sem nicho"
  const nicheOf = new Map<string, string>()
  for (const c of O.channels) if (c.niche) nicheOf.set(c.id, c.niche)
  if (preset) applyOwnPreset(O, preset)
  return { O, nicheOf }
}

/** uuid semeado de um canal próprio do oráculo ('tnfigueiredo' mantém o id de antes). */
export function ownSeedUuid(siteId: string, oracleId: string): string {
  return seedUuid(siteId, 'own-channel', oracleId === 'tnfigueiredo' ? 'own' : oracleId)
}
const localeOf = (c: { lang: string }): 'pt' | 'en' => (c.lang === 'en' ? 'en' : 'pt')

/* ------------------------------------------------------------------ helpers */
const DAY = 864e5, SP_OFF = 3 * 36e5
const iso = (ms: number | null | undefined): string | null => (ms == null ? null : new Date(ms).toISOString())
const spDate = (ms: number) => new Date(ms - SP_OFF).toISOString().slice(0, 10)
const sha1 = (s: string) => createHash('sha1').update(s).digest('hex')
/** Deterministic uuid (v5 layout) for an oracle id within a site. */
export function seedUuid(siteId: string, kind: string, oracleId: string): string {
  const h = sha1(siteId + '|' + kind + '|' + oracleId)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16]!, 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}
const durSeconds = (dur: string) => dur.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0)
const precOf = (p: OPrec): 'first' | 'min' | '6h' | '1d' => (p === 'publicacao' || p === 'desde-arquivo' ? 'first' : p)
const FIELD_OF = { title: 'title', description: 'desc', thumbnail: 'thumb' } as const
const changePrec = (p: OPrec): 'min' | '6h' | '1d' | null => (p === 'min' || p === '6h' || p === '1d' ? p : null)
const dmyToIso = (d: string) => { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}` }

/** Throws unless the Supabase URL is the local stack (127.0.0.1 / localhost). */
export function assertLocal(url: string): void {
  const host = new URL(url).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') throw new Error('observatorio-seed: refusing a non-local Supabase (' + host + ')')
}
/** Service client of the LOCAL Supabase (env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). */
export function localServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('observatorio-seed: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (apps/web/.env.test)')
  assertLocal(url)
  return createClient(url, key, { auth: { persistSession: false } })
}
function clientOf(sb?: SupabaseClient): SupabaseClient {
  if (!sb) return localServiceClient()
  // supabaseUrl is public on the client: the guard holds for an injected client too
  const url = (sb as unknown as { supabaseUrl?: string }).supabaseUrl
  // fail closed: a client whose URL cannot be read is refused rather than trusted
  if (typeof url !== 'string' || !url) throw new Error('observatorio-seed: cannot read the injected client URL; refusing to write')
  assertLocal(url)
  return sb
}

async function insertAll(sb: SupabaseClient, table: string, rows: object[], chunk = 1000): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + chunk))
    if (error) throw new Error('observatorio-seed: insert ' + table + ' failed: ' + error.message)
  }
}
async function check(label: string, p: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await p
  if (error) throw new Error('observatorio-seed: ' + label + ' failed: ' + error.message)
}

/**
 * Rewrites every oracle video/channel id into its seeded uuid (readings carry oracle ids), including inside a change id
 * "<video>/<title|thumb|desc>/<n>": the engine names a change after its video, so the loader's ids carry the uuid.
 */
export function remapIds(x: unknown, ids: Map<string, string>): unknown {
  if (typeof x === 'string') {
    const hit = ids.get(x)
    if (hit) return hit
    const m = /^(.+)\/(title|thumb|desc)\/(\d+)$/.exec(x)
    return m && ids.has(m[1]!) ? ids.get(m[1]!) + '/' + m[2] + '/' + m[3] : x
  }
  if (Array.isArray(x)) return x.map(y => remapIds(y, ids))
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, remapIds(v, ids)]))
  return x
}

/* ------------------------------------------------------------------ clear */
/**
 * Removes the observatory data of the site, not only what the seed wrote: every competitor channel (and, by cascade,
 * videos, versions, daily rows, snapshots), changes, readings, heartbeat, settings, and EVERY non-diagnostico forja
 * task of the site (including one a developer queued by hand). Fine for the local e2e site; never point it elsewhere
 * (clientOf refuses non-local URLs).
 */
export async function clearObservatory(siteId: string, client?: SupabaseClient): Promise<void> {
  const sb = clientOf(client)
  // every own channel the seed may have written: the legacy one and each extra of segundo-canal.cjs
  const ownIds = ['tnfigueiredo', ...OWN_EXTRA_IDS].map(id => ownSeedUuid(siteId, id))
  await check('delete competitor_readings', sb.from('competitor_readings').delete().eq('site_id', siteId))
  await check('delete tasks', sb.from('youtube_intelligence_tasks').delete().eq('site_id', siteId).neq('task_type', 'diagnostico'))
  await check('delete forja_heartbeat', sb.from('forja_heartbeat').delete().eq('site_id', siteId))
  await check('delete competitor_changes', sb.from('competitor_changes').delete().eq('site_id', siteId))
  // cascades: competitor_videos → versions, daily; snapshots
  await check('delete competitor_channels', sb.from('competitor_channels').delete().eq('site_id', siteId))
  await check('delete competitor_settings', sb.from('competitor_settings').delete().eq('site_id', siteId))
  // as tabelas privadas do canal próprio (FK `on delete restrict` para youtube_channels): só as dos canais que a semente escreve
  await clearOwnL2(siteId, sb, ownIds)
  await check('delete youtube_videos', sb.from('youtube_videos').delete().eq('site_id', siteId).in('channel_id', ownIds))
  await check('delete youtube_channels', sb.from('youtube_channels').delete().eq('site_id', siteId).in('id', ownIds))
  // last (the FKs demand it): the niches the owner created. Viagem and IA stay (every site has them). A niche still
  // used by a channel the seed did not write (a developer's own channel on the local site) is left alone, not forced.
  const kept = await sb.from('youtube_channels').select('niche').eq('site_id', siteId).not('niche', 'is', null)
  if (kept.error) throw new Error('observatorio-seed: read youtube_channels failed: ' + kept.error.message)
  const keep = [...new Set([...BUILTIN_SLUGS, ...(kept.data ?? []).map(r => String((r as { niche: string }).niche))])]
  await check('delete youtube_niches', sb.from('youtube_niches').delete().eq('site_id', siteId).not('slug', 'in', '(' + keep.map(k => '"' + k + '"').join(',') + ')'))
}

/**
 * Forgets every viewer's persisted niche on the site (competitor_user_prefs): a mockup tab starts from an empty
 * localStorage ('todos'), so each fidelity test starts the implementation the same way — a ?niche= of an earlier state
 * (persisted by the chrome, CHROME.md) must not leak into the next one.
 */
export async function resetViewerPrefs(siteId: string, client?: SupabaseClient): Promise<void> {
  await check('delete competitor_user_prefs', clientOf(client).from('competitor_user_prefs').delete().eq('site_id', siteId))
}

/* ------------------------------------------------------------------ dado privado do canal próprio (L2) */
/**
 * Apaga as tabelas privadas (alcance, diário, relatórios, jobs) dos canais próprios que a semente escreve (`ownIds`): nada mais.
 * Vem ANTES de apagar youtube_channels (a chave de yt_own_video_* é `on delete restrict`). Só no banco local (clientOf).
 */
export async function clearOwnL2(siteId: string, client?: SupabaseClient, ownIds?: string[]): Promise<void> {
  const sb = clientOf(client)
  const ids = ownIds ?? ['tnfigueiredo', ...OWN_EXTRA_IDS].map(id => ownSeedUuid(siteId, id))
  for (const t of ['yt_own_video_reach_daily', 'yt_own_video_daily', 'yt_reporting_reports', 'yt_reporting_jobs']) {
    await check('delete ' + t, sb.from(t).delete().eq('site_id', siteId).in('channel_id', ids))
  }
}

/** Um perfil de dado privado. `relatorios`: um caractere por dia, do mais antigo ao mais novo (I = baixado com impressões, V = vazio, L = listado, nunca baixado). */
interface PerfilL2 {
  /** dias entre o último dia coletado (dia do YouTube, Pacífico) e o relógio do oráculo */
  fimDias: number
  relatorios: string
  /** um vídeo, num dia com impressão, vem sem CTR */
  ctrNulo: boolean
  diarioDias: number
  /** `tres`: só os três longos mais novos têm views; `maioria`: metade dos longos; `zeros`: nenhuma view */
  diario: 'tres' | 'maioria' | 'zeros'
  /** somado às impressões de toda linha de alcance: números grandes (e improváveis) para a prova do usuário só de leitura e para o layout a 390 px */
  impBase?: number
  /** quantos dos longos MAIS ANTIGOS têm só 5 dias de diário (menos de 7: fora da mediana de views por dia), com views altas para o filtro fazer diferença */
  diarioCurtos?: number
  /** o primeiro longo entre os 6 vídeos com alcance fica SEM nenhuma linha de diário (impressões sem views por dia) */
  semDiarioPrimeiro?: boolean
  /** uma linha de alcance de um vídeo que NÃO existe em youtube_videos (video_id nulo, id só no relatório): detector de vazamento do id cru */
  orfao?: boolean
  /** `retencao`: alcance e diário DESENHADOS, vídeo a vídeo, para a aba Retenção e para a tela do vídeo (veja MAPA_RETENCAO e `linhasAlcanceRetencao`) */
  mapa?: 'retencao'
  /**
   * `recente`: o relatório vai até HOJE (D). Dois longos antigos (`a` = o mais novo e `b` = o seguinte, entre os de 35 dias ou mais; `ytIdsAlcance` devolve [a, b]) têm impressão em todo relatório baixado, EXCETO o de D-1, em que só o `b`
   * aparece: o `a` fica sem linha num dia lido (hachurado, "o dia ainda não chegou"), o `b` mostra o valor, D-2 é lido e vazio (zero medido) e D é lido e vazio (hachurado).
   */
  recente?: true
}
/** Os dois vídeos do perfil `recente` (escolhidos entre os longos com 35 dias ou mais de vida, os dois mais novos), e o valor do `b` em D-1. */
export const RECENTE_IMP_B_EM_D1 = 77
/** O id do vídeo que só existe no relatório de alcance do perfil `grande` (sem linha em youtube_videos). */
export const ORFAO_YT_ID = 'orfaoRel001'
const REL_CHEIO = 'ILIVVILIVVLIVLIIVLILLILVILVLI'.slice(0, 29)
export const PERFIS_L2: Record<OwnL2, PerfilL2> = {
  cheio: { fimDias: 3, relatorios: REL_CHEIO, ctrNulo: true, diarioDias: 28, diario: 'tres' },
  curto: { fimDias: 3, relatorios: 'IV', ctrNulo: false, diarioDias: 2, diario: 'tres' },
  parado: { fimDias: 3, relatorios: 'V'.repeat(29), ctrNulo: false, diarioDias: 28, diario: 'zeros' },
  ativo: { fimDias: 3, relatorios: REL_CHEIO, ctrNulo: false, diarioDias: 28, diario: 'maioria' },
  velho: { fimDias: 12, relatorios: REL_CHEIO, ctrNulo: false, diarioDias: 28, diario: 'tres' },
  grande: { fimDias: 3, relatorios: REL_CHEIO, ctrNulo: false, diarioDias: 28, diario: 'maioria', impBase: 2713, orfao: true },
  lacunas: { fimDias: 3, relatorios: REL_CHEIO, ctrNulo: false, diarioDias: 28, diario: 'maioria', diarioCurtos: 4, semDiarioPrimeiro: true },
  retencao: { fimDias: 3, relatorios: REL_CHEIO, ctrNulo: false, diarioDias: 28, diario: 'tres', mapa: 'retencao' },
  // 29 relatórios até hoje: os 25 primeiros alternam I/V; D-3 = I, D-2 = V (zero medido), D-1 = I (só o vídeo `b`), D = V (recente, hachurado)
  recente: { fimDias: 0, relatorios: 'IV'.repeat(13).slice(0, 25) + 'IVIV', ctrNulo: false, diarioDias: 28, diario: 'tres', recente: true },
}

/** Os vídeos do canal `tnfigueiredo` do oráculo que o perfil `retencao` usa (ids do YouTube; a semente falha alto se o oráculo mudar). */
export const RET = {
  /** longo publicado há 2 dias do relógio do oráculo: depois do último dia coletado, então "vídeo novo" (sem dia de alcance nem de diário válido) */
  novo: 'RPdOoDA127j',
  /** longo de 886 s: UM dia de alcance com 18 impressões e 2 cliques estimados (taxa 11,1%, de 3,1% a 32,8%: "ainda não conclui") */
  magro: 'Fv7Orf5gRqx',
  /** longo de 554 s: volume alto (taxa de 6,6% contra a do canal): veredito "acima"; no dia 2 do relatório é o único com impressão (19.983, 1.139 cliques) ao lado de um dia não medido */
  volumeAlto: 'DvP4RC_VIjz',
  /** curto com volume alto e taxa baixa (3%): puxa a taxa do canal para baixo para o vídeo acima se separar dela */
  volumeBaixo: 'yDSmNLUJxTZ',
  /** curto publicado há 14 dias: taxa de clique perto de 0% (0,1%): a faixa colada no começo do eixo */
  taxaBaixa: 'yXGNu4kxWgP',
  /** curto de 167 dias: dois dias de alcance com taxa de 97%: a faixa colada no fim do eixo (dado extremo, só para a medida de layout) */
  taxaAlta: 'dNVq3MzoX4L',
} as const
/** O dia (índice no relatório) do alcance de 18 impressões do vídeo magro e o dia do 1.139: ambos depois da publicação de cada um. */
export const RET_DIA_MAGRO = 24
export const RET_DIA_1139 = 2
export const RET_1139 = { imp: 19983, ctr: 0.057 } as const
export const RET_MAGRO = { imp: 18, ctr: 0.1111 } as const
export interface VideoRetencao {
  yt: string
  /** % assistido de todo dia com view (pontos; 112,5 passa de 100) */
  pct: number
  /** o diário só cobre os últimos N dias (os de antes não têm linha) */
  ultimosDias?: number
  /** só estas views por dia-índice (resto zero medido): o vídeo com menos de 10 views na janela */
  poucas?: Record<number, number>
  /** um dia (índice 0..27) com este % acima de 100, com views */
  diaCem?: { dia: number; pct: number }
}
/**
 * Faixa "5 a 15 min": 5 vídeos com views (normal 50 = a mediana de 38, 45, 50, 52, 53: 52 fica a 2 pontos, "na média"; 53 a 3, "acima"), mais um com 7 views.
 * Faixa "Acima de 15 min": só 4 vídeos com views ("poucos vídeos para comparar (4; precisa de 5)"); um passa de 100% sempre e outro tem um dia de 139,38%.
 */
export const MAPA_RETENCAO: readonly VideoRetencao[] = [
  { yt: 'Fv7Orf5gRqx', pct: 50 },
  { yt: 'DvP4RC_VIjz', pct: 52 },
  { yt: 'cY76nv73Qkf', pct: 53 },
  { yt: 'lqqH14-w84j', pct: 38 },
  { yt: 'zSvhy3lJc4u', pct: 45, ultimosDias: 14 },
  { yt: 'YSsFxMlqbOA', pct: 61, poucas: { 20: 2, 22: 3, 25: 2 } },
  { yt: 'DNxcPR2DNIV', pct: 60, diaCem: { dia: 20, pct: 139.38 } },
  { yt: 'F1llCrDzvR2', pct: 55 },
  { yt: 'xsi7iiX5Hvd', pct: 112.5 },
  { yt: 'bsUv93jytXZ', pct: 41 },
]
/** Alcance do perfil `retencao` num dia baixado (índice `i` do relatório): [índice em `ids`, impressões, CTR]. */
function linhasAlcanceRetencao(i: number): Array<[string, number, number]> {
  if (i === RET_DIA_1139) return [[RET.volumeAlto, RET_1139.imp, RET_1139.ctr]]
  const l: Array<[string, number, number]> = [
    [RET.volumeAlto, 700 + ((i * 37) % 300), 0.085],
    [RET.volumeBaixo, 2000 + ((i * 53) % 500), 0.03],
  ]
  if (i >= 18) l.push([RET.taxaBaixa, 120 + ((i * 11) % 60), 0.001])
  if (i === 14 || i === 15) l.push([RET.taxaAlta, 40, 0.97])
  if (i === RET_DIA_MAGRO) l.push([RET.magro, RET_MAGRO.imp, RET_MAGRO.ctr])
  return l
}
/** % assistido de um dia e a duração média em segundos (a coluna é `numeric`; nulos num dia sem view, como na coleta). */
function assistidoDoDia(pct: number, durSeg: number): { avg_view_percentage: number; avg_view_duration_seconds: number } {
  return { avg_view_percentage: Math.round(pct * 100) / 100, avg_view_duration_seconds: Math.round((pct / 100) * durSeg * 100) / 100 }
}
const PACIFICO = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
/** O dia do YouTube (Pacífico) em que o instante cai: o mesmo `hoje` que as páginas usam. */
export function diaYoutube(ms: number): string {
  const p = PACIFICO.formatToParts(new Date(ms)), v = (t: string) => p.find(x => x.type === t)!.value
  return `${v('year')}-${v('month')}-${v('day')}`
}
export function somaDias(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}
/** O id (do oráculo) do primeiro canal próprio do preset: o dono do dado privado. */
function primeiroProprio(preset?: OwnPreset): string { return preset ? OWN_PRESETS[preset].ids[0]! : 'tnfigueiredo' }

/**
 * Semeia o dado privado de UM canal próprio (o primeiro do preset), tudo relativo ao relógio do oráculo. Substitui o que já houver
 * (limpa as tabelas privadas antes). Os ytIds vêm dos vídeos que a semente já escreve em youtube_videos.
 */
export async function seedOwnL2(siteId: string, perfil: OwnL2, preset?: OwnPreset, client?: SupabaseClient): Promise<{ canalId: string; ytIdsAlcance: string[]; ytIdsDiario: string[]; ultimoDia: string; primeiroDia: string }> {
  const P = PERFIS_L2[perfil]
  if (!P) throw new Error('observatorio-seed: ownL2 desconhecido ' + JSON.stringify(perfil))
  const sb = clientOf(client)
  const { O } = loadOracleData(preset)
  const oid = primeiroProprio(preset), canalId = ownSeedUuid(siteId, oid)
  const vids = O.videos.filter(v => v.ch === oid).sort((a, b) => b.pub - a.pub || (a.ytId < b.ytId ? -1 : 1))
  if (vids.length < 6) throw new Error('observatorio-seed: o canal ' + oid + ' tem menos de 6 vídeos no oráculo; ownL2 precisa de 6')
  const vuuid = (v: OVideo) => seedUuid(siteId, 'own-video', v.id)
  await clearOwnL2(siteId, sb)

  const ultimo = somaDias(diaYoutube(O.NOW), -P.fimDias)
  const n = P.relatorios.length, primeiro = somaDias(ultimo, -(n - 1))
  const pref = canalId.slice(0, 8)
  await check('yt_reporting_jobs', sb.from('yt_reporting_jobs').insert({
    site_id: siteId, channel_id: canalId, report_type_id: 'channel_reach_basic_a1', job_id: 'seed-job-' + pref, job_create_time: iso(O.NOW - 60 * DAY),
    status: 'ativo', last_listed_at: iso(O.NOW - P.fimDias * DAY), last_create_time: iso(O.NOW - P.fimDias * DAY),
  }))
  const seis = vids.slice(0, 6)
  const porYt = new Map(vids.map(v => [v.ytId, v]))
  if (P.mapa === 'retencao') {
    // o perfil desenhado depende destes vídeos do oráculo: se o oráculo mudar, falha alto em vez de semear outra coisa
    for (const yt of [...Object.values(RET), ...MAPA_RETENCAO.map(m => m.yt)]) if (!porYt.has(yt)) throw new Error('observatorio-seed: o perfil retencao precisa do vídeo ' + yt + ' no canal ' + oid)
  }
  const reports: object[] = [], reach: object[] = []
  for (let i = 0; i < n; i++) {
    const dia = somaDias(primeiro, i), kind = P.relatorios[i]!
    const id = `seed-${pref}-${dia}`, create = `${somaDias(dia, 1)}T09:00:00Z`
    reports.push({
      report_id: id, site_id: siteId, job_id: 'seed-job-' + pref, channel_id: canalId, report_type_id: 'channel_reach_basic_a1',
      start_time: `${dia}T07:00:00Z`, end_time: `${somaDias(dia, 1)}T07:00:00Z`, create_time: create, download_url: 'https://example.invalid/seed/' + id, is_backfill: false,
      status: kind === 'I' ? 'baixado' : kind === 'V' ? 'vazio' : 'listado', row_count: kind === 'I' ? 1 : kind === 'V' ? 0 : null,
      downloaded_at: kind === 'L' ? null : create, normalized_at: kind === 'L' ? null : create,
    })
    if (kind !== 'I') continue
    if (P.recente) {
      const antigos = vids.filter(v => v.fmt === 'long' && v.ageDays >= 35)
      if (antigos.length < 2) throw new Error('observatorio-seed: o perfil recente precisa de 2 longos com 35 dias ou mais no canal ' + oid)
      const [a, b] = antigos as [OVideo, OVideo]
      const dB = dia === somaDias(ultimo, -1)
      const linhas: Array<[OVideo, number, number]> = dB ? [[b, RECENTE_IMP_B_EM_D1, 0.1]] : [[a, 30 + (i % 7), 0.05], [b, 50 + (i % 9), 0.08]]
      for (const [v, imp, ctr] of linhas) {
        reach.push({
          youtube_video_id: v.ytId, day_pt: dia, site_id: siteId, video_id: vuuid(v), channel_id: canalId, thumbnail_impressions: imp, thumbnail_ctr: ctr,
          source_report_id: id, report_create_time: create, source: 'reporting_api', metric_version: 'views_desde_2026-08-27',
        })
      }
      continue
    }
    if (P.mapa === 'retencao') {
      for (const [yt, imp, ctr] of linhasAlcanceRetencao(i)) {
        const v = porYt.get(yt)!
        reach.push({
          youtube_video_id: yt, day_pt: dia, site_id: siteId, video_id: vuuid(v), channel_id: canalId, thumbnail_impressions: imp, thumbnail_ctr: ctr,
          source_report_id: id, report_create_time: create, source: 'reporting_api', metric_version: 'views_desde_2026-08-27',
        })
      }
      continue
    }
    const quantos = 1 + (i % 3), inicio = i % 6
    // o dia anterior à publicação não existe para o vídeo: nenhum relatório real traz linha dele antes de ser publicado (as telas cortam por isso).
    // Um relatório "baixado" nunca fica sem linha: se todos os escolhidos ainda não existiam naquele dia, entra o primeiro da fila que já existia.
    const escolhidos = Array.from({ length: quantos }, (_, j) => seis[(inicio + j) % 6]!).filter(v => dia >= diaYoutube(v.pub))
    if (escolhidos.length === 0) {
      const primeiro = Array.from({ length: 6 }, (_, j) => seis[(inicio + quantos + j) % 6]!).find(v => dia >= diaYoutube(v.pub))
      if (primeiro) escolhidos.push(primeiro)
    }
    for (const v of escolhidos) {
      const vi = seis.indexOf(v)
      reach.push({
        youtube_video_id: v.ytId, day_pt: dia, site_id: siteId, video_id: vuuid(v), channel_id: canalId,
        thumbnail_impressions: (P.impBase ?? 0) + 40 + ((i * 37 + vi * 91) % 260),
        thumbnail_ctr: P.ctrNulo && i === 11 && v === escolhidos[0] ? null : (20 + ((i * 7 + vi * 13) % 55)) / 1000,
        source_report_id: id, report_create_time: create, source: 'reporting_api', metric_version: 'views_desde_2026-08-27',
      })
    }
  }
  if (P.orfao) {
    const i = [...P.relatorios].findIndex(k => k === 'I'), dia = somaDias(primeiro, i), create = `${somaDias(dia, 1)}T09:00:00Z`
    reach.push({
      youtube_video_id: ORFAO_YT_ID, day_pt: dia, site_id: siteId, video_id: null, channel_id: canalId, thumbnail_impressions: 3571, thumbnail_ctr: 0.0333,
      source_report_id: `seed-${pref}-${dia}`, report_create_time: create, source: 'reporting_api', metric_version: 'views_desde_2026-08-27',
    })
  }
  await insertAll(sb, 'yt_reporting_reports', reports)
  await insertAll(sb, 'yt_own_video_reach_daily', reach)

  // diário: os longos acompanhados (mais novo primeiro, no máximo 50, como o leitor), uma linha por dia (zero é medido)
  const longos = vids.filter(v => v.fmt === 'long').slice(0, 50)
  const comViews = P.diario === 'tres' ? 3 : P.diario === 'maioria' ? Math.floor(longos.length / 2) + 1 : 0
  const diario: object[] = []
  const semDiario = P.semDiarioPrimeiro ? seis.find(v => v.fmt === 'long') : undefined
  if (P.semDiarioPrimeiro && !semDiario) throw new Error('observatorio-seed: semDiarioPrimeiro precisa de um vídeo longo entre os 6 com alcance')
  if (P.mapa === 'retencao') {
    MAPA_RETENCAO.forEach((m, mi) => {
      const v = porYt.get(m.yt)!, durSeg = durSeconds(v.dur)
      for (let d = 0; d < P.diarioDias; d++) {
        if (m.ultimosDias != null && d < P.diarioDias - m.ultimosDias) continue
        const dia = somaDias(ultimo, -(P.diarioDias - 1 - d))
        const views = m.poucas ? (m.poucas[d] ?? 0) : (d + mi) % 4 !== 0 ? 15 + ((d * 29 + mi * 47) % 70) : 0
        const pct = m.diaCem && m.diaCem.dia === d ? m.diaCem.pct : m.pct
        diario.push({
          youtube_video_id: v.ytId, day_pt: dia, site_id: siteId, video_id: vuuid(v), channel_id: canalId, views, source: 'analytics_api', metric_version: 'views_desde_2026-08-27',
          ...(views > 0 ? assistidoDoDia(pct, durSeg) : { avg_view_percentage: null, avg_view_duration_seconds: null }),
        })
      }
    })
    await insertAll(sb, 'yt_own_video_daily', diario)
    return { canalId, ytIdsAlcance: [...new Set(reach.map(r => (r as { youtube_video_id: string }).youtube_video_id))], ytIdsDiario: MAPA_RETENCAO.map(m => m.yt), ultimoDia: ultimo, primeiroDia: primeiro }
  }
  for (let d = 0; d < P.diarioDias; d++) {
    const dia = somaDias(ultimo, -(P.diarioDias - 1 - d))
    longos.forEach((v, li) => {
      if (semDiario && v.ytId === semDiario.ytId) return
      const curto = li >= longos.length - (P.diarioCurtos ?? 0)
      if (curto && d < P.diarioDias - 5) return
      const views = curto ? 400 + ((d * 13 + li * 7) % 90) : li < comViews && (d + li) % 4 !== 0 ? 15 + ((d * 29 + li * 47) % 70) : 0
      // % assistido e duração média: nulos em dia sem view (como na coleta); o segundo vídeo tem UM dia acima de 100% (trecho revisto)
      const pct = li === 1 && d === P.diarioDias - 10 ? 139.38 : 30 + ((li * 11 + d * 3) % 45)
      diario.push({
        youtube_video_id: v.ytId, day_pt: dia, site_id: siteId, video_id: vuuid(v), channel_id: canalId, views, source: 'analytics_api', metric_version: 'views_desde_2026-08-27',
        ...(views > 0 ? assistidoDoDia(pct, durSeconds(v.dur)) : { avg_view_percentage: null, avg_view_duration_seconds: null }),
      })
    })
  }
  await insertAll(sb, 'yt_own_video_daily', diario)
  const ytIdsAlcance = P.recente ? vids.filter(v => v.fmt === 'long' && v.ageDays >= 35).slice(0, 2).map(v => v.ytId) : seis.map(v => v.ytId)
  return { canalId, ytIdsAlcance, ytIdsDiario: longos.map(v => v.ytId), ultimoDia: ultimo, primeiroDia: primeiro }
}

/**
 * Põe a data de publicação dos vídeos de um canal próprio em `data do oráculo - dias` (valor ABSOLUTO, a partir do relógio do oráculo: rodar duas vezes dá o mesmo
 * resultado, ao contrário de um deslocamento sobre o valor atual). Só no banco local. Devolve a publicação mais nova gravada (ms), para o teste conferir a janela.
 */
export async function fixarPublicacaoProprio(siteId: string, canalOracle: string, dias: number, preset?: OwnPreset, client?: SupabaseClient): Promise<number> {
  const sb = clientOf(client)
  const { O } = loadOracleData(preset)
  const canal = ownSeedUuid(siteId, canalOracle)
  const vids = O.videos.filter(v => v.ch === canalOracle)
  if (!vids.length) throw new Error('observatorio-seed: o canal ' + canalOracle + ' não tem vídeos no oráculo')
  let maisNovo = 0
  for (const v of vids) {
    const alvo = v.pub - dias * DAY
    maisNovo = Math.max(maisNovo, alvo)
    await check('fixarPublicacaoProprio', sb.from('youtube_videos').update({ published_at: iso(alvo) }).eq('site_id', siteId).eq('channel_id', canal).eq('youtube_video_id', v.ytId))
  }
  return maisNovo
}

/* ------------------------------------------------------------------ seed */
export const MANY_VERSIONS_ID = 'f4-muitas-versoes'
/** The letters of the mockup's state 2 (2026-10-07-historico-muitas-versoes), on the oracle's calendar. */
function manyVersionsVideo(O: OracleData): OVideo {
  const H = 36e5, sp = (d: number, h = 0, mi = 0) => Date.UTC(2026, 9, d, h + 3, mi) // October 2026, São Paulo (UTC−3)
  const ch = O.channels.find(c => c.id === 'matt-wolfe')
  if (!ch || ch.sync.last == null) throw new Error('observatorio-seed: manyVersions precisa do canal matt-wolfe sincronizado no oráculo')
  const pub = sp(4, 11), last = ch.sync.last
  // a version ends where the next one starts (the start of its window, when it has one); the last one is the current
  const close = <T extends OVersion>(arr: T[]): T[] => arr.map((x, i) => { const nx = arr[i + 1]; return { ...x, current: !nx, last_seen: nx ? (nx.window ? nx.window[0] : nx.first_seen) : last } })
  // hours between one thumbnail change and the next: 23 changes from 05/10 09:00 to 23/10 20:30, some a few hours apart
  const gaps = [0, 9, 14, 3.5, 20, 30, 18, 26, 22, 16, 28, 17, 30, 15, 6, 20, 19, 27, 17, 22, 19, 26, 21]
  let at = sp(5, 9)
  const thumbs = close('ABACABCDADBDAECEBEDECEDE'.split('').map((key, i): OThumb => {
    if (i > 0) at += gaps[i - 1]! * H
    return { id: 'TH' + (i + 1), key, first_seen: i === 0 ? pub : at, last_seen: 0, current: false, prec: i === 0 ? 'publicacao' : 'min', window: null }
  }))
  const TITLES = [
    'Testei 5 thumbnails no mesmo vídeo', 'Testei 5 thumbnails no mesmo vídeo (o método que eu uso)', 'Thumbnail: o método que eu uso em 2026',
    'Thumbnail: 7 erros que derrubam o clique', '7 erros que derrubam o clique da sua thumbnail', 'Troquei a thumbnail 23 vezes: 7 erros que derrubam o clique',
    'Troquei a thumbnail 23 vezes (e os 7 erros que derrubam o clique)', '23 trocas de thumbnail: os 7 erros que derrubam o clique', '23 trocas de thumbnail: pare de cometer estes 7 erros',
  ]
  const titleAt = [sp(5, 18), sp(7, 12), sp(9, 6), sp(12, 12), sp(15, 0), sp(18, 18), sp(21, 12), sp(23, 6)]
  const titles = close(TITLES.map((text, i): OTitle => {
    const t = i === 0 ? pub : titleAt[i - 1]!
    return { id: 'T' + (i + 1), text, first_seen: t, last_seen: 0, current: false, prec: i === 0 ? 'publicacao' : '6h', window: i === 0 ? null : [t - 6 * H, t] }
  }))
  const DESC = ['Como eu testo thumbnails em 2026.', 'Planilha do teste: https://example.com/planilha', 'Inscreva-se para os próximos testes.']
  const descAt = [sp(8, 12), sp(20, 18)]
  const descs = close([DESC, [DESC[0]!, '00:00 O método', '04:10 Os 7 erros', ...DESC.slice(1)], ['Troquei a thumbnail 23 vezes. Os 7 erros que derrubam o clique.', '00:00 O método', '04:10 Os 7 erros', ...DESC.slice(1)]].map((lines, i): ODesc => {
    const t = i === 0 ? pub : descAt[i - 1]!
    return { id: 'D' + (i + 1), lines, hasText: true, first_seen: t, last_seen: 0, current: false, prec: i === 0 ? 'publicacao' : '6h', window: i === 0 ? null : [t - 6 * H, t] }
  }))
  // one daily record at 12:00 from 04/10 to 24/10 (the oracle's snapshot hour; index 0 is 03/10)
  let views = 3900
  const series = Array.from({ length: 21 }, (_, k) => {
    if (k) views += Math.round(52000 * (0.2 + 0.8 * Math.exp(-(k - 1) / 13)))
    return { idx: k + 1, t: sp(4 + k, 12), views }
  })
  return {
    id: MANY_VERSIONS_ID, ch: ch.id, niche: ch.niche, fmt: 'long', pub, ageDays: Math.floor((O.NOW - pub) / DAY), dur: '18:42', ytId: 'F4muitasV01',
    title: TITLES[TITLES.length - 1]!, theme: null, views, viewsAt: series[series.length - 1]!.t, likes: 4100, comments: 212, series, titles, thumbs, descs,
  }
}
export async function seedObservatory(siteId: string, opts: SeedOptions = {}, client?: SupabaseClient): Promise<void> {
  if (opts.emptyWindow) throw new Error('observatorio-seed: emptyWindow is a filter, not data — use MockupState.query')
  if (opts.scenario && opts.scenario !== 'own-empty') throw new Error('observatorio-seed: unknown scenario ' + JSON.stringify(opts.scenario))
  const ownEmpty = !!opts.ownEmpty || opts.scenario === 'own-empty'
  if (opts.ownPreset && !OWN_PRESETS[opts.ownPreset]) throw new Error('observatorio-seed: unknown ownPreset ' + JSON.stringify(opts.ownPreset))
  const sb = clientOf(client)
  const { O, nicheOf } = loadOracleData(opts.ownPreset)
  if (opts.manyVersions) O.videos.push(manyVersionsVideo(O))
  const ownChs = O.channels.filter(c => c.own)
  // niches the owner created: validated BEFORE any write, so a bad option never leaves the site half seeded
  const extras: ExtraNiche[] = [...(opts.extraNiche ? [{ slug: opts.extraNiche.slug, label: opts.extraNiche.label, channels: [opts.extraNiche.channel] }] : []), ...(opts.extraNiches ?? [])]
  const movedTo = new Map<string, string>()
  for (const n of extras) {
    if (BUILTIN_SLUGS.includes(n.slug) || extras.filter(x => x.slug === n.slug).length > 1) throw new Error('observatorio-seed: nicho extra repetido ou de fábrica: ' + JSON.stringify(n.slug))
    for (const ch of n.channels ?? []) {
      const c = O.channels.find(x => x.id === ch)
      if (!c || c.own) throw new Error(`observatorio-seed: o nicho ${n.slug} pede o concorrente ${JSON.stringify(ch)}, que não existe no oráculo`)
      if (movedTo.has(ch)) throw new Error(`observatorio-seed: o concorrente ${ch} está em dois nichos extras`)
      movedTo.set(ch, n.slug)
    }
  }
  // as OBS.setNiche in the mockup: the channel changes niche, and its videos follow it
  for (const c of O.channels) if (movedTo.has(c.id)) c.niche = movedTo.get(c.id)!
  for (const v of O.videos) if (movedTo.has(v.ch) && v.niche !== undefined) v.niche = movedTo.get(v.ch)!
  await clearObservatory(siteId, sb)
  await insertAll(sb, 'youtube_niches', extras.map((n, i) => {
    const c = NICHE_TONES[n.tone ?? TONE_CYCLE[i % TONE_CYCLE.length]!]
    return { site_id: siteId, slug: n.slug, label: n.label, color_dark: c.dark, color_light: c.light, sort_order: 30 + i * 10 }
  }))

  const SS = O.SERIES_START
  const U = (kind: string, id: string) => seedUuid(siteId, kind, id)
  const ownIdSet = new Set(ownChs.map(c => c.id))
  const competitors = O.channels.filter(c => !c.own && (!opts.onlyProblems || c.sync.state !== 'ok'))
  const keptCh = new Set(competitors.map(c => c.id))
  // ownEmpty is the mockup's one-channel scenario: only tnfigueiredo loses its recent long videos
  const ownVideos = O.videos.filter(v => ownIdSet.has(v.ch) && !(ownEmpty && v.ch === 'tnfigueiredo' && v.fmt === 'long' && v.ageDays <= 90))
  const compVideos = O.videos.filter(v => keptCh.has(v.ch))
  const ids = new Map<string, string>()
  for (const c of competitors) ids.set(c.id, U('channel', c.id))
  for (const c of ownChs) ids.set(c.id, ownSeedUuid(siteId, c.id))
  for (const v of compVideos) ids.set(v.id, U('video', v.id))
  for (const v of ownVideos) ids.set(v.id, U('own-video', v.id))

  await check('competitor_settings', sb.from('competitor_settings').upsert(
    { site_id: siteId, series_started_at: iso(SS), channel_limit: opts.channelLimit ?? 75 }, { onConflict: 'site_id' }))

  /* channels */
  await insertAll(sb, 'competitor_channels', competitors.map(c => {
    const s = c.sync, ok = s.state !== 'backfill'
    return {
      id: ids.get(c.id), site_id: siteId, channel_id: 'UC' + sha1(c.id).slice(0, 22), channel_name: c.name, niche: c.niche,
      subscriber_count: c.subs, video_limit: c.video_limit, thumbnail_url: null,
      sync_status: s.state === 'erro' ? 'error' : 'idle',
      // the oracle message: humanizeSyncError(msg) is the oracle's label (404 → 'não encontrado no YouTube (404)')
      sync_error: s.state === 'erro' || s.state === 'atrasado' ? s.msg : null,
      sync_error_since: s.state === 'erro' ? iso(s.errorSince) : null,
      last_ok_synced_at: ok ? iso(s.last) : null, last_synced_at: iso(s.last), full_sync_completed_at: ok ? iso(s.last) : null,
      youtube_video_count: s.backfill ? s.backfill.total : null,
      // the oracle's founding channels (no `added`) joined at the observatory start, in the oracle's order: one second
      // apart, so the loader's "order added" is the oracle's list order (production always stores added_at)
      added_at: iso(s.added ?? O.OBS_START + O.channels.indexOf(c) * 1000),
    }
  }))

  /* videos, daily, versions, changes */
  const videoRows: object[] = [], dailyRows: object[] = [], versionRows: object[] = [], changeRows: object[] = []
  for (const v of compVideos) {
    const vid = ids.get(v.id)!
    videoRows.push({
      id: vid, competitor_channel_id: ids.get(v.ch), video_id: v.ytId, title: v.title, view_count: v.views, like_count: v.likes,
      comment_count: v.comments, duration_seconds: durSeconds(v.dur), published_at: iso(v.pub), is_short: v.fmt === 'short',
      last_checked_at: iso(v.viewsAt), tags: [], thumbnail_url: null,
    })
    for (const p of v.series) dailyRows.push({ video_id: vid, snap_date: spDate(p.t), views: p.views, taken_at: iso(p.t) })
    const versionRow = (field: 'title' | 'thumb' | 'desc', x: OVersion, value: { value_text: string | null; value_hash: string; has_text: boolean }) => ({
      id: U('version', v.id + '/' + field + '/' + x.id), video_id: vid, field, ...value, thumb_blob_url: null,
      first_seen_at: iso(x.first_seen), last_seen_at: iso(x.last_seen), window_start: iso(x.window?.[0]), precision: precOf(x.prec), is_current: x.current,
    })
    const changeRow = (type: 'title' | 'description' | 'thumbnail', prev: OVersion | null, x: OVersion, extra: object) => ({
      site_id: siteId, video_id: vid, change_type: type, detected_at: iso(x.first_seen), ...extra,
      ...(prev ? { from_version_id: U('version', v.id + '/' + FIELD_OF[type] + '/' + prev.id), to_version_id: U('version', v.id + '/' + FIELD_OF[type] + '/' + x.id),
        window_start: iso(x.window?.[0]), window_end: iso(x.window?.[1]), precision: changePrec(x.prec) } : {}),
    })
    // titles: pre-series changes → legacy rows; real versions from the last pre-series one on
    let k = 0
    v.titles.forEach((t, i) => { if (i > 0 && t.first_seen < SS) k = i })
    for (let i = 1; i <= k; i++) changeRows.push(changeRow('title', null, v.titles[i]!, { old_title: v.titles[i - 1]!.text, new_title: v.titles[i]!.text }))
    v.titles.slice(k).forEach((t, j) => {
      versionRows.push(versionRow('title', t, { value_text: t.text, value_hash: sha1(t.text), has_text: true }))
      const i = k + j
      if (i > 0 && j > 0) changeRows.push(changeRow('title', v.titles[i - 1]!, t, { old_title: v.titles[i - 1]!.text, new_title: t.text }))
    })
    v.thumbs.forEach((t, i) => {
      versionRows.push(versionRow('thumb', t, { value_text: null, value_hash: t.key, has_text: false }))
      if (i > 0 && t.first_seen >= SS) changeRows.push(changeRow('thumbnail', v.thumbs[i - 1]!, t, {}))
    })
    v.descs.forEach((d, i) => {
      const text = d.hasText && d.lines ? d.lines.join('\n') : null
      versionRows.push(versionRow('desc', d, { value_text: text, value_hash: text != null ? sha1(text) : 'sem-texto:' + d.id, has_text: text != null }))
      if (i > 0) changeRows.push(changeRow('description', v.descs[i - 1]!, d, {}))
    })
  }
  if (opts.canalCompleto) {
    const C = CANAL_COMPLETO, byId = (oid: string) => videoRows.find(r => (r as { id: string }).id === ids.get(oid)) as Record<string, unknown> | undefined
    const fixado = byId(C.fixadoAntigo), curto = byId(C.shortNulo), coment = byId(C.comentariosNulo), base = byId('matt-wolfe-l7')
    if (!fixado || !curto || !coment || !base) throw new Error('observatorio-seed: canalCompleto precisa dos vídeos de matt-wolfe no oráculo')
    fixado.pinned_at = iso(O.NOW - 40 * DAY)
    curto.is_short = null
    coment.comment_count = null
    videoRows.push({ ...base, id: U('video', C.semData), video_id: 'semDataCanal1', title: 'Vídeo sem data de publicação no YouTube', published_at: null, is_short: false, view_count: 4200, like_count: 120, comment_count: 9, pinned_at: null })
  }
  await insertAll(sb, 'competitor_videos', videoRows)
  await insertAll(sb, 'competitor_video_versions', versionRows, 2000)
  await insertAll(sb, 'competitor_video_daily', dailyRows, 2000)
  await insertAll(sb, 'competitor_changes', changeRows)

  /* channel snapshots */
  const snapRows: object[] = []
  for (const c of competitors) {
    const seen = new Set<string>()
    for (const s of c.snapshots) {
      const date = dmyToIso(s.date)
      if (seen.has(date)) continue
      seen.add(date)
      snapRows.push({ competitor_channel_id: ids.get(c.id), snapshot_date: date, subscriber_count: s.subs, view_count: s.views })
    }
  }
  await insertAll(sb, 'competitor_channel_snapshots', snapRows, 2000)

  /* own channels (no series, no versions: production keeps neither for them); `niche` is null for the preset's "sem nicho" */
  await insertAll(sb, 'youtube_channels', ownChs.map(c => ({
    id: ids.get(c.id), site_id: siteId, channel_id: 'UC' + sha1('own|' + c.id).slice(0, 22), handle: c.handle, locale: localeOf(c),
    slug: c.id, name: c.name, niche: c.niche, uploads_playlist_id: 'UU' + sha1('own|' + c.id).slice(0, 22), subscriber_count: c.subs,
    last_synced_at: iso(c.sync.last), created_at: iso(c.sync.added ?? O.OBS_START),
  })))
  await insertAll(sb, 'youtube_videos', ownVideos.map(v => ({
    id: ids.get(v.id), site_id: siteId, channel_id: ids.get(v.ch), youtube_video_id: v.ytId, title: v.title, published_at: iso(v.pub),
    view_count: v.views ?? 0, like_count: v.likes ?? 0, comment_count: v.comments ?? 0, duration_seconds: durSeconds(v.dur),
    updated_at: iso(v.viewsAt ?? O.NOW), tags: [],
  })))

  /* readings: oracle ids → seeded uuids; the latest temas reading per niche carries the theme evidence */
  const latestTemas = new Map<string, OReading>()
  for (const r of O.forja.readings) if (r.type === 'temas' && (latestTemas.get(r.niche)?.generatedAt ?? -1) < r.generatedAt) latestTemas.set(r.niche, r)
  // the niche of the video's channel; a channel "sem nicho" keeps the oracle's original one (its themes still exist)
  const nicheOfVideo = (v: OVideo) => O.channels.find(c => c.id === v.ch)!.niche ?? nicheOf.get(v.ch) ?? null
  const readingRow = (r: OReading, taskId: string | null) => ({
    id: U('reading', r.id), site_id: siteId, task_id: taskId, task_type: r.type, niche: r.niche, fmt: r.fmt ?? null,
    video_id: r.target?.video ? ids.get(r.target.video) ?? null : null, model: 'Gemma 12B', generated_at: iso(r.generatedAt),
    // production freezes since()'s data inside `sent` (forja/sent.ts SentPack: base / effects / viewsThen); the oracle keeps them beside it
    sent: remapIds({ ...r.sent, ...(r.base !== undefined ? { base: r.base } : {}), ...(r.effects !== undefined ? { effects: r.effects } : {}), ...(r.viewsThen !== undefined ? { viewsThen: r.viewsThen } : {}) }, ids),
    analysis: remapIds(r.analysis, ids), text: r.text,
  })

  /* forja: history requests always; the scenario's on top when asked */
  let machinePoll: number | null = O.forja.queue.lastPollAt
  const reqs: ORequest[] = O.forja.requests.filter(r => !r.scenario)
  if (opts.forjaState) {
    const sc = O.forja.requestScenario(opts.forjaState, { niche: 'todos', type: opts.forjaType ?? 'padroes-titulo' })
    if (!sc) throw new Error('observatorio-seed: unknown forja state ' + JSON.stringify(opts.forjaState))
    reqs.push(...sc.requests)
    machinePoll = sc.machine.lastPollAt
  }
  await insertAll(sb, 'youtube_intelligence_tasks', reqs.map(r => {
    // R27: released_at is the VIGIA's release; a validator rejection is a failure (failed_at) that sends it back
    const byVigia = r.releasedBy === 'vigia', byValidator = r.releasedBy === 'validador'
    return {
      id: U('task', r.id), site_id: siteId, trigger_type: 'manual', channel_id: null,
      task_type: r.type, target_niche: r.niche, target_video_id: r.type === 'leitura-video' && r.target.video ? ids.get(r.target.video) ?? null : null,
      target_fmt: r.target.fmt ?? null, status: r.status, retry_count: Math.max(0, (r.attempt ?? 1) - 1),
      requested_at: iso(r.createdAt), started_at: iso(r.claimedAt), completed_at: iso(r.publishedAt),
      failed_at: iso(r.failedAt ?? (byValidator ? r.releasedAt : null)), refused_at: iso(r.refusedAt), refused_reason: r.refusedReason ?? null,
      released_at: byVigia ? iso(r.releasedAt) : null, error_message: r.failReason ?? null,
    }
  }))
  const taskOfReading = new Map(reqs.filter(r => r.readingId).map(r => [r.readingId!, U('task', r.id)]))
  await insertAll(sb, 'competitor_readings', (opts.noReadings ? [] : O.forja.readings).map(r => ({
    // production links each reading to the task that produced it (completeReading writes task_id)
    ...readingRow(r, taskOfReading.get(r.id) ?? null),
    evidence: latestTemas.get(r.niche) === r
      ? [...compVideos, ...ownVideos].filter(v => v.theme && nicheOfVideo(v) === r.niche).map(v => ({ id: ids.get(v.id), theme: v.theme }))
      : [],
  })))
  // a published scenario request produced a reading (dados.js "…-cenario"): written as production does, linked by task_id
  const scenarioReadings = Object.values(O.forja.scenarioReadings ?? {})
  const produced = reqs.filter(r => r.scenario && r.readingId).map(r => {
    const rd = scenarioReadings.find(x => x.id === r.readingId)
    if (!rd) throw new Error('observatorio-seed: scenario reading not found: ' + r.readingId)
    return { ...readingRow(rd, U('task', r.id)), evidence: [] }
  })
  if (produced.length && !opts.noReadings) await insertAll(sb, 'competitor_readings', produced)
  if (machinePoll != null) {
    await check('forja_heartbeat', sb.from('forja_heartbeat').upsert(
      { site_id: siteId, last_poll_at: iso(machinePoll), capabilities: ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'] },
      { onConflict: 'site_id' }))
  }
  // dado privado do primeiro canal próprio do preset (os canais e vídeos acima já existem)
  if (opts.ownL2) await seedOwnL2(siteId, opts.ownL2, opts.ownPreset, sb)
}
