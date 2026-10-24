// @vitest-environment node
/**
 * A5 · E17 degrau 2, Tarefa 15 (parte de integração): `criarChaveDoPerfil` de verdade, o check da MG11, o SQL de revogação do
 * runbook (lido do arquivo) e o privilégio/equivalência das funções `_as`. Dado sintético; limpa no fim.
 * Banco: SÓ o `bythiago_int` (a MG11 já aplicada), com a API (54421) para `from` e `rpc`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run --no-file-parallelism test/integration/observatorio-a5-e17-d2-chaves.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite, insertAuthUser, deleteAuthUser } from '../helpers/db-seed'
import { definirSessao } from '../helpers/mg11'
import { criarChaveDoPerfil, type DepsDeCriar } from '@/lib/youtube/observatorio/acesso-ia/criar-chave'
import { apagarSitesDeTeste } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const PERFIL = 'observatorio_leitura'
const RUNBOOK = resolve(__dirname, '..', '..', '..', '..', 'docs', 'ops', 'observatorio-acesso-ia.md')

/** O SQL de revogação, lido do runbook (não copiado aqui): o bloco ```sql depois do título "Revogar uma chave do perfil". */
function sqlDeRevogar(): string {
  const texto = readFileSync(RUNBOOK, 'utf8')
  const depois = texto.slice(texto.indexOf('## Revogar uma chave do perfil'))
  const m = /```sql\n([\s\S]*?)```/.exec(depois)
  if (!m) throw new Error('runbook: bloco SQL de revogação não encontrado')
  return m[1]!.trim()
}
const comNome = (sql: string, nome: string): string => sql.replace('<nome exato da chave>', nome.replace(/'/g, "''"))

/** Cada execução abre uma conexão nova, sem transação aberta, e fecha (é o que o painel faz). */
async function rodar<T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<{ rowCount: number; rows: T[] }> {
  const c = new Client({ connectionString: PG_URL })
  await c.connect()
  try {
    const r = await c.query(sql, params)
    return { rowCount: r.rowCount ?? 0, rows: r.rows as T[] }
  } finally { await c.end() }
}

describe.skipIf(skipIfNoLocalDb())('E17 d2 T15: criar-chave contra o banco (bythiago_int)', () => {
  const sufixo = `${Date.now()}-${randomBytes(3).toString('hex')}`
  const real: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  // A listagem do Auth (GoTrue) quebra neste banco compartilhado: outros testes deixam usuários inseridos à mão com confirmation_token
  // nulo ("Scan error ... converting NULL to string"), e isso derruba o /admin/users de todo mundo. Só a listagem vem do `auth.users`
  // por pg (mesmos campos id e email, mesma paginação); o resto do cliente (from, rpc, insert) é o real.
  const sb: SupabaseClient = new Proxy(real, {
    get(alvo, chave, receptor) {
      if (chave !== 'auth') return Reflect.get(alvo, chave, receptor)
      const admin = {
        listUsers: async ({ page = 1, perPage = 50 }: { page?: number; perPage?: number } = {}) => {
          const r = await rodar<{ id: string; email: string | null }>(`select id, email from auth.users order by created_at, id limit $1 offset $2`, [perPage, (page - 1) * perPage])
          return { data: { users: r.rows }, error: null }
        },
      }
      return { admin }
    },
  })
  const emailAna = `ana-${sufixo}@example.test`
  const emailBia = `bia-${sufixo}@example.test`
  const emailSem = `sem-${sufixo}@example.test`
  let siteA = ''
  let siteB = ''
  let ana = ''
  let bia = ''
  let sem = ''
  const nomes: string[] = []

  const deps = (): DepsDeCriar => ({ sb, agora: () => Date.now(), e19: () => ({ ok: true }), excecaoEm: 'excecao-sintetica', aleatorio: (n) => randomBytes(n) })
  const venc = (dias: number): string => new Date(Date.now() + dias * 86_400_000).toISOString()

  beforeAll(async () => {
    const existe = await rodar<{ ok: boolean }>(`select to_regclass('public.site_private_viewers') is not null and exists (select 1 from information_schema.columns where table_name='pipeline_api_keys' and column_name='expires_at') as ok`)
    if (!existe.rows[0]?.ok) throw new Error('a MG11 não está aplicada neste banco (use o bythiago_int, 54422)')
    siteA = (await seedSite(sb)).siteId
    siteB = (await seedSite(sb)).siteId
    ana = await insertAuthUser(emailAna)
    bia = await insertAuthUser(emailBia)
    sem = await insertAuthUser(emailSem)
    await rodar(`insert into public.site_memberships (site_id, user_id, role) values ($1,$2,'editor'), ($1,$3,'editor')`, [siteA, ana, bia])
  })

  afterAll(async () => {
    await rodar(`delete from public.pipeline_api_keys where site_id = any($1::uuid[])`, [[siteA, siteB]]).catch(() => undefined)
    await rodar(`delete from public.site_memberships where site_id = any($1::uuid[])`, [[siteA, siteB]]).catch(() => undefined)
    await apagarSitesDeTeste('id = any($1::uuid[])', [[siteA, siteB]]).catch(() => undefined)
    for (const u of [ana, bia, sem]) if (u) await deleteAuthUser(u).catch(() => undefined)
  })

  it('criarChaveDoPerfil de verdade grava a linha, e o check do banco a aceita', async () => {
    const r = await criarChaveDoPerfil(deps(), { email: emailAna })
    expect(r, JSON.stringify(r)).toMatchObject({ ok: true })
    if (!r.ok) return
    expect(r.siteId).toBe(siteA)
    expect(r.chave).toMatch(/^obs_[A-Za-z0-9_-]{43}$/)
    expect(r.nome).toMatch(/^observatorio-\d{8}-[0-9a-f]{4}$/)
    const l = await rodar<{ site_id: string; key_hash: string; permissions: string[]; user_id: string; created_by: string | null; revoked_at: string | null; expires_at: Date }>(
      `select * from public.pipeline_api_keys where name = $1`, [r.nome])
    expect(l.rowCount).toBe(1)
    const linha = l.rows[0]!
    expect(linha.permissions).toEqual([PERFIL])
    expect(linha.site_id).toBe(siteA)
    expect(linha.user_id).toBe(ana)
    expect(linha.created_by).toBeNull()
    expect(linha.revoked_at).toBeNull()
    expect(linha.key_hash).toBe(createHash('sha256').update(r.chave).digest('hex'))
    expect(linha.expires_at.toISOString()).toBe(r.venceEm)
    // o texto da chave nunca vai ao banco
    const achou = await rodar(`select 1 from public.pipeline_api_keys where key_hash = $1 or name = $1`, [r.chave])
    expect(achou.rowCount).toBe(0)
    nomes.push(r.nome)
  })

  it('as recusas do núcleo contra o banco real: sem acesso ao site, e a renovação longe do vencimento', async () => {
    expect(await criarChaveDoPerfil(deps(), { email: emailSem })).toMatchObject({ ok: false, recusa: 'sem_acesso_ao_site' })
    expect(await criarChaveDoPerfil(deps(), { email: `ninguem-${sufixo}@example.test` })).toMatchObject({ ok: false, recusa: 'email_ausente' })
    // Ana já tem uma chave com 180 dias de vida: não é hora de renovar
    expect(await criarChaveDoPerfil(deps(), { email: emailAna })).toMatchObject({ ok: false, recusa: 'ja_tem_chave' })
    // a recusa não gravou nada
    const n = await rodar(`select 1 from public.pipeline_api_keys where site_id = $1`, [siteA])
    expect(n.rowCount).toBe(1)
  })

  it('tentar inserir à mão uma chave com [observatorio_leitura, read]: o banco recusa (check da MG11)', async () => {
    await expect(rodar(
      `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, expires_at) values ($1, $2, 'h', array['observatorio_leitura','read'], $3)`,
      [siteB, `mao-${sufixo}`, venc(30)],
    )).rejects.toMatchObject({ code: '23514' })
    const n = await rodar(`select 1 from public.pipeline_api_keys where name = $1`, [`mao-${sufixo}`])
    expect(n.rowCount).toBe(0)
  })

  describe('o SQL de revogação do runbook', () => {
    const sql = sqlDeRevogar()
    const nRead = `rev-read-${sufixo}`
    const nIntel = `rev-intel-${sufixo}`
    const nTudo = `rev-tudo-${sufixo}`
    const nPerfil = `observatorio-20000101-rv${sufixo.slice(-2)}`
    const nDupla = `observatorio-20000102-du${sufixo.slice(-2)}`
    const nVelha = `observatorio-20000103-ve${sufixo.slice(-2)}`
    const inserir = (nome: string, perms: string[], revogada: string | null = null) => rodar(
      `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, expires_at, revoked_at) values ($1,$2,$3,$4::text[],$5,$6)`,
      [siteB, nome, randomUUID(), perms, perms.includes(PERFIL) ? venc(100) : null, revogada])
    const fotos = async (ns: string[]): Promise<Record<string, string>> => {
      const r = await rodar<{ name: string; j: string }>(`select name, row_to_json(k)::text as j from public.pipeline_api_keys k where name = any($1::text[])`, [ns])
      return Object.fromEntries(r.rows.map((x) => [x.name, x.j]))
    }

    beforeAll(async () => {
      await inserir(nRead, ['read'])
      await inserir(nIntel, ['intelligence'])
      await inserir(nTudo, ['read', 'write', 'admin'])
      await inserir(nPerfil, [PERFIL])
      await inserir(nDupla, [PERFIL]); await inserir(nDupla, [PERFIL])
      await inserir(nVelha, [PERFIL], '2000-01-05T00:00:00Z')
    })

    it('é uma instrução só, com as quatro condições (lida do arquivo)', () => {
      expect(sql).not.toMatch(/\b(begin|commit|rollback)\b/i)
      expect(sql.match(/\bupdate\b/gi)).toHaveLength(1)
      expect(sql).toMatch(/returning/i)
      expect(sql).toContain('<nome exato da chave>')
      expect(sql).toMatch(/k\.name = '/)
      expect(sql).toMatch(/k\.permissions = array\['observatorio_leitura'\]/)
      expect(sql).toMatch(/revoked_at is null/)
      expect(sql).toMatch(/select count\(\*\)[\s\S]*= 1/)
      expect(readFileSync(RUNBOOK, 'utf8')).toContain('rode em seguida a consulta de ver as chaves')
    })

    it('0 linhas com o nome de uma read, de uma intelligence e de uma read+write+admin; 1 com o nome exato do perfil; as outras ficam iguais byte a byte', async () => {
      const todos = [nRead, nIntel, nTudo, nPerfil]
      const antes = await fotos(todos)
      for (const n of [nRead, nIntel, nTudo]) expect((await rodar(comNome(sql, n))).rowCount).toBe(0)
      expect(await fotos(todos)).toEqual(antes)
      const r = await rodar<{ name: string; revoked_at: Date }>(comNome(sql, nPerfil))
      expect(r.rowCount).toBe(1)
      expect(r.rows[0]!.name).toBe(nPerfil)
      // lida noutra conexão depois
      const depois = await fotos(todos)
      for (const n of [nRead, nIntel, nTudo]) expect(depois[n]).toBe(antes[n])
      expect(depois[nPerfil]).not.toBe(antes[nPerfil])
      const l = await rodar<{ revoked_at: Date | null }>(`select revoked_at from public.pipeline_api_keys where name = $1`, [nPerfil])
      expect(l.rows[0]!.revoked_at).not.toBeNull()
    })

    it('duas do perfil com o mesmo nome: 0 linhas, e as duas seguem sem revogação', async () => {
      expect((await rodar(comNome(sql, nDupla))).rowCount).toBe(0)
      const l = await rodar(`select 1 from public.pipeline_api_keys where name = $1 and revoked_at is null`, [nDupla])
      expect(l.rowCount).toBe(2)
    })

    it('nome que não existe: 0 linhas; chave já revogada: 0 linhas e a data antiga não muda', async () => {
      expect((await rodar(comNome(sql, `nao-existe-${sufixo}`))).rowCount).toBe(0)
      const antes = await fotos([nVelha])
      expect((await rodar(comNome(sql, nVelha))).rowCount).toBe(0)
      expect(await fotos([nVelha])).toEqual(antes)
    })
  })

  it('as funções _as não são executáveis por anon nem authenticated (item 236)', async () => {
    for (const f of ['can_view_site_as(uuid, uuid)', 'can_view_private_site_as(uuid, uuid)']) {
      for (const papel of ['anon', 'authenticated']) {
        const r = await rodar<{ p: boolean }>(`select has_function_privilege($1, $2, 'execute') as p`, [papel, `public.${f}`])
        expect(r.rows[0]!.p, `${papel} ${f}`).toBe(false)
      }
      const s = await rodar<{ p: boolean }>(`select has_function_privilege('service_role', $1, 'execute') as p`, [`public.${f}`])
      expect(s.rows[0]!.p).toBe(true)
    }
  })

  it('can_view_site_as(u, s) é igual a can_view_site(s) com a sessão de u, mesmo com o GUC app.site_id forjado (item 236)', async () => {
    const pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    try {
      for (const u of [ana, bia, sem]) {
        for (const s of [siteA, siteB]) {
          await pg.query('begin')
          try {
            const as = await pg.query<{ v: boolean }>(`select public.can_view_site_as($1, $2) as v`, [u, s])
            for (const guc of [siteA, siteB, '']) {
              await definirSessao(pg, u)
              await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
              await pg.query('set local role authenticated')
              const sessao = await pg.query<{ v: boolean }>(`select public.can_view_site($1) as v`, [s])
              await pg.query('reset role')
              expect(sessao.rows[0]!.v, `u=${u === ana ? 'ana' : u === bia ? 'bia' : 'sem'} guc=${guc}`).toBe(as.rows[0]!.v)
            }
          } finally { await pg.query('rollback') }
        }
      }
    } finally { await pg.end() }
    expect((await rodar<{ v: boolean }>(`select public.can_view_site_as($1,$2) as v`, [ana, siteA])).rows[0]!.v).toBe(true)
    expect((await rodar<{ v: boolean }>(`select public.can_view_site_as($1,$2) as v`, [ana, siteB])).rows[0]!.v).toBe(false)
    expect((await rodar<{ v: boolean }>(`select public.can_view_site_as($1,$2) as v`, [sem, siteA])).rows[0]!.v).toBe(false)
  })
})
