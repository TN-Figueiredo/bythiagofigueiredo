// @vitest-environment node
/**
 * M3b-recusa (D-M9-26 antecipada): enquanto a M9 não existe, o banco recusa apagar vídeo e comentário do site que a M3b já tocou.
 * Plano: .superpowers/sdd/manutencao-nas/plano-m3b-recusa-2510.md (Yannis) + revisão do Phil (M1 lock/volatile, M2, M3, I1).
 * Cada caso em begin … rollback; nada confirmado no banco compartilhado.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM3b, m3bNoBanco, semearCanal, escalar, tenta } from '../helpers/m3b'
import { criarUsuario } from '../helpers/mg6'
import { aplicarRecusa, desfazerRecusa, RECUSA_SQL, MD5_PARTIDA, MD5_COM_RECUSA, MD5_HELPER } from '../helpers/m3b-recusa'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const ASSIN_VIDEO = 'public.competitor_video_purge(uuid,uuid,uuid,integer,text,text)'
const ASSIN_COMENT = 'public.competitor_comments_purge(uuid,uuid,bigint[],uuid,text,text)'
const HELPER = 'public.obs_archive_m9_pronto(uuid)'

type Cena = { site: string; canal: string; video: string; videoNoAr: string; comentario: string; actor: string }

describe.skipIf(skipIfNoLocalDb())('M3b-recusa: o banco recusa apagar vídeo e comentário depois que a M3b tocou o site', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: Cena) => Promise<void>, o: { recusa?: boolean } = {}): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')   // TRAVA_DDL_TESTES na 1ª instrução
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      if (o.recusa !== false) await aplicarRecusa(pg)   // idempotente: vale também com a migration já aplicada (CI)
      const s = await semearCanal(pg, { videos: 2 })
      await pg.query(`update public.competitor_videos set missing_since = current_date - 3 where id = $1`, [s.videos[0]])
      const actor = await criarUsuario(pg)
      const comentario = (await pg.query(
        `insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, body, is_creator, published_at, first_seen_at, last_seen_at, missing_since)
         values ($1, $2, $3, 'cm' || substr(md5(gen_random_uuid()::text), 1, 10), 'sintético', false, now() - interval '5 days', now() - interval '5 days', now() - interval '3 days', current_date - 3) returning id`,
        [s.site, s.canal, s.videos[1]])).rows[0].id as string
      await fn({ site: s.site, canal: s.canal, video: s.videos[0], videoNoAr: s.videos[1], comentario, actor })
    } finally { await pg.query('rollback') }
  }

  const unidade = (c: Cena, site = c.site) => pg.query(
    `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
     values ($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 1, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, now())`, [site, c.canal])
  const switchDe = (site: string, colunas: string) => pg.query(`insert into public.obs_archive_switch (site_id, class, ${colunas.split('=')[0]}) values ($1, 'serie', ${colunas.split('=')[1]})`, [site])

  /** Chama a função da E9 como service_role (o papel real) e devolve { status } ou { code, message }. */
  async function apagarVideo(c: Cena, video = c.video) {
    await pg.query('set local role service_role')
    try {
      const r = await tenta(pg, `select (public.competitor_video_purge($1, $2, $3, 60, '203.0.113.7', 'ua'))->>'status' as st`, [c.site, video, c.actor])
      return r.ok ? { st: r.rows[0].st as string } : { code: r.code, message: r.message }
    } finally { await pg.query('reset role') }
  }
  async function apagarComentarios(c: Cena, ids: string[] = [c.comentario]) {
    await pg.query('set local role service_role')
    try {
      const r = await tenta(pg, `select (public.competitor_comments_purge($1, $2, $3::bigint[], $4, '203.0.113.7', 'ua'))->>'status' as st`, [c.site, c.canal, ids, c.actor])
      return r.ok ? { st: r.rows[0].st as string } : { code: r.code, message: r.message }
    } finally { await pg.query('reset role') }
  }
  const contagens = async (c: Cena) => ({
    videos: await escalar<number>(pg, `select count(*)::int from public.competitor_videos where competitor_channel_id = $1`, [c.canal]),
    comentarios: await escalar<number>(pg, `select count(*)::int from public.competitor_video_comments where competitor_channel_id = $1`, [c.canal]),
    removidos: await escalar<number>(pg, `select count(*)::int from public.competitor_removed_items where site_id = $1`, [c.site]),
    auditoria: await escalar<number>(pg, `select count(*)::int from public.audit_log where site_id = $1`, [c.site]),
  })
  const recusado = { code: 'P0001', message: 'm9_desligada' }
  async function afirmarRecusa(c: Cena) {
    const antes = await contagens(c)
    expect(await apagarVideo(c)).toMatchObject(recusado)
    expect(await apagarComentarios(c)).toMatchObject(recusado)
    expect(await contagens(c)).toEqual(antes)
  }
  async function afirmarApaga(c: Cena) {
    expect(await apagarVideo(c)).toEqual({ st: 'apagado' })
    expect(await apagarComentarios(c)).toEqual({ st: 'apagado' })
  }

  it('1. sem unidade e sem switch: apaga', async () => { await emTx(async c => { await afirmarApaga(c) }) })

  it('2. com unidade do site: recusa (P0001 m9_desligada), sem apagar, sem lista, sem auditoria', async () => {
    await emTx(async c => { await unidade(c); await afirmarRecusa(c) })
  })

  it('3. switch com armed_at, sem unidade: recusa', async () => {
    await emTx(async c => { await switchDe(c.site, 'armed_at=now()'); await afirmarRecusa(c) })
  })

  it('4. switch só com first_month_at (a janela do 1º plano): recusa', async () => {
    await emTx(async c => { await switchDe(c.site, 'first_month_at=now()'); await afirmarRecusa(c) })
  })

  it('5. switch só com disarmed_at, switch de outro site e unidade de outro site: apaga (isolamento por site_id)', async () => {
    await emTx(async c => { await switchDe(c.site, 'disarmed_at=now()'); await afirmarApaga(c) })
    await emTx(async c => { await switchDe(randomUUID(), 'armed_at=now()'); await afirmarApaga(c) })
    await emTx(async c => { await unidade(c, randomUUID()); await afirmarApaga(c) })
  })

  it('6. as saídas antecipadas não mudam (a recusa vem depois delas)', async () => {
    await emTx(async c => {
      await unidade(c)
      expect(await apagarVideo(c, randomUUID())).toEqual({ st: 'not_found' })
      expect(await apagarVideo(c, c.videoNoAr)).toEqual({ st: 'no_ar' })
      expect(await apagarComentarios(c, ['999999999'])).toEqual({ st: 'not_found' })
    })
  })

  /** Apaga o canal pela E9 (fila) como service_role. */
  async function apagarCanal(c: Cena) {
    await pg.query('set local role service_role')
    try { return await tenta(pg, `select (public.competitor_channel_purge($1, $2, $3, 60, '203.0.113.7', 'ua'))->>'status' as st`, [c.site, c.canal, c.actor]) } finally { await pg.query('reset role') }
  }
  /** Prepara o caso 7: admin do site, canal ausente do YouTube, e unidade de OUTRO canal do mesmo site (Yannis I2: o site fica tocado pela M3b, o canal apagado não tem unidade). */
  async function prepararCanalSemUnidade(c: Cena): Promise<void> {
    const org = await escalar<string>(pg, `select org_id from public.sites where id = $1`, [c.site])
    await pg.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, c.actor])
    await pg.query(`update public.competitor_channels set missing_since = current_date - 3 where id = $1`, [c.canal])
    const outro = await semearCanal(pg, { site: c.site, videos: 0 })
    await unidade({ ...c, canal: outro.canal })
    expect(await escalar<boolean>(pg, `select exists (select 1 from public.obs_archive_units where site_id = $1)`, [c.site])).toBe(true)   // o helper levantaria para este site
  }

  it('7. apagar canal não é recusado: a E9 do canal declara o destino e o corpo não tem o helper (site tocado por unidade de outro canal)', async () => {
    await emTx(async c => {
      // o canal apagado não tem unidade (com unidade só sai por Guardar: manutencao-m3b-apagar-com-arquivo.test.ts)
      await prepararCanalSemUnidade(c)
      const r = await apagarCanal(c)
      expect(r).toMatchObject({ ok: true })
      expect((r as { rows: { st: string }[] }).rows[0].st).toBe('apagado')
      const decisao = (await pg.query(`select archive_decision, removed_via from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [c.site, c.canal])).rows[0]
      expect(decisao).toEqual({ archive_decision: 'apagar', removed_via: 'fila' })
      for (const f of ['competitor_channel_purge', 'competitor_channel_remove']) {
        expect(await escalar<boolean>(pg, `select prosrc like '%obs_archive_m9_pronto%' from pg_proc where proname = $1`, [f])).toBe(false)
      }
    })
  })

  it('7b. mutante: com o helper injetado em competitor_channel_remove, o caso 7 cai com m9_desligada', async () => {
    await emTx(async c => {
      await prepararCanalSemUnidade(c)
      const def = await escalar<string>(pg, `select pg_get_functiondef('public.competitor_channel_remove(uuid,uuid,text,text,uuid)'::regprocedure)`)
      const mutante = def.replace(/\nbegin\n/, '\nbegin\n  perform public.obs_archive_m9_pronto(p_site);\n')
      expect(mutante).not.toBe(def)
      await pg.query(mutante)
      expect(await apagarCanal(c)).toMatchObject({ ok: false, message: 'm9_desligada' })
    })
  })

  it('8. injeção: idempotente, posição, md5, assinatura, privilégios, e o helper (volatile + lock + md5 + search_path)', async () => {
    await emTx(async () => {
      await aplicarRecusa(pg)   // 2ª aplicação (a 1ª foi no emTx)
      const corpo = async (nome: string) => (await pg.query(`select prosrc from pg_proc where proname = $1`, [nome])).rows[0].prosrc as string
      for (const [nome, ancora, md5] of [
        ['competitor_video_purge', 'delete from public.competitor_videos v where v.id = p_video;', MD5_COM_RECUSA.video],
        ['competitor_comments_purge', 'insert into public.competitor_removed_items as r', MD5_COM_RECUSA.comentarios],
      ] as const) {
        const p = await corpo(nome)
        expect(p.split('obs_archive_m9_pronto').length - 1).toBe(1)
        expect(p.indexOf('obs_archive_m9_pronto')).toBeLessThan(p.indexOf(ancora))
        expect(await escalar<string>(pg, `select md5(prosrc) from pg_proc where proname = $1`, [nome])).toBe(md5)
      }
      for (const assin of [ASSIN_VIDEO, ASSIN_COMENT]) {
        expect(await escalar<boolean>(pg, `select prosecdef from pg_proc where oid = $1::regprocedure`, [assin])).toBe(false)
        expect(await escalar<number>(pg, `select pronargs::int from pg_proc where oid = $1::regprocedure`, [assin])).toBe(6)
      }
      for (const assin of [ASSIN_VIDEO, ASSIN_COMENT, HELPER]) {
        expect(await escalar<boolean>(pg, `select has_function_privilege('service_role', $1::regprocedure, 'EXECUTE')`, [assin])).toBe(true)
        expect(await escalar<boolean>(pg, `select has_function_privilege('anon', $1::regprocedure, 'EXECUTE')`, [assin])).toBe(false)
        expect(await escalar<boolean>(pg, `select has_function_privilege('authenticated', $1::regprocedure, 'EXECUTE')`, [assin])).toBe(false)
      }
      // o helper: Phil I1 (corpo byte a byte), M1 (volatile + lock share), M2 (proconfig comparado no SQL)
      expect(await escalar<string>(pg, `select md5(prosrc) from pg_proc where oid = $1::regprocedure`, [HELPER])).toBe(MD5_HELPER)
      expect(await escalar<string>(pg, `select provolatile::text from pg_proc where oid = $1::regprocedure`, [HELPER])).toBe('v')
      expect(await escalar<boolean>(pg, `select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = $1::regprocedure`, [HELPER])).toBe(true)
      expect(await escalar<boolean>(pg, `select prosrc like '%lock table public.obs_archive_switch in share mode%' from pg_proc where oid = $1::regprocedure`, [HELPER])).toBe(true)
      await pg.query(`select ${HELPER.replace('(uuid)', '')}($1)`, [randomUUID()])   // sem unidade e sem switch: volta vazio, e segura o lock
      expect(await escalar<number>(pg, `select count(*)::int from pg_locks where relation = 'public.obs_archive_switch'::regclass and pid = pg_backend_pid() and mode = 'ShareLock'`)).toBe(1)
    })
  })

  it('9. fail-closed: corpo diferente, âncora ausente, função ausente, M3b ausente', async () => {
    await emTx(async () => {
      await desfazerRecusa(pg)
      const def = async () => (await pg.query(`select pg_get_functiondef($1::regprocedure) as d`, [ASSIN_VIDEO])).rows[0].d as string
      const d0 = await def()
      // (a) md5 diferente: um espaço a mais depois do begin
      await pg.query(d0.replace(/\nbegin\n/, '\nbegin \n'))
      await pg.query('savepoint a')
      const a = await tenta(pg, RECUSA_SQL())
      expect(a).toMatchObject({ ok: false, code: 'P0001', message: 'm3b_recusa_e9_mudou' })
      await pg.query('rollback to savepoint a')
      // (b) âncora ausente, com o md5 do corpo alterado declarado como esperado (isola a checagem da âncora)
      await pg.query(d0.replace('delete from public.competitor_videos v where v.id = p_video;', 'delete from public.competitor_videos v where v.id = p_video ;'))
      const md5Alterado = await escalar<string>(pg, `select md5(prosrc) from pg_proc where oid = $1::regprocedure`, [ASSIN_VIDEO])
      const b = await tenta(pg, RECUSA_SQL().replace(MD5_PARTIDA.video, md5Alterado))
      expect(b).toMatchObject({ ok: false, code: 'P0001', message: 'm3b_recusa_ancora' })
      // (c) função ausente
      await pg.query(`drop function ${ASSIN_VIDEO}`)
      const c = await tenta(pg, RECUSA_SQL())
      expect(c).toMatchObject({ ok: false, code: 'P0001', message: 'm3b_recusa_sem_e9' })
    })
    await emTx(async () => {
      await pg.query('alter table public.obs_archive_units rename to obs_archive_units_x')
      const d = await tenta(pg, RECUSA_SQL())
      expect(d).toMatchObject({ ok: false, code: 'P0001', message: 'm3b_recusa_sem_m3b' })
    })
  })

  it('10. mutante: sem a injeção nas funções da E9, o caso 2 cai (as duas apagam)', async () => {
    await emTx(async c => { await unidade(c); await desfazerRecusa(pg); await afirmarApaga(c) })
  })

  it('11. mutante do critério: helper só com unidade, os casos 3 e 4 caem', async () => {
    const soUnidade = `create or replace function public.obs_archive_m9_pronto(p_site uuid) returns void language plpgsql volatile security definer set search_path = '' as $$
      begin if exists (select 1 from public.obs_archive_units x where x.site_id = p_site) then raise exception 'm9_desligada' using errcode = 'P0001'; end if; end $$`
    for (const col of ['armed_at=now()', 'first_month_at=now()']) {
      await emTx(async c => { await pg.query(soUnidade); await switchDe(c.site, col); await afirmarApaga(c) })
    }
  })

  it('12. o critério é o banco, não o env', async () => {
    const guardado = process.env.OBS_ARQUIVO
    try {
      delete process.env.OBS_ARQUIVO
      await emTx(async c => { await unidade(c); await afirmarRecusa(c) })
      await emTx(async c => { await afirmarApaga(c) })
      process.env.OBS_ARQUIVO = 'on'
      await emTx(async c => { await unidade(c); await afirmarRecusa(c) })
      await emTx(async c => { await afirmarApaga(c) })
    } finally { if (guardado === undefined) delete process.env.OBS_ARQUIVO; else process.env.OBS_ARQUIVO = guardado }
  })

  it('13. o desfazer devolve a partida; recusa com a M9 presente; md5 que não volta deixa o helper vivo', async () => {
    await emTx(async () => {
      await desfazerRecusa(pg)
      expect(await escalar<string>(pg, `select md5(prosrc) from pg_proc where proname = 'competitor_video_purge'`)).toBe(MD5_PARTIDA.video)
      expect(await escalar<string>(pg, `select md5(prosrc) from pg_proc where proname = 'competitor_comments_purge'`)).toBe(MD5_PARTIDA.comentarios)
      expect(await escalar<boolean>(pg, `select to_regprocedure('${HELPER}') is null`)).toBe(true)
    })
    await emTx(async () => {
      const d = (await pg.query(`select pg_get_functiondef($1::regprocedure) as d`, [ASSIN_VIDEO])).rows[0].d as string
      await pg.query(d.replace(/\nbegin\n/, '\nbegin\n  -- obs_archive_item_capture\n'))   // simula a M9 presente
      await pg.query('savepoint m9')
      const m9 = await tenta(pg, `do $$ begin perform 1; end $$`)   // ancora o savepoint
      expect(m9.ok).toBe(true)
      const r = await tenta(pg, (await import('node:fs')).readFileSync((await import('../helpers/m3b-recusa')).RECUSA_DESFAZER_CAMINHO, 'utf8').replace(/^begin;$/m, '').replace(/^commit;$/m, ''))
      expect(r).toMatchObject({ ok: false, code: 'P0001', message: 'm3b_recusa_desfazer_m9_presente' })
      expect(await escalar<boolean>(pg, `select to_regprocedure('${HELPER}') is not null`)).toBe(true)
    })
    await emTx(async () => {
      const d = (await pg.query(`select pg_get_functiondef($1::regprocedure) as d`, [ASSIN_VIDEO])).rows[0].d as string
      await pg.query(d.replace(/\nbegin\n/, '\nbegin \n'))   // espaço a mais: depois de tirar a injeção o md5 não volta
      const r = await tenta(pg, (await import('node:fs')).readFileSync((await import('../helpers/m3b-recusa')).RECUSA_DESFAZER_CAMINHO, 'utf8').replace(/^begin;$/m, '').replace(/^commit;$/m, ''))
      expect(r).toMatchObject({ ok: false, code: 'P0001', message: 'm3b_recusa_desfazer_md5' })
      expect(await escalar<boolean>(pg, `select to_regprocedure('${HELPER}') is not null`)).toBe(true)
    })
  })
})
