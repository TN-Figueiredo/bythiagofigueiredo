// apps/web/test/integration/manutencao-m6-hash.test.ts
// @vitest-environment node
/** M6 parte 1 (plano M6, Tarefa 1): o hash sobre a partição e sobre a tabela destacada é o MESMO da tabela-mãe. Banco: bythiago_int, begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, q1, tenta, semearCanal, semearDiaria } from '../helpers/m3b'
import { prepararM6, particaoDe } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'

describe.skipIf(skipIfNoLocalDb())('M6 parte 1: hash sobre relação', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 1); await f() } finally { await c.query('rollback') }
  }

  it('com p_rel nulo, unit_source_rel é idêntico a unit_source em toda linha de partição da política', async () => {
    await emTransacao(async () => {
      const r = await c.query(`select p.class, p.table_name,
          (select row(s.*)::text from public.obs_archive_unit_source(p.class, p.table_name) s) as a,
          (select row(s.*)::text from public.obs_archive_unit_source_rel(p.class, p.table_name, null) s) as b
        from public.obs_archive_policy() p where p.exit_mode = 'particao'`)
      expect(r.rows.length).toBe(4)
      for (const x of r.rows) expect(x.b, `${x.class}/${x.table_name}`).toBe(x.a)
    })
  })

  it('o hash na mãe, na partição anexada e na tabela destacada (_saida) é o mesmo, para cada canal', async () => {
    await emTransacao(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 4 })
      await semearDiaria(c, videos, '2026-10-01', 31)
      const mae = await q1(c, `select * from public.obs_archive_content_hash($1, 'serie', 'competitor_video_daily', $2, $3)`, [site, canal, MES])
      const part = particaoDe('competitor_video_daily', MES)
      const anexada = await q1(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, part, canal, MES])
      expect(anexada).toEqual(mae)
      expect(Number(mae.row_count)).toBe(124)
      await c.query(`alter table public.competitor_video_daily detach partition ${part}`)
      await c.query(`alter table ${part} rename to competitor_video_daily_202610_saida`)
      const saida = await q1(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', 'obs_part.competitor_video_daily_202610_saida'::regclass, $2, $3)`, [site, canal, MES])
      expect(saida).toEqual(mae)
    })
  })

  it('o dado não existe: canal sem linha no mês dá 0 linhas e o hash da string vazia, igual ao da mãe', async () => {
    await emTransacao(async () => {
      const { site, canal } = await semearCanal(c, { videos: 1 })
      await semearDiaria(c, [], '2026-10-01', 1)
      const part = particaoDe('competitor_video_daily', MES)
      const a = await q1(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, part, canal, MES])
      const b = await q1(c, `select * from public.obs_archive_content_hash($1, 'serie', 'competitor_video_daily', $2, $3)`, [site, canal, MES])
      expect(a).toEqual(b)
      expect(Number(a.row_count)).toBe(0)
    })
  })

  it('relação fora do contrato é recusada: outra tabela, outro schema, tabela de texto', async () => {
    await emTransacao(async () => {
      const r1 = await tenta(c, `select * from public.obs_archive_unit_source_rel('serie', 'competitor_video_daily', 'public.competitor_videos'::regclass)`)
      expect(r1).toMatchObject({ ok: false, message: expect.stringContaining('relacao_invalida') })
      const r2 = await tenta(c, `select * from public.obs_archive_unit_source_rel('texto', 'competitor_raw', 'public.competitor_raw'::regclass)`)
      expect(r2).toMatchObject({ ok: false, message: expect.stringContaining('relacao_so_em_particao') })
      const r3 = await tenta(c, `select * from public.obs_archive_unit_source_rel('serie', 'competitor_video_daily', '${particaoDe('competitor_video_early', MES)}'::regclass)`)
      expect(r3).toMatchObject({ ok: false, message: expect.stringContaining('relacao_invalida') })
    })
  })

  it('as funções de relação não têm execute para anon, authenticated nem service_role', async () => {
    await emTransacao(async () => {
      for (const papel of ['anon', 'authenticated', 'service_role']) {
        expect(await escalar<boolean>(c, `select has_function_privilege($1, 'public.obs_archive_content_hash_rel(uuid, text, text, regclass, uuid, date)', 'execute')`, [papel]), papel).toBe(false)
        expect(await escalar<boolean>(c, `select has_function_privilege($1, 'public.obs_archive_unit_source_rel(text, text, regclass)', 'execute')`, [papel]), papel).toBe(false)
        expect(await escalar<boolean>(c, `select has_function_privilege($1, 'public.obs_archive_row_digest_rel(uuid, text, text, regclass, uuid, date)', 'execute')`, [papel]), papel).toBe(false)
      }
    })
  })

  it('C-1: o resumo da linha inteira é igual na mãe, na partição e na _saida, e muda com uma coluna que não é a de controle (likes), sem mexer em contagem nem soma', async () => {
    await emTransacao(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 3 })
      await semearDiaria(c, videos, MES, 31)
      const part = particaoDe('competitor_video_daily', MES)
      const dig = (rel: string | null): Promise<string> => escalar<string>(c, `select public.obs_archive_row_digest_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)::text`, [site, rel, canal, MES])
      const mae = await dig(null)
      expect(await dig(part)).toBe(mae)
      expect(Number(mae)).not.toBe(0)
      const antes = await q1(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, part, canal, MES])
      await c.query(`update public.competitor_video_daily set likes = coalesce(likes, 0) + 7 where video_id = $1 and snap_date = '2026-10-05'`, [videos[0]])
      const depois = await q1(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, part, canal, MES])
      expect(depois.row_count).toBe(antes.row_count)
      expect(depois.control_sum).toBe(antes.control_sum)          // a coluna de controle (views) não mudou
      const novo = await dig(part)
      expect(novo).not.toBe(mae)                                      // o resumo da linha inteira pega
      await c.query(`alter table public.competitor_video_daily detach partition ${part}`)
      await c.query(`alter table ${part} rename to competitor_video_daily_202610_saida`)
      expect(await dig('obs_part.competitor_video_daily_202610_saida')).toBe(novo)   // a tabela destacada dá o mesmo resumo da partição anexada
    })
  })

  it('m-13: relação de outro mês é recusada (o sufixo AAAAMM tem de ser o do mês pedido)', async () => {
    await emTransacao(async () => {
      const { site, canal } = await semearCanal(c, { videos: 1 })
      await c.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, '2026-09-01')`)
      const set = particaoDe('competitor_video_daily', '2026-09-01')
      const r1 = await tenta(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, set, canal, MES])
      expect(r1).toMatchObject({ ok: false, message: expect.stringContaining('relacao_invalida') })
      const r2 = await tenta(c, `select public.obs_archive_row_digest_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, set, canal, MES])
      expect(r2).toMatchObject({ ok: false, message: expect.stringContaining('relacao_invalida') })
    })
  })

  it('m-6: guarda de texto: o hash sobre relação e o leitor da M3b serializam a linha com a MESMA expressão (dívida declarada)', async () => {
    await emTransacao(async () => {
      const a = await escalar<string>(c, `select prosrc from pg_proc where oid = 'public.obs_archive_content_hash_rel(uuid, text, text, regclass, uuid, date)'::regprocedure`)
      const b = await escalar<string>(c, `select prosrc from pg_proc where proname = 'obs_archive_read_unit' and pronamespace = 'public'::regnamespace`)
      const ex = 'to_jsonb(array[%1$s]::text[])'
      expect(a).toContain(ex)
      expect(b).toContain(ex)
    })
  })
})
