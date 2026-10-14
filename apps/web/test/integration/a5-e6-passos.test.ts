// @vitest-environment node
/**
 * A5 · E6 (Tarefa 3b): a dieta do diário contra Postgres de verdade. O passo `diario` (`coleta/diario-step.ts`), o critério de
 * cobertura (`coleta/criteria-cobertura.ts`), a leitura da cobertura (`coleta/cobertura.ts`) e o leitor do canal próprio
 * (`observatorio/proprio/ler.ts`) rodando juntos sobre `yt_own_daily_apply` e `yt_own_video_coverage` (MG14), com a API do
 * YouTube FALSA (o `fetch` global é trocado por um roteador que só atende a Analytics API, de mentira, e o Supabase local).
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e6-passos.test.ts --no-file-parallelism
 *
 * O banco é dividido com outras etapas: cada teste cria o SEU site, o SEU canal e os SEUS vídeos e só olha para eles; o arquivo
 * semeia e limpa. Função sem EXECUTE nunca é CHAMADA aqui como anon/authenticated (derruba este Postgres): só `service_role`.
 * Datas: tudo relativo a hoje (Pacífico para a fonte e a cobertura, UTC para o `attempt_day`, que o BANCO escreve).
 * Token: `ensureFreshToken` é trocado (como em `diario-step.test.ts`), e NÃO `autorizacao` inteira: `marcarAutorizado` grava de verdade.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { leituraDe } from '../youtube/observatorio/leitura-teste'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))

import { ensureFreshToken } from '@/lib/social/token-refresh'
import { passoDiario } from '@/lib/youtube/coleta/diario-step'
import { criterioCobertura } from '@/lib/youtube/coleta/criteria-cobertura'
import { lerCoberturaBase } from '@/lib/youtube/coleta/cobertura'
import { criarRelogio } from '@/lib/youtube/coleta/clock'
import { addDays, dayPt, utcDay } from '@/lib/youtube/coleta/day-pt'
import { metricVersion } from '@/lib/youtube/coleta/metric-version'
import { lerDiario } from '@/lib/youtube/observatorio/proprio/ler'
import type { ColetaChannel, StepCtx } from '@/lib/youtube/coleta/types'

vi.setConfig({ testTimeout: 90_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const HOJE = utcDay(new Date())
const HOJE_PT = dayPt(new Date())
const d = (n: number): string => addDays(HOJE, n)
const p = (n: number): string => addDays(HOJE_PT, n)
const TOKEN = 'token-fixo-do-teste'

type Linha = Record<string, unknown>
interface Cen { site: string; canal: string; uc: string; nome: string }
interface Vid { id: string; yt: string }

// ───────────────────────── a API do YouTube, de mentira ─────────────────────────
const fetchReal = globalThis.fetch
const YT = 'https://youtubeanalytics.googleapis.com/'
const json = (corpo: unknown, status = 200): Response => new Response(JSON.stringify(corpo), { status })

interface DiaFonte { day: string; views: number; engaged?: number }
/**
 * O corpo da Analytics API, com as colunas por NOME (o leitor nunca lê por posição). `views` 0 vem com as médias 0 (o coletor é que as
 * troca por nulo); minutos assistidos fracionários. `semViews` tira a coluna `views`; `semEstendidas` tira as três estendidas.
 */
function corpoDiario(dias: readonly DiaFonte[], o: { semViews?: boolean; semEstendidas?: boolean } = {}) {
  const colunas: Array<{ name: string; valor: (x: DiaFonte) => unknown }> = [
    { name: 'day', valor: x => x.day },
    ...(o.semViews ? [] : [{ name: 'views', valor: (x: DiaFonte) => x.views }]),
    { name: 'estimatedMinutesWatched', valor: x => x.views * 1.2345 },
    { name: 'averageViewDuration', valor: x => (x.views > 0 ? 61.5 : 0) },
    { name: 'averageViewPercentage', valor: x => (x.views > 0 ? 42.25 : 0) },
    { name: 'likes', valor: x => (x.views > 0 ? 1 : 0) },
    { name: 'comments', valor: () => 0 },
    { name: 'shares', valor: () => 0 },
    { name: 'subscribersGained', valor: () => 0 },
    { name: 'subscribersLost', valor: () => 0 },
    ...(o.semEstendidas ? [] : [
      { name: 'engagedViews', valor: (x: DiaFonte) => x.engaged ?? x.views },
      { name: 'cardImpressions', valor: () => 0 },
      { name: 'cardClickRate', valor: () => 0 },
    ]),
  ]
  return { columnHeaders: colunas.map(c => ({ name: c.name })), rows: dias.map(x => colunas.map(c => c.valor(x))) }
}
/** `n` dias seguidos terminando em `ate`, todos com 0 view; `comView` = quais dias (deslocamento de `ate`) têm `views`. */
const diasFonte = (n: number, ate: string, comView: Record<number, number> = {}): DiaFonte[] =>
  Array.from({ length: n }, (_, k) => ({ day: addDays(ate, -(n - 1 - k)), views: comView[-(n - 1 - k)] ?? 0 }))

type Resp = Response | Error | (() => Response | Error)
let chamadasYt: Array<{ video: string; auth: string | null; inicio: string | null; fim: string | null }> = []
/** Troca o `fetch` global: Analytics API = falsa (guarda cada chamada); Supabase local = o de verdade; qualquer outro destino lança. */
function instalarYt(porVideo: Record<string, Resp> = {}, padrao: Resp = () => json({ columnHeaders: [{ name: 'day' }], rows: [] })): void {
  chamadasYt = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith(YT)) {
      const u = new URL(url)
      const video = /video==([^;]+)/.exec(u.searchParams.get('filters') ?? '')?.[1] ?? ''
      const h = init?.headers as Record<string, string> | undefined
      chamadasYt.push({ video, auth: h?.Authorization ?? null, inicio: u.searchParams.get('startDate'), fim: u.searchParams.get('endDate') })
      const r = porVideo[video] ?? padrao
      const v = typeof r === 'function' ? r() : r
      if (v instanceof Error) throw v
      return v
    }
    if (url.startsWith(SUPABASE_URL)) return fetchReal(input, init)
    throw new Error(`chamada de rede inesperada no teste: ${new URL(url).host}`)
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.mocked(ensureFreshToken).mockReset()
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: TOKEN, connectionId: 'c1' } as never)
})

describe.skipIf(skipIfNoLocalDb())('A5 E6 (3b): a dieta do diário contra o banco (bythiago_int), API do YouTube falsa', () => {
  let pg: Client
  let sb: SupabaseClient
  const sites: string[] = []
  /** O que `yt_own_daily_apply` devolveu a cada chamada do passo (o cliente do passo registra o retorno da função). */
  let retornos: Array<{ name: string; data: unknown }> = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: TOKEN, connectionId: 'c1' } as never)
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        // FK "restrict" do canal: as tabelas presas a ele primeiro, depois vídeos e canais; o site leva o resto por cascata
        for (const t of ['yt_own_video_meta_daily', 'yt_own_video_coverage', 'yt_own_video_daily', 'yt_own_collection_attempts', 'youtube_videos', 'youtube_channels']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.site_memberships where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      }
    } finally {
      await pg.end()
    }
  })

  // ───────────────────────── semeadura e leitura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  const novoYt = (): string => 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
  const ok = async (r: PromiseLike<{ error: { message?: string } | null }>): Promise<void> => { expect((await r).error).toBeNull() }

  async function cenario(): Promise<Cen> {
    const site = (await seedSite(sb)).siteId
    sites.push(site)
    const n = randomUUID().replace(/-/g, '')
    const uc = 'UC' + n.slice(0, 22)
    const nome = 'Canal ' + n.slice(0, 6)
    const r = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, $4, $5, $6) returning id`, [site, uc, '@t' + n.slice(0, 8), nome, 'UU' + n.slice(2, 24), 'teste-' + n.slice(0, 8)])
    return { site, canal: String(r[0]!.id), uc, nome }
  }
  const canalDe = (c: Cen): ColetaChannel =>
    ({ id: c.canal, channel_id: c.uc, site_id: c.site, name: c.nome, sync_enabled: true, collection_status: 'ok', video_count: null })

  /** Um vídeo do canal, publicado no dia PT `pub` (padrão: há 7 dias, a janela de 8 dias do primeiro teste). */
  async function video(c: Cen, o: { pub?: string } = {}): Promise<Vid> {
    const yt = novoYt()
    const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, duration_seconds)
      values ($1, $2, $3, 'Teste', $4, 600) returning id`, [c.site, c.canal, yt, `${o.pub ?? p(-7)}T12:00:00Z`])
    return { id: String(r[0]!.id), yt }
  }
  /** Cobertura `base` (e `estendidas`, se pedido) de um vídeo, de `de` a `ate`, direto no banco. */
  async function cobrir(c: Cen, v: Vid, de: string, ate: string, conjuntos: string[] = ['base']): Promise<void> {
    for (const m of conjuntos) {
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id)
        values ($1, $2, $3, $4, $5, $6, $7)`, [v.yt, m, de, ate, c.site, v.id, c.canal])
    }
  }
  /** Linhas do diário como o coletor ANTIGO as gravava: uma por dia, `views` 0 nos dias sem atividade. */
  async function diarioAntigo(c: Cen, v: Vid, dias: readonly DiaFonte[]): Promise<void> {
    await ok(sb.from('yt_own_video_daily').insert(dias.map(x => ({
      youtube_video_id: v.yt, day_pt: x.day, site_id: c.site, video_id: v.id, channel_id: c.canal, views: x.views, engaged_views: x.views,
      // como o coletor antigo gravava: média medida num dia com view, nula (não 0) num dia sem
      avg_view_percentage: x.views > 0 ? 42.25 : null, avg_view_duration_seconds: x.views > 0 ? 61.5 : null, watch_time_minutes: x.views * 1.2345,
      metric_version: metricVersion(x.day),
    }))))
  }
  async function tentativa(c: Cen, o: { id: string; dia: string; outcome: string; status?: number | null; error?: string | null }): Promise<void> {
    await pg.query(`insert into public.yt_own_collection_attempts (scope_type, scope_id, kind, attempt_day, site_id, channel_id, outcome, http_status, error)
      values ('video', $1, 'diario', $2, $3, $4, $5, $6, $7)`, [o.id, o.dia, c.site, c.canal, o.outcome, o.status ?? null, o.error ?? null])
  }
  /** As tentativas do diário dos 4 últimos dias UTC (hoje e os 3 anteriores): a janela do fim do alarme. */
  const quatroDias = async (c: Cen, v: Vid, o: { outcome: string; status?: number | null; error?: string | null }): Promise<void> => {
    for (let k = 3; k >= 0; k--) await tentativa(c, { id: v.yt, dia: d(-k), ...o })
  }

  const linhasDe = async (v: Vid): Promise<Linha[]> => q(`select day_pt::text as day_pt, views, engaged_views, watch_time_minutes, avg_view_duration_seconds,
      avg_view_percentage, metric_version, site_id, channel_id, video_id from public.yt_own_video_daily where youtube_video_id = $1 order by day_pt`, [v.yt])
  const cobDe = async (v: Vid, conjunto?: string): Promise<Linha[]> => q(`select metric_set, covered_from::text as covered_from, covered_to::text as covered_to, source, site_id, channel_id
      from public.yt_own_video_coverage where youtube_video_id = $1 ${conjunto ? 'and metric_set = $2' : ''} order by metric_set, covered_from`,
    conjunto ? [v.yt, conjunto] : [v.yt])
  const tentDe = async (v: Vid): Promise<Linha[]> => q(`select outcome, http_status, error, attempt_day::text as attempt_day, channel_id, site_id
    from public.yt_own_collection_attempts where scope_type = 'video' and scope_id = $1 and kind = 'diario' order by attempt_day`, [v.yt])

  // ───────────────────────── o passo e o critério ─────────────────────────
  /** O cliente do passo: igual ao de verdade, mas guarda o que `yt_own_daily_apply` devolveu. */
  function clienteQueGrava(): SupabaseClient {
    return new Proxy(sb, {
      get(alvo, prop) {
        if (prop === 'rpc') {
          return async (nome: string, args?: Record<string, unknown>) => {
            const r = await alvo.rpc(nome, args)
            if (nome === 'yt_own_daily_apply') retornos.push({ name: nome, data: r.data })
            return r
          }
        }
        const v = Reflect.get(alvo, prop, alvo) as unknown
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(alvo) : v
      },
    })
  }
  async function passo(c: Cen) {
    retornos = []
    const ctx: StepCtx = {
      supabase: clienteQueGrava(), channels: [canalDe(c)], deadline: Date.now() + 120_000, falhas: [], tentativas: [],
      autorizados: new Set(), negados: new Set(),
    }
    const r = await passoDiario(ctx)
    return { r, ctx }
  }
  async function criterio(c: Cen, canais: ColetaChannel[] = [canalDe(c)]) {
    const falhas: string[] = []
    const { acaoDoDono } = await criterioCobertura({ supabase: sb, channels: canais, falhas, relogio: criarRelogio() })
    return { falhas, acaoDoDono }
  }
  const retornoDaFuncao = (n = 0): Record<string, unknown> => retornos.filter(x => x.name === 'yt_own_daily_apply')[n]!.data as Record<string, unknown>

  // ═════════════════════════ o passo ═════════════════════════
  describe('passo: gravar pela função', () => {
    it('8 dias, 1 com view: 1 linha, cobertura de 8 dias nos dois conjuntos, tentativa `ok`; o p_rows do passo é aceito e o retorno tem os cinco números', async () => {
      const c = await cenario(); const v = await video(c)
      instalarYt({ [v.yt]: () => json(corpoDiario(diasFonte(8, p(0), { [-3]: 3 }))) })
      const { r, ctx } = await passo(c)

      expect(ctx.falhas).toEqual([])
      expect(chamadasYt).toHaveLength(1)
      expect(chamadasYt[0]).toMatchObject({ video: v.yt, auth: `Bearer ${TOKEN}`, inicio: p(-7), fim: HOJE_PT })

      // só o dia com atividade virou linha; os sete zeros ficaram de fora
      const l = await linhasDe(v)
      expect(l).toHaveLength(1)
      expect(l[0]).toMatchObject({ day_pt: p(-3), views: '3', metric_version: metricVersion(p(-3)), site_id: c.site, channel_id: c.canal, video_id: v.id })
      // watch_time_minutes fracionário chega ao banco como numeric (3 x 1,2345), as médias medidas como vieram
      expect(Number(l[0]!.watch_time_minutes)).toBeCloseTo(3.7035, 4)
      expect(Number(l[0]!.avg_view_duration_seconds)).toBe(61.5)
      expect(Number(l[0]!.avg_view_percentage)).toBe(42.25)

      // a cobertura diz que os 8 dias foram coletados, nos dois conjuntos
      for (const conjunto of ['base', 'estendidas']) {
        expect(await cobDe(v, conjunto), conjunto).toEqual([expect.objectContaining({ metric_set: conjunto, covered_from: p(-7), covered_to: p(0), source: 'analytics_api', site_id: c.site, channel_id: c.canal })])
      }
      expect(await tentDe(v)).toEqual([expect.objectContaining({ outcome: 'ok', http_status: null, error: null, attempt_day: HOJE, channel_id: c.canal })])

      // o retorno da função: os cinco números, inteiros
      expect(retornos).toHaveLength(1)
      expect(Object.keys(retornoDaFuncao()).sort()).toEqual(['apagadas', 'atualizadas', 'dias', 'inseridas', 'intervalos'])
      expect(retornoDaFuncao()).toEqual({ dias: 8, inseridas: 1, atualizadas: 0, apagadas: 0, intervalos: 2 })
      expect(r).toMatchObject({ gravados: 1, apagadas: 0, intervalos: 2, estendidas_ausentes: 0, atrasados_antigos: 0, com_buraco: 0, pendentes: 0 })
      // marcarAutorizado gravou a coluna de verdade
      const aut = await q('select authorization_verified_at from public.youtube_channels where id = $1', [c.canal])
      expect(aut[0]!.authorization_verified_at).not.toBeNull()
    })

    it('a segunda execução com a mesma resposta não muda nada (atualizadas, sem inseridas)', async () => {
      const c = await cenario(); const v = await video(c)
      instalarYt({ [v.yt]: () => json(corpoDiario(diasFonte(8, p(0), { [-3]: 3, [-1]: 2 }))) })
      await passo(c)
      const antes = { linhas: await linhasDe(v), base: await cobDe(v, 'base'), est: await cobDe(v, 'estendidas') }
      expect(antes.linhas).toHaveLength(2)

      const { ctx } = await passo(c)
      expect(ctx.falhas).toEqual([])
      expect(retornoDaFuncao()).toMatchObject({ dias: 8, inseridas: 0, atualizadas: 2, apagadas: 0 })
      expect(await linhasDe(v)).toEqual(antes.linhas)
      expect(await cobDe(v, 'base')).toEqual(antes.base)
      expect(await cobDe(v, 'estendidas')).toEqual(antes.est)
      expect(await tentDe(v), 'a tentativa do dia é a mesma linha').toEqual([expect.objectContaining({ outcome: 'ok', attempt_day: HOJE })])
    })

    it('resposta SEM `views`: nada é gravado no banco; tentativa `erro_http` com `forma_inesperada` (I1)', async () => {
      const c = await cenario(); const v = await video(c)
      instalarYt({ [v.yt]: () => json(corpoDiario(diasFonte(8, p(0), { [-3]: 3 }), { semViews: true })) })
      const { r, ctx } = await passo(c)

      expect(await linhasDe(v)).toHaveLength(0)
      expect(await cobDe(v)).toHaveLength(0)
      expect(retornos, 'a função nem foi chamada').toHaveLength(0)
      expect(await tentDe(v)).toEqual([expect.objectContaining({ outcome: 'erro_http', error: 'forma_inesperada' })])
      expect(r.gravados).toBe(0)
      expect(ctx.falhas.length, 'o vídeo é novo demais para ser atraso antigo: entra na nota do passo').toBeGreaterThan(0)
    })

    it('resposta SEM `engaged_views`: só o intervalo `base` existe', async () => {
      const c = await cenario(); const v = await video(c)
      instalarYt({ [v.yt]: () => json(corpoDiario(diasFonte(8, p(0), { [-3]: 3 }), { semEstendidas: true })) })
      const { r, ctx } = await passo(c)

      // a resposta sem as estendidas é gravada só na base, e o passo DIZ isso (uma nota, não um vermelho silencioso)
      expect(ctx.falhas).toEqual([`diário: ${c.nome}: estendidas ausentes na resposta de 1 vídeo(s)`])
      expect(r.estendidas_ausentes).toBe(1)
      expect(await cobDe(v, 'base')).toHaveLength(1)
      expect(await cobDe(v, 'estendidas')).toHaveLength(0)
      expect(retornoDaFuncao()).toMatchObject({ dias: 8, inseridas: 1, intervalos: 1 })
      const l = await linhasDe(v)
      expect(l).toHaveLength(1)
      expect(l[0]!.engaged_views, 'coluna que não veio fica nula, nunca zero').toBeNull()
    })
  })

  // ═════════════════════════ o leitor, antes e depois da dieta ═════════════════════════
  describe('leitor do canal próprio', () => {
    it('`lerDiario` devolve as MESMAS linhas antes e depois do passo (a função apaga os zeros; a cobertura os devolve)', async () => {
      const c = await cenario(); const v = await video(c)
      // o estado ANTIGO: 7 dias com uma linha cada (zeros inclusive) e a cobertura do mesmo trecho
      const fonte = diasFonte(7, p(-1), { [-4]: 5, [-1]: 2 })
      await diarioAntigo(c, v, fonte)
      await cobrir(c, v, p(-7), p(-1), ['base', 'estendidas'])
      const ler = async () => {
        const r = await lerDiario(sb, { leitura: await leituraDe(c.site), canalId: c.canal, hoje: HOJE_PT, ytIds: [v.yt] })
        if (r.acesso !== 'ok') throw new Error('esperava ok')
        return r.dado
      }
      const antes = await ler()
      expect(antes.linhas).toHaveLength(7)
      expect((await linhasDe(v))).toHaveLength(7)

      instalarYt({ [v.yt]: () => json(corpoDiario(fonte)) })
      const { ctx } = await passo(c)
      expect(ctx.falhas).toEqual([])
      // a função apagou os 5 zeros e deixou as 2 linhas com atividade
      expect(retornoDaFuncao()).toMatchObject({ dias: 7, apagadas: 5 })
      expect(await linhasDe(v)).toHaveLength(2)

      const depois = await ler()
      expect(depois.linhas, 'o leitor devolve os zeros apagados').toHaveLength(7)
      expect(depois).toEqual(antes)
    })
  })

  // ═════════════════════════ o critério ═════════════════════════
  describe('critério de cobertura', () => {
    it('verde depois do passo: `falhas` vazio e nada para o dono', async () => {
      const c = await cenario(); const v = await video(c)
      instalarYt({ [v.yt]: () => json(corpoDiario(diasFonte(8, p(0), { [-3]: 3 }))) })
      await passo(c)
      expect(await criterio(c)).toEqual({ falhas: [], acaoDoDono: [] })
    })

    it('vermelho ao apagar a cobertura de um vídeo: a nota leva o id dele, e só o dele', async () => {
      const c = await cenario(); const v1 = await video(c); const v2 = await video(c)
      instalarYt({
        [v1.yt]: () => json(corpoDiario(diasFonte(8, p(0), { [-3]: 3 }))),
        [v2.yt]: () => json(corpoDiario(diasFonte(8, p(0), { [-2]: 1 }))),
      })
      await passo(c)
      expect((await criterio(c)).falhas, 'antes de apagar: verde').toEqual([])
      await pg.query('delete from public.yt_own_video_coverage where youtube_video_id = $1', [v2.yt])

      const { falhas, acaoDoDono } = await criterio(c)
      expect(acaoDoDono).toEqual([])
      expect(falhas).toHaveLength(1)
      expect(falhas[0]).toContain(v2.yt)
      expect(falhas[0]).toContain('1 de 2 vídeos')
      expect(falhas[0]).toContain('nunca coberto')
      expect(falhas[0]).not.toContain(v1.yt)
    })

    it('vermelho com a tabela de cobertura vazia: todos os vídeos do canal do teste', async () => {
      const c = await cenario()
      const vs = [await video(c, { pub: p(-30) }), await video(c, { pub: p(-30) }), await video(c, { pub: p(-30) })]
      const { falhas, acaoDoDono } = await criterio(c)
      expect(acaoDoDono).toEqual([])
      expect(falhas).toHaveLength(1)
      expect(falhas[0]).toContain('3 de 3 vídeos')
      for (const v of vs) expect(falhas[0]).toContain(v.yt)
    })

    it('o 4º dia sem resposta do YouTube vira ação do dono: `falhas` vazio e a nota na lista, com a situação lida de `yt_own_video_meta_daily`', async () => {
      const c = await cenario()
      // 3 vídeos elegíveis: um é candidato (cobertura até hoje - 9 e 4 dias de "sem dado"); os outros 2 estão em dia (não é pane)
      const sumido = await video(c, { pub: p(-30) }); const a = await video(c, { pub: p(-30) }); const b = await video(c, { pub: p(-30) })
      await cobrir(c, sumido, p(-30), p(-9))
      await cobrir(c, a, p(-30), p(0)); await cobrir(c, b, p(-30), p(0))
      await quatroDias(c, sumido, { outcome: 'sem_dado_na_janela' })
      await ok(sb.from('yt_own_video_meta_daily').insert({
        youtube_video_id: sumido.yt, day_pt: p(-9), site_id: c.site, video_id: sumido.id, channel_id: c.canal, privacy_status: 'unlisted', captured_at: new Date().toISOString(),
      }))

      const { falhas, acaoDoDono } = await criterio(c)
      expect(falhas).toEqual([])
      expect(acaoDoDono).toHaveLength(1)
      expect(acaoDoDono[0]).toContain(sumido.yt)
      expect(acaoDoDono[0]).toContain('última situação conhecida: não listado')
      expect(acaoDoDono[0]).toContain(`coberto até ${p(-9).slice(8, 10)}/${p(-9).slice(5, 7)}`)
    })

    it('N1: 4 dias de `erro_de_banco` ficam vermelhos (falha nossa, não do YouTube); nada vai para o dono', async () => {
      const c = await cenario()
      const sumido = await video(c, { pub: p(-30) }); const a = await video(c, { pub: p(-30) }); const b = await video(c, { pub: p(-30) })
      await cobrir(c, sumido, p(-30), p(-9)); await cobrir(c, a, p(-30), p(0)); await cobrir(c, b, p(-30), p(0))
      await quatroDias(c, sumido, { outcome: 'erro_http', error: 'erro_de_banco' })

      const { falhas, acaoDoDono } = await criterio(c)
      expect(acaoDoDono).toEqual([])
      expect(falhas).toHaveLength(1)
      expect(falhas[0]).toContain(sumido.yt)
      expect(falhas[0]).toContain('1 de 3 vídeos')
    })

    it('N1: 4 dias de 404 viram ação do dono', async () => {
      const c = await cenario()
      const sumido = await video(c, { pub: p(-30) }); const a = await video(c, { pub: p(-30) }); const b = await video(c, { pub: p(-30) })
      await cobrir(c, sumido, p(-30), p(-9)); await cobrir(c, a, p(-30), p(0)); await cobrir(c, b, p(-30), p(0))
      await quatroDias(c, sumido, { outcome: 'erro_http', status: 404, error: 'http_404' })

      const { falhas, acaoDoDono } = await criterio(c)
      expect(falhas).toEqual([])
      expect(acaoDoDono).toHaveLength(1)
      expect(acaoDoDono[0]).toContain(sumido.yt)
    })

    it('só 3 dos 4 dias sem resposta: ainda vermelho (o fim do alarme exige os 4)', async () => {
      const c = await cenario()
      const sumido = await video(c, { pub: p(-30) }); const a = await video(c, { pub: p(-30) }); const b = await video(c, { pub: p(-30) })
      await cobrir(c, sumido, p(-30), p(-9)); await cobrir(c, a, p(-30), p(0)); await cobrir(c, b, p(-30), p(0))
      for (let k = 2; k >= 0; k--) await tentativa(c, { id: sumido.yt, dia: d(-k), outcome: 'sem_dado_na_janela' })

      const { falhas, acaoDoDono } = await criterio(c)
      expect(acaoDoDono).toEqual([])
      expect(falhas).toHaveLength(1)
      expect(falhas[0]).toContain(sumido.yt)
    })

    it('só o canal do teste é olhado (R5): o vídeo sem cobertura de outro site não aparece', async () => {
      const meu = await cenario(); const outro = await cenario()
      const vMeu = await video(meu, { pub: p(-30) }); await cobrir(meu, vMeu, p(-30), p(0))
      const vOutro = await video(outro, { pub: p(-30) }) // sem cobertura nenhuma
      const eu = await criterio(meu)
      expect(eu).toEqual({ falhas: [], acaoDoDono: [] })
      // o mesmo critério sobre o canal do outro site o enxerga (a prova de que o vídeo estava lá para ser visto)
      const ele = await criterio(outro)
      expect(ele.falhas).toHaveLength(1)
      expect(ele.falhas[0]).toContain(vOutro.yt)
      expect(ele.falhas[0]).not.toContain(vMeu.yt)
    })
  })

  // ═════════════════════════ a leitura da cobertura ═════════════════════════
  describe('lerCoberturaBase', () => {
    it('com mais de 1.000 intervalos pagina: 1.200 semeados, 1.200 lidos, e nenhuma falha', async () => {
      const c = await cenario(); const v = await video(c, { pub: '2019-01-01' })
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id)
        select $1, 'base', date '2020-01-01' + (2 * g), date '2020-01-01' + (2 * g), $2, $3, $4 from generate_series(0, 1199) g`, [v.yt, c.site, v.id, c.canal])
      expect((await q('select count(*)::int as n from public.yt_own_video_coverage where youtube_video_id = $1', [v.yt]))[0]!.n).toBe(1200)

      const falhas: string[] = []
      const lida = await lerCoberturaBase({ supabase: sb, falhas }, canalDe(c))
      expect(falhas).toEqual([])
      if (typeof lida === 'string') throw new Error('esperava o mapa, veio ' + lida)
      expect(lida.size).toBe(1)
      expect(lida.get(v.yt)).toMatchObject({ intervalos: 1200, ate: addDays('2020-01-01', 2 * 1199) })
    })
  })
})
