// @vitest-environment node
/**
 * A5 · E4, Tarefa 16: os leitores e o montador das medidas (`medidasDoCanal`) contra Postgres de verdade.
 * Banco: SÓ o `bythiago_int` (a MG4 e a MG6 aplicadas de vez nele).
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e4-medidas.test.ts --no-file-parallelism
 * Cada teste cria o SEU site; o `afterAll` apaga (roda também depois de falha). Só dado inventado, datas relativas ao relógio.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SERVICE_KEY } from '../helpers/db-seed'
import { criarCanal, criarSite, escalar, q1 } from '../helpers/mg6'
import { DAY, spDateOf } from '@/lib/youtube/observatorio/time'
import { somaDias } from '@/lib/youtube/observatorio/medidas/direcao'
import { medidasDoCanal, type Insumos, type MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import { lerCanal, lerMarcasDoCanal, lerRetratosDoCanal, lerVideosDoCanal } from '@/lib/youtube/observatorio/medidas/ler'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const URL_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const NA_CI = process.env.CI === 'true'
const HOST_BANCO = NA_CI ? '127.0.0.1:54321' : '127.0.0.1:54421'
const PORTA_PG = NA_CI ? ':54322/' : ':54422/'
const PG_URL = process.env.SUPABASE_DB_URL ?? (NA_CI ? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' : '')
const iso = (ms: number): string => new Date(ms).toISOString()
const uid = (): string => randomUUID().replace(/-/g, '').slice(0, 10)

/** Toda medida (objeto com `estado`) dentro do resultado, qualquer que seja a forma (Map, lista, registro). */
function medidasDentro(x: unknown, achadas: Array<{ estado: string }> = []): Array<{ estado: string }> {
  if (x instanceof Map) { for (const v of x.values()) medidasDentro(v, achadas); return achadas }
  if (Array.isArray(x)) { for (const v of x) medidasDentro(v, achadas); return achadas }
  if (x !== null && typeof x === 'object') {
    const o = x as Record<string, unknown>
    if (o.estado === 'medido' || o.estado === 'nao_medido') { achadas.push({ estado: o.estado }); return achadas }
    for (const v of Object.values(o)) medidasDentro(v, achadas)
  }
  return achadas
}

describe.skipIf(skipIfNoLocalDb())('A5 E4 Tarefa 16: leitores e medidasDoCanal contra o banco local', () => {
  let pg: Client
  let sb: SupabaseClient
  const sites: string[] = []
  const orgs: string[] = []

  beforeAll(async () => {
    if (new URL(URL_BANCO).host !== HOST_BANCO) throw new Error('NEXT_PUBLIC_SUPABASE_URL não aponta para o banco de integração (' + HOST_BANCO + ')')
    if (!PG_URL.includes(PORTA_PG)) throw new Error('SUPABASE_DB_URL não aponta para o banco de integração (' + PORTA_PG + ')')
    sb = createClient(URL_BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY ?? SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    const ok = await escalar<string | null>(pg, `select to_regclass('public.competitor_video_marks')::text`)
    if (ok === null) throw new Error('a MG4 não está aplicada neste banco (aplique .superpowers/sdd/a5-e4/sql/mg4-com-pausa.sql)')
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) await apagarSites(pg, 'id = any($1::uuid[])', [sites])
      if (orgs.length > 0) await pg.query('delete from public.organizations where id = any($1::uuid[])', [orgs])
    } finally {
      await pg.end()
    }
  })

  async function novoSite(): Promise<{ site: string; canal: string }> {
    const { org, site } = await criarSite(pg)
    sites.push(site)
    orgs.push(org)
    return { site, canal: await criarCanal(pg, site) }
  }
  async function insumos(site: string, canal: string, agoraMs: number): Promise<Insumos> {
    const e = { siteId: site, channelId: canal }
    const videos = await lerVideosDoCanal(sb, e)
    const ids = videos.lido ? videos.dados.map((v) => v.id) : []
    return {
      canal: await lerCanal(sb, e),
      videos,
      marcas: await lerMarcasDoCanal(sb, { ...e, videoIds: ids }),
      retratos: await lerRetratosDoCanal(sb, { ...e, agoraMs }),
      series: 'nao_pedida', mudancas: 'nao_pedida', multiplos: 'nao_pedido', comentarios: 'nao_pedido',
    }
  }
  const medir = async (site: string, canal: string): Promise<MedidasDoCanal> => {
    const agoraMs = Date.now()
    return medidasDoCanal(await insumos(site, canal, agoraMs), { agoraMs })
  }
  async function snapshots(canal: string, hoje: string, v0: number, v1: number, v2: number): Promise<void> {
    await pg.query(
      `insert into public.competitor_channel_snapshots (competitor_channel_id, snapshot_date, view_count) values ($1, $2::date, $3), ($1, $4::date, $5), ($1, $6::date, $7)`,
      [canal, hoje, v0, somaDias(hoje, -28), v1, somaDias(hoje, -56), v2])
  }

  it('banco só com o canal: toda medida é nao_medido; semeado e depois apagado, volta a ser (o teste apaga o que semeou)', async () => {
    const { site, canal } = await novoSite()
    const vazio = await medir(site, canal)
    const m0 = medidasDentro(vazio)
    expect(m0.length).toBeGreaterThan(20) // a varredura achou as medidas de verdade
    expect(m0.filter((m) => m.estado === 'medido')).toEqual([])
    expect(vazio.falhas).toEqual([])
    expect(vazio.m3a.estado).toBe('nao_medido')

    // controle: com dado, ao menos M3(a) e uma M1 passam a ser medidas (senão o "tudo nao_medido" não prova nada)
    const hoje = spDateOf(Date.now())
    const pub = Date.now() - 40 * DAY
    const v = (await q1(pg,
      `insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at, is_short, view_count)
       values ($1, $2, 'sintético', $3::timestamptz, $3::timestamptz, false, 100) returning id`, [canal, 'e4d' + uid(), iso(pub)])).id as string
    await pg.query(
      `insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
       values ($1, 7, $2, 777, 24, $3::timestamptz, $4::timestamptz, $5::timestamptz)`,
      [v, site, iso(pub), iso(pub + 7 * DAY - 12 * 3_600_000), iso(pub + 7 * DAY + 12 * 3_600_000)])
    await snapshots(canal, hoje, 1500, 1000, 600)
    const cheio = await medir(site, canal)
    expect(cheio.m3a.estado).toBe('medido')
    const m1 = cheio.porVideo.get(v)?.m1[7]
    expect(m1?.estado).toBe('medido')
    if (m1?.estado === 'medido') expect(m1.valor.views).toBe(777)

    // apaga o que semeou (vídeos e retratos; as marcas caem em cascata) e roda de novo
    await pg.query('delete from public.competitor_videos where competitor_channel_id = $1', [canal])
    await pg.query('delete from public.competitor_channel_snapshots where competitor_channel_id = $1', [canal])
    const depois = await medir(site, canal)
    expect(medidasDentro(depois).filter((m) => m.estado === 'medido')).toEqual([])
    expect(depois.porVideo.size).toBe(0)
  })

  it('M3(a) confere com uma consulta direta aos retratos (a mesma conta em SQL, escrita no teste)', async () => {
    const hoje = spDateOf(Date.now())
    const casos: Array<{ v: [number, number, number]; esperado: 'numero' | 'base_zero' }> = [
      { v: [1500, 1000, 600], esperado: 'numero' }, // 500/400 - 1 = 0,25
      { v: [1100, 1000, 500], esperado: 'numero' }, // 100/500 - 1 = -0,8
      { v: [1000, 1000, 500], esperado: 'numero' }, // 0/500 - 1 = -1
      { v: [1200, 1100, 1100], esperado: 'base_zero' }, // ganho anterior 0
    ]
    for (const c of casos) {
      const { site, canal } = await novoSite()
      await snapshots(canal, hoje, ...c.v)
      const sql = await q1(pg,
        `with b as (select competitor_channel_id as c, max(snapshot_date) filter (where view_count is not null) as d from public.competitor_channel_snapshots where competitor_channel_id = $1 group by 1)
         select case when s0.view_count is null or s1.view_count is null or s2.view_count is null or s1.view_count - s2.view_count <= 0 or s0.view_count - s1.view_count < 0
                     then null else round(((s0.view_count - s1.view_count)::numeric / (s1.view_count - s2.view_count)) - 1, 4)::float8 end as variacao
           from b
           left join public.competitor_channel_snapshots s0 on s0.competitor_channel_id = b.c and s0.snapshot_date = b.d
           left join public.competitor_channel_snapshots s1 on s1.competitor_channel_id = b.c and s1.snapshot_date = b.d - 28
           left join public.competitor_channel_snapshots s2 on s2.competitor_channel_id = b.c and s2.snapshot_date = b.d - 56`, [canal])
      const m = (await medir(site, canal)).m3a
      if (c.esperado === 'base_zero') {
        expect(sql.variacao).toBeNull()
        expect(m.estado).toBe('nao_medido')
        if (m.estado === 'nao_medido') expect(m.motivo).toBe('base_zero')
      } else {
        expect(m.estado).toBe('medido')
        if (m.estado === 'medido') expect(m.valor.variacao).toBeCloseTo(Number(sql.variacao), 4)
      }
    }
  })

  it('canal de outro site: canal_de_outro_site em todo leitor, e nenhuma medida', async () => {
    const a = await novoSite()
    const b = await novoSite()
    const hoje = spDateOf(Date.now())
    await snapshots(b.canal, hoje, 1500, 1000, 600)
    const e = { siteId: a.site, channelId: b.canal }
    const esperado = { lido: false, causa: 'canal_de_outro_site' }
    expect(await lerCanal(sb, e)).toEqual(esperado)
    expect(await lerVideosDoCanal(sb, e)).toEqual(esperado)
    expect(await lerMarcasDoCanal(sb, { ...e, videoIds: [] })).toEqual(esperado)
    expect(await lerRetratosDoCanal(sb, e)).toEqual(esperado)
    const agoraMs = Date.now()
    const m = medidasDoCanal(await insumos(a.site, b.canal, agoraMs), { agoraMs })
    expect(medidasDentro(m).filter((x) => x.estado === 'medido')).toEqual([])
    expect(m.m3a.estado).toBe('nao_medido')
  })
})
