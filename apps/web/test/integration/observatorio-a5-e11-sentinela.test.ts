// @vitest-environment node
/**
 * A5 · E11 (Tarefa 12, item 89): o SENTINELA. O detalhe da origem (`traffic_source_detail`) pode ser termo pesquisado, ou seja, dado
 * privado e às vezes nome de pessoa. Com `zz-sentinela-e11` gravado na tabela de detalhe do site do teste, chama TODOS os handlers `GET`
 * de `api/pipeline/` do domínio do YouTube (que inclui o Observatório: `competitors/*`, `intelligence/*`) com a autenticação de uma chave
 * de leitura do site do teste, e afirma que nenhuma resposta (corpo ou cabeçalhos) contém o sentinela.
 *
 * A lista vem do registro (`lib/pipeline/api-registry.ts`, só lido). O teste FALHA se a lista vier com 0 handlers (registro vazio ou filtro
 * errado não pode passar em verde), se um caminho do registro não tiver arquivo de rota (rota sumida) e se o sentinela não estiver no
 * banco (o teste não pode passar por falta de dado). Controle: o detector acha o sentinela numa resposta que o contém.
 *
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run --no-file-parallelism test/integration/observatorio-a5-e11-sentinela.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { NextRequest } from 'next/server'
import { randomUUID, createHash } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { PipelineAuth } from '@/lib/pipeline/auth'

const ctx = vi.hoisted(() => ({ auth: null as PipelineAuth | null }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/pipeline/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/auth')>()),
  authenticatePipeline: vi.fn(async () => ({ ok: true as const, auth: ctx.auth! })),
}))
vi.mock('@/lib/pipeline/leitura-registro', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/leitura-registro')>()),
  registrarLeitura: vi.fn(async () => undefined),
}))

import { API_REGISTRY } from '@/lib/pipeline/api-registry'

vi.setConfig({ testTimeout: 120_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const SENTINELA = 'zz-sentinela-e11'
const PREFIXO = '/api/pipeline/youtube/'
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')

// Todas as rotas do YouTube/Observatório, resolvidas pelo Vite (o caminho do registro vira o do arquivo).
const ROTAS = import.meta.glob('/src/app/api/pipeline/youtube/**/route.ts') as Record<string, () => Promise<Record<string, unknown>>>

type Handler = (req: NextRequest, c: { params: Promise<Record<string, string>> }) => Promise<Response>

/** O detector: o sentinela em qualquer lugar do corpo ou dos cabeçalhos. */
async function vazou(res: Response): Promise<boolean> {
  const cab = JSON.stringify([...res.headers.entries()])
  return cab.includes(SENTINELA) || (await res.clone().text()).includes(SENTINELA)
}

describe.skipIf(skipIfNoLocalDb())('A5 E11 (item 89): nenhum GET de api/pipeline/youtube devolve o detalhe da origem (sentinela)', () => {
  let pg: Client
  let site = ''
  let canal = ''
  let video = { id: '', yt: '' }
  const fetchReal = globalThis.fetch

  beforeAll(async () => {
    const sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    site = (await seedSite(sb)).siteId
    const x = randomUUID().replace(/-/g, '')
    const c = await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug, sync_enabled)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5, true) returning id`, [site, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)])
    canal = String(c.rows[0].id)
    const yt = 'y' + x.slice(0, 10)
    const v = await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at) values ($1, $2, $3, 'Teste', now() - interval '60 days') returning id`, [site, canal, yt])
    video = { id: String(v.rows[0].id), yt }
    // o detalhe, gravado pela função de verdade a partir de um relatório de verdade (a linha do relatório + a função do banco)
    const dia = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
    const rep = 'rep-' + randomUUID().slice(0, 12)
    await pg.query(`insert into public.yt_reporting_reports (report_id, site_id, job_id, channel_id, report_type_id, start_time, end_time, create_time, download_url, status, downloaded_at)
      values ($1, $2, 'job-e11', $3, 'channel_traffic_source_a3', $4, $5, now(), 'https://exemplo.invalid/x', 'baixado', now())`,
    [rep, site, canal, `${dia}T07:00:00Z`, `${new Date(Date.parse(`${dia}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)}T07:00:00Z`])
    const r = await sb.rpc('yt_own_traffic_detail_apply', {
      p_report_id: rep, p_unmatched: null,
      p_rows: [{ youtube_video_id: yt, video_id: video.id, day_pt: dia, source_type: '4', detail: SENTINELA, detail_hash: sha256(SENTINELA), views: 5, watch_time_minutes: 2, metric_version: 'views_desde_2026-08-27' }],
    })
    expect(r.error, JSON.stringify(r.error)).toBeNull()
    ctx.auth = { siteId: site, permissions: ['read', 'intelligence'], source: 'api_key', keyHash: 'h'.repeat(64), keyId: randomUUID(), keyName: 'teste-sentinela-e11' }
    // nada de rede além do Supabase local
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.startsWith(SUPABASE_URL)) return fetchReal(input, init)
      throw new Error(`chamada de rede inesperada no ensaio: ${new URL(url).host}`)
    })
  })
  afterAll(async () => {
    vi.unstubAllGlobals()
    try {
      if (site) {
        for (const t of ['yt_own_video_traffic_detail_daily', 'yt_own_video_coverage', 'yt_reporting_reports', 'youtube_videos', 'youtube_channels']) {
          await pg.query(`delete from public.${t} where site_id = $1`, [site])
        }
        await pg.query('delete from public.audit_log where site_id = $1', [site])
        await pg.query('delete from public.sites where id = $1', [site])
      }
    } finally {
      await pg.end()
    }
  })

  const endpointsGet = (): Array<{ path: string; domain: string }> => API_REGISTRY.capabilities.flatMap(d =>
    d.endpoints.filter(e => e.method === 'GET' && e.path.startsWith(PREFIXO)).map(e => ({ path: e.path, domain: d.domain })))

  it('controle: o sentinela está no banco, na tabela de detalhe do site do teste, e o detector o acha numa resposta que o contém', async () => {
    const r = await pg.query(`select count(*)::int as n from public.yt_own_video_traffic_detail_daily where site_id = $1 and detail = $2`, [site, SENTINELA])
    expect(r.rows[0].n).toBe(1)
    expect(await vazou(new Response(JSON.stringify({ q: SENTINELA })))).toBe(true)
    expect(await vazou(new Response('{}', { headers: { 'x-qualquer': SENTINELA } }))).toBe(true)
    expect(await vazou(new Response(JSON.stringify({ q: 'outra coisa' })))).toBe(false)
  })

  it('a lista de handlers vem do registro, não é vazia, e cada caminho tem o seu arquivo de rota com um `GET`', async () => {
    const eps = endpointsGet()
    expect(eps.length, 'registro vazio ou filtro errado').toBeGreaterThan(0)
    expect(eps.length).toBeGreaterThanOrEqual(20)
    expect([...new Set(eps.map(e => e.domain))]).toEqual(['youtube'])
    expect(Object.keys(ROTAS).length, 'nenhum arquivo de rota achado').toBeGreaterThan(0)
    const sem: string[] = []
    for (const e of eps) {
      const arquivo = `/src/app${e.path.replace(/:(\w+)/g, '[$1]')}/route.ts`
      const mod = ROTAS[arquivo] ? await ROTAS[arquivo]!() : null
      if (!mod || typeof mod.GET !== 'function') sem.push(`${e.path} -> ${arquivo}`)
    }
    expect(sem, 'caminho do registro sem rota (ou sem GET) no código').toEqual([])
  })

  /** Chama cada GET do registro com a chave do site do teste. Devolve o que vazou, quem lançou e o status de cada um. */
  async function chamarTodos(): Promise<{ total: number; vazaram: string[]; lancaram: string[]; status: Record<string, number> }> {
    const eps = endpointsGet()
    const vazaram: string[] = []
    const lancaram: string[] = []
    const status: Record<string, number> = {}
    for (const e of eps) {
      const arquivo = `/src/app${e.path.replace(/:(\w+)/g, '[$1]')}/route.ts`
      const GET = (await ROTAS[arquivo]!()).GET as Handler
      const params: Record<string, string> = {}
      const caminho = e.path.replace(/:(\w+)/g, (_, nome: string) => {
        const valor = e.path.includes('/videos/') ? video.id : randomUUID()
        params[nome] = valor
        return valor
      })
      const url = `http://localhost${caminho}?channel_id=${canal}&youtube_video_id=${video.yt}&video_id=${video.id}&limit=50`
      let res: Response
      try {
        res = await GET(new NextRequest(url), { params: Promise.resolve(params) })
      } catch (err) {
        lancaram.push(`${e.path}: ${err instanceof Error ? err.name : 'erro'}`)
        continue
      }
      status[e.path] = res.status
      if (await vazou(res)) vazaram.push(e.path)
    }
    return { total: eps.length, vazaram, lancaram, status }
  }

  it('nenhuma resposta de nenhum GET do YouTube/Observatório contém o sentinela (corpo e cabeçalhos), e nenhum handler lança', async () => {
    const { total, vazaram, lancaram, status } = await chamarTodos()
    expect(Object.keys(status).length + lancaram.length).toBe(total)
    expect(vazaram).toEqual([])
    expect(lancaram, 'um handler que lança não prova nada: ele não respondeu').toEqual([])
    // ao menos um handler respondeu 2xx com o site do teste (o teste não está só batendo em 401/404)
    expect(Object.values(status).filter(s => s >= 200 && s < 300).length).toBeGreaterThan(0)
  })
  // ACHADO (fora do código da E11, apanhado por este teste de ponta): `GET /api/pipeline/youtube/videos` responde 500 `DB_ERROR` para um canal
  // do site. Causa: `youtube_videos` tem DUAS chaves para `youtube_categories` (`category_id` e `auto_suggested_category_id`, esta da migration
  // 20260922000002) e o embed `youtube_categories(slug)` em `src/lib/pipeline/services/youtube.ts:1970` fica ambíguo (PGRST201 do PostgREST).
  // Correção proposta (vai para revisão, não é desta tarefa): `youtube_categories!youtube_videos_category_id_fkey(slug)`. Quando for consertado,
  // este `it.fails` falha e deve virar `it`.
  it.fails('nenhum GET do YouTube responde 5xx para um canal do site do teste (hoje `videos` responde 500: embed ambíguo de categorias)', async () => {
    const { status } = await chamarTodos()
    expect(Object.entries(status).filter(([, s]) => s >= 500).map(([p]) => p)).toEqual([])
  })
})
