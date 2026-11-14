// @vitest-environment node
/**
 * C1 T23 (C1-17, consulta): a consulta de 4.3 devolve as cinco classes, inclusive "pessoa apagada, chamada antiga do ChatGPT continua
 * `chatgpt`". Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/c1-consulta-4-3.test.ts
 * O texto vem de docs/ops/observatorio-c1-consulta-4-3.sql (o mesmo do runbook). Outra sessão escreve no mesmo banco: o teste só olha o
 * site que ele mesmo criou (único filtro acrescentado ao texto, conferido abaixo).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, insertAuthUser, deleteAuthUser } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const ORIGINAL = readFileSync(resolve(__dirname, '../../../../docs/ops/observatorio-c1-consulta-4-3.sql'), 'utf8')
const ANCORA = 'where l.at > now()'

describe.skipIf(skipIfNoLocalDb())('C1 T23: consulta 4.3 do registro (banco local)', () => {
  let pg: Client
  let siteId = ''
  let pessoa = ''
  let apagada = ''
  const keys: string[] = []
  const users: string[] = []

  const chave = async (nome: string): Promise<string> => {
    const k = await pg.query(
      `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, user_id, expires_at, created_by)
       values ($1, $2, $3, array['observatorio_leitura']::text[], $4, now() + interval '30 days', null) returning id`,
      [siteId, nome, randomUUID(), pessoa])
    const id = String(k.rows[0].id); keys.push(id); return id
  }
  const log = async (o: { origin: string; keyId: string | null; userId: string | null; params?: Record<string, unknown>; result?: string; action?: string }) =>
    pg.query(
      `insert into public.obs_ai_access_log (site_id, user_id, key_id, origin, action, params, included_private, output_chars, result)
       values ($1, $2, $3, $4, $5, $6::jsonb, false, null, $7)`,
      [siteId, o.userId, o.keyId, o.origin, o.action ?? 'definicoes', JSON.stringify(o.params ?? {}), o.result ?? 'ok'])
  const consulta = async () => {
    expect(ORIGINAL).toContain(ANCORA)
    const texto = ORIGINAL.replace(ANCORA, 'where l.site_id = $1 and l.at > now()')
    return (await pg.query(texto, [siteId])).rows as Array<{ email: string | null; action: string; result: string; desfecho: string | null; cliente: string }>
  }

  beforeAll(async () => {
    const sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId
    pessoa = await insertAuthUser(`c1t23-${randomUUID()}@example.test`); users.push(pessoa)
    apagada = await insertAuthUser(`c1t23-${randomUUID()}@example.test`); users.push(apagada)
  })
  afterAll(async () => {
    try {
      await pg.query(`delete from public.obs_ai_access_log where site_id = $1`, [siteId])
      await pg.query(`delete from public.pipeline_api_keys where id = any($1::uuid[])`, [keys])
      await pg.query(`delete from public.site_memberships where site_id = $1`, [siteId])
      await pg.query(`delete from public.audit_log where site_id = $1`, [siteId])
      if (siteId) await apagarSites(pg, 'id = any($1::uuid[])', [[siteId]])
      for (const u of users) await deleteAuthUser(u).catch(() => undefined)
    } finally {
      await pg.end()
    }
  })

  it('devolve as cinco classes; a pessoa apagada fica sem e-mail e a chamada antiga do ChatGPT continua "chatgpt"', async () => {
    const chatgpt = await chave(`observatorio-oauth-chatgpt-${randomUUID().slice(0, 8)}`)
    const claude = await chave(`observatorio-oauth-claude-${randomUUID().slice(0, 8)}`)
    const manual = await chave(`observatorio-${randomUUID().slice(0, 8)}`)
    await log({ origin: 'mcp', keyId: chatgpt, userId: apagada, action: 'canal' })   // a que sobrevive à exclusão
    await log({ origin: 'mcp', keyId: chatgpt, userId: pessoa, action: 'video' })
    await log({ origin: 'mcp', keyId: claude, userId: pessoa, action: 'destaques' })
    await log({ origin: 'mcp', keyId: manual, userId: pessoa, action: 'serie' })
    await log({ origin: 'botao', keyId: null, userId: pessoa, action: 'pacote_da_tela' })
    await log({ origin: 'oauth', keyId: null, userId: pessoa, action: 'consentimento', params: { cliente: 'claude', desfecho: 'aprovado' } })
    await log({ origin: 'oauth', keyId: null, userId: pessoa, action: 'consentimento', result: 'recusado', params: { cliente: 'chatgpt', desfecho: 'sem_direito', motivo: 'nao_liberada' } })
    await log({ origin: 'oauth', keyId: null, userId: pessoa, action: 'consentimento', params: {} })

    await deleteAuthUser(apagada)
    users.splice(users.indexOf(apagada), 1)

    const linhas = await consulta()
    const por = (a: string) => linhas.find((l) => l.action === a)!
    expect(por('canal')).toMatchObject({ cliente: 'chatgpt', email: null })
    expect(por('video').cliente).toBe('chatgpt')
    expect(por('video').email).toMatch(/^c1t23-/)
    expect(por('destaques').cliente).toBe('claude')
    expect(por('serie').cliente).toBe('chave')
    expect(por('pacote_da_tela').cliente).toBe('botao')
    const consent = linhas.filter((l) => l.action === 'consentimento').map((l) => `${l.cliente}/${l.desfecho ?? '-'}`).sort()
    expect(consent).toEqual(['consentimento:?/-', 'consentimento:chatgpt/sem_direito', 'consentimento:claude/aprovado'])
    expect(new Set(linhas.map((l) => l.cliente.split(':')[0]))).toEqual(new Set(['chatgpt', 'claude', 'chave', 'botao', 'consentimento']))
  })

  it('chave apagada (key_id nulo, origem mcp) cai em "sem_chave", nunca em "chave"', async () => {
    await log({ origin: 'mcp', keyId: null, userId: pessoa, action: 'sugestoes' })
    const l = (await consulta()).find((x) => x.action === 'sugestoes')!
    expect(l.cliente).toBe('sem_chave')
  })
})
