// @vitest-environment node
/**
 * M7b T1: guarda das colunas escolha_* de ab_tests, gatilho do histórico e CHECK de ab_event, contra o banco local.
 * Banco: SÓ o bythiago_int:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-m7b-escolha-guarda.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb } from '../helpers/db-seed'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('M7b T1: guarda escolha_*, gatilho do histórico, CHECK ab_event', () => {
  let pg: Client
  const usuarios: string[] = []
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => {
    if (usuarios.length) await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
    await pg.end()
  })

  async function usuario(): Promise<string> {
    const id = randomUUID(); usuarios.push(id)
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@m7b.test'])
    return id
  }
  /** Executa `corpo` numa transação com o papel dado; devolve o código do erro (ou null) e sempre faz rollback. */
  async function como(papel: string, corpo: () => Promise<unknown>, sub: string = randomUUID()): Promise<string | null> {
    await pg.query('begin')
    try {
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: papel })])
      await pg.query(`set local role ${papel}`)
      await corpo()
      return null
    } catch (e) {
      const x = e as { code?: string; message?: string }
      return x.code === '42501' && !/escolha_/.test(x.message ?? '') ? '42501-outro' : (x.code ?? 'erro')
    } finally {
      await pg.query('rollback')
    }
  }

  it('(a) authenticated não grava escolha_* (UPDATE e INSERT): 42501', async () => {
    const t = await semearTesteAb({ status: 'completed' })
    const ed = await usuario()
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [t.siteId, ed])
    // sanidade: o editor consegue atualizar outra coluna (a RLS deixa a linha visível, então o 42501 abaixo é da guarda)
    expect(await como('authenticated', () => pg.query('update public.ab_tests set name = name where id = $1 returning id', [t.testId]), ed)).toBeNull()
    const upd = await como('authenticated', () => pg.query('update public.ab_tests set escolha_em = now() where id = $1', [t.testId]), ed)
    expect(upd).toBe('42501')
    const ins = await como('authenticated', () => pg.query(
      `insert into public.ab_tests (site_id, youtube_video_id, name, test_type, config, escolha_variant_id, escolha_em)
       select site_id, youtube_video_id, 'x', test_type, config, $2, now() from public.ab_tests where id = $1`, [t.testId, t.varA]), ed)
    expect(ins).toBe('42501')
  })

  it('(b) service_role grava a escolha', async () => {
    const t = await semearTesteAb({ status: 'completed' })
    const erro = await como('service_role', () => pg.query(
      'update public.ab_tests set escolha_variant_id = $2, escolha_em = now() where id = $1', [t.testId, t.varB]))
    expect(erro).toBeNull()
  })

  it('(c) excluir o usuário (LGPD, supabase_auth_admin) passa e deixa escolha_por nulo', async () => {
    const t = await semearTesteAb({ status: 'completed' })
    const u = await usuario()
    await pg.query('update public.ab_tests set escolha_variant_id = $2, escolha_em = now(), escolha_por = $3 where id = $1', [t.testId, t.varB, u])
    // GoTrue conecta como supabase_auth_admin (o postgres local não é superusuário e não pode trocar para esse papel)
    const adm = new Client({ connectionString: PG_URL.replace('//postgres:', '//supabase_auth_admin:').replace('@', '@') })
    await adm.connect()
    try { await adm.query('delete from auth.users where id = $1', [u]) } finally { await adm.end() }
    const r = (await pg.query('select escolha_por, escolha_variant_id from public.ab_tests where id = $1', [t.testId])).rows[0]
    expect(r.escolha_por).toBeNull()
    expect(r.escolha_variant_id).toBe(t.varB)
  })

  it('(d) apagar a variante escolhida (service_role) passa e anula escolha_variant_id', async () => {
    const t = await semearTesteAb({ status: 'completed' })
    await pg.query('update public.ab_tests set escolha_variant_id = $2, escolha_em = now() where id = $1', [t.testId, t.varB])
    await pg.query('begin')
    try {
      await pg.query('set local role service_role')
      await pg.query('delete from public.ab_test_variants where id = $1', [t.varB])
    } finally { await pg.query('commit') }
    const r = (await pg.query('select escolha_variant_id from public.ab_tests where id = $1', [t.testId])).rows[0]
    expect(r.escolha_variant_id).toBeNull()
  })

  it('(e) variante de outro teste: 23514', async () => {
    const t1 = await semearTesteAb({ status: 'completed' })
    const t2 = await semearTesteAb({ status: 'completed' })
    const erro = await como('service_role', () => pg.query(
      'update public.ab_tests set escolha_variant_id = $2, escolha_em = now() where id = $1', [t1.testId, t2.varB]))
    expect(erro).toBe('23514')
  })

  it('(f) a migration aplicada de novo não dá erro', async () => {
    const dir = resolve(__dirname, '../../../../supabase/migrations')
    const f = readdirSync(dir).find(x => x.endsWith('_ab_lab_m7b_escolha_do_dono.sql'))!
    await pg.query(readFileSync(resolve(dir, f), 'utf8'))
  })

  const OK = { estado: 'ok', destino: 'original', forcado: false, escreveu: true, erro: null, em: '2026-10-12T08:02:00Z', attempts: 0 }

  it('(g) gatilho do histórico: definer, search_path vazio, copia iniciativa; valor inválido vira nulo', async () => {
    const fn = (await pg.query(`select prosecdef, proconfig from pg_proc where oid = 'public.tg_ab_tests_restore_log()'::regprocedure`)).rows[0]
    expect(fn.prosecdef).toBe(true)
    expect(fn.proconfig).toEqual(['search_path=""'])

    const t = await semearTesteAb({ status: 'paused' })
    await pg.query('update public.ab_tests set restore_seq = 1, restore_status = $2::jsonb where id = $1',
      [t.testId, JSON.stringify({ title: { ...OK, iniciativa: 'dono' }, thumbnail: { ...OK, iniciativa: 'x' } })])
    const l = (await pg.query('select campo, iniciativa, estado from public.ab_test_restores where test_id = $1 order by campo', [t.testId])).rows
    expect(l).toEqual([{ campo: 'thumbnail', iniciativa: null, estado: 'ok' }, { campo: 'title', iniciativa: 'dono', estado: 'ok' }])

    // guarda P4a: retomar que falha regrava o valor anterior e não gera linha nova
    await pg.query('update public.ab_tests set restore_seq = 2, restore_status = $2::jsonb where id = $1',
      [t.testId, JSON.stringify({ title: { ...OK, estado: 'em_andamento', escreveu: null } })])
    await pg.query('update public.ab_tests set restore_status = $2::jsonb where id = $1', [t.testId, JSON.stringify({ title: { ...OK, iniciativa: 'dono' } })])
    expect((await pg.query('select 1 from public.ab_test_restores where test_id = $1 and campo = $2', [t.testId, 'title'])).rowCount).toBe(1)
  })

  it('(h) yt_own_video_versions aceita ab_event = escolha e há um único CHECK de ab_event', async () => {
    const cs = (await pg.query(`select conname, pg_get_constraintdef(oid) as def from pg_constraint
      where conrelid = 'public.yt_own_video_versions'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%rotacao%'`)).rows
    expect(cs).toHaveLength(1)
    expect(cs[0].def).toContain('escolha')
  })
})
