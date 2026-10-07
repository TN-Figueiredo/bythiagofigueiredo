// @vitest-environment node
// O degrau "administrar o site" (2026-10-07): `requireSiteAdminScope` pergunta
// `can_admin_site_users(site_id)` ao banco. Este sistema falha em verde e o
// dono é o único usuário real — o pior resultado é trancar o dono. Então a
// prova que importa é: o DONO (org_admin da organização RAIZ, sem nenhuma linha
// em site_memberships) passa; a editora de site e quem não tem vínculo não.
//
// Fala com o PostgREST como `authenticated` (JWT de usuário comum, nunca
// service role/superusuário): o mesmo caminho da tela.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  ANON_KEY,
  insertAuthUser,
  deleteAuthUser,
  seedSite,
  signUserJwt,
} from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function clientAs(userId: string): SupabaseClient {
  // Papel 'user' no JWT: nada aqui pode depender de app_metadata.role.
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${signUserJwt(userId, 'user').jwt}` } },
  })
}

describe.skipIf(skipIfNoLocalDb())('degrau "administrar o site": can_admin_site_users como usuário autenticado', () => {
  let service: SupabaseClient
  let rootOrgId = ''
  let rootSiteId = '' // site da organização raiz (o caso de produção)
  let childOrgId = ''
  let childSiteId = ''
  let ownerId = ''
  let childAdminId = ''
  let editorId = ''
  let reporterId = ''
  let strangerId = ''
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`

  beforeAll(async () => {
    service = getSupabaseServiceClient()
    const root = await seedSite(service) // reaproveita a organização raiz existente
    rootOrgId = root.orgId
    rootSiteId = root.siteId
    const child = await seedSite(service, { parentOrgId: rootOrgId })
    childOrgId = child.orgId
    childSiteId = child.siteId

    ownerId = await insertAuthUser(`degrau-dono-${stamp}@example.test`)
    childAdminId = await insertAuthUser(`degrau-orgadmin-${stamp}@example.test`)
    editorId = await insertAuthUser(`degrau-editora-${stamp}@example.test`)
    reporterId = await insertAuthUser(`degrau-reporter-${stamp}@example.test`)
    strangerId = await insertAuthUser(`degrau-semvinculo-${stamp}@example.test`)

    const members = await service.from('organization_members').insert([
      { org_id: rootOrgId, user_id: ownerId, role: 'org_admin' },
      { org_id: childOrgId, user_id: childAdminId, role: 'org_admin' },
    ])
    expect(members.error).toBeNull()
    const sites = await service.from('site_memberships').insert([
      { site_id: rootSiteId, user_id: editorId, role: 'editor' },
      { site_id: childSiteId, user_id: editorId, role: 'editor' },
      { site_id: rootSiteId, user_id: reporterId, role: 'reporter' },
    ])
    expect(sites.error).toBeNull()
  })

  afterAll(async () => {
    const users = [ownerId, childAdminId, editorId, reporterId, strangerId].filter(Boolean)
    for (const siteId of [rootSiteId, childSiteId]) {
      if (siteId) await service.from('site_memberships').delete().eq('site_id', siteId)
    }
    if (users.length) await service.from('organization_members').delete().in('user_id', users)
    // Os triggers de auditoria apontam para site/org; sem apagar, a FK segura as linhas.
    for (const siteId of [rootSiteId, childSiteId]) {
      if (siteId) await service.from('audit_log').delete().eq('site_id', siteId)
    }
    if (childOrgId) await service.from('audit_log').delete().eq('org_id', childOrgId)
    for (const id of users) await deleteAuthUser(id)
    for (const siteId of [rootSiteId, childSiteId]) {
      if (siteId) expect((await service.from('sites').delete().eq('id', siteId)).error).toBeNull()
    }
    if (childOrgId) expect((await service.from('organizations').delete().eq('id', childOrgId)).error).toBeNull()
  })

  async function canAdmin(userId: string, siteId: string): Promise<unknown> {
    const res = await clientAs(userId).rpc('can_admin_site_users', { p_site_id: siteId })
    expect(res.error).toBeNull()
    return res.data
  }

  it('o DONO (org_admin da org raiz, SEM linha em site_memberships) administra o site', async () => {
    const own = await service.from('site_memberships').select('site_id').eq('user_id', ownerId)
    expect(own.error).toBeNull()
    expect(own.data).toEqual([]) // é exatamente a situação do dono em produção
    expect(await canAdmin(ownerId, rootSiteId)).toBe(true)
    expect(await canAdmin(ownerId, childSiteId)).toBe(true) // super_admin vale para todo site
  })

  it('org_admin de uma org filha administra só os sites dela', async () => {
    expect(await canAdmin(childAdminId, childSiteId)).toBe(true)
    expect(await canAdmin(childAdminId, rootSiteId)).toBe(false)
  })

  it('editora de site EDITA mas NÃO administra (é o degrau)', async () => {
    for (const siteId of [rootSiteId, childSiteId]) {
      const edit = await clientAs(editorId).rpc('can_edit_site', { p_site_id: siteId })
      expect(edit.error).toBeNull()
      expect(edit.data).toBe(true)
      expect(await canAdmin(editorId, siteId)).toBe(false)
    }
  })

  it('reporter, usuário sem vínculo e anônimo: false', async () => {
    expect(await canAdmin(reporterId, rootSiteId)).toBe(false)
    expect(await canAdmin(strangerId, rootSiteId)).toBe(false)
    expect(await canAdmin(strangerId, childSiteId)).toBe(false)
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const res = await anon.rpc('can_admin_site_users', { p_site_id: rootSiteId })
    expect(res.error !== null || res.data !== true).toBe(true)
  })

  it('site inexistente: false até para o org_admin de org filha (não para o super_admin)', async () => {
    expect(await canAdmin(childAdminId, '00000000-0000-4000-8000-00000000dead')).toBe(false)
  })

  describe('o guarda de verdade (requireSiteAdminScope) contra o banco local', () => {
    // GoTrue não carrega usuário inserido à mão, então só `auth.getUser` é
    // substituído; a RPC de permissão vai ao Postgres com o JWT do usuário.
    async function guardAs(userId: string | null, siteId: string) {
      vi.resetModules()
      vi.doMock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
      vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
        createServerClient: () => {
          const real = userId
            ? clientAs(userId)
            : createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
          return {
            auth: {
              getUser: async () =>
                userId
                  ? { data: { user: { id: userId } }, error: null }
                  : { data: { user: null }, error: { message: 'no session' } },
            },
            rpc: (name: string, args: Record<string, unknown>) => real.rpc(name, args),
          }
        },
      }))
      const { requireSiteAdminScope } = await import('@/lib/cms/auth-guards')
      const out = await requireSiteAdminScope(siteId)
      vi.doUnmock('next/headers')
      vi.doUnmock('@tn-figueiredo/auth-nextjs/server')
      return out
    }

    it('dono PASSA (não tranca o único usuário real)', async () => {
      expect(await guardAs(ownerId, rootSiteId)).toEqual({ ok: true, user: { id: ownerId } })
      expect(await guardAs(ownerId, childSiteId)).toEqual({ ok: true, user: { id: ownerId } })
    })

    it('editora, reporter e sem vínculo são barrados; sem sessão é unauthenticated', async () => {
      const denied = { ok: false, reason: 'insufficient_access' }
      expect(await guardAs(editorId, rootSiteId)).toEqual(denied)
      expect(await guardAs(reporterId, rootSiteId)).toEqual(denied)
      expect(await guardAs(strangerId, rootSiteId)).toEqual(denied)
      expect(await guardAs(null, rootSiteId)).toEqual({ ok: false, reason: 'unauthenticated' })
    })
  })
})
