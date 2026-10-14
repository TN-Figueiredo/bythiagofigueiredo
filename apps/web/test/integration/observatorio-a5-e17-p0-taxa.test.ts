// @vitest-environment node
/**
 * A5 · E17 passo 0 (MG11), Tarefa 4 (item 239, metade de banco): o contador de taxa `obs_ai_rate_hit`, o `check` das chaves
 * do perfil e os privilégios do registro de acesso de IA. A metade "30 servidas e 10 `limite`" é do código do degrau 2.
 *
 * Os testes de transação aplicam a MG11 (`garantirMg11`), provam e DESFAZEM. O de 40 conexões é o ÚNICO que não cabe numa
 * transação (exige 40 conexões e dado commitado): só roda com a MG11 aplicada DE VERDADE; antes disso PULA com o motivo escrito
 * (pende aplicação do controlador, passo 2b da seção 2 do plano). Banco: SÓ o `bythiago_int` (fora da CI):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e17-p0-taxa.test.ts --no-file-parallelism
 * Erro 55P03 ou `lock_timeout` = banco ocupado por outro teste: esperar um minuto e repetir.
 * Função sem EXECUTE NUNCA é chamada aqui como anon/authenticated (derruba este Postgres): o que authenticated/anon NÃO pode vai por
 * `has_function_privilege`; os que ELE pode (tabelas com privilégio negado ou policy) são consultados de verdade.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { garantirMg11 } from '../helpers/mg11'

vi.setConfig({ testTimeout: 90_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

interface Semente { site: string; org: string; orgAdmin: string; editor: string; leitora: string; chave: string }

describe.skipIf(skipIfNoLocalDb())('A5 E17 passo 0 (MG11): contador de taxa, check das chaves do perfil e registro de acesso (banco local)', () => {
  let pg: Client

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    await pg.end()
  })

  async function emTransacao<T>(corpo: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try {
      await garantirMg11(pg)
      return await corpo()
    } finally {
      await pg.query('rollback')
    }
  }

  async function codigoDoErro(sql: string, params: unknown[] = []): Promise<string | null> {
    await pg.query('savepoint tentativa')
    try {
      await pg.query(sql, params)
      await pg.query('release savepoint tentativa')
      return null
    } catch (e) {
      await pg.query('rollback to savepoint tentativa')
      return (e as { code?: string }).code ?? 'sem-codigo'
    }
  }

  /** Um site em organização filha da raiz, o administrador da organização, um editor, uma leitora e uma chave do perfil. */
  async function semear(): Promise<Semente> {
    const sufixo = randomUUID().slice(0, 8)
    let raiz = (await pg.query<{ id: string }>('select id from public.organizations where parent_org_id is null limit 1')).rows[0]?.id
    if (!raiz) {
      raiz = randomUUID()
      await pg.query(`insert into public.organizations (id, name, slug, parent_org_id) values ($1, 'Raiz MG11', $2, null)`, [raiz, `mg11-raiz-${sufixo}`])
    }
    const org = randomUUID(); const site = randomUUID()
    await pg.query(`insert into public.organizations (id, name, slug, parent_org_id) values ($1, 'Org MG11', $2, $3)`, [org, `mg11-org-${sufixo}`, raiz])
    await pg.query(`insert into public.sites (id, org_id, name, slug, domains, primary_domain) values ($1, $2, 'Site MG11', $3, $4, $5)`, [site, org, `mg11-site-${sufixo}`, [`mg11-${sufixo}.test`], `mg11-${sufixo}.test`])
    const [orgAdmin, editor, leitora] = [randomUUID(), randomUUID(), randomUUID()]
    for (const [id, nome] of [[orgAdmin, 'orgadmin'], [editor, 'editor'], [leitora, 'leitora']] as const) {
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, `${nome}-${sufixo}@mg11.test`])
    }
    await pg.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, orgAdmin])
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'reporter')`, [site, editor, leitora])
    const chave = randomUUID()
    await pg.query(
      `insert into public.pipeline_api_keys (id, site_id, name, key_hash, permissions, user_id, expires_at) values ($1, $2, 'mg11 perfil', $3, array['observatorio_leitura'], $4, now() + interval '30 days')`,
      [chave, site, `hash-${chave}`, leitora],
    )
    return { site, org, orgAdmin, editor, leitora, chave }
  }

  /** Chama a contagem como a service role (o papel que a usa em produção); a contagem fica na transação até o rollback. Devolve [no_minuto, no_dia]. */
  async function bater(chave: string, instante: string): Promise<[number, number]> {
    await pg.query('set local role service_role')
    try {
      const r = await pg.query<{ no_minuto: number; no_dia: number }>('select no_minuto, no_dia from public.obs_ai_rate_hit($1, $2::timestamptz)', [chave, instante])
      return [r.rows[0].no_minuto, r.rows[0].no_dia]
    } finally {
      await pg.query('reset role')
    }
  }

  it('quatro chamadas em sequência contam 1, 2, 3 no mesmo minuto e 1 no minuto seguinte; o dia vira à meia-noite UTC', async () => {
    await emTransacao(async () => {
      const s = await semear()
      // os valores do Apêndice B: a terceira é 20:59:59 de Brasília = 23:59:59 UTC (o mesmo minuto e o mesmo dia UTC das duas primeiras); a quarta já é o dia seguinte
      expect(await bater(s.chave, '2026-10-13 23:59:10+00')).toEqual([1, 1])
      expect(await bater(s.chave, '2026-10-13 23:59:30+00')).toEqual([2, 2])
      expect(await bater(s.chave, '2026-10-13 20:59:59-03')).toEqual([3, 3])
      expect(await bater(s.chave, '2026-10-14 00:00:05+00')).toEqual([1, 1])
      const linhas = await pg.query<{ grain: string; bucket: string; n: number }>(
        `select grain, to_char(bucket at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as bucket, n from public.obs_ai_rate where key_id = $1 order by 1, 2`, [s.chave],
      )
      expect(linhas.rows).toEqual([
        { grain: 'dia', bucket: '2026-10-13 00:00:00', n: 3 },
        { grain: 'dia', bucket: '2026-10-14 00:00:00', n: 1 },
        { grain: 'minuto', bucket: '2026-10-13 23:59:00', n: 3 },
        { grain: 'minuto', bucket: '2026-10-14 00:00:00', n: 1 },
      ])
    })
  })

  it('tabela vazia: a primeira chamada devolve 1 e 1', async () => {
    await emTransacao(async () => {
      const s = await semear()
      expect((await pg.query(`select count(*)::int as n from public.obs_ai_rate where key_id = $1`, [s.chave])).rows[0].n).toBe(0)
      expect(await bater(s.chave, new Date().toISOString())).toEqual([1, 1])
    })
  })

  it('chave que não existe: a chamada dá erro de chave estrangeira (23503) e nada é gravado', async () => {
    await emTransacao(async () => {
      await semear()
      const fantasma = randomUUID()
      await pg.query('set local role service_role')
      const codigo = await codigoDoErro('select * from public.obs_ai_rate_hit($1, now())', [fantasma])
      await pg.query('reset role')
      expect(codigo).toBe('23503')
      expect((await pg.query(`select count(*)::int as n from public.obs_ai_rate where key_id = $1`, [fantasma])).rows[0].n).toBe(0)
    })
  })

  it('chave com observatorio_leitura e outra permissão é recusada no insert e no update (23514); só com observatorio_leitura entra (com validade; sem ela, 23514); as chaves de hoje não são afetadas', async () => {
    await emTransacao(async () => {
      const s = await semear()
      const amanha = new Date(Date.now() + 86_400_000).toISOString()
      const inserir = (nome: string, permissoes: string[], validade: string | null) => codigoDoErro(
        `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, expires_at) values ($1, $2, $3, $4::text[], $5)`,
        [s.site, nome, `hash-${nome}`, permissoes, validade],
      )
      expect(await inserir('mista', ['observatorio_leitura', 'read'], amanha)).toBe('23514')
      expect(await inserir('mista-sem-validade', ['read', 'observatorio_leitura'], null)).toBe('23514')
      expect(await inserir('perfil', ['observatorio_leitura'], amanha)).toBeNull()
      expect(await inserir('perfil-sem-validade', ['observatorio_leitura'], null)).toBe('23514')
      expect(await codigoDoErro(`update public.pipeline_api_keys set permissions = array_append(permissions, 'read') where id = $1`, [s.chave])).toBe('23514')
      expect(await codigoDoErro(`update public.pipeline_api_keys set expires_at = null where id = $1`, [s.chave])).toBe('23514')
      // as combinações das chaves de hoje (cowork-permanent, forja fila, forja leitura) seguem entrando, sem validade
      expect(await inserir('cowork-como-hoje', ['read', 'write', 'admin'], null)).toBeNull()
      expect(await inserir('forja-fila-como-hoje', ['intelligence'], null)).toBeNull()
      expect(await inserir('forja-leitura-como-hoje', ['read'], null)).toBeNull()
    })
  })

  it('apagar a chave apaga os contadores dela (cascata) e anula key_id no registro', async () => {
    await emTransacao(async () => {
      const s = await semear()
      await bater(s.chave, new Date().toISOString())
      await pg.query(`insert into public.obs_ai_access_log (site_id, user_id, key_id, origin, action, included_private, result) values ($1, $2, $3, 'mcp', 'prova', true, 'ok')`, [s.site, s.leitora, s.chave])
      expect((await pg.query(`select count(*)::int as n from public.obs_ai_rate where key_id = $1`, [s.chave])).rows[0].n).toBe(2)
      await pg.query('delete from public.pipeline_api_keys where id = $1', [s.chave])
      expect((await pg.query(`select count(*)::int as n from public.obs_ai_rate where key_id = $1`, [s.chave])).rows[0].n).toBe(0)
      const reg = await pg.query(`select key_id, user_id from public.obs_ai_access_log where action = 'prova' and site_id = $1`, [s.site])
      expect(reg.rows).toEqual([{ key_id: null, user_id: s.leitora }])
    })
  })

  it('authenticated não lê nem escreve obs_ai_rate (42501) e lê zero linha de obs_ai_access_log sem ser administrador do site', async () => {
    await emTransacao(async () => {
      const s = await semear()
      await pg.query(`insert into public.obs_ai_access_log (site_id, user_id, key_id, origin, action, included_private, result) values ($1, $2, $3, 'mcp', 'prova', true, 'ok')`, [s.site, s.leitora, s.chave])
      const como = async (quem: string | null, sql: string): Promise<{ n: number; code: string | null }> => {
        await pg.query('savepoint como')
        try {
          await pg.query(`select set_config('request.jwt.claims', $1, true)`, [quem ? JSON.stringify({ sub: quem, role: 'authenticated' }) : ''])
          await pg.query(`select set_config('app.site_id', $1, true)`, [s.site])
          await pg.query(quem ? 'set local role authenticated' : 'set local role anon')
          const r = await pg.query(sql)
          return { n: r.rowCount ?? 0, code: null }
        } catch (e) {
          return { n: 0, code: (e as { code?: string }).code ?? 'sem-codigo' }
        } finally {
          await pg.query('rollback to savepoint como')
          await pg.query('release savepoint como')
        }
      }
      for (const quem of [s.orgAdmin, s.editor, s.leitora]) {
        expect((await como(quem, 'select 1 from public.obs_ai_rate')).code, 'select em obs_ai_rate').toBe('42501')
        expect((await como(quem, `insert into public.obs_ai_rate (key_id, grain, bucket) values (gen_random_uuid(), 'minuto', now())`)).code, 'insert em obs_ai_rate').toBe('42501')
        expect((await como(quem, `insert into public.obs_ai_access_log (site_id, origin, action, included_private, result) values (gen_random_uuid(), 'mcp', 'x', false, 'ok')`)).code, 'insert em obs_ai_access_log').toBe('42501')
      }
      expect((await como(s.editor, 'select 1 from public.obs_ai_access_log')).n, 'o editor não administra o site').toBe(0)
      expect((await como(s.leitora, 'select 1 from public.obs_ai_access_log')).n, 'a leitora não administra o site').toBe(0)
      expect((await como(s.orgAdmin, 'select 1 from public.obs_ai_access_log')).n, 'o administrador da organização lê o registro').toBe(1)
      expect((await como(null, 'select 1 from public.obs_ai_rate')).code).toBe('42501')
      expect((await como(null, 'select 1 from public.obs_ai_access_log')).code).toBe('42501')
    })
  })

  // ── o único teste que não cabe numa transação ──────────────────────────────────────────────────────────────────────────────
  it('40 chamadas ao mesmo tempo, com a mesma chave e o mesmo instante, devolvem os números de 1 a 40 sem repetição e a linha fica com n = 40', async (ctx) => {
    const url = new URL(PG_URL)
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      throw new Error(`este teste grava dado commitado e só roda em banco local (host ${url.hostname}): apps/web/.env.local aponta para produção`)
    }
    // sem SUPABASE_DB_URL os auxiliares caem na 54322 (banco do navegador, também 127.0.0.1): fora da CI só se grava na 54422
    if (!process.env.CI && url.port !== '54422') ctx.skip('fora da CI este teste só grava no banco de integração, porta 54422')
    const aplicada = (await pg.query<{ a: boolean }>(`select to_regclass('public.obs_ai_rate') is not null as a`)).rows[0].a
    if (!aplicada) ctx.skip('a MG11 ainda não está aplicada neste banco: roda depois da Tarefa 1b (pende aplicação do controlador, passo 2b)')

    const sufixo = randomUUID().slice(0, 8)
    const org = randomUUID(); const site = randomUUID(); const chave = randomUUID()
    const raiz = (await pg.query<{ id: string }>('select id from public.organizations where parent_org_id is null limit 1')).rows[0]?.id ?? null
    const conexoes: Client[] = []
    try {
      await pg.query(`insert into public.organizations (id, name, slug, parent_org_id) values ($1, 'Org MG11 taxa', $2, $3)`, [org, `mg11-taxa-org-${sufixo}`, raiz])
      await pg.query(`insert into public.sites (id, org_id, name, slug, domains, primary_domain) values ($1, $2, 'Site MG11 taxa', $3, $4, $5)`, [site, org, `mg11-taxa-site-${sufixo}`, [`mg11-taxa-${sufixo}.test`], `mg11-taxa-${sufixo}.test`])
      await pg.query(`insert into public.pipeline_api_keys (id, site_id, name, key_hash, permissions, expires_at) values ($1, $2, 'mg11 taxa 40', $3, array['read'], null)`, [chave, site, `hash-${chave}`])
      for (let i = 0; i < 40; i++) { const c = new Client({ connectionString: PG_URL }); await c.connect(); conexoes.push(c) }
      const instante = new Date(Math.floor(Date.now() / 60_000) * 60_000 + 30_000).toISOString()
      const resultados = await Promise.allSettled(conexoes.map((c) => c.query<{ no_minuto: number; no_dia: number }>('select no_minuto, no_dia from public.obs_ai_rate_hit($1, $2::timestamptz)', [chave, instante])))
      const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      expect(falhas.map((f) => (f.reason as { code?: string; message?: string }).code ?? String(f.reason)), 'nenhuma das 40 chamadas pode falhar (em especial 40P01, travamento cruzado)').toEqual([])
      const cumpridas = resultados.filter((r): r is PromiseFulfilledResult<{ rows: Array<{ no_minuto: number; no_dia: number }> }> => r.status === 'fulfilled').map((r) => r.value.rows[0])
      const esperado = Array.from({ length: 40 }, (_, i) => i + 1)
      expect(cumpridas.map((r) => r.no_minuto).sort((a, b) => a - b), 'no_minuto').toEqual(esperado)
      expect(cumpridas.map((r) => r.no_dia).sort((a, b) => a - b), 'no_dia').toEqual(esperado)
      const linhas = await pg.query<{ grain: string; n: number }>(`select grain, n from public.obs_ai_rate where key_id = $1 order by grain`, [chave])
      expect(linhas.rows).toEqual([{ grain: 'dia', n: 40 }, { grain: 'minuto', n: 40 }])
    } finally {
      for (const c of conexoes) await c.end().catch(() => undefined)
      await pg.query('delete from public.pipeline_api_keys where id = $1', [chave]) // a cascata leva os contadores
      await pg.query('delete from public.audit_log where site_id = $1', [site])
      await pg.query('delete from public.sites where id = $1', [site])
      await pg.query('delete from public.organizations where id = $1', [org])
    }
  })
})
