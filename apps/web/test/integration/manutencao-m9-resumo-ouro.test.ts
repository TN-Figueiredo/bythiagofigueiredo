// @vitest-environment node
/** M9 Tarefa 6 (ouro): o resumo refeito em TS (expurgo-resumo.ts) contra obs_archive_summary_calc, e hashConteudo (TS) contra obs_archive_content_hash. Tudo em begin ... rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, escalar, semearCanal } from '../helpers/m3b'
import { aplicarM9 } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'
import { hashConteudo, type Celula, type UnidadeLida } from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro'
import { refazerResumo } from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-resumo'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-09-01'
type Cena = { site: string; canal: string; videos: string[] }
interface Lida { rows: Celula[][]; row_count: string; hash_conteudo: string; columns: Array<{ nome: string }> }

describe.skipIf(skipIfNoLocalDb())('M9 ouro: resumo refeito em TS contra o SQL da M3b', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: Cena) => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await aplicarM9(pg)
      const s = await semearCanal(pg, { videos: 2 })
      for (const t of ['competitor_video_hourly', 'competitor_video_early', 'competitor_video_daily'])
        await pg.query(`select obs_part.criar_particao($1::regclass, $2::date)`, [`public.${t}`, MES])
      await fn(s)
    } finally { await pg.query('rollback') }
  }

  async function semear(s: Cena): Promise<{ filho: string }> {
    const [a, b] = s.videos as [string, string]
    // diária: likes nulo em um dos extremos do vídeo b (var_likes do canal tem de sair nulo, nunca zero)
    await pg.query(`insert into public.competitor_video_daily (video_id, snap_date, views, likes, comments, taken_at)
      select v, d::date, 100 + (extract(day from d))::int * (case when v = $1::uuid then 3 else 7 end), case when v = $2::uuid and d = '2026-09-30' then null else extract(day from d)::bigint end, 1, d + interval '12 hours'
        from unnest($3::uuid[]) v, generate_series('2026-09-01'::date, '2026-09-30'::date, interval '1 day') d`, [a, b, s.videos])
    // horária: o dia de São Paulo (02:00Z de 1/10 é 30/9 em SP, dentro; 03:00Z de 1/10 já é outubro; a partição é alinhada a SP)
    for (const [v, slot, n] of [[a, '2026-09-01 03:00:00+00', 10], [a, '2026-09-01 05:00:00+00', 12], [a, '2026-09-15 12:00:00+00', 20], [b, '2026-10-01 02:00:00+00', 40], [b, '2026-09-02 09:00:00+00', 5], [a, '2026-10-01 03:00:00+00', 99]] as const)
      await pg.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views, likes, comments) values ($1, $2, $2, $3, $4, null, 2)`, [v, slot, s.site, n])
    for (const [v, t, n] of [[a, '2026-09-03 10:00:00+00', 3], [a, '2026-09-04 10:00:00+00', 8], [b, '2026-09-05 10:00:00+00', 2]] as const)
      await pg.query(`insert into public.competitor_video_early (video_id, taken_at, site_id, views, likes, comments) values ($1, $2, $3, $4, 1, 1)`, [v, t, s.site, n])
    // texto: pai de 30/9 (SP) com resposta em outubro (pertence pelo pai); raiz de setembro com acento, aspas e barra invertida
    const com = async (video: string, yt: string, parent: number | null, seen: string, body: string): Promise<number> =>
      Number((await pg.query(`insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, published_at, is_creator, first_seen_at, last_seen_at)
        values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $5::bigint is not null, $7::timestamptz, $7::timestamptz) returning id`, [s.site, s.canal, video, yt, parent, body, seen])).rows[0].id)
    const pai = await com(a, 'y1', null, '2026-09-30 23:00:00-03', 'ação "ótima" \\ fim')
    const resp = await com(a, 'y2', pai, '2026-10-02 10:00:00-03', 'resposta')
    const raiz = await com(b, 'y3', null, '2026-09-10 10:00:00-03', 'outra')
    await com(b, 'y4', null, '2026-10-10 10:00:00-03', 'fora do mês')
    for (const id of [resp, raiz]) await pg.query(`insert into public.competitor_video_comment_marks (comment_id, mark, site_id, likes) values ($1, 1, $2, 3)`, [id, s.site])
    return { filho: 'ok' }
  }

  async function ler(s: Cena, classe: string, tabela: string): Promise<{ u: UnidadeLida; hash: string; n: number }> {
    const r = (await pg.query(`select * from public.obs_archive_read_unit($1, $2, $3, $4, $5::date, 0, 50000)`, [s.site, classe, tabela, s.canal, MES])).rows[0] as Lida
    return { u: { colunas: r.columns.map(c => c.nome), linhas: r.rows }, hash: r.hash_conteudo, n: Number(r.row_count) }
  }
  const calc = async (s: Cena, classe: string, tabela: string, hash: string): Promise<{ canal: Celula[]; video: Celula[][] }> =>
    (await pg.query(`select public.obs_archive_summary_calc($1, $2, $3, $4, $5::date, $6, '1') as r`, [s.site, classe, s.canal, tabela, MES, hash])).rows[0].r

  const CASOS: Array<[string, string]> = [
    ['serie', 'competitor_video_daily'], ['horaria', 'competitor_video_hourly'], ['serie', 'competitor_video_early'],
    ['texto', 'competitor_video_comments'], ['texto', 'competitor_video_comment_marks'],
  ]

  it.each(CASOS)('%s/%s: canal e vídeo do TS iguais ao SQL, célula a célula', async (classe, tabela) => emTx(async s => {
    await semear(s)
    const com = (await ler(s, 'texto', 'competitor_video_comments')).u
    const { u, hash, n } = await ler(s, classe, tabela)
    expect(n).toBeGreaterThan(0)
    const sql = await calc(s, classe, tabela, hash)
    const ts = refazerResumo({ classe, canal: s.canal, mes: '2026-09', diasDoMes: 30, versao: 1, unidades: [{ tabela, unidade: u, hashConteudo: hash }], vazias: [], comentarios: com })
    expect(ts.canal).toEqual([sql.canal])
    expect(ts.video).toEqual(sql.video)
  }))

  it('diária: var_likes nulo quando um extremo é nulo (nunca zero), nos dois lados', async () => emTx(async s => {
    await semear(s)
    const { u, hash } = await ler(s, 'serie', 'competitor_video_daily')
    const sql = await calc(s, 'serie', 'competitor_video_daily', hash)
    const ts = refazerResumo({ classe: 'serie', canal: s.canal, mes: '2026-09', diasDoMes: 30, versao: 1, unidades: [{ tabela: 'competitor_video_daily', unidade: u, hashConteudo: hash }], vazias: [] })
    expect(sql.canal[10]).toBeNull()
    expect(ts.canal[0]![10]).toBeNull()
  }))

  it('unidade vazia do canal: linha de contagem zero igual ao SQL', async () => emTx(async s => {
    const { u, hash, n } = await ler(s, 'serie', 'competitor_video_early')
    expect(n).toBe(0)
    const sql = await calc(s, 'serie', 'competitor_video_early', hash)
    const ts = refazerResumo({
      classe: 'serie', canal: s.canal, mes: '2026-09', diasDoMes: 30, versao: 1, unidades: [],
      vazias: [{ tabela: 'competitor_video_early', hashConteudo: hash }],
    })
    expect(u.linhas).toEqual([])
    // todas vazias: o resumo do TS é "vazio" sem linhas (02 §10.4); o SQL de summary_rows faz o mesmo. A linha por tabela só existe quando há outra com dado.
    expect(ts).toMatchObject({ vazio: true, canal: [], video: [] })
    expect(sql.canal.slice(3, 6)).toEqual(['0', '0', '0'])
    expect(sql.canal.slice(7, 12)).toEqual([null, null, null, null, null])
  }))

  it('vazia ao lado de uma com dado: a linha da vazia é igual à do SQL', async () => emTx(async s => {
    await semear(s)
    const d = await ler(s, 'serie', 'competitor_video_daily')
    await pg.query(`delete from public.competitor_video_early`)
    const e = await ler(s, 'serie', 'competitor_video_early')
    const sqlE = await calc(s, 'serie', 'competitor_video_early', e.hash)
    const ts = refazerResumo({
      classe: 'serie', canal: s.canal, mes: '2026-09', diasDoMes: 30, versao: 1,
      unidades: [{ tabela: 'competitor_video_daily', unidade: d.u, hashConteudo: d.hash }], vazias: [{ tabela: 'competitor_video_early', hashConteudo: e.hash }],
    })
    expect(ts.canal.find(l => l[1] === 'competitor_video_early')).toEqual(sqlE.canal)
  }))

  it('Phil I5: hashConteudo (TS) igual a obs_archive_content_hash e ao read_unit, com null, aspas, barra e acento', async () => emTx(async s => {
    await semear(s)
    for (const [classe, tabela] of CASOS) {
      const { u, hash } = await ler(s, classe, tabela)
      const sqlHash = await escalar<string>(pg, `select hash_conteudo from public.obs_archive_content_hash($1, $2, $3, $4, $5::date)`, [s.site, classe, tabela, s.canal, MES])
      expect(hashConteudo(u.linhas), tabela).toBe(sqlHash)
      expect(sqlHash).toBe(hash)
    }
    const com = (await ler(s, 'texto', 'competitor_video_comments')).u
    expect(JSON.stringify(com.linhas)).toContain('ação')
    expect(com.linhas.some(l => l.some(c => c === null))).toBe(true)
  }))
})
