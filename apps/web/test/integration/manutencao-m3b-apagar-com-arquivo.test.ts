// @vitest-environment node
/**
 * M3b-apagar-sql (Phil a, 25/10): competitor_channel_remove recusa 'apagar' de canal com unidade no arquivo (P0001 apagar_com_arquivo).
 * Tudo em begin … rollback no bythiago_int (54422).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM3b, m3bNoBanco, semearCanal, escalar, tenta } from '../helpers/m3b'
import { criarUsuario } from '../helpers/mg6'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DIR = resolve(__dirname, '../../../../supabase/migrations')
const NOME = readdirSync(DIR).find(n => n.endsWith('_manutencao_m3b_apagar_com_arquivo.sql'))
const SQL_GUARDA = (): string => readFileSync(resolve(DIR, NOME ?? 'ausente.sql'), 'utf8')

describe.skipIf(skipIfNoLocalDb())('M3b-apagar-sql: o banco recusa apagar canal que tem arquivo', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: { site: string; canal: string; admin: string }) => Promise<void>, sql: () => string = SQL_GUARDA): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await pg.query(sql())
      const s = await semearCanal(pg, { videos: 1 })
      const admin = await criarUsuario(pg)
      const org = await escalar<string>(pg, `select org_id from public.sites where id = $1`, [s.site])
      await pg.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, admin])
      await fn({ site: s.site, canal: s.canal, admin })
    } finally { await pg.query('rollback') }
  }
  const unidade = (c: { site: string; canal: string }) => pg.query(
    `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
     values ($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 1, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, now())`, [c.site, c.canal])
  const remover = (c: { site: string; canal: string; admin: string }, decisao: string, via: string) =>
    tenta(pg, `select public.competitor_channel_remove($1, $2, $3, $4, $5) as r`, [c.site, c.canal, decisao, via, c.admin])
  const canais = (c: { canal: string }) => escalar<number>(pg, `select count(*)::int from public.competitor_channels where id = $1`, [c.canal])
  const registros = (c: { site: string }) => escalar<number>(pg, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1`, [c.site])

  it('0. a migration existe', () => { expect(NOME).toBeDefined() })

  it('1. apagar com unidade: P0001 apagar_com_arquivo, canal e registro intactos', async () => {
    await emTx(async c => {
      await unidade(c)
      expect(await remover(c, 'apagar', 'botao')).toMatchObject({ ok: false, code: 'P0001', message: 'apagar_com_arquivo' })
      expect(await remover(c, 'apagar', 'fila')).toMatchObject({ ok: false, code: 'P0001', message: 'apagar_com_arquivo' })
    })
    await emTx(async c => {
      await unidade(c)
      await pg.query('savepoint a')
      await remover(c, 'apagar', 'botao')
      await pg.query('rollback to savepoint a')
      expect(await canais(c)).toBe(1)
      expect(await registros(c)).toBe(0)
    })
  })

  it('2. apagar sem unidade: passa', async () => {
    await emTx(async c => {
      expect(await remover(c, 'apagar', 'botao')).toMatchObject({ ok: true })
      expect(await canais(c)).toBe(0)
      expect(await registros(c)).toBe(1)
    })
  })

  it('3. guardar com unidade: passa', async () => {
    await emTx(async c => {
      await unidade(c)
      expect(await remover(c, 'guardar', 'e10_export')).toMatchObject({ ok: true })
      expect(await canais(c)).toBe(0)
      expect(await escalar<string>(pg, `select archive_decision from public.obs_archive_channel_removals where site_id = $1`, [c.site])).toBe('guardar')
    })
  })

  it('4. mutante: sem a guarda, o caso 1 cai (apagar com unidade passa)', async () => {
    const semGuarda = (): string => SQL_GUARDA().replace(/^\s*if p_decision = 'apagar' and coalesce\(v_units, 0\) > 0 then raise exception 'apagar_com_arquivo'.*$/m, '')
    expect(semGuarda()).not.toContain("raise exception 'apagar_com_arquivo'")
    await emTx(async c => {
      await unidade(c)
      expect(await remover(c, 'apagar', 'botao')).toMatchObject({ ok: true })   // o contrário do caso 1: é o que prova que a guarda é o que recusa
    }, semGuarda)
  })

  it('6. unidade ainda não recebida (received_at nulo) também recusa: o SQL conta toda unidade não purgada, recebida ou não', async () => {
    await emTx(async c => {
      await pg.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes)
        values ($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 1, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100)`, [c.site, c.canal])
      expect(await remover(c, 'apagar', 'botao')).toMatchObject({ ok: false, code: 'P0001', message: 'apagar_com_arquivo' })
    })
  })

  it('7. unidade já purgada (purged_at preenchido) não conta: apagar passa', async () => {
    await emTx(async c => {
      await unidade(c)
      // Por caminho normal unidade purgada só existe com canal já removido (gatilho purga_sem_decisao_apagar); aqui a purga é forçada só para fixar o que o SQL conta.
      await pg.query(`set local session_replication_role = replica`)
      await pg.query(`update public.obs_archive_units set purged_at = now(), purged_by = $3, purge_ref = 'x' where site_id = $1 and channel_ref = $2`, [c.site, c.canal, c.admin])
      await pg.query(`set local session_replication_role = origin`)
      expect(await remover(c, 'apagar', 'botao')).toMatchObject({ ok: true })
      expect(await canais(c)).toBe(0)
    })
  })

  it('8. guarda de md5 (Phil I1): base alterado recusa a sobrescrita; reaplicar sobre o próprio corpo passa', async () => {
    await emTx(async c => {
      expect(await tenta(pg, SQL_GUARDA())).toMatchObject({ ok: true })   // 2ª aplicação: o corpo já é o 04 (aafccb33…)
      const def = await escalar<string>(pg, `select pg_get_functiondef('public.competitor_channel_remove(uuid,uuid,text,text,uuid)'::regprocedure)`)
      await pg.query(def.replace("'decisao_invalida'", "'decisao_invalida_x'"))   // simula um hotfix em produção
      expect(await tenta(pg, SQL_GUARDA())).toMatchObject({ ok: false, code: 'P0001', message: 'm3b_apagar_base_mudou' })
      expect(c.canal).toBeTruthy()
    })
  })

  it('5. assinatura e grants não mudam', async () => {
    await emTx(async () => {
      const a = 'public.competitor_channel_remove(uuid,uuid,text,text,uuid)'
      expect(await escalar<boolean>(pg, `select has_function_privilege('service_role', $1::regprocedure, 'EXECUTE')`, [a])).toBe(true)
      for (const papel of ['anon', 'authenticated']) expect(await escalar<boolean>(pg, `select has_function_privilege('${papel}', $1::regprocedure, 'EXECUTE')`, [a])).toBe(false)
      expect(await escalar<boolean>(pg, `select prosecdef from pg_proc where oid = $1::regprocedure`, [a])).toBe(true)
    })
  })
})
