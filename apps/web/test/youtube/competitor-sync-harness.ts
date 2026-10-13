import { vi } from 'vitest'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// Falso do banco e auxiliares do sync de concorrentes (movidos de competitor-sync.test.ts, sem mudança de comportamento).
// O `vi.mock('@/lib/supabase/service', ...)` continua em cada arquivo de teste, que é onde o Vitest o iça.

export type Payload = { p_video_id: string; p_close: string[]; p_open: Array<Record<string, unknown>>; p_changes: Array<Record<string, unknown>> }

// ── fake supabase: recorded, thenable chains, scripted results ──
export interface Call { table: string; ops: Array<[string, unknown[]]> }
export type Script = (c: Call) => Record<string, unknown> | undefined
export function fakeDb(script: Script) {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    calls.push(call)
    const b: Record<string, unknown> = {}
    const proxy: unknown = new Proxy(b, {
      get(_t, prop: string) {
        if (prop === 'then') {
          const res = script(call) ?? { data: null, error: null }
          return (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok)
        }
        return (...args: unknown[]) => { call.ops.push([prop, args]); return proxy }
      },
    })
    return proxy
  }
  const rpc = (name: string, args: unknown) => {
    const call: Call = { table: 'rpc:' + name, ops: [['rpc', [args]]] }
    calls.push(call)
    return Promise.resolve(script(call) ?? { data: null, error: null })
  }
  return { client: { from, rpc }, calls }
}
export const rpcs = (db: { calls: Call[] }) => db.calls.filter(c => c.table === 'rpc:apply_competitor_version_plan').map(c => c.ops[0]![1][0] as Payload)
export const first = (c: Call) => c.ops[0]![0]
export const arg = (c: Call, op: string) => c.ops.find(o => o[0] === op)?.[1][0] as Record<string, unknown> | undefined
export const NOW = new Date('2026-10-24T15:00:00.000Z') // 12:00 SP
export const NOW_ISO = NOW.toISOString()
export const ch = { id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }
export const lockRow = { id: 'cc-1', sync_mode: 'incremental', full_sync_completed_at: null, video_limit: 50, last_ok_synced_at: '2026-10-24T09:00:00.000Z', sync_error_since: null }

export interface FetchLog { dailyCalls: string[] }
export function apiFetch(video: Record<string, unknown> | null, status = 200, extra: { daily?: (call: number, url: string) => Response | Record<string, unknown>[]; noUploads?: boolean; log?: FetchLog; channelItems?: unknown[] } = {}): typeof fetch {
  let dailyN = 0, pageNext = false
  return (async (input: RequestInfo | URL) => {
    const u = String(input)
    if (status !== 200) return { ok: false, status }
    if (u.includes('/channels?')) {
      return Response.json({ items: extra.channelItems ?? [{ id: 'UC_test', contentDetails: { relatedPlaylists: extra.noUploads ? {} : { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '10' } }] })
    }
    // a chamada de detalhes da página vem logo depois da lista de uploads (quando ela trouxe vídeo); qualquer outra videos.list é da passada
    if (u.includes('/playlistItems?')) { pageNext = video != null; return Response.json({ items: video ? [{ snippet: { resourceId: { videoId: video.id } } }] : [] }) }
    if (u.includes('/videos?') && !pageNext) {
      dailyN++
      extra.log?.dailyCalls.push(u)
      if (extra.daily) {
        const r = extra.daily(dailyN, u)
        return r instanceof Response ? r : Response.json({ items: r })
      }
      return Response.json({ items: video ? [{ ...video, statistics: { viewCount: '7' } }] : [] })
    }
    pageNext = false
    return Response.json({ items: video ? [video] : [] })
  }) as typeof fetch
}
export const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString()

export type SetupOpts = {
  existing?: Record<string, unknown>[]; versions?: Record<string, unknown>[]; lastDaily?: string | null
  tracked?: Array<Record<string, unknown>>; dailyHave?: string[]; rpcError?: boolean; longs?: Array<{ video_id: string }>
  /** Pinned rows of the channel (entram em `all` quando ele é omitido). Omitido = nenhum fixado. */
  pinned?: Array<Record<string, unknown>> | null
  /** O `update` de competitor_videos para esta linha (uuid) devolve erro de banco. */
  failUpdateOf?: string
  /** O `update` de competitor_videos destas linhas (uuid) devolve erro de banco com a mensagem dada (para distinguir qual falhou primeiro). */
  failUpdates?: Record<string, string>
  /** (A5) Linhas correntes de competitor_field_versions e de competitor_raw que o banco "já tem"; omitido = nenhuma (primeira execução). */
  fields?: Record<string, unknown>[]; raws?: Record<string, unknown>[]
  /** Função SQL (nome sem `rpc:`) que devolve erro de banco. */
  rpcFail?: string
  /** Leitura (select) desta tabela devolve erro; para `competitor_channels` falha a trava do canal. */
  selectFail?: string
  /** O que as funções de ausência devolvem; omitido = lista vazia / nulo. */
  missed?: Record<string, unknown>[]; channelMissed?: Record<string, unknown> | null
  /** Campos extras da linha que a trava do canal devolve (por exemplo `last_seen_at`). */
  lock?: Record<string, unknown>
  /** Esta função SQL devolve erro de banco só quando algum item de `p_open` é deste vídeo (uuid): a falha de UM vídeo, não do canal. */
  rpcFailFor?: { fn: string; videoId: string }
  /** (A5 E2) `apply_competitor_version_plan` devolve erro de banco para estes vídeos (uuid): a falha da reconciliação de versões de UM vídeo. */
  versionPlanFailOf?: string[]
  /** O carimbo `update competitor_videos set last_seen_at ... in(id)` devolve erro de banco. */
  failStamp?: boolean
  /** O `update` da linha do canal (o que leva `miss_streak`) devolve erro de banco. */
  failChannelUpdate?: boolean
  /** A trava do canal não é obtida (outro processo sincroniza): o `update … or(…)` devolve lista vazia. */
  lockTaken?: boolean
  /** (A5 E2) Todos os vídeos do canal como a leitura paginada os devolve; `allPages` = uma lista por página de 1.000; `allError` = a leitura falha. Omitidos: monta de `tracked` e `pinned`. */
  all?: Record<string, unknown>[]; allPages?: Record<string, unknown>[][]; allError?: string; allNull?: boolean
  /** (A5 E2) O `video_limit` do canal (a linha da trava); omitido = 50. */
  videoLimit?: number
  /**
   * (A5 E2) A gravação nova que falha com 'boom'. Nome de tabela (`insert`, `update` ou `upsert`), `'<tabela>:insert|update|upsert'`,
   * `'competitor_channels:patch'` (o `update` do canal que leva `custom_url`, que não é a trava nem o progresso) ou `'rpc:<função>'`.
   * Falha só uma chamada: a de ordem `failWriteSkip` (0 = a primeira) entre as que casam.
   */
  failWrite?: string; failWriteSkip?: number
  /** (A5 E2, leitura semanal) Os pontos de competitor_video_daily dos últimos 8 dias (a leitura com `gte` em snap_date); omitido = nenhum. */
  recentDaily?: Record<string, unknown>[]; recentDailyError?: string
  /** (A5 E2, 11c) Os mesmos pontos como estão DEPOIS de gravados os desta visita: a leitura da promoção é a segunda leitura com `gte` (e as seguintes); omitido = os de `recentDaily`. */
  recentDailyAfter?: Record<string, unknown>[]; recentDailyAfterError?: string
  /** (A5 E2, 11c) A leitura das trocas recentes falha com este texto. */
  recentChangesError?: string; recentChangesNull?: boolean
  /** (A5 E2, leitura semanal) O estado do canal que a leitura semanal lê (select, sem trava); omitidos = 'idle' e sem início. */
  channelStatus?: string; channelStartedAt?: string | null
  /** (A5 E2) As versões de campo abertas recentemente (a leitura com `gte` em first_seen_at; a Tarefa 11c usa). */
  recentChanges?: Record<string, unknown>[]
}

/** O `failWrite` casa com esta chamada? */
function writeMatches(spec: string, c: Call): boolean {
  if (spec.startsWith('rpc:')) return c.table === spec
  const [table, kind] = spec.split(':') as [string, string | undefined]
  if (c.table !== table) return false
  const op = String(first(c))
  if (kind === 'patch') return op === 'update' && 'custom_url' in (arg(c, 'update') ?? {})
  if (kind === 'daily_until') return op === 'update' && 'daily_until' in (arg(c, 'update') ?? {}) // (11c) a gravação da promoção
  return kind ? op === kind : ['insert', 'update', 'upsert'].includes(op)
}

export function setup(opts: SetupOpts = {}) {
  let writesSeen = 0, pointReads = 0
  const db = fakeDb((c) => {
    if (opts.failWrite && writeMatches(opts.failWrite, c) && writesSeen++ === (opts.failWriteSkip ?? 0)) return { data: null, error: { message: 'boom' } }
    if (opts.selectFail === 'competitor_channels' && c.table === 'competitor_channels' && c.ops.some(o => o[0] === 'or')) return { data: null, error: { message: 'boom' } }
    if (opts.lockTaken && c.table === 'competitor_channels' && c.ops.some(o => o[0] === 'or')) return { data: [] }
    if (c.table === 'competitor_channels' && c.ops.some(o => o[0] === 'or')) return { data: [{ ...lockRow, video_limit: opts.videoLimit ?? lockRow.video_limit, ...opts.lock }] }
    // (A5 E2) a leitura semanal lê o estado do canal sem tomar a trava
    if (c.table === 'competitor_channels' && first(c) === 'select') return { data: [{ ...lockRow, sync_status: opts.channelStatus ?? 'idle', sync_started_at: opts.channelStartedAt ?? null, video_limit: opts.videoLimit ?? lockRow.video_limit }] }
    // (A5 E2) a leitura de TODOS os vídeos do canal (paginada por `range`): primeira linha de competitor_videos no roteiro
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'range')) {
      if (opts.allNull) return { data: null, error: null }
      if (opts.allError) return { data: null, error: { message: opts.allError } }
      if (opts.allPages) return { data: opts.allPages[(c.ops.find(o => o[0] === 'range')![1][0] as number) / 1000] ?? [] }
      if (opts.all) return { data: opts.all }
      // sem `all`: monta o canal a partir de `tracked` (recentes, uma hora de diferença entre eles) e `pinned` (antigos), que é como os
      // testes antigos o descrevem; o que `existing` sabe da mesma linha (last_seen_at, missing_since, discovered_at) entra junto
      const known = new Map<unknown, Record<string, unknown>>((opts.existing ?? []).map(e => [e.id, e] as const))
      const tr = (opts.tracked ?? [{ id: 'v-1', video_id: 'vid-1', title: null, thumbnail_url: null }]).map((r, i) => ({ published_at: new Date(NOW.getTime() - (i + 1) * 3_600_000).toISOString(), pinned_at: null, ...(known.get(r.id) ?? {}), ...r }))
      const seenIds = new Set(tr.map(r => r.id))
      const pinnedIds = new Set((opts.pinned ?? []).map(p => p.id))
      const pin = (opts.pinned ?? []).filter(p => !seenIds.has(p.id)).map(p => ({ published_at: new Date(NOW.getTime() - 400 * 86_400_000).toISOString(), pinned_at: '2026-10-01T00:00:00.000Z', ...p }))
      return { data: [...tr.map(r => (pinnedIds.has(r.id) ? { ...r, pinned_at: '2026-10-01T00:00:00.000Z' } : r)), ...pin] }
    }
    if (opts.failChannelUpdate && c.table === 'competitor_channels' && first(c) === 'update' && 'miss_streak' in (arg(c, 'update') ?? {})) return { data: null, error: { message: 'boom' } }
    if (opts.failStamp && c.table === 'competitor_videos' && first(c) === 'update' && Object.keys(arg(c, 'update') ?? {}).join() === 'last_seen_at') return { data: null, error: { message: 'boom' } }
    if (c.table === 'competitor_videos' && first(c) === 'update' && opts.failUpdates) {
      const eq = c.ops.find(o => o[0] === 'eq' && o[1][0] === 'id')
      const msg = eq ? opts.failUpdates[String(eq[1][1])] : undefined
      if (msg !== undefined) return { data: null, error: { message: msg } }
    }
    if (c.table === 'competitor_videos' && first(c) === 'update' && opts.failUpdateOf && c.ops.some(o => o[0] === 'eq' && o[1][1] === opts.failUpdateOf)) return { data: null, error: { message: 'boom' } }
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'gt' && o[1][1] === 180)) return { data: opts.longs ?? [] }
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'in')) return { data: opts.existing ?? [] }
    if (c.table === 'competitor_videos' && first(c) === 'select') return { count: 100 }
    if (c.table === 'competitor_videos' && first(c) === 'insert') return { data: { id: 'v-new' } }
    // (A5 E2) os pontos recentes da leitura semanal (o único select de competitor_video_daily com `gte`)
    // a primeira leitura é a do começo da visita; da segunda em diante, a da promoção (depois dos pontos)
    if (c.table === 'competitor_video_daily' && first(c) === 'select' && c.ops.some(o => o[0] === 'gte')) {
      const after = pointReads++ >= 1
      if (after && opts.recentDailyAfterError) return { data: null, error: { message: opts.recentDailyAfterError } }
      if (opts.recentDailyError) return { data: null, error: { message: opts.recentDailyError } }
      const ids = c.ops.find(o => o[0] === 'in' && o[1][0] === 'video_id')?.[1][1] as unknown[] | undefined // como o banco: só os vídeos pedidos
      const from = c.ops.find(o => o[0] === 'gte' && o[1][0] === 'snap_date')?.[1][1] as string | undefined // como o banco: só de `from` em diante
      return { data: ((after ? opts.recentDailyAfter : undefined) ?? opts.recentDaily ?? []).filter(r => (!ids || ids.includes(r.video_id)) && (from === undefined || String(r.snap_date) >= from)).sort((a, b) => String(a.snap_date).localeCompare(String(b.snap_date))) } // como o banco: `order('snap_date', ascending)`
    }
    if (c.table === 'competitor_video_daily' && first(c) === 'select') {
      const have = opts.dailyHave ?? (opts.lastDaily === '2026-10-24' ? ['v-1', 'v-new'] : [])
      return { data: have.map(video_id => ({ video_id })) }
    }
    if (c.table === 'competitor_video_daily' && first(c) === 'upsert') return { data: c.ops[0]![1][0] }
    if (c.table === 'competitor_video_early' && first(c) === 'upsert') return { data: c.ops[0]![1][0] }
    if (c.table === 'competitor_video_versions' && first(c) === 'select' && c.ops.some(o => o[0] === 'gte' && o[1][0] === 'first_seen_at')) return opts.recentChangesNull ? { data: null, error: null } : opts.recentChangesError ? { data: null, error: { message: opts.recentChangesError } } : { data: opts.recentChanges ?? [] }
    if (c.table === 'competitor_video_versions' && first(c) === 'select') return { data: opts.versions ?? [] }
    if (c.table === 'rpc:apply_competitor_version_plan') {
      if (opts.rpcError) return { data: null, error: { message: 'boom' } }
      if (opts.versionPlanFailOf?.includes((c.ops[0]![1][0] as { p_video_id: string }).p_video_id)) return { data: null, error: { message: 'boom' } }
      return { data: { opened: {}, changes: (c.ops[0]![1][0] as { p_changes: unknown[] }).p_changes.length } }
    }
    // (A5) leituras e funções da captura: o que o falso não conhece é nulo, e a captura trata nulo como falha ("nenhuma linha" é lista vazia)
    if (opts.selectFail && c.table === opts.selectFail && first(c) === 'select') return { data: null, error: { message: 'boom' } }
    if (c.table === 'competitor_field_versions' && first(c) === 'select') return { data: opts.fields ?? [] }
    if (c.table === 'competitor_raw' && first(c) === 'select') return { data: opts.raws ?? [] }
    if (c.table.startsWith('rpc:')) {
      const name = c.table.slice(4)
      if (opts.rpcFail === name) return { data: null, error: { message: 'boom' } }
      if (opts.rpcFailFor?.fn === name) {
        const a = c.ops[0]![1][0] as { p_open?: Array<{ video_id?: unknown }> }
        if ((a.p_open ?? []).some(o => o.video_id === opts.rpcFailFor!.videoId)) return { data: null, error: { message: 'boom' } }
      }
      if (name === 'competitor_mark_missing') return { data: opts.missed ?? [] }
      if (name === 'competitor_channel_mark_missing') return { data: opts.channelMissed ?? null }
      if (name === 'youtube_quota_add') return { data: 1 }
      return { data: {} }
    }
    return { data: null, error: null }
  })
  vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client as never)
  return db
}

export const EARLY = new Date(NOW.getTime() - 6 * 3_600_000) // 06:00 SP: not the daily pass
export const quiet = { probeBudget: { remaining: 0 }, deferBackfill: true } // no Shorts probe: only the API calls under test
/** Wraps a fetch and lists the YouTube Data API calls it saw, in order, without host and key. */
export function traced(inner: typeof fetch) {
  const urls: string[] = []
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => { urls.push(String(input)); return inner(input, init) }) as typeof fetch
  const api = () => urls.filter(u => u.includes('googleapis.com/youtube/v3/')).map(u => u.split('/youtube/v3/')[1]!.replace(/&key=.*$/, ''))
  return { f, api }
}

/** Os `update` gravados em competitor_videos para UMA linha (os corpos, na ordem). */
export const updatesOf = (db: { calls: Call[] }, uuid: string) => db.calls
  .filter(c => c.table === 'competitor_videos' && first(c) === 'update' && c.ops.some(o => o[0] === 'eq' && o[1][0] === 'id' && o[1][1] === uuid))
  .map(c => arg(c, 'update')!)
/** Os argumentos de cada chamada a uma função SQL, na ordem. */
export const rpcCalls = (db: { calls: Call[] }, name: string) => db.calls.filter(c => c.table === 'rpc:' + name).map(c => c.ops[0]![1][0] as Record<string, unknown>)

/** Os sinalizadores que TODA leitura de um vídeo grava na linha (o vídeo veio: faltas zeradas, decisão limpa, não é ao vivo). */
export const SINAIS = {
  miss_streak: 0, miss_first_at: null, missing_since: null,
  removal_decision: null, removal_decided_at: null, removal_decided_by: null,
  was_live: false, live_scheduled_start_at: null, live_actual_start_at: null, live_actual_end_at: null,
}
/** O que a linha leva quando a parte snippet veio sem idioma, sem tags e sem categoria. A miniatura NÃO entra: sem miniatura utilizável a chave fica fora. */
export const SNIPPET0 = { default_language: null, default_audio_language: null, live_broadcast_content: null, tags: [], category_id: null }
