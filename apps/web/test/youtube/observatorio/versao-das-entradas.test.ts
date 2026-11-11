// @vitest-environment node
// F3-cache T1: a guarda da versão das entradas do cache do Observatório. A chave do cache passou a ser fixa (sem o texto do
// callback), então uma entrada sobrevive ao deploy e a ÚNICA fronteira entre formatos é a versão nos `keyParts`. Aqui, para cada
// uma das 9 `ENTRADAS`, o callback REAL roda sobre uma fixture com todas as colunas preenchidas e se calcula a forma do valor
// gravado (chaves ordenadas e tipo de cada folha, recursivo; array pela forma do 1º item) mais as listas de colunas pedidas.
// Forma mudou e a versão não → falha "suba a versão". Não cobre: mesma forma com conteúdo diferente (janela, filtro) e
// migration de RPC/view; isso vale o prazo da entrada e a regra de revisão "mudou filtro ou janela → sobe a versão".
import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { createFakeNextCache } from '../../helpers/fake-next-cache'
import { fakeSupabase } from '../../helpers/fake-supabase'
import { buildTables, ids } from './load-fixture'
import { falsoPostgrest, type Linha } from './medidas-fixture'

vi.mock('server-only', () => ({}))

/** Chaves ordenadas e tipo primitivo de cada folha, recursivo; array pela forma do 1º item (vazio = []). */
export function forma(v: unknown): unknown {
  if (v === null) return 'null'
  if (Array.isArray(v)) return v.length === 0 ? [] : [forma(v[0])]
  if (typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map(k => [k, forma((v as Record<string, unknown>)[k])]))
  return typeof v
}
const sha = (x: unknown): string => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16)

const T0 = Date.UTC(2026, 9, 14, 15, 0, 0)
const D = 86_400_000
const LAST = Date.UTC(2026, 9, 14, 10, 0, 0)
const iso = (ms: number): string => new Date(ms).toISOString()

/** Linha em que toda coluna pedida existe: as que a fixture traz valem; as outras viram um valor do tipo provável (pelo nome). */
function completa(base: Linha): Linha {
  return new Proxy(base, {
    get(t, k) {
      if (typeof k !== 'string') return undefined
      if (k in t) return t[k]
      if (/(_at|_date|^t$|^day$)/.test(k) || k.startsWith('read_')) return iso(T0 - D)
      if (/^(is_|was_|has_)|hidden|disabled/.test(k)) return false
      if (/(views|count|age_days|likes|comments|seconds|bytes|^n$)/.test(k)) return 10
      return 'x'
    },
  })
}

const canalRow = (id: string): Linha => completa({ id, site_id: 's1', collection_paused_at: null, missing_since: null, subscribers_hidden: false, last_ok_synced_at: iso(LAST), video_limit: 50 })
const videoRow = (id: string, canal: string, dias: number): Linha => completa({ id, competitor_channel_id: canal, video_id: 'yt' + id, published_at: iso(T0 - dias * D), is_short: false, view_count: 1000, missing_since: null, live_actual_start_at: null })
const diario = (video: string, dias: number, views: number): Linha => completa({ video_id: video, snap_date: iso(T0 - dias * D).slice(0, 10), taken_at: iso(T0 - dias * D), views })
const hora = (video: string, k: number): Linha => completa({ site_id: 's1', video_id: video, hour_slot: iso(Math.floor((T0 - 2 * D + k * 36e5) / 36e5) * 36e5), taken_at: iso(T0 - 2 * D + k * 36e5), views: 100 + k })
const tabelasDoCanal = (): Record<string, Linha[]> => ({
  competitor_channels: [canalRow('a')],
  competitor_videos: [videoRow('av1', 'a', 10), videoRow('av2', 'a', 40), videoRow('av3', 'a', 400)],
  competitor_channel_snapshots: [completa({ competitor_channel_id: 'a', snapshot_date: iso(T0 - 3 * D).slice(0, 10), view_count: 5000 })],
  competitor_video_daily: [diario('av1', 9, 500), diario('av1', 3, 900), diario('av2', 30, 700), diario('av3', 200, 90)],
  competitor_video_early: [completa({ video_id: 'av1', taken_at: iso(T0 - 9 * D), views: 3 })],
  competitor_video_marks: [completa({ video_id: 'av1', age_days: 1, views: 10 })],
  competitor_video_mark_misses: [completa({ video_id: 'av2', age_days: 7, reason: 'sem_leitura' })],
  competitor_video_versions: [completa({ video_id: 'av1', field: 'title', first_seen_at: iso(T0 - 5 * D), precision: 'hora', value_text: 'T' })],
  competitor_field_versions: [completa({ video_id: 'av1', field: 'title', first_seen_at: iso(T0 - 5 * D), precision: 'hora' })],
  competitor_video_hourly: [hora('av1', 1), hora('av1', 2), hora('av1', 30)],
  competitor_agenda_runs: [],
})

type Pedir = { serie: boolean; mudancas: boolean; horas: boolean }
const NENHUM: Pedir = { serie: false, mudancas: false, horas: false }
const obs = { channels: [{ id: 'a', own: false, sync: { last: LAST } }], videos: [] } as never

/** Roda os leitores reais com o cache fiel e devolve, por nome de entrada, a forma do que foi gravado e as colunas pedidas ao banco. */
async function rodarMedidas(): Promise<Record<string, { forma: unknown; colunas: string[] }>> {
  vi.resetModules()
  const cache = createFakeNextCache()
  vi.doMock('next/cache', () => cache.module)
  vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
  const { carregarMedidasDoCanalInteiro } = await import('@/lib/youtube/observatorio/medidas-telas/carregar-do-canal')
  const { completarVideoForaDaJanela } = await import('@/lib/youtube/observatorio/medidas-telas/carregar-do-video')
  const consultar = async (pedir: Pedir): Promise<{ colunas: Set<string>; canal: Awaited<ReturnType<typeof carregarMedidasDoCanalInteiro>> }> => {
    const f = falsoPostgrest(tabelasDoCanal())
    const canal = await carregarMedidasDoCanalInteiro(f.sb, { siteId: 's1', obs, channelId: 'a', agoraMs: T0, pedir })
    return { colunas: new Set(f.consultas.map(c => c.tabela + ': ' + c.colunas.join(','))), canal }
  }
  const base = await consultar(NENHUM)
  const colunasDe = async (pedir: Pedir): Promise<string[]> => { const r = await consultar(pedir); return [...r.colunas].filter(c => !base.colunas.has(c)).sort() }
  const colunas = {
    serie: await colunasDe({ ...NENHUM, serie: true }), mudancas: await colunasDe({ ...NENHUM, mudancas: true }), horas: await colunasDe({ ...NENHUM, horas: true }),
  }
  // as três partes juntas, para o vídeo fora da janela completar a partir delas
  const cheio = await consultar({ serie: true, mudancas: true, horas: true })
  const f = falsoPostgrest(tabelasDoCanal())
  await completarVideoForaDaJanela(f.sb, cheio.canal, { siteId: 's1', channelId: 'a', agoraMs: T0, okSyncedAt: LAST, video: { id: 'av3', publicadoEmMs: T0 - 400 * D, baseMs: T0 - 400 * D } })
  const colunasVideo = [...new Set(f.consultas.map(c => c.tabela + ': ' + c.colunas.join(',')))].sort()
  const porNome = (nome: string): unknown[] => [...cache.entries].filter(([k]) => k.startsWith(nome + ':')).map(([, e]) => forma(JSON.parse(e.body)))
  const out: Record<string, { forma: unknown; colunas: string[] }> = {}
  const baseCols = [...base.colunas].sort()
  for (const [nome, cols] of [['medidas-telas', baseCols], ['medidas-telas-serie', colunas.serie], ['medidas-telas-mudancas', colunas.mudancas], ['medidas-telas-horas', colunas.horas], ['medidas-telas-video', colunasVideo]] as const) {
    const formas = porNome(nome)
    out[nome] = { forma: formas.length ? formas : 'ENTRADA NÃO GRAVADA', colunas: cols }
  }
  return out
}

async function rodarPacote(): Promise<{ forma: unknown; colunas: string[] }> {
  const { loadChannelRows } = await import('@/lib/youtube/observatorio/load-channel')
  const { packChannel } = await import('@/lib/youtube/observatorio/pack')
  const db = fakeSupabase(buildTables({ siteId: 'a', now: T0, pinOldest: true, weekly: true }))
  const packed = packChannel(await loadChannelRows(db.client, { channelId: ids.channel('a', 0), videoLimit: 3, seriesStart: T0 - 5 * D, now: T0 }))
  const stored = JSON.parse(gunzipSync(Buffer.from(packed, 'base64')).toString('utf8')) as unknown
  return { forma: forma(stored), colunas: [...new Set(db.selects.map(x => x.table + ': ' + x.cols))] }
}

async function rodarAviso(): Promise<{ forma: unknown; colunas: string[] }> {
  vi.resetModules()
  const cache = createFakeNextCache()
  const rpc = vi.fn().mockResolvedValue({ data: { versao: 1, lido_em: iso(T0), hoje: '2026-10-14', proximo_mes: null, primeira_devida_em: null, primeira_devida_mes: null, atraso_mes: null, ultima_copia: iso(T0),
    casa: [{ worker: 'w', last_poll_at: iso(T0), updated_at: iso(T0), nas_ok: true, nas_checked_at: iso(T0) }], vermelhos_n: 0, atraso: { amarelos: 0, vermelhos: 0, mais_antiga: null, meses_sem_selo: 0 } }, error: null })
  vi.doMock('next/cache', () => cache.module)
  vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ rpc }) }))
  const { lerAvisoLeve } = await import('@/lib/youtube/observatorio/arquivo-mensal/aviso-leve')
  await lerAvisoLeve('s1')
  const e = [...cache.entries].filter(([k]) => k.startsWith('arquivo-aviso-leve:'))
  return { forma: e.length ? forma(JSON.parse(e[0]![1].body)) : 'ENTRADA NÃO GRAVADA', colunas: ['rpc obs_archive_aviso'] }
}

async function rodarSinal(): Promise<{ forma: unknown; colunas: string[] }> {
  vi.resetModules()
  const cache = createFakeNextCache()
  const { COLUNAS_DO_SINAL } = await import('@/lib/youtube/observatorio/arquivo/ler-sinal')
  const linhas = Array.from({ length: 29 }, (_, i) => ({ day: iso(T0 - i * D).slice(0, 10), db_bytes: 4e8 + i, competitor_bytes: 2e8, own_bytes: 1e8, measured_at: iso(T0 - i * D) }))
  const sb = { from: () => { const b = { select: () => b, order: () => b, limit: () => b, abortSignal: () => Promise.resolve({ data: linhas, error: null }) }; return b } }
  vi.doMock('next/cache', () => cache.module)
  vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => sb }))
  vi.useFakeTimers({ now: T0, toFake: ['Date'] })
  try {
    const { bancoNoChrome } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/arquivo-do-chrome')
    await bancoNoChrome('s1')
  } finally { vi.useRealTimers() }
  const e = [...cache.entries].filter(([k]) => k.startsWith('arquivo-sinal-banco:'))
  return { forma: e.length ? forma(JSON.parse(e[0]![1].body)) : 'ENTRADA NÃO GRAVADA', colunas: ['obs_db_size_daily: ' + COLUNAS_DO_SINAL] }
}

async function rodarLugares(): Promise<{ forma: unknown; colunas: string[] }> {
  vi.resetModules()
  const cache = createFakeNextCache()
  vi.doMock('next/cache', () => cache.module)
  vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
  const { lerMapaDeLugares, COLUNAS_DOS_LUGARES } = await import('@/lib/youtube/observatorio/lugar/leitura')
  const linhas = [{ video_id: 'v1', chaves: ['local:vn-hanoi', 'pais:VN'], semente_versao: 2 }, { video_id: 'v2', chaves: [], semente_versao: 2 }]
  const q: Record<string, unknown> = {}
  q.select = () => q; q.eq = () => q; q.order = () => q
  q.range = async () => ({ data: linhas, error: null })
  await lerMapaDeLugares({ from: () => q } as never, 's1', 'A')
  const e = [...cache.entries].filter(([k]) => k.startsWith('lugares-mapa:'))
  return { forma: e.length ? forma(JSON.parse(e[0]![1].body)) : 'ENTRADA NÃO GRAVADA', colunas: ['video_lugares: ' + COLUNAS_DOS_LUGARES] }
}

/**
 * O RETRATO. A versão é a constante do código (PACK_VERSION, MEDIDAS_TELAS_V) ou o `v1` dos keyParts das duas entradas do chrome do arquivo.
 * Mudou a forma ou as colunas → suba a versão no código E reescreva a linha daqui (versao e forma) no mesmo commit.
 */
const GUARDA: Record<string, { versao: number; forma: string }> = {
  'observatorio-pack': { versao: 4, forma: '8cb06d40fea5240b' },
  'medidas-telas': { versao: 3, forma: '8043f8463bc059e5' },
  'medidas-telas-serie': { versao: 3, forma: '1113c959c107f43e' },
  'medidas-telas-mudancas': { versao: 3, forma: 'fe88d45b7bac2db1' },
  'medidas-telas-horas': { versao: 3, forma: '9220569d5c6c6cb1' },
  'medidas-telas-video': { versao: 3, forma: 'ad2aac2c0dc80e00' },
  'arquivo-aviso-leve': { versao: 1, forma: 'b676d0410b27a83c' },
  'arquivo-sinal-banco': { versao: 1, forma: 'c0be82a26816598e' },
  'lugares-mapa': { versao: 1, forma: '8255115176327912' },
}

async function hoje(): Promise<Record<string, { versao: number; forma: string; detalhe: unknown }>> {
  const m = await rodarMedidas()
  const outras: Record<string, { forma: unknown; colunas: string[] }> = { 'observatorio-pack': await rodarPacote(), ...m, 'arquivo-aviso-leve': await rodarAviso(), 'arquivo-sinal-banco': await rodarSinal(), 'lugares-mapa': await rodarLugares() }
  const { PACK_VERSION } = await import('@/lib/youtube/observatorio/pack')
  const { MEDIDAS_TELAS_V } = await import('@/lib/youtube/observatorio/medidas-telas/carregar-do-site')
  const { AVISO_LEVE_V } = await import('@/lib/youtube/observatorio/arquivo-mensal/aviso-leve')
  const { SINAL_BANCO_V } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/arquivo-do-chrome')
  const { MAPA_V } = await import('@/lib/youtube/observatorio/lugar/leitura')
  const versaoDe = (nome: string): number => (nome === 'lugares-mapa' ? MAPA_V : nome === 'observatorio-pack' ? PACK_VERSION : nome.startsWith('medidas-telas') ? MEDIDAS_TELAS_V : nome === 'arquivo-aviso-leve' ? AVISO_LEVE_V : SINAL_BANCO_V)
  return Object.fromEntries(Object.entries(outras).map(([nome, v]) => [nome, { versao: versaoDe(nome), forma: sha(v), detalhe: v }]))
}

describe('versão das entradas do cache (a chave é fixa: a versão é a única fronteira entre formatos)', () => {
  it('as nove ENTRADAS têm retrato, e nenhuma deixou de gravar (a fixture é cheia)', async () => {
    const { ENTRADAS } = await import('@/lib/youtube/observatorio/cache-tag')
    const h = await hoje()
    expect(Object.keys(h).sort()).toEqual([...Object.values(ENTRADAS)].sort())
    for (const [nome, v] of Object.entries(h)) expect(JSON.stringify(v.detalhe), nome).not.toContain('ENTRADA NÃO GRAVADA')
  })
  it('a forma do valor gravado e as colunas pedidas são as do retrato desta versão', async () => {
    const h = await hoje()
    const atual = Object.fromEntries(Object.entries(h).map(([nome, v]) => [nome, { versao: v.versao, forma: v.forma }]))
    expect(atual, 'mudou a forma do que o cache guarda (ou as colunas lidas): suba a versão da entrada (PACK_VERSION, MEDIDAS_TELAS_V ou o v1 dos keyParts) e reescreva a linha do retrato neste arquivo, no mesmo commit').toEqual(GUARDA)
  })
  it('forma(): ordena chaves, tipa as folhas e olha só o 1º item do array', () => {
    expect(forma({ b: 1, a: [{ z: 'x', y: null }, { z: 2 }], c: [] })).toEqual({ a: [{ y: 'null', z: 'string' }], b: 'number', c: [] })
  })
})
