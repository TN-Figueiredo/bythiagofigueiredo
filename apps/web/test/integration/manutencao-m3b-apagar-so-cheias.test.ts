// @vitest-environment node
/**
 * M3b-apagar-so-cheias (Phil I2 do T12, 25/10): a recusa 'apagar_com_arquivo' conta só unidade CORRENTE com row_count > 0 (a regra de `meses` da tela).
 * Tudo em begin … rollback no bythiago_int (54422).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM3b, m3bNoBanco, semearCanal, escalar, tenta, voltarA04 } from '../helpers/m3b'
import { criarUsuario } from '../helpers/mg6'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DIR = resolve(__dirname, '../../../../supabase/migrations')
const NOME = readdirSync(DIR).find(n => n.endsWith('_manutencao_m3b_apagar_so_cheias.sql'))
const NOME_BASE = readdirSync(DIR).find(n => n.endsWith('_manutencao_m3b_apagar_com_arquivo.sql'))
const SQL_BASE = (): string => readFileSync(resolve(DIR, NOME_BASE ?? 'ausente.sql'), 'utf8')
const SQL_GUARDA = (): string => readFileSync(resolve(DIR, NOME ?? 'ausente.sql'), 'utf8')

describe.skipIf(skipIfNoLocalDb())('M3b-apagar-so-cheias: unidade vazia não recusa o apagar', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: { site: string; canal: string; admin: string }) => Promise<void>, sql: () => string = SQL_GUARDA): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await voltarA04(pg)
      await pg.query(SQL_BASE())   // o corpo da 000004 (base da 000005)
      await pg.query(sql())
      const s = await semearCanal(pg, { videos: 1 })
      const admin = await criarUsuario(pg)
      const org = await escalar<string>(pg, `select org_id from public.sites where id = $1`, [s.site])
      await pg.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, admin])
      await fn({ site: s.site, canal: s.canal, admin })
    } finally { await pg.query('rollback') }
  }
  const unidade = (c: { site: string; canal: string }, linhas = 5, versao = 1, mes = '2026-10-01') => pg.query(
    `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
     values ($1, 'serie', 'competitor_video_daily', $2, $3::date, $4::int, $5::bigint, md5('a') || md5('a'), md5('s') || md5('s'), case when $5::bigint = 0 then null else md5('b') || md5('b') end, case when $5::bigint = 0 then null else md5('c') || md5('c') end, case when $5::bigint = 0 then null else 100 end, now())`, [c.site, c.canal, mes, versao, linhas])
  const remover = (c: { site: string; canal: string; admin: string }, decisao: string, via: string) =>
    tenta(pg, `select public.competitor_channel_remove($1, $2, $3, $4, $5) as r`, [c.site, c.canal, decisao, via, c.admin])
  const canais = (c: { canal: string }) => escalar<number>(pg, `select count(*)::int from public.competitor_channels where id = $1`, [c.canal])
  const registros = (c: { site: string }) => escalar<number>(pg, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1`, [c.site])

  it('0. a migration existe', () => { expect(NOME).toBeDefined() })

  it('1. só unidades vazias (row_count = 0): apagar passa e as duas são marcadas purgadas', async () => {
    await emTx(async c => {
      await unidade(c, 0, 1, '2026-09-01'); await unidade(c, 0, 1, '2026-10-01')
      expect(await remover(c, 'apagar', 'botao')).toMatchObject({ ok: true })
      expect(await canais(c)).toBe(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_units where site_id = $1 and channel_ref = $2 and purged_at is not null`, [c.site, c.canal])).toBe(2)
    })
  })

  it('2. uma unidade com linhas (row_count = 1): apagar_com_arquivo, canal e registro intactos', async () => {
    await emTx(async c => {
      await unidade(c, 1)
      await pg.query('savepoint a')
      expect(await remover(c, 'apagar', 'botao')).toMatchObject({ ok: false, code: 'P0001', message: 'apagar_com_arquivo' })
      await pg.query('rollback to savepoint a')
      expect(await canais(c)).toBe(1)
    })
  })

  it('3. versão 2 vazia sobre versão 1 cheia: conta a corrente (a vazia), apagar passa', async () => {
    await emTx(async c => {
      await unidade(c, 5, 1); await unidade(c, 0, 2)
      expect(await remover(c, 'apagar', 'botao')).toMatchObject({ ok: true })
    })
  })

  it('3b. o inverso: versão 2 cheia sobre versão 1 vazia recusa', async () => {
    await emTx(async c => {
      await unidade(c, 0, 1); await unidade(c, 5, 2)
      expect(await remover(c, 'apagar', 'botao')).toMatchObject({ ok: false, code: 'P0001', message: 'apagar_com_arquivo' })
    })
  })

  it('4. guardar com unidade vazia segue passando e registra o total de unidades', async () => {
    await emTx(async c => {
      await unidade(c, 0)
      expect(await remover(c, 'guardar', 'e10_export')).toMatchObject({ ok: true })
      expect(await escalar<number>(pg, `select units_at_removal from public.obs_archive_channel_removals where site_id = $1`, [c.site])).toBe(1)
    })
  })

  it('5. mutante: com a recusa por v_units (a da 000004), o caso 1 cai', async () => {
    const velha = (): string => SQL_GUARDA().replace("coalesce(v_cheias, 0) > 0", "coalesce(v_units, 0) > 0")
    expect(velha()).not.toBe(SQL_GUARDA())
    await emTx(async c => {
      await unidade(c, 0)
      expect(await remover(c, 'apagar', 'botao')).toMatchObject({ ok: false, message: 'apagar_com_arquivo' })
    }, velha)
  })

  it('6. guarda de md5: base alterado recusa; reaplicar sobre o próprio corpo (v_cheias) passa e não altera a função', async () => {
    await emTx(async c => {
      expect(await tenta(pg, SQL_GUARDA())).toMatchObject({ ok: true })
      const antes = await escalar<string>(pg, `select md5(prosrc) from pg_proc where oid = 'public.competitor_channel_remove(uuid,uuid,text,text,uuid)'::regprocedure`)
      expect(await tenta(pg, SQL_GUARDA())).toMatchObject({ ok: true })
      expect(await escalar<string>(pg, `select md5(prosrc) from pg_proc where oid = 'public.competitor_channel_remove(uuid,uuid,text,text,uuid)'::regprocedure`)).toBe(antes)
      expect(c.canal).toBeTruthy()
    })
    await emTx(async () => {
      // base = 000004 sem a migration nova aplicada
      const def = await escalar<string>(pg, `select pg_get_functiondef('public.competitor_channel_remove(uuid,uuid,text,text,uuid)'::regprocedure)`)
      await pg.query(def.replace("'decisao_invalida'", "'decisao_invalida_x'"))
      expect(await tenta(pg, SQL_GUARDA())).toMatchObject({ ok: false, code: 'P0001', message: 'm3b_apagar_base_mudou' })
    }, () => 'select 1')
  })

  it('7. assinatura e grants não mudam', async () => {
    await emTx(async () => {
      const a = 'public.competitor_channel_remove(uuid,uuid,text,text,uuid)'
      expect(await escalar<boolean>(pg, `select has_function_privilege('service_role', $1::regprocedure, 'EXECUTE')`, [a])).toBe(true)
      for (const papel of ['anon', 'authenticated']) expect(await escalar<boolean>(pg, `select has_function_privilege('${papel}', $1::regprocedure, 'EXECUTE')`, [a])).toBe(false)
    })
  })
})
