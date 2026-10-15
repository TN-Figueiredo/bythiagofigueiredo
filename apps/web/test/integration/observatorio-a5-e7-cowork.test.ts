// @vitest-environment node
/**
 * A5 · E7, Tarefa 15: o Lote 2 (medidas por canal em `channels`) contra o PostgREST de verdade, com tempo e tamanho medidos.
 * Banco: SÓ o `bythiago_int` (MG1 e MG4 aplicadas nele).
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e7-cowork.test.ts --no-file-parallelism
 * Cada teste cria o SEU site; o `afterAll` apaga (roda também depois de falha). Só dado inventado, datas relativas ao relógio.
 * Os números medidos saem em `console.info` com o prefixo `[E7 T15]`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SERVICE_KEY } from '../helpers/db-seed'
import { criarCanal, criarSite, criarVideo, q1 } from '../helpers/mg6'

const medidasMod = vi.hoisted(() => ({ fimEm: 0 }))
vi.mock('@/lib/pipeline/services/competitors-medidas', async (importar) => {
  const real = await importar<typeof import('@/lib/pipeline/services/competitors-medidas')>()
  return {
    ...real,
    medidasDosCanais: async (...a: Parameters<typeof real.medidasDosCanais>) => {
      try { return await real.medidasDosCanais(...a) } finally { medidasMod.fimEm = Date.now() }
    },
  }
})
const mcp = vi.hoisted(() => ({ ctx: null as null | { siteId: string }, sb: null as null | SupabaseClient }))
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => ({ siteId: mcp.ctx!.siteId, permissions: ['read'], keyHash: 'h' }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => mcp.sb }))

import { listCompetitorChanges, listCompetitorChannels } from '@/lib/pipeline/services/competitors'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { youtubeObservatory, LIMITE_DO_TEXTO_DA_FERRAMENTA } from '@/lib/pipeline/mcp/services/youtube-observatory'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 })

const URL_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const NA_CI = process.env.CI === 'true'
const HOST_BANCO = NA_CI ? '127.0.0.1:54321' : '127.0.0.1:54421'
const PORTA_PG = NA_CI ? ':54322/' : ':54422/'
const PG_URL = process.env.SUPABASE_DB_URL ?? (NA_CI ? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' : '')
const LIMITE_DE_TEMPO_MS = 10_000
const LIMITE_DE_BYTES = 80_000

describe.skipIf(skipIfNoLocalDb())('A5 E7 Tarefa 15: Lote 2 contra o PostgREST local', () => {
  let pg: Client
  let sb: SupabaseClient
  const sites: string[] = []
  const orgs: string[] = []

  beforeAll(async () => {
    if (new URL(URL_BANCO).host !== HOST_BANCO) throw new Error('NEXT_PUBLIC_SUPABASE_URL não aponta para o banco de integração (' + HOST_BANCO + ')')
    if (!PG_URL.includes(PORTA_PG)) throw new Error('SUPABASE_DB_URL não aponta para o banco de integração (' + PORTA_PG + ')')
    sb = createClient(URL_BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY ?? SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    mcp.sb = sb
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    const t = await q1(pg, `select to_regclass('public.competitor_field_versions')::text as a, to_regclass('public.competitor_channel_snapshots')::text as b`)
    if (t.a === null || t.b === null) throw new Error('a MG1 ou a tabela de retratos não está neste banco')
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      if (orgs.length > 0) await pg.query('delete from public.organizations where id = any($1::uuid[])', [orgs])
    } finally {
      await pg.end()
    }
  })

  const ctxDe = (siteId: string): ServiceContext => ({ siteId, permissions: ['read'], supabase: sb })
  async function novoSite(): Promise<string> {
    const { org, site } = await criarSite(pg)
    sites.push(site)
    orgs.push(org)
    return site
  }
  /** `videosPorCanal` vídeos por canal (um em cada quatro é Short), retratos de 120 dias com views crescentes, perfil lido. */
  async function semear(site: string, canais: number, videosPorCanal: number, nomeBase = 'Canal'): Promise<string[]> {
    const ids: string[] = []
    for (let c = 0; c < canais; c++) {
      const id = await criarCanal(pg, site, `${nomeBase} ${c}`)
      ids.push(id)
      await pg.query(
        `insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at, view_count, like_count, comment_count, is_short, duration_seconds, was_live, live_broadcast_content, last_seen_at)
         select $1::uuid, 'e7t15' || substr(md5($1::text || g::text), 1, 12), 'Vídeo sintético ' || g, now() - make_interval(days => g * 2), now() - make_interval(days => g * 2),
                1000 + g * 37, 40 + g, 4 + (g % 7), (g % 4 = 0), case when g % 4 = 0 then 40 else 600 end, false, 'none', now()
         from generate_series(1, $2::int) g`, [id, videosPorCanal])
      await pg.query(
        `insert into public.competitor_channel_snapshots (competitor_channel_id, snapshot_date, view_count, subscriber_count, video_count)
         select $1::uuid, current_date - g, 1000000 + (120 - g) * 3000 + (120 - g) * (120 - g) * 5, 10000, $2 from generate_series(1, 120) g`, [id, videosPorCanal])
      await pg.query(`update public.competitor_channels set last_seen_at = now(), published_at = now() - interval '900 days' where id = $1`, [id])
      for (const [campo, valor] of [['custom_url', `@${nomeBase.toLowerCase()}${c}`], ['country', 'BR']] as const) {
        await pg.query(
          `insert into public.competitor_field_versions (site_id, competitor_channel_id, video_id, field, value, value_hash, precision, first_seen_at, last_seen_at, is_current)
           values ($1, $2, null, $3, $4::jsonb, $5, 'first', now() - interval '2 days', now() - interval '2 days', true)`, [site, id, campo, JSON.stringify(valor), 'h' + campo + c])
      }
    }
    return ids
  }

  it('as consultas dos módulos novos são aceitas pelo PostgREST de verdade', async () => {
    const site = await novoSite()
    const [c1] = await semear(site, 2, 10)
    // 6 versões de campo de vídeo: 2 primeiras leituras e 4 mudanças
    const v = await q1(pg, 'select id from public.competitor_videos where competitor_channel_id = $1 limit 1', [c1])
    const vid = v.id as string
    let h = 0
    for (const [campo, valor, precisao, horas, corrente] of [
      ['tags', ['a'], 'first', 80, false], ['tags', ['a', 'b'], '1d', 60, false], ['tags', ['a', 'b', 'c'], '1d', 40, true],
      ['category_id', '19', 'first', 80, false], ['category_id', '22', '1d', 20, true],
    ] as const) {
      await pg.query(
        `insert into public.competitor_field_versions (site_id, competitor_channel_id, video_id, field, value, value_hash, precision, first_seen_at, last_seen_at, is_current)
         values ($1, $2, $3, $4, $5::jsonb, $6, $7, now() - make_interval(hours => $8), now() - make_interval(hours => $8), $9)`, [site, c1, vid, campo, JSON.stringify(valor), 'x' + h++, precisao, horas, corrente])
    }
    const canais = await listCompetitorChannels(ctxDe(site))
    expect(canais.data.channels).toHaveLength(2)
    for (const c of canais.data.channels) {
      expect(c.perfil.estado).toBe('lido')
      expect(Object.keys(c.medidas).sort()).toEqual(['direcao_do_canal', 'estado_do_canal', 'por_formato'])
      // nenhum erro do banco escondido: leitura_falhou e calculo_falhou ficam em zero
      expect(canais.data.medidas_indisponiveis.por_motivo['leitura_falhou'] ?? 0).toBe(0)
      expect(canais.data.medidas_indisponiveis.por_motivo['calculo_falhou'] ?? 0).toBe(0)
    }
    const m = canais.data.channels[0]!.medidas
    expect(m.direcao_do_canal.estado).toBe('medido')
    const mud = (await listCompetitorChanges(ctxDe(site), { campos: 'todos' })).data as unknown as { mudancas_de_campo: { estado: string; itens: unknown[] } }
    expect(mud.mudancas_de_campo.estado).toBe('lido')
    expect(mud.mudancas_de_campo.itens.length).toBe(3)
  })

  it('dois sites no mesmo banco não se enxergam', async () => {
    const A = await novoSite(), B = await novoSite()
    await semear(A, 2, 8, 'AlfaSintetico')
    await semear(B, 2, 8, 'BetaSintetico')
    const a = JSON.stringify((await listCompetitorChannels(ctxDe(A))).data)
    const ca = JSON.stringify((await listCompetitorChanges(ctxDe(A), { campos: 'todos' })).data)
    for (const t of [a, ca]) { expect(t).not.toContain('BetaSintetico'); expect(t).not.toContain('@betasintetico') }
    expect(a).toContain('AlfaSintetico')
  })

  it('com as tabelas de marcas presentes, com e sem linha, as nove medidas são as mesmas', async () => {
    const site = await novoSite()
    const [c1] = await semear(site, 1, 40)
    const semMarcas = (await listCompetitorChannels(ctxDe(site))).data.channels[0]!.medidas
    // o `bythiago_int` TEM a MG4: o caso "tabelas ausentes" não é executável aqui (o relatório diz); o caso "presentes com linha" sim
    const v = await q1(pg, `select id, published_at::text as p from public.competitor_videos where competitor_channel_id = $1 order by published_at desc offset 10 limit 1`, [c1])
    await pg.query(
      `insert into public.competitor_video_marks (video_id, age_days, site_id, views, likes, comments, likes_hidden, gap_hours, age_base_at, read_before_at, read_after_at)
       values ($1, 7, $2, 500, 20, 2, false, 12, ($3)::timestamptz + interval '7 days', ($3)::timestamptz + interval '7 days' - interval '6 hours', ($3)::timestamptz + interval '7 days' + interval '6 hours')`, [v.id, site, v.p])
    const comMarcas = (await listCompetitorChannels(ctxDe(site))).data.channels[0]!.medidas
    // o relógio anda entre as duas leituras (frações de milissegundo em `maiorBuracoDias`): compara com 3 casas
    const arredonda = (x: unknown): unknown => JSON.parse(JSON.stringify(x), (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))
    expect(arredonda(comMarcas)).toEqual(arredonda(semMarcas))
  })

  it('tempo e tamanho com 15 canais e 1.400 vídeos', async () => {
    const site = await novoSite()
    await semear(site, 15, 94) // 1.410 vídeos
    mcp.ctx = { siteId: site }
    const t0 = Date.now()
    const r = await listCompetitorChannels(ctxDe(site))
    const fim = Date.now()
    const duracaoTotal = fim - t0
    const montagem = fim - medidasMod.fimEm
    const bytes = JSON.stringify(r.data).length
    const porMcp = await youtubeObservatory({ action: 'list_channels' })
    const c = porMcp.content[0]
    const textoMcp = c && c.type === 'text' ? c.text : ''
    const porCanal = textoMcp.length / 15
    const gatilho = Math.floor((0.8 * LIMITE_DO_TEXTO_DA_FERRAMENTA) / porCanal)
    console.info(`[E7 T15] 15 canais, 1.410 vídeos: medidas_meta.duracao_ms=${r.data.medidas_meta.duracao_ms}; pedido inteiro=${duracaoTotal} ms; ` +
      `montar e serializar=${montagem} ms; JSON da rota=${bytes} bytes; texto da ferramenta=${textoMcp.length} caracteres; ${porCanal.toFixed(0)} caracteres por canal; ` +
      `gatilho da e7-l2-d7 = ${gatilho} canais; cortados=${r.data.medidas_meta.canais_cortados_por_tempo}; indisponiveis=${JSON.stringify(r.data.medidas_indisponiveis)}`)
    expect(r.data.channels).toHaveLength(15)
    expect(r.data.medidas_meta.canais_cortados_por_tempo).toBe(0)
    expect(r.data.medidas_meta.duracao_ms).toBeLessThan(LIMITE_DE_TEMPO_MS)
    expect(bytes).toBeLessThan(LIMITE_DE_BYTES)
    expect(textoMcp.length).toBeLessThan(LIMITE_DO_TEXTO_DA_FERRAMENTA)
    expect(montagem).toBeGreaterThanOrEqual(0)
  })

  it('o canal apagado some da resposta', async () => {
    const site = await novoSite()
    const [c1, c2] = await semear(site, 2, 6)
    const v = await q1(pg, 'select id from public.competitor_videos where competitor_channel_id = $1 limit 1', [c2])
    for (const [h, val, prec, cor] of [[50, ['a'], 'first', false], [10, ['a', 'z'], '1d', true]] as const) {
      await pg.query(
        `insert into public.competitor_field_versions (site_id, competitor_channel_id, video_id, field, value, value_hash, precision, first_seen_at, last_seen_at, is_current)
         values ($1, $2, $3, 'tags', $4::jsonb, $5, $6, now() - make_interval(hours => $7), now() - make_interval(hours => $7), $8)`, [site, c2, v.id, JSON.stringify(val), randomUUID(), prec, h, cor])
    }
    await pg.query('delete from public.competitor_channels where id = $1', [c2])
    const canais = (await listCompetitorChannels(ctxDe(site))).data
    expect(canais.channels.map(c => c.id)).toEqual([c1])
    expect(canais.medidas_indisponiveis.total).toBe(8)
    const mud = (await listCompetitorChanges(ctxDe(site), { campos: 'todos' })).data as unknown as { mudancas_de_campo: { itens: unknown[] } }
    expect(JSON.stringify(mud)).not.toContain(c2)
    void criarVideo
  })
})
