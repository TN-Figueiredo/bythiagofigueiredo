// apps/web/test/integration/manutencao-m6-invariante.test.ts
// @vitest-environment node
/**
 * M6 parte 2 (plano M6, Tarefa 2; itens 126 e 127): com mês destacado, nada apaga vídeo nem canal, por nenhum caminho; fora dele, nada muda.
 * O destaque aqui é só a marca no registro (detached_at): a tabela destacada de verdade e a contagem dela são da Tarefa 4.
 * begin … rollback; nunca deixa mês destacado confirmado (as limpezas da E14/E16 apagam canais).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, tenta, semearCanal, SITE_TESTE } from '../helpers/m3b'
import { prepararM6, apagarCanalDeclarando, novoAdmin } from '../helpers/m6'   // emenda 23/10 (N-M6-1): `admin = await novoAdmin(c, SITE_TESTE)` dentro de cada `emTransacao` que apaga canal

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const GATILHOS = [
  'competitor_channels.obs_archive_a_mes_destacado', 'competitor_channels.obs_archive_a_mes_destacado_truncate',
  'competitor_videos.obs_archive_a_mes_destacado', 'competitor_videos.obs_archive_a_mes_destacado_truncate',
]

// desvio (128): o grep ignora a leitura `read only` do export (src/lib/youtube/observatorio/arquivo/sessao.ts), que não apaga nada.
describe.skipIf(skipIfNoLocalDb())('M6 parte 2: o invariante do mês destacado', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try {
      await prepararM6(c, 2)
      // desvio: o banco int guarda o seed do e2e da M5 (mês destacado de 2028, commitado); aqui ele só vale dentro desta transação
      await c.query(`update public.obs_archive_months set dropped_at = now() where detached_at is not null and dropped_at is null`)
      await f()
    } finally { await c.query('rollback') }
  }
  async function destacar(site: string, classe = 'serie', tabela = 'competitor_video_daily', mes = '2026-10-01'): Promise<void> {
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, detached_at) values ($1, $2, $3, $4, now())
                   on conflict (site_id, class, table_name, month) do update set detached_at = now(), dropped_at = null`, [site, classe, tabela, mes])
  }

  it('catálogo: os quatro gatilhos existem, ligados, com a função volatile, security definer e search_path vazio', async () => {
    await emTransacao(async () => {
      expect(await escalar<string[]>(c, `select public.obs_archive_invariante_faltam()`)).toEqual([])
      const f = (await c.query(`select provolatile, prosecdef, proconfig from pg_proc where oid = 'public.obs_archive_block_delete_while_detached()'::regprocedure`)).rows[0]
      expect(f).toEqual({ provolatile: 'v', prosecdef: true, proconfig: ['search_path=""'] })
    })
  })

  it('ordem: o gatilho do mês destacado dispara ANTES dos da M3b (ordem alfabética do nome)', async () => {
    await emTransacao(async () => {
      const del = (await c.query(`select tgname from pg_trigger where tgrelid = 'public.competitor_channels'::regclass and not tgisinternal
                                    and (tgtype & 2) = 2 and (tgtype & 8) = 8 and (tgtype & 1) = 1 order by tgname`)).rows.map(r => r.tgname as string)
      expect(del.indexOf('obs_archive_a_mes_destacado')).toBeGreaterThanOrEqual(0)
      expect(del.indexOf('obs_archive_a_mes_destacado')).toBeLessThan(del.indexOf('obs_archive_z_destino_declarado'))
      const tru = (await c.query(`select tgname from pg_trigger where tgrelid = 'public.competitor_channels'::regclass and not tgisinternal
                                    and (tgtype & 2) = 2 and (tgtype & 32) = 32 order by tgname`)).rows.map(r => r.tgname as string)
      expect(tru.indexOf('obs_archive_a_mes_destacado_truncate')).toBeLessThan(tru.indexOf('obs_archive_z_truncate'))
    })
  })

  it('tgenabled D ou R conta como ausente; O e A, como ligado', async () => {
    await emTransacao(async () => {
      await c.query(`alter table public.competitor_videos disable trigger obs_archive_a_mes_destacado`)
      expect(await escalar<string[]>(c, `select public.obs_archive_invariante_faltam()`)).toEqual(['competitor_videos.obs_archive_a_mes_destacado'])
      await c.query(`alter table public.competitor_videos enable replica trigger obs_archive_a_mes_destacado`)
      expect(await escalar<string[]>(c, `select public.obs_archive_invariante_faltam()`)).toEqual(['competitor_videos.obs_archive_a_mes_destacado'])
      await c.query(`alter table public.competitor_videos enable always trigger obs_archive_a_mes_destacado`)
      expect(await escalar<string[]>(c, `select public.obs_archive_invariante_faltam()`)).toEqual([])
      await c.query(`drop trigger obs_archive_a_mes_destacado_truncate on public.competitor_channels`)
      expect(await escalar<string[]>(c, `select public.obs_archive_invariante_faltam()`)).toEqual(['competitor_channels.obs_archive_a_mes_destacado_truncate'])
    })
  })

  it('126: com mês destacado, (a) delete de vídeo, (b) delete de canal, (c) cascata com o gatilho do canal desligado, (d) função security definer, (e) truncate: todos recusam e nada some', async () => {
    await emTransacao(async () => {
      const { canal, videos } = await semearCanal(c, { videos: 2 })
      await destacar(SITE_TESTE)
      const antes = await escalar<string>(c, `select count(*)::text from public.competitor_videos where competitor_channel_id = $1`, [canal])
      const casos: Array<[string, string]> = [
        ['a', `delete from public.competitor_videos where id = '${videos[0]}'`],
        ['b', `delete from public.competitor_channels where id = '${canal}'`],
        ['e1', `truncate public.competitor_videos cascade`],
        ['e2', `truncate public.competitor_channels cascade`],
      ]
      for (const [nome, sql] of casos) {
        const r = await tenta(c, sql)
        expect(r, nome).toMatchObject({ ok: false, code: 'P0001', message: 'mes_destacado_em_transito' })
      }
      await c.query(`alter table public.competitor_channels disable trigger obs_archive_a_mes_destacado`)
      // desvio (c): com a M3b aplicada o z_destino_declarado dispararia antes e recusaria por outro motivo; declara o destino para a cascata chegar ao vídeo
      await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, declared_xid)
        values ($1, $2, 'botao', 'apagar', now(), true, pg_current_xact_id())`, [SITE_TESTE, canal])
      const rc = await tenta(c, `delete from public.competitor_channels where id = $1`, [canal])
      expect(rc, 'c').toMatchObject({ ok: false, message: 'mes_destacado_em_transito' })
      await c.query(`alter table public.competitor_channels enable trigger obs_archive_a_mes_destacado`)
      // desvio (d): função em pg_temp chamada como service_role derrubou o Postgres (SIGSEGV); a função de teste vai em public, com execute dado, e a transação a desfaz
      await c.query(`create function public.m6_apaga_canal_teste(p uuid) returns void language sql security definer set search_path = '' as $f$ delete from public.competitor_channels where id = p $f$`)
      await c.query(`grant execute on function public.m6_apaga_canal_teste(uuid) to service_role`)
      await c.query(`set local role service_role`)
      const rd = await tenta(c, `select public.m6_apaga_canal_teste($1)`, [canal])
      await c.query(`reset role`)
      expect(rd, 'd').toMatchObject({ ok: false, message: 'mes_destacado_em_transito' })
      expect(await escalar<string>(c, `select count(*)::text from public.competitor_videos where competitor_channel_id = $1`, [canal])).toBe(antes)
    })
  })

  it('o detail traz a tabela e o mês (mm/aaaa) de cada mês destacado; vale para outro site e para a classe ensaio', async () => {
    await emTransacao(async () => {
      const { canal } = await semearCanal(c, { videos: 1 })
      await destacar('00000000-0000-0000-0000-0000000000f1', 'ensaio', 'obs_archive_rehearsal', '2026-03-01')
      await destacar('00000000-0000-0000-0000-0000000000f2', 'serie', 'competitor_video_early', '2026-11-01')
      await c.query('savepoint s')
      try { await c.query(`delete from public.competitor_channels where id = $1`, [canal]); throw new Error('não recusou') } catch (e) {
        const d = (e as { detail?: string }).detail ?? ''
        expect(d).toContain('obs_archive_rehearsal 03/2026')
        expect(d).toContain('competitor_video_early 11/2026')
      }
      await c.query('rollback to savepoint s')
    })
  })

  it('127: sem mês destacado, depois de descartado (dropped_at) e depois de trazido de volta (detached_at nulo), apagar funciona como hoje', async () => {
    await emTransacao(async () => {
      const a = await semearCanal(c, { videos: 1 })
      expect(await tenta(c, `delete from public.competitor_videos where id = $1`, [a.videos[0]])).toMatchObject({ ok: true })
      await destacar(SITE_TESTE)
      await c.query(`update public.obs_archive_months set dropped_at = now() where site_id = $1`, [SITE_TESTE])
      const admin = await novoAdmin(c, SITE_TESTE)
      const b = await semearCanal(c, { videos: 1 })
      await apagarCanalDeclarando(c, SITE_TESTE, b.canal, admin)    // emenda 23/10 (N-M6-1): delete cru recusa com a M3b aplicada
      await c.query(`update public.obs_archive_months set dropped_at = null, detached_at = null where site_id = $1`, [SITE_TESTE])
      const d = await semearCanal(c, { videos: 1 })
      await apagarCanalDeclarando(c, SITE_TESTE, d.canal, admin)    // idem: se a função recusar, o teste falha (ela levanta)
    })
  })

  // emenda 23/10 (Yannis N-M6-2, Phil N6-2): os dois chamadores da E9 já em produção passam pelo invariante
  it('126b: com mês destacado, competitor_video_purge e competitor_channel_purge (E9) recusam com mes_destacado_em_transito e nada some', async () => {
    // rodada 0.7 (Phil C2, Yannis C-C): assinatura REAL de 6 argumentos (origin/staging:supabase/migrations/20261015000001_*.sql:267-269, 362-364):
    // (p_site uuid, p_video|p_channel uuid, p_actor uuid, p_janela_min integer, p_ip text, p_ua text). O ator é uuid ('teste' dá 22P02).
    // As duas devolvem {status:'no_ar'} sem erro se missing_since é nulo: o delete (onde o gatilho a_ levanta) nunca roda. Por isso o vídeo
    // e o canal entram em missing_since ANTES. Cada `tenta` roda em savepoint (conferir no helper `tenta`; se não abrir, o 2º select roda
    // numa transação abortada).
    await emTransacao(async () => {
      const { canal, videos } = await semearCanal(c, { videos: 1 })
      const admin = await novoAdmin(c, SITE_TESTE)
      await c.query(`update public.competitor_videos set missing_since = current_date - 40 where id = $1`, [videos[0]])
      await c.query(`update public.competitor_channels set missing_since = current_date - 40 where id = $1`, [canal])
      await destacar(SITE_TESTE)
      for (const sql of [
        `select public.competitor_video_purge('${SITE_TESTE}', '${videos[0]}', '${admin}', 30, '127.0.0.1', 'teste')`,
        `select public.competitor_channel_purge('${SITE_TESTE}', '${canal}', '${admin}', 30, '127.0.0.1', 'teste')`,
      ]) {
        const r = await tenta(c, sql)
        expect(r).toMatchObject({ ok: false })
        expect(JSON.stringify(r)).toContain('mes_destacado_em_transito')
      }
      expect(await escalar<string>(c, `select count(*)::text from public.competitor_videos where id = $1`, [videos[0]])).toBe('1')
      expect(await escalar<string>(c, `select count(*)::text from public.competitor_channels where id = $1`, [canal])).toBe('1')
    })
  })
  // 126b, mutantes: tirar os dois `update ... missing_since` faz o teste cair com `no_ar`, sem a palavra mes_destacado_em_transito; sem o `destacar`,
  // a mesma chamada devolve ok.

  it('89: unidade nova de mês destacado (expurgo, reexportação) é recusada', async () => {
    await emTransacao(async () => {
      const { canal } = await semearCanal(c, { videos: 1 })
      await destacar(SITE_TESTE)
      const r = await tenta(c, `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp)
        values ($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 2, 0, 0, repeat('0', 64), repeat('0', 64))`, [SITE_TESTE, canal])
      expect(r).toMatchObject({ ok: false, message: 'mes_destacado_em_transito' })
    })
  })

  it('128 (guarda): nenhum caminho que apaga vídeo ou canal abre transação acima de read committed', async () => {
    const { execSync } = await import('node:child_process')
    const achados = execSync(`grep -rnE "isolation level (repeatable read|serializable)" ../../supabase/migrations ../../supabase/rascunhos src lib | grep -v "read only" || true`, { cwd: process.cwd(), encoding: 'utf8' }).trim()
    expect(achados).toBe('')
  })
})
