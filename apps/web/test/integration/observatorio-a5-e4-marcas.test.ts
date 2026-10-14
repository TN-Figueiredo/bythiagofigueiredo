// @vitest-environment node
/**
 * A5 · E4, Tarefa 16: o escritor das marcas (`runFecharMarcas`) INTEIRO contra Postgres de verdade, com o cliente de serviço do
 * PostgREST local: as duas idas (`competitor_marks_pending` e `competitor_marks_apply`), CHECK, FK, RLS e o relógio do banco.
 *
 * Banco: SÓ o `bythiago_int` (a MG6 e a MG4 precisam estar aplicadas de vez nele; `.superpowers/sdd/a5-e4/sql/mg4-com-pausa.sql`).
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e4-marcas.test.ts --no-file-parallelism
 *
 * Trava: o arquivo se recusa a rodar se as variáveis não apontarem para o banco de integração. Cada teste cria o SEU site e o
 * `afterAll` apaga (roda também depois de falha). Só dado inventado. Datas relativas ao relógio. `runFecharMarcas` olha o banco
 * inteiro (outros agentes semeiam coisas no `bythiago_int`): as afirmações sobre linhas são sempre sobre os vídeos DESTE arquivo.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SERVICE_KEY } from '../helpers/db-seed'
import { criarCanal, criarSite, escalar, q1 } from '../helpers/mg6'
import { runFecharMarcas } from '@/lib/youtube/observatorio/medidas/fechar-marcas'
import { lerMarcasDoCanal, lerSeriesDoCanal } from '@/lib/youtube/observatorio/medidas/ler'
import { m1DoVideo, viewsNaIdade, type IdadeDeMarca } from '@/lib/youtube/observatorio/medidas/m1'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 60_000 })

const URL_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const NA_CI = process.env.CI === 'true'
const HOST_BANCO = NA_CI ? '127.0.0.1:54321' : '127.0.0.1:54421'
const PORTA_PG = NA_CI ? ':54322/' : ':54422/'
const PG_URL = process.env.SUPABASE_DB_URL ?? (NA_CI ? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' : '')

const H = 3_600_000
const D = 24 * H
const iso = (ms: number): string => new Date(ms).toISOString()
const limiteDe = (idade: number): number => (idade === 1 ? MEASURE_RULES.maxGapHoursDay1 : MEASURE_RULES.maxGapHours)
const uid = (): string => randomUUID().replace(/-/g, '').slice(0, 10)

type Linha = Record<string, unknown>

describe.skipIf(skipIfNoLocalDb())('A5 E4 Tarefa 16: runFecharMarcas contra o banco local (cliente de serviço do PostgREST)', () => {
  let pg: Client
  let sb: SupabaseClient
  const sites: string[] = []
  const orgs: string[] = []
  // um segundo inteiro: a base de todos os vídeos
  const agora = (): number => Math.floor(Date.now() / 1000) * 1000

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
      if (sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      if (orgs.length > 0) await pg.query('delete from public.organizations where id = any($1::uuid[])', [orgs])
    } finally {
      await pg.end()
    }
  })

  // ───────────────────────── semeadura ─────────────────────────
  const rows = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  async function novoSite(): Promise<{ site: string; canal: string }> {
    const { org, site } = await criarSite(pg)
    sites.push(site)
    orgs.push(org)
    return { site, canal: await criarCanal(pg, site) }
  }
  interface OpcoesVideo { publicado?: string; liveInicio?: string | null; ao?: 'none' | 'upcoming' | 'live' }
  async function novoVideo(canal: string, base: number, o: OpcoesVideo = {}): Promise<string> {
    return (await q1(pg,
      `insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at, live_actual_start_at, live_broadcast_content, view_count)
       values ($1, $2, 'sintético', $3::timestamptz, $4::timestamptz, $5::timestamptz, $6, 10) returning id`,
      [canal, 'e4m' + uid(), o.publicado ?? iso(base), iso(base + H), o.liveInicio ?? null, o.ao ?? 'none'])).id as string
  }
  async function ponto(site: string, video: string, tabela: 'daily' | 'early', t: number, views: number, likes: number | null = null, comments: number | null = null): Promise<void> {
    if (tabela === 'daily') {
      await pg.query(
        `insert into public.competitor_video_daily (video_id, snap_date, views, likes, comments, taken_at) values ($1, $2::date, $3, $4, $5, $6::timestamptz) on conflict do nothing`,
        [video, iso(t).slice(0, 10), views, likes, comments, iso(t)])
    } else {
      await pg.query(
        `insert into public.competitor_video_early (video_id, taken_at, site_id, views, likes, comments) values ($1, $2::timestamptz, $3, $4, $5, $6) on conflict do nothing`,
        [video, iso(t), site, views, likes, comments])
    }
  }
  /** Série completa: uma leitura por dia (base + 3 h + i dias) e duas das primeiras horas (20 h e 28 h), para a idade de 1 dia medir. */
  async function serieCompleta(site: string, video: string, base: number, k: number, dias = 10): Promise<void> {
    for (let i = 0; i < dias; i++) {
      const v = 1000 + i * 137 + k * 11
      await ponto(site, video, 'daily', base + 3 * H + i * D, v, Math.round(v / 10), Math.round(v / 100))
    }
    await ponto(site, video, 'early', base + 20 * H, 1000 + k * 11 - 5, 90 + k, 9)
    await ponto(site, video, 'early', base + 28 * H, 1000 + k * 11 + 40, 95 + k, 10)
  }
  const marcasDe = (videos: string[]): Promise<Linha[]> =>
    rows(`select video_id, age_days, views, likes, comments, gap_hours::float8 as gap_hours, computed_at, age_base_at, read_before_at, read_after_at
            from public.competitor_video_marks where video_id = any($1::uuid[]) order by video_id, age_days`, [videos])
  const faltasDe = (videos: string[]): Promise<Linha[]> =>
    rows(`select video_id, age_days, reason from public.competitor_video_mark_misses where video_id = any($1::uuid[]) order by video_id, age_days`, [videos])
  const rodar = (): ReturnType<typeof runFecharMarcas> => runFecharMarcas({ sb, now: () => Date.now() })

  // ───────────────────────── os testes ─────────────────────────
  it('a marca gravada é igual ao cálculo sobre a série (item 54)', async () => {
    const { site, canal } = await novoSite()
    const base0 = agora() - 10 * D
    const videos: string[] = []
    for (let k = 0; k < 6; k++) {
      const v = await novoVideo(canal, base0 - k * 5 * H)
      await serieCompleta(site, v, base0 - k * 5 * H, k)
      videos.push(v)
    }
    const r = await rodar()
    expect(r.numeros.recusadas).toBe(0)
    const marcas = await marcasDe(videos)
    expect(marcas).toHaveLength(12) // idades 1 e 7; a de 30 ainda não fechou
    const series = await lerSeriesDoCanal(sb, { siteId: site, channelId: canal, videoIds: videos, desde: iso(base0 - 5 * D).slice(0, 10) })
    expect(series.lido).toBe(true)
    if (!series.lido) return
    for (const m of marcas) {
      const id = m.video_id as string
      const idade = m.age_days as number
      const base = Date.parse(m.age_base_at as string)
      const calc = viewsNaIdade(series.dados.series.get(id) ?? [], base, idade, { maxGapHoras: limiteDe(idade) })
      expect('medido' in calc).toBe(true)
      if (!('medido' in calc)) continue
      expect(Number(m.views)).toBe(calc.medido.views)
      expect(m.likes === null ? null : Number(m.likes)).toBe(calc.medido.likes)
      expect(m.comments === null ? null : Number(m.comments)).toBe(calc.medido.comments)
      expect(m.gap_hours as number).toBeCloseTo((calc.medido.depois - calc.medido.antes) / H, 6)
    }
    expect(await faltasDe(videos)).toHaveLength(0)
  })

  it('com as vizinhas além do limite, nenhuma linha vai para as marcas e a medida responde o motivo (item 54)', async () => {
    const { site, canal } = await novoSite()
    const base = agora() - 10 * D
    const v = await novoVideo(canal, base)
    // uma leitura a cada 48 h: o 7º dia fica entre 147 h e 195 h (48 h > 36 h); o 1º, entre 3 h e 51 h
    for (let i = 0; i < 5; i++) await ponto(site, v, 'daily', base + 3 * H + i * 2 * D, 1000 + i * 300)
    await rodar()
    expect((await marcasDe([v])).filter((m) => m.age_days === 7)).toHaveLength(0)
    const f = (await faltasDe([v])).filter((x) => x.age_days === 7)
    expect(f).toHaveLength(1)
    expect(f[0]?.reason).toBe('leituras_distantes')
    const lidas = await lerMarcasDoCanal(sb, { siteId: site, channelId: canal, videoIds: [v] })
    expect(lidas.lido).toBe(true)
    if (!lidas.lido) return
    const m = m1DoVideo({
      idadeDias: 7 as IdadeDeMarca, baseMs: base, agendadoOuNoAr: false, agoraMs: Date.now(),
      marca: lidas.dados.marcas.get(v)?.[7] ?? null, falta: lidas.dados.faltas.get(v)?.[7] ?? null,
    })
    expect(m.estado).toBe('nao_medido')
    if (m.estado === 'nao_medido') expect(m.motivo).toBe('leituras_distantes')
  })

  it('rodar duas vezes não muda nada (contagens e computed_at iguais)', async () => {
    const { site, canal } = await novoSite()
    const base = agora() - 10 * D
    const videos: string[] = []
    for (let k = 0; k < 3; k++) {
      const v = await novoVideo(canal, base - k * H)
      await serieCompleta(site, v, base - k * H, k)
      videos.push(v)
    }
    const semSerie = await novoVideo(canal, base)
    videos.push(semSerie)
    await rodar()
    const antes = { m: await marcasDe(videos), f: await faltasDe(videos) }
    expect(antes.m.length).toBeGreaterThan(0)
    expect(antes.f.length).toBeGreaterThan(0)
    await rodar()
    const depois = { m: await marcasDe(videos), f: await faltasDe(videos) }
    expect(depois.m.map((x) => [x.video_id, x.age_days, x.views, String(x.computed_at)]))
      .toEqual(antes.m.map((x) => [x.video_id, x.age_days, x.views, String(x.computed_at)]))
    expect(depois.f).toEqual(antes.f)
  })

  it('banco sem nenhuma série: só motivos, e a prova fica limpa', async () => {
    const { canal } = await novoSite()
    const base = agora() - 10 * D
    const v = await novoVideo(canal, base)
    const r = await rodar()
    expect(await marcasDe([v])).toHaveLength(0)
    const f = await faltasDe([v])
    expect(f.map((x) => [x.age_days, x.reason])).toEqual([[1, 'sem_leitura'], [7, 'sem_leitura']])
    expect(r.numeros.em_duas_tabelas).toBe(0)
    expect(r.numeros.site_divergente).toBe(0)
    expect(r.numeros.base_divergente).toBe(0)
    expect(r.numeros.atrasadas).toBe(0)
  })

  it('site: a marca de um vídeo do site B nunca aparece na leitura do site A', async () => {
    const a = await novoSite()
    const b = await novoSite()
    const base = agora() - 10 * D
    const va = await novoVideo(a.canal, base)
    const vb = await novoVideo(b.canal, base)
    await serieCompleta(a.site, va, base, 1)
    await serieCompleta(b.site, vb, base, 2)
    await rodar()
    expect(await marcasDe([va, vb])).toHaveLength(4)
    const lidas = await lerMarcasDoCanal(sb, { siteId: a.site, channelId: a.canal, videoIds: [va, vb] })
    expect(lidas.lido).toBe(true)
    if (lidas.lido) {
      expect([...lidas.dados.marcas.keys()]).toEqual([va])
      expect(lidas.dados.marcas.has(vb)).toBe(false)
    }
    const alheio = await lerMarcasDoCanal(sb, { siteId: a.site, channelId: b.canal, videoIds: [vb] })
    expect(alheio).toEqual({ lido: false, causa: 'canal_de_outro_site' })
  })

  it('apagar o vídeo e depois rodar: nada volta', async () => {
    const { site, canal } = await novoSite()
    const base = agora() - 10 * D
    const v = await novoVideo(canal, base)
    await serieCompleta(site, v, base, 3)
    await rodar()
    expect((await marcasDe([v])).length).toBeGreaterThan(0)
    await pg.query('delete from public.competitor_videos where id = $1', [v])
    expect(await marcasDe([v])).toHaveLength(0) // a cascata levou
    expect(await faltasDe([v])).toHaveLength(0)
    await rodar()
    expect(await marcasDe([v])).toHaveLength(0)
    expect(await faltasDe([v])).toHaveLength(0)
    expect(await escalar(pg, `select count(*)::int from public.competitor_video_early where video_id = $1`, [v])).toBe(0)
  })

  it('buraco na coleta: a execução que grava o motivo devolve marcas_perdidas, e a seguinte devolve ok', async () => {
    const { site, canal } = await novoSite()
    const base = agora() - 10 * D
    // vídeo 1: leitura a cada 48 h (buraco ao redor do 7º dia, e do 1º)
    const v1 = await novoVideo(canal, base)
    for (let i = 0; i < 5; i++) await ponto(site, v1, 'daily', base + 3 * H + i * 2 * D, 1000 + i * 300)
    // vídeo 2: só série diária (sem primeiras horas): o 1º dia grava leituras_distantes (24 h > 8 h) e isso NÃO deixa vermelho
    const v2 = await novoVideo(canal, base - H)
    for (let i = 0; i < 10; i++) await ponto(site, v2, 'daily', base - H + 3 * H + i * D, 2000 + i * 100)
    const r1 = await rodar()
    expect(r1.status).toBe('erro')
    expect(r1.motivo).toBe('marcas_perdidas')
    expect(r1.numeros.perdidas_7).toBeGreaterThanOrEqual(1)
    const f2 = await faltasDe([v2])
    expect(f2.map((x) => [x.age_days, x.reason])).toEqual([[1, 'leituras_distantes']])
    expect((await marcasDe([v2])).map((m) => m.age_days)).toEqual([7])
    const r2 = await rodar()
    expect(r2.numeros.perdidas).toBe(0)
    expect(r2.status).toBe('ok')
  })

  it('a base com microssegundos faz a volta inteira pelo cliente (guarda do risco 20)', async () => {
    const { site, canal } = await novoSite()
    const base = agora() - 10 * D
    const v = await novoVideo(canal, base, { publicado: iso(base).slice(0, 19) + '.123456+00' })
    await serieCompleta(site, v, base, 4)
    const r = await rodar()
    expect(r.numeros.recusadas).toBe(0)
    expect(r.numeros.faltas_recusadas).toBe(0)
    const marcas = await marcasDe([v])
    expect(marcas.map((m) => m.age_days)).toEqual([1, 7])
  })

  it('a transmissão agendada não ganha marca; começou, ganha a marca na base nova', async () => {
    const { site, canal } = await novoSite()
    const inicio = agora() - 10 * D
    const v = await novoVideo(canal, inicio - 3 * D, { ao: 'upcoming' })
    await serieCompleta(site, v, inicio, 5)
    await rodar()
    expect(await marcasDe([v])).toHaveLength(0)
    expect(await faltasDe([v])).toHaveLength(0)
    await pg.query(`update public.competitor_videos set live_actual_start_at = $2::timestamptz, live_broadcast_content = 'none' where id = $1`, [v, iso(inicio)])
    await rodar()
    const marcas = await marcasDe([v])
    expect(marcas.map((m) => m.age_days)).toEqual([1, 7])
    for (const m of marcas) expect(Date.parse(m.age_base_at as string)).toBe(inicio)
  })

  it('curtidas interpoladas chegam inteiras ao banco', async () => {
    const { site, canal } = await novoSite()
    const base = agora() - 10 * D
    const alvo = base + 7 * D
    const v = await novoVideo(canal, base)
    // 20 h entre as vizinhas, o alvo a 30%: 70 + (80 - 70) × 0,3 = 73 (inteiro) e 1000 + 1000 × 0,3 = 1300
    await ponto(site, v, 'early', alvo - 6 * H, 1000, 70, 7)
    await ponto(site, v, 'daily', alvo + 14 * H, 2000, 80, 8)
    const r = await rodar()
    expect(r.numeros.recusadas).toBe(0)
    const m = (await marcasDe([v])).find((x) => x.age_days === 7)
    expect(m).toBeDefined()
    expect(Number(m?.views)).toBe(1300)
    expect(Number(m?.likes)).toBe(73)
    expect(Number(m?.comments)).toBe(7) // 7 + 1 × 0,3 = 7,3 → 7
  })

  it('tempo: 1.500 vídeos com 49 dias de série, três execuções, cada uma abaixo de 5 s', async () => {
    const { site, canal } = await novoSite()
    const base = agora() - 49 * D
    await pg.query(
      `insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at, view_count)
       select $1, 'e4t' || g || '${uid()}', 'sintético', $2::timestamptz + g * interval '1 second', $2::timestamptz + interval '1 hour', 10
         from generate_series(1, 1500) g`, [canal, iso(base)])
    await pg.query(
      `insert into public.competitor_video_daily (video_id, snap_date, views, taken_at)
       select v.id, (v.published_at + interval '3 hours' + i * interval '1 day')::date, 1000 + i * 100, v.published_at + interval '3 hours' + i * interval '1 day'
         from public.competitor_videos v cross join generate_series(0, 48) i where v.competitor_channel_id = $1`, [canal])
    await pg.query(
      `insert into public.competitor_video_early (video_id, taken_at, site_id, views)
       select v.id, v.published_at + h * interval '1 hour', $2, 1000 + h from public.competitor_videos v cross join (values (20), (28)) t(h) where v.competitor_channel_id = $1`, [canal, site])
    const duracoes: number[] = []
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now()
      await rodar()
      duracoes.push(Date.now() - t0)
    }
    console.info('E4 T16 tempo das três execuções (ms):', duracoes.join(', '))
    for (const d of duracoes) expect(d).toBeLessThan(5_000)
    const ids = (await rows('select id from public.competitor_videos where competitor_channel_id = $1', [canal])).map((x) => x.id as string)
    expect(ids).toHaveLength(1500)
    const m = await escalar(pg, `select count(*)::int from public.competitor_video_marks where video_id = any($1::uuid[])`, [ids])
    const f = await escalar(pg, `select count(*)::int from public.competitor_video_mark_misses where video_id = any($1::uuid[])`, [ids])
    expect(m + f).toBe(4500) // 3 idades × 1.500 vídeos, nenhum par ficou
  })
})
