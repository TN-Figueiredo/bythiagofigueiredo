// @vitest-environment node
/**
 * A/B Lab S8-F1: RLS, privilégios e funções de ab_test_dias / ab_test_sondas, com o GUC `app.site_id` FORJADO. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-s8-f1-schema-rls.test.ts --no-file-parallelism
 * Função sem EXECUTE nunca é CHAMADA aqui como anon/authenticated (derruba este Postgres): `has_function_privilege`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABELAS = ['ab_test_dias', 'ab_test_sondas'] as const
type Tabela = (typeof TABELAS)[number]
type Who = 'anon' | 'sem' | 'leitor' | 'editor' | 'editorB'
interface Cenario { siteA: string; siteB: string; testId: string; users: Record<Exclude<Who, 'anon'>, string> }
interface Resultado { rows: number; error: string | null; code: string | null }

const FUNCOES = ['ab_test_dias_apply(jsonb)', 'ab_test_dias_fechar_apagados(uuid[])', 'ab_test_dias_fechar_antigas(date)'] as const

/** Linha completa de ab_test_dias (todas as colunas preenchidas). */
function linha(testId: string, siteId: string, dia: string, v: number, final = false): Record<string, unknown> {
  return {
    test_id: testId, day_pt: dia, site_id: siteId, youtube_video_id: 'abcdefghijk', regra_duracao: v === 1 ? 'v1' : 'v2',
    variant_id: randomUUID(), motivo_sem_variante: null, motivo_nulo_meta: v === 1 ? 'ciclo_aberto_duplicado' : null,
    segundos_no_ar: 80000 + v, segundos_do_dia: 86400, dia_de_troca: true, ciclos: [{ id: 'c' + v, started_at: '2026-10-01T00:00:00Z', ended_at: null }],
    impressoes: 100 * v, ctr: 0.01 * v, alcance_estado: 'medido', source_report_id: 'rep' + v, report_create_time: `2026-10-0${v}T00:00:00Z`,
    views: 10 * v, views_estado: 'medido', views_fonte: 'fonte' + v, metric_version: 'mv' + v, engaged_views: 5 * v,
    watch_time_minutes: 1.5 * v, avg_view_percentage: 10 * v, troca_vista_em: `2026-10-0${v}T10:15:00Z`, retratado_em: `2026-10-0${v}T14:00:00Z`, final,
  }
}

describe.skipIf(skipIfNoLocalDb())('S8-F1: RLS e funções das tabelas de gravação (banco local, GUC forjado)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const usuarios: string[] = []
  const testes: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      if (testes.length > 0) for (const t of TABELAS) await pg.query(`delete from public.${t} where test_id = any($1::uuid[])`, [testes])
      if (sites.length > 0) {
        await pg.query('delete from public.site_memberships where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
      }
      if (usuarios.length > 0) await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
      if (sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
    } finally {
      await pg.end()
    }
  })

  async function cenario(): Promise<Cenario> {
    const siteA = (await seedSite(sb)).siteId; sites.push(siteA)
    const siteB = (await seedSite(sb)).siteId; sites.push(siteB)
    const users = { sem: randomUUID(), leitor: randomUUID(), editor: randomUUID(), editorB: randomUUID() }
    for (const id of Object.values(users)) {
      usuarios.push(id)
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@s8.test'])
    }
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'reporter'), ($1, $3, 'editor'), ($4, $5, 'editor')`, [siteA, users.leitor, users.editor, siteB, users.editorB])
    const testId = randomUUID(); testes.push(testId)
    const r = await sb.rpc('ab_test_dias_apply', { p_rows: [linha(testId, siteA, '2026-10-01', 1)] })
    if (r.error) throw new Error('cenario (apply): ' + r.error.message)
    await pg.query(`insert into public.ab_test_sondas (test_id, hora, site_id, lida_em, leitura_estado) values ($1, '2026-10-01T10:00:00Z', $2, now(), 'bate')`, [testId, siteA])
    return { siteA, siteB, testId, users }
  }

  async function como(c: Cenario, who: Who, sql: string, params: unknown[] = [], guc: string = c.siteA): Promise<Resultado> {
    await pg.query('begin')
    try {
      if (who !== 'anon') await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: c.users[who], role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query(who === 'anon' ? 'set local role anon' : 'set local role authenticated')
      const r = await pg.query(sql, params)
      return { rows: r.rowCount ?? 0, error: null, code: null }
    } catch (e) {
      return { rows: 0, error: e instanceof Error ? e.message : String(e), code: (e as { code?: string }).code ?? null }
    } finally {
      await pg.query('rollback')
    }
  }
  const ler = (c: Cenario, who: Who, t: Tabela, guc?: string): Promise<Resultado> => como(c, who, `select 1 from public.${t} where site_id = $1`, [c.siteA], guc)

  it('policy de leitura usa can_edit_site, nunca o GUC', async () => {
    const pol = await pg.query(`select tablename, qual from pg_policies where schemaname = 'public' and tablename = any($1) order by 1`, [TABELAS])
    expect(pol.rows).toHaveLength(2)
    for (const p of pol.rows) {
      expect(String(p.qual), p.tablename).toContain('can_edit_site(site_id)')
      expect(String(p.qual)).not.toMatch(/app\.site_id|site_visible|true/)
    }
  })

  it('sem vínculo, reporter e editor de outro site leem zero; o editor lê (controle positivo); GUC forjado não ajuda', async () => {
    const c = await cenario()
    for (const t of TABELAS) {
      for (const who of ['sem', 'leitor', 'editorB'] as const) {
        const r = await ler(c, who, t)
        expect(r.error, `${who} em ${t}`).toBeNull()
        expect(r.rows, `${who} lê ${t}`).toBe(0)
      }
      expect((await ler(c, 'editorB', t, c.siteB)).rows).toBe(0)
      expect((await ler(c, 'sem', t, '')).rows).toBe(0)
      expect((await ler(c, 'editor', t)).rows).toBe(1)
    }
  })

  it('anon não tem select (42501); a service role lê', async () => {
    const c = await cenario()
    for (const t of TABELAS) {
      expect((await ler(c, 'anon', t)).code, `anon em ${t}`).toBe('42501')
      const svc = await sb.from(t).select('site_id').eq('site_id', c.siteA)
      expect(svc.error).toBeNull()
      expect(svc.data).toHaveLength(1)
    }
  })

  it('authenticated recebe 42501 em insert, update, delete e truncate; nada muda', async () => {
    const c = await cenario()
    const ins: Record<Tabela, string> = {
      ab_test_dias: `insert into public.ab_test_dias (test_id, day_pt, site_id, youtube_video_id, regra_duracao, segundos_do_dia, ciclos, alcance_estado, views_estado, retratado_em)
        values (gen_random_uuid(), current_date, $1, 'abcdefghijk', 'v1', 86400, '[{}]'::jsonb, 'medido', 'medido', now())`,
      ab_test_sondas: `insert into public.ab_test_sondas (test_id, hora, site_id, lida_em, leitura_estado) values (gen_random_uuid(), now(), $1, now(), 'bate')`,
    }
    for (const t of TABELAS) {
      for (const who of ['editor', 'leitor', 'sem', 'editorB'] as const) {
        expect((await como(c, who, ins[t], [c.siteA])).code, `insert ${who} ${t}`).toBe('42501')
        expect((await como(c, who, `update public.${t} set site_id = site_id where site_id = $1`, [c.siteA])).code, `update ${who} ${t}`).toBe('42501')
        expect((await como(c, who, `delete from public.${t} where site_id = $1`, [c.siteA])).code, `delete ${who} ${t}`).toBe('42501')
        expect((await como(c, who, `truncate public.${t}`)).code, `truncate ${who} ${t}`).toBe('42501')
      }
      expect((await pg.query(`select count(*)::int as n from public.${t} where site_id = $1`, [c.siteA])).rows[0].n).toBe(1)
    }
  })

  it.each(FUNCOES)('execute de %s negado a authenticated e anon, liberado à service_role (sem chamar)', async (f) => {
    const r = await pg.query(`select has_function_privilege('authenticated', $1, 'execute') as a, has_function_privilege('anon', $1, 'execute') as n,
      has_function_privilege('service_role', $1, 'execute') as s`, ['public.' + f])
    expect(r.rows[0]).toEqual({ a: false, n: false, s: true })
  })

  it('apply: linha nova entra; linha final não muda (devolve 0)', async () => {
    const c = await cenario()
    const nova = linha(c.testId, c.siteA, '2026-10-02', 1)
    const r1 = await sb.rpc('ab_test_dias_apply', { p_rows: [nova] })
    expect(r1.data).toBe(1)
    await pg.query(`update public.ab_test_dias set final = true where test_id = $1 and day_pt = '2026-10-02'`, [c.testId])
    const r2 = await sb.rpc('ab_test_dias_apply', { p_rows: [{ ...nova, impressoes: 999 }] })
    expect(r2.data).toBe(0)
    const x = await pg.query(`select impressoes from public.ab_test_dias where test_id = $1 and day_pt = '2026-10-02'`, [c.testId])
    expect(Number(x.rows[0].impressoes)).toBe(100)
  })

  it('apply: a releitura bate com a 2ª chamada campo a campo (pega coluna esquecida no do update set)', async () => {
    const c = await cenario()
    const a = linha(c.testId, c.siteA, '2026-10-03', 1)
    const b = linha(c.testId, c.siteA, '2026-10-03', 2)
    b.variant_id = randomUUID()
    expect((await sb.rpc('ab_test_dias_apply', { p_rows: [a] })).data).toBe(1)
    expect((await sb.rpc('ab_test_dias_apply', { p_rows: [b] })).data).toBe(1)
    const x = (await pg.query(`select * from public.ab_test_dias where test_id = $1 and day_pt = '2026-10-03'`, [c.testId])).rows[0]
    const instante = (v: unknown): number => new Date(v as string).getTime()
    for (const [k, v] of Object.entries(b)) {
      if (k === 'day_pt') continue
      if (['report_create_time', 'troca_vista_em', 'retratado_em'].includes(k)) expect(instante(x[k]), k).toBe(instante(v))
      else if (['impressoes', 'views', 'engaged_views', 'ctr', 'watch_time_minutes', 'avg_view_percentage'].includes(k)) expect(Number(x[k]), k).toBeCloseTo(Number(v), 6)
      else expect(x[k], k).toEqual(v)
    }
  })

  it('fechar_antigas: linha aberta antiga vira final/nao_medido sem mexer em variante e motivo; a recente não muda', async () => {
    const c = await cenario()
    const antiga = { ...linha(c.testId, c.siteA, '2026-09-01', 1), alcance_estado: 'aguardando' }
    const recente = { ...linha(c.testId, c.siteA, '2026-10-20', 1), alcance_estado: 'aguardando' }
    await sb.rpc('ab_test_dias_apply', { p_rows: [antiga, recente] })
    const antes = (await pg.query(`select variant_id, motivo_sem_variante from public.ab_test_dias where test_id = $1 and day_pt = '2026-09-01'`, [c.testId])).rows[0]
    const n = await sb.rpc('ab_test_dias_fechar_antigas', { p_antes: '2026-10-10' })
    expect(n.error).toBeNull()
    const a = (await pg.query(`select final, alcance_estado, variant_id, motivo_sem_variante from public.ab_test_dias where test_id = $1 and day_pt = '2026-09-01'`, [c.testId])).rows[0]
    expect(a).toMatchObject({ final: true, alcance_estado: 'nao_medido', variant_id: antes.variant_id, motivo_sem_variante: antes.motivo_sem_variante })
    const r = (await pg.query(`select final, alcance_estado from public.ab_test_dias where test_id = $1 and day_pt = '2026-10-20'`, [c.testId])).rows[0]
    expect(r).toEqual({ final: false, alcance_estado: 'aguardando' })
  })

  it('fechar_apagados: fecha as abertas do teste, aguardando vira nao_medido e variante nula ganha teste_apagado', async () => {
    const c = await cenario()
    const sem = { ...linha(c.testId, c.siteA, '2026-10-05', 1), alcance_estado: 'aguardando', variant_id: null, motivo_sem_variante: 'meta_ausente' }
    await sb.rpc('ab_test_dias_apply', { p_rows: [sem] })
    const n = await sb.rpc('ab_test_dias_fechar_apagados', { p_test_ids: [c.testId] })
    expect(n.error).toBeNull()
    const x = (await pg.query(`select final, alcance_estado, motivo_sem_variante from public.ab_test_dias where test_id = $1 and day_pt = '2026-10-05'`, [c.testId])).rows[0]
    expect(x).toEqual({ final: true, alcance_estado: 'nao_medido', motivo_sem_variante: 'teste_apagado' })
  })
})
