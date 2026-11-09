// @vitest-environment node
/**
 * A2 · Tarefa 7: a chave do perfil de um REPORTER (a irmã) continua valendo depois da MG19, sem código novo.
 * Passo 6 da porta = `can_view_site_as` (vínculo, qualquer papel): inalterado. O privado é `can_view_private_site_as` (linha em vigor + vínculo):
 * sem concessão a rota recusa `sem_direito`; com concessão devolve o token; com a concessão retirada, recusa de novo.
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run --no-file-parallelism test/integration/a2-chave-reporter.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedRbacScenario, cleanupRbacScenario, type RbacScenario } from '../helpers/db-seed'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

vi.mock('@/lib/pipeline/leitura-modo', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/pipeline/leitura-modo')>()
  return { ...real, modoLeitura: () => ({ ...real.modoLeitura(), modo: 'recusa' as const }) }
})
vi.mock('@/lib/youtube/observatorio/acesso-ia/regras', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/youtube/observatorio/acesso-ia/regras')>()
  return { ...real, ACESSO_IA_RULES: { ...real.ACESSO_IA_RULES, e19RecusaConferidaEm: '2026-10-20' } }
})
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// cliente de serviço REAL (banco local), menos a leitura do Auth/GoTrue: o usuário do teste é inserido à mão e o GoTrue não o carrega
vi.mock('@/lib/supabase/service', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const real = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321', process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const cliente = new Proxy(real, {
    get(alvo, chave, receptor) {
      if (chave !== 'auth') return Reflect.get(alvo, chave, receptor)
      return { admin: { getUserById: async () => ({ data: { user: { banned_until: null } }, error: null }) } }
    },
  })
  return { getSupabaseServiceClient: () => cliente }
})

import { abrirPorta } from '@/lib/youtube/observatorio/acesso-ia/porta'
import { provarAcessoPrivadoDaChave } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { ChaveLida } from '@/lib/pipeline/chave'

describe.skipIf(skipIfNoLocalDb())('A2 T7: a chave do perfil de um reporter', () => {
  let pg: Client
  let admin: SupabaseClient
  let s: RbacScenario
  const ENV_ON = { OBSERVATORIO_IA_EXTERNA: 'on' } as NodeJS.ProcessEnv
  const chaveDe = (userId: string, siteId: string): ChaveLida => ({
    id: 'k1', siteId, name: 'observatorio-a2', permissions: ['observatorio_leitura'], userId, expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  })

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    s = await seedRbacScenario(admin)
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    await pg?.query('delete from public.site_private_viewers where site_id = $1', [s.siteAId]).catch(() => undefined)
    await pg?.end()
    await cleanupRbacScenario(admin, s)
  })

  async function porta(userId: string, siteId: string) {
    const r = await abrirPorta(chaveDe(userId, siteId), false, Date.now(), ENV_ON)
    if (!r.ok) throw new Error(`a porta recusou: ${r.recusa.motivo}`)
    return r.prova
  }

  it('a porta deixa o reporter passar (passo 6 = vínculo, qualquer papel); quem não tem vínculo é recusado', async () => {
    await expect(porta(s.reporterAId, s.siteAId)).resolves.toBeTruthy()
    const r = await abrirPorta(chaveDe(s.randomId, s.siteAId), false, Date.now(), ENV_ON)
    expect(r.ok).toBe(false)
    const outro = await abrirPorta(chaveDe(s.reporterAId, s.siteBId), false, Date.now(), ENV_ON)
    expect(outro.ok).toBe(false)
  })

  it('sem concessão: a rota privada recusa sem_direito; com concessão devolve o token; retirada, recusa de novo', async () => {
    const prova = await porta(s.reporterAId, s.siteAId)
    const antes = await provarAcessoPrivadoDaChave(prova)
    expect(antes).toMatchObject({ leitura: null, edita: false, negativa: 'sem_direito' })

    await pg.query(`insert into public.site_private_viewers (site_id, user_id, granted_by) values ($1,$2,$3)`, [s.siteAId, s.reporterAId, s.superAdminId])
    const com = await provarAcessoPrivadoDaChave(prova)
    expect(com.leitura).not.toBeNull()
    expect(com).toMatchObject({ edita: false, negativa: null })

    await pg.query(`update public.site_private_viewers set revoked_at = now(), revoked_by = $3 where site_id = $1 and user_id = $2`, [s.siteAId, s.reporterAId, s.superAdminId])
    const depois = await provarAcessoPrivadoDaChave(prova)
    expect(depois).toMatchObject({ leitura: null, edita: false, negativa: 'sem_direito' })
  })

  it('controle: o editor do mesmo site lê o privado pela chave sem concessão (can_view_private_site_as: edita)', async () => {
    const prova = await porta(s.editorAId, s.siteAId)
    const r = await provarAcessoPrivadoDaChave(prova)
    expect(r.leitura).not.toBeNull()
  })
})
