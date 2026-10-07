// @vitest-environment node
// Raiz do defeito de convites (2026-10-07): `org_role` rodava como o usuário e
// as policies de `organization_members` chamavam `org_role` de volta — recursão
// "stack depth limit exceeded" (54001) para QUALQUER usuário autenticado. Além
// disso as policies e `is_org_staff` ainda comparavam com 'owner'/'admin', que
// o CHECK da tabela não aceita mais (só existe 'org_admin').
//
// Este teste fala com o PostgREST como `authenticated` (JWT de usuário, nunca
// service-role/superusuário): é o mesmo caminho que a tela usa. O org_admin
// aqui é de uma organização FILHA, de propósito — assim `is_super_admin()` é
// falso e o que autoriza é o vínculo com a organização, não o anel mestre.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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

describe.skipIf(skipIfNoLocalDb())('org_role / is_org_staff / can_admin_site como usuário autenticado', () => {
  let service: SupabaseClient
  let orgId = ''
  let siteId = ''
  let adminId = ''
  let editorId = ''
  let strangerId = ''
  let candidateId = ''
  let invitationId = ''
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`

  let asAdmin: SupabaseClient
  let asEditor: SupabaseClient
  let asStranger: SupabaseClient

  beforeAll(async () => {
    service = getSupabaseServiceClient()
    const master = await service
      .from('organizations')
      .select('id')
      .is('parent_org_id', null)
      .limit(1)
      .single()
    expect(master.error).toBeNull()
    const seeded = await seedSite(service, { parentOrgId: master.data!.id as string })
    orgId = seeded.orgId
    siteId = seeded.siteId

    adminId = await insertAuthUser(`rls-orgadmin-${stamp}@example.test`)
    editorId = await insertAuthUser(`rls-editora-${stamp}@example.test`)
    strangerId = await insertAuthUser(`rls-semvinculo-${stamp}@example.test`)
    candidateId = await insertAuthUser(`rls-candidata-${stamp}@example.test`)

    const member = await service
      .from('organization_members')
      .insert({ org_id: orgId, user_id: adminId, role: 'org_admin' })
    expect(member.error).toBeNull()
    const site = await service
      .from('site_memberships')
      .insert({ site_id: siteId, user_id: editorId, role: 'editor' })
    expect(site.error).toBeNull()
    const inv = await service
      .from('invitations')
      .insert({
        email: `rls-convidada-${stamp}@example.test`,
        org_id: orgId,
        site_id: siteId,
        role_scope: 'site',
        role: 'editor',
        token: randomBytes(32).toString('hex'),
        invited_by: adminId,
      })
      .select('id')
      .single()
    expect(inv.error).toBeNull()
    invitationId = inv.data!.id as string

    asAdmin = clientAs(adminId)
    asEditor = clientAs(editorId)
    asStranger = clientAs(strangerId)
  })

  afterAll(async () => {
    if (invitationId) await service.from('invitations').delete().eq('id', invitationId)
    if (siteId) await service.from('site_memberships').delete().eq('site_id', siteId)
    if (orgId) await service.from('organization_members').delete().eq('org_id', orgId)
    // Os triggers de auditoria gravam audit_log apontando para o site e a org;
    // sem apagar essas linhas a FK segura o site e ele fica de sobra no banco local.
    if (siteId) await service.from('audit_log').delete().eq('site_id', siteId)
    if (orgId) await service.from('audit_log').delete().eq('org_id', orgId)
    for (const id of [adminId, editorId, strangerId, candidateId]) {
      if (id) await deleteAuthUser(id)
    }
    if (siteId) {
      const site = await service.from('sites').delete().eq('id', siteId)
      expect(site.error).toBeNull()
    }
    if (orgId) {
      const org = await service.from('organizations').delete().eq('id', orgId)
      expect(org.error).toBeNull()
    }
  })

  it('org_role não recursa: devolve o papel de quem é membro e null para quem não é', async () => {
    const admin = await asAdmin.rpc('org_role', { p_org_id: orgId })
    expect(admin.error).toBeNull()
    expect(admin.data).toBe('org_admin')

    const editor = await asEditor.rpc('org_role', { p_org_id: orgId })
    expect(editor.error).toBeNull()
    expect(editor.data).toBeNull()

    const stranger = await asStranger.rpc('org_role', { p_org_id: orgId })
    expect(stranger.error).toBeNull()
    expect(stranger.data).toBeNull()
  })

  it('o org_admin deste teste não é super_admin (a autorização vem do vínculo com a org)', async () => {
    const res = await asAdmin.rpc('is_super_admin')
    expect(res.error).toBeNull()
    expect(res.data).toBe(false)
  })

  it('is_org_staff: verdadeiro só para o org_admin', async () => {
    const admin = await asAdmin.rpc('is_org_staff', { p_org_id: orgId })
    expect(admin.error).toBeNull()
    expect(admin.data).toBe(true)
    for (const c of [asEditor, asStranger]) {
      const res = await c.rpc('is_org_staff', { p_org_id: orgId })
      expect(res.error).toBeNull()
      expect(res.data).toBe(false)
    }
  })

  it('can_admin_site: verdadeiro só para o org_admin; editora de site não administra o site', async () => {
    const admin = await asAdmin.rpc('can_admin_site', { p_site_id: siteId })
    expect(admin.error).toBeNull()
    expect(admin.data).toBe(true)
    for (const c of [asEditor, asStranger]) {
      const res = await c.rpc('can_admin_site', { p_site_id: siteId })
      expect(res.error).toBeNull()
      expect(res.data).toBe(false)
    }
  })

  it('org_admin lê os membros da própria organização', async () => {
    const res = await asAdmin.from('organization_members').select('user_id, role').eq('org_id', orgId)
    expect(res.error).toBeNull()
    expect(res.data?.map((r) => r.user_id)).toEqual([adminId])
  })

  it('org_admin escreve membros (insere e remove) pela policy, sem service-role', async () => {
    const ins = await asAdmin
      .from('organization_members')
      .insert({ org_id: orgId, user_id: candidateId, role: 'org_admin' })
      .select('user_id')
    expect(ins.error).toBeNull()
    expect(ins.data).toHaveLength(1)

    const del = await asAdmin
      .from('organization_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', candidateId)
      .select('user_id')
    expect(del.error).toBeNull()
    expect(del.data).toHaveLength(1)
  })

  it('editora de site e usuário sem vínculo não leem membros da organização', async () => {
    for (const c of [asEditor, asStranger]) {
      const res = await c.from('organization_members').select('user_id').eq('org_id', orgId)
      expect(res.error).toBeNull()
      expect(res.data).toEqual([])
    }
  })

  it('editora de site e usuário sem vínculo não escrevem membros (nem se promovem a org_admin)', async () => {
    for (const [c, selfId] of [
      [asEditor, editorId],
      [asStranger, strangerId],
    ] as const) {
      const ins = await c
        .from('organization_members')
        .insert({ org_id: orgId, user_id: selfId, role: 'org_admin' })
      expect(ins.error?.code).toBe('42501')

      const del = await c
        .from('organization_members')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', adminId)
        .select('user_id')
      expect(del.error).toBeNull()
      expect(del.data).toEqual([])
    }
    const still = await service
      .from('organization_members')
      .select('user_id')
      .eq('org_id', orgId)
    expect(still.data?.map((r) => r.user_id)).toEqual([adminId])
  })

  it('convites: org_admin enxerga os da organização; editora e sem vínculo não', async () => {
    const admin = await asAdmin.from('invitations').select('id').eq('org_id', orgId)
    expect(admin.error).toBeNull()
    expect(admin.data?.map((r) => r.id)).toEqual([invitationId])
    for (const c of [asEditor, asStranger]) {
      const res = await c.from('invitations').select('id').eq('org_id', orgId)
      expect(res.error).toBeNull()
      expect(res.data).toEqual([])
    }
  })

  it('sites e organizations: só o org_admin altera; a editora não renomeia o site nem a organização', async () => {
    const siteByEditor = await asEditor
      .from('sites')
      .update({ name: 'renomeado pela editora' })
      .eq('id', siteId)
      .select('id')
    expect(siteByEditor.error).toBeNull()
    expect(siteByEditor.data).toEqual([])
    const orgByEditor = await asEditor
      .from('organizations')
      .update({ name: 'renomeada pela editora' })
      .eq('id', orgId)
      .select('id')
    expect(orgByEditor.error).toBeNull()
    expect(orgByEditor.data).toEqual([])

    const siteByAdmin = await asAdmin
      .from('sites')
      .update({ name: `Site RLS ${stamp}` })
      .eq('id', siteId)
      .select('id')
    expect(siteByAdmin.error).toBeNull()
    expect(siteByAdmin.data).toHaveLength(1)
  })
})
