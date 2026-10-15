// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 9: o registro do botão "Perguntar a uma IA" (`registrarAcesso`) contra Postgres de verdade. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e17-d1-registro.test.ts --no-file-parallelism
 * (a chave de serviço: `supabase status --workdir ~/.local/share/bythiago-db-int -o env`; as chaves de demonstração do `db-seed` valem se o JWT secret for o padrão.)
 * A decisão de rodar ou pular é tomada na COLETA (valor síncrono para `skipIf`), com `situacaoDaTabela`. O único teste que fica pulado de propósito e
 * para sempre é o do bloco de controle da tabela fantasma; ele RODADO é defeito.
 * RLS com o GUC `app.site_id` forjado, papel sem superusuário. Função sem EXECUTE nunca é chamada como anon/authenticated.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { situacaoDaTabela } from '../helpers/espera-a-mg11'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.mock('server-only', () => ({}))
vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

async function decidir(nome: string, lista?: readonly string[]): Promise<'roda' | 'pula'> {
  if (skipIfNoLocalDb()) return 'pula'
  const c = new Client({ connectionString: PG_URL })
  await c.connect()
  try { return await (lista ? situacaoDaTabela(c, nome, lista) : situacaoDaTabela(c, nome)) } finally { await c.end() }
}
const situacao = await decidir('obs_ai_access_log')
const fantasma = await decidir('obs_tabela_que_nao_existe', ['obs_tabela_que_nao_existe'])

describe.skipIf(situacao === 'pula')('A5 E17 D1: o registro do botão contra o banco (bythiago_int)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const orgs: string[] = []
  const usuarios: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        await pg.query('delete from public.obs_ai_access_log where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
      }
      if (orgs.length > 0) await pg.query('delete from public.organization_members where org_id = any($1::uuid[])', [orgs])
      if (usuarios.length > 0) await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
      // os deletes acima disparam auditoria nova (site e organização); limpa de novo antes dos donos
      await pg.query('delete from public.audit_log where site_id = any($1::uuid[]) or org_id = any($2::uuid[])', [sites, orgs])
      if (sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      if (orgs.length > 0) await pg.query('delete from public.organizations where id = any($1::uuid[])', [orgs])
    } finally { await pg.end() }
  })

  interface Cen { siteA: string; siteB: string; admin: string; editor: string; semVinculo: string }
  /** Dois sites em organizações-filhas distintas; admin = org_admin da organização do site A; editor = editor de A; sem vínculo. */
  async function cenario(): Promise<Cen> {
    const mestra = String((await pg.query('select id from public.organizations where parent_org_id is null limit 1')).rows[0]?.id ?? '')
    expect(mestra, 'a organização mestra existe no banco de integração').not.toBe('')
    const a = await seedSite(sb, { parentOrgId: mestra }); sites.push(a.siteId); orgs.push(a.orgId)
    const b = await seedSite(sb, { parentOrgId: mestra }); sites.push(b.siteId); orgs.push(b.orgId)
    const u = { admin: randomUUID(), editor: randomUUID(), semVinculo: randomUUID() }
    for (const id of Object.values(u)) {
      usuarios.push(id)
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@e17d1.test'])
    }
    await pg.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [a.orgId, u.admin])
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [a.siteId, u.editor])
    return { siteA: a.siteId, siteB: b.siteId, ...u }
  }

  async function gravar(siteId: string, userId: string) {
    const { registrarAcesso } = await import('@/lib/youtube/observatorio/contexto-ia/registrar-acesso')
    return registrarAcesso({ siteId, userId, tela: 'comparar', params: { tela: 'comparar', estado: ['a=1'], total: 40, privado: 'na' }, incluiuPrivado: false, caracteres: 12_345 })
  }

  type Quem = 'admin' | 'editor' | 'semVinculo' | 'anon'
  /** Roda `sql` como `quem`, GUC `app.site_id` forjado para `guc`, papel sem superusuário, transação desfeita. */
  async function como(c: Cen, quem: Quem, sql: string, params: unknown[] = [], guc = ''): Promise<{ rows: number; code: string | null }> {
    await pg.query('begin')
    try {
      if (quem !== 'anon') {
        await pg.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [JSON.stringify({ sub: c[quem], role: 'authenticated' }), c[quem]])
      }
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query(quem === 'anon' ? 'set local role anon' : 'set local role authenticated')
      const r = await pg.query(sql, params)
      return { rows: r.rowCount ?? 0, code: null }
    } catch (e) {
      return { rows: 0, code: (e as { code?: string }).code ?? 'erro' }
    } finally { await pg.query('rollback') }
  }

  it('registrarAcesso de verdade grava a linha, e ela é lida de volta com origin botao, key_id nulo, params sem a pergunta e com o ambiente', async () => {
    const c = await cenario()
    expect(await gravar(c.siteA, c.editor)).toEqual({ ok: true })
    const r = await pg.query('select * from public.obs_ai_access_log where site_id = $1', [c.siteA])
    expect(r.rowCount).toBe(1)
    const l = r.rows[0]
    expect(l).toMatchObject({ origin: 'botao', action: 'pacote:comparar', result: 'ok', included_private: false, output_chars: 12_345, key_id: null, user_id: c.editor })
    expect(l.params).toMatchObject({ tela: 'comparar', total: 40, privado: 'na' })
    expect(typeof l.params.ambiente).toBe('string')
    expect(JSON.stringify(l.params)).not.toMatch(/pergunta/i)
  })

  it('o check de origin e o de result aceitam os valores usados e recusam os outros (23514)', async () => {
    const c = await cenario()
    const ins = (origin: string, result: string) => pg.query(
      `insert into public.obs_ai_access_log (site_id, origin, action, included_private, result) values ($1, $2, 'pacote:x', false, $3)`, [c.siteA, origin, result])
    await expect(ins('botao', 'ok')).resolves.toBeDefined()
    await expect(ins('mcp', 'recusado')).resolves.toBeDefined()
    await expect(ins('botao', 'limite')).resolves.toBeDefined()
    await expect(ins('api', 'ok')).rejects.toMatchObject({ code: '23514' })
    await expect(ins('botao', 'talvez')).rejects.toMatchObject({ code: '23514' })
  })

  it('usuário comum (editor ou sem vínculo) e anon NÃO leem a linha, mesmo forjando o GUC; e NÃO inserem, atualizam nem apagam', async () => {
    const c = await cenario()
    await gravar(c.siteA, c.editor)
    const ler = 'select 1 from public.obs_ai_access_log where site_id = $1'
    for (const quem of ['editor', 'semVinculo'] as const) {
      for (const guc of ['', c.siteA, c.siteB]) expect((await como(c, quem, ler, [c.siteA], guc)).rows, `${quem}, GUC "${guc.slice(0, 4)}"`).toBe(0)
      const ins = await como(c, quem, `insert into public.obs_ai_access_log (site_id, origin, action, included_private, result) values ($1, 'botao', 'x', false, 'ok')`, [c.siteA], c.siteA)
      expect(ins.code, `insert de ${quem}`).toBe('42501')
      expect((await como(c, quem, 'update public.obs_ai_access_log set action = action where site_id = $1', [c.siteA], c.siteA)).code, `update de ${quem}`).toBe('42501')
      expect((await como(c, quem, 'delete from public.obs_ai_access_log where site_id = $1', [c.siteA], c.siteA)).code, `delete de ${quem}`).toBe('42501')
    }
    expect((await como(c, 'anon', ler, [c.siteA], c.siteA)).code).toBe('42501')
    expect(Number((await pg.query('select count(*) as n from public.obs_ai_access_log where site_id = $1', [c.siteA])).rows[0].n)).toBe(1)
  })

  it('o administrador do site lê a linha do SEU site (controle positivo) e não escreve', async () => {
    const c = await cenario()
    await gravar(c.siteA, c.editor)
    expect((await como(c, 'admin', 'select 1 from public.obs_ai_access_log where site_id = $1', [c.siteA])).rows).toBe(1)
    expect((await como(c, 'admin', `insert into public.obs_ai_access_log (site_id, origin, action, included_private, result) values ($1, 'botao', 'x', false, 'ok')`, [c.siteA])).code).toBe('42501')
  })

  it('a linha de OUTRO site não aparece para o administrador deste (prova por mutação: gravada no site A, aparece; gravada no B, some)', async () => {
    const c = await cenario()
    await gravar(c.siteB, c.editor)
    const doSiteB = await como(c, 'admin', 'select 1 from public.obs_ai_access_log where site_id = $1', [c.siteB], c.siteB)
    expect(doSiteB.rows, 'admin do A não lê a linha do B, nem com o GUC do B').toBe(0)
    expect((await como(c, 'admin', 'select 1 from public.obs_ai_access_log', [], c.siteB)).rows, 'sem filtro nenhum').toBe(0)
    // mutação: a mesma gravação com o site_id do admin faz a leitura enxergar a linha — se a política vazasse, o caso acima já teria visto
    await gravar(c.siteA, c.editor)
    expect((await como(c, 'admin', 'select 1 from public.obs_ai_access_log', [], '')).rows).toBe(1)
  })

  it('registrarAcesso nunca lança: site inexistente (FK) devolve ok:false com código', async () => {
    const c = await cenario()
    const r = await gravar(randomUUID(), c.editor)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('23503')
  })

  it('apagar a pessoa (LGPD) anula user_id e mantém a linha', async () => {
    const c = await cenario()
    await gravar(c.siteA, c.editor)
    await pg.query('delete from public.site_memberships where user_id = $1', [c.editor])
    await pg.query('delete from auth.users where id = $1', [c.editor])
    const r = await pg.query('select user_id from public.obs_ai_access_log where site_id = $1', [c.siteA])
    expect(r.rows).toEqual([{ user_id: null }])
  })
})

describe('A5 E17 D1: o mecanismo de pulo (controle da tabela fantasma)', () => {
  it('com banco, a tabela que nunca existe, na lista de espera, dá "pula"', () => {
    if (skipIfNoLocalDb()) return
    expect(fantasma).toBe('pula')
  })
})
describe.skipIf(fantasma === 'pula')('A5 E17 D1: bloco que só roda se o pulo quebrar', () => {
  it('nunca deve rodar (único teste pulado de propósito e para sempre)', () => {
    throw new Error('rodou: o pulo não funcionou')
  })
})
