// @vitest-environment node
// Contrato do fluxo de convite contra o banco LOCAL: os nomes de parâmetro e o
// formato de retorno que a tela usa precisam bater com as funções de verdade.
//
// Os testes unitários de convite mockam `rpc()` por inteiro, então aceitavam
// qualquer nome de parâmetro e qualquer formato. Foi assim que três defeitos
// ficaram verdes até o primeiro convite real (2026-10-07):
//   - `/admin/users` autorizava por `org_role`, que recursa na policy de
//     `organization_members` e devolve 54001 para todo usuário;
//   - a página do convite chamava `get_invitation_by_token({ p_token })`, mas o
//     parâmetro é `p_token_hash` (PGRST202), e lia o retorno como array;
//   - consequência: nenhum convite podia ser criado nem aceito.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  ANON_KEY,
  insertAuthUser,
  deleteAuthUser,
  signUserJwt,
} from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { fetchPendingInvitation } from '@/app/signup/invite/[token]/invitation-lookup'

function clientAs(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

describe.skipIf(skipIfNoLocalDb())('convite org_admin: contrato com o banco local', () => {
  let service: SupabaseClient
  let masterOrgId = ''
  let masterSiteId = ''
  let inviterId = ''
  let inviteeId = ''
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`
  const inviterEmail = `convite-dono-${stamp}@example.test`
  const inviteeEmail = `convite-irma-${stamp}@example.test`
  const token = randomBytes(32).toString('hex')
  let invitationId = ''

  beforeAll(async () => {
    service = getSupabaseServiceClient()
    const org = await service
      .from('organizations')
      .select('id')
      .is('parent_org_id', null)
      .limit(1)
      .single()
    expect(org.error).toBeNull()
    masterOrgId = org.data!.id as string
    const site = await service
      .from('sites')
      .select('id')
      .eq('org_id', masterOrgId)
      .limit(1)
      .single()
    expect(site.error).toBeNull()
    masterSiteId = site.data!.id as string

    inviterId = await insertAuthUser(inviterEmail)
    inviteeId = await insertAuthUser(inviteeEmail)
    const member = await service
      .from('organization_members')
      .insert({ org_id: masterOrgId, user_id: inviterId, role: 'org_admin' })
    expect(member.error).toBeNull()
  })

  afterAll(async () => {
    if (invitationId) await service.from('invitations').delete().eq('id', invitationId)
    await service
      .from('organization_members')
      .delete()
      .eq('org_id', masterOrgId)
      .in('user_id', [inviterId, inviteeId])
    if (inviterId) await deleteAuthUser(inviterId)
    if (inviteeId) await deleteAuthUser(inviteeId)
  })

  it('quem convida passa na autorização que a tela usa (is_org_admin), sem erro de RPC', async () => {
    const asInviter = clientAs(signUserJwt(inviterId, 'super_admin').jwt)
    const { data, error } = await asInviter.rpc('is_org_admin', { p_org_id: masterOrgId })
    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it('quem não é membro é negado pela mesma checagem', async () => {
    const stranger = clientAs(signUserJwt(randomUUID(), 'user').jwt)
    const { data, error } = await stranger.rpc('is_org_admin', { p_org_id: masterOrgId })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('o convite de escopo org é gravado com o token cru e achado pelo helper da página', async () => {
    const inserted = await service
      .from('invitations')
      .insert({
        email: inviteeEmail,
        org_id: masterOrgId,
        site_id: null,
        role_scope: 'org',
        role: 'org_admin',
        token,
        invited_by: inviterId,
      })
      .select('id, token')
      .single()
    expect(inserted.error).toBeNull()
    invitationId = inserted.data!.id as string
    // cru, não hash: é o mesmo valor que vai no link
    expect(inserted.data!.token).toBe(token)

    const inv = await fetchPendingInvitation(service, token)
    expect(inv).not.toBeNull()
    expect(inv!.email).toBe(inviteeEmail)
    expect(inv!.role).toBe('org_admin')
    expect(inv!.org_name).not.toBe('')
  })

  it('token desconhecido devolve null (e não lança)', async () => {
    expect(await fetchPendingInvitation(service, randomBytes(32).toString('hex'))).toBeNull()
  })

  it('aceitar cria o vínculo org_admin, consome o convite e libera o CMS para a convidada', async () => {
    const accepted = await service.rpc('accept_invitation_atomic', {
      p_token_hash: token,
      p_user_id: inviteeId,
    })
    expect(accepted.error).toBeNull()
    const result = accepted.data as { role?: string; role_scope?: string; redirect_url?: string }
    expect(result.role).toBe('org_admin')
    expect(result.role_scope).toBe('org')
    expect(result.redirect_url).toMatch(/\/cms\/login$/)

    const member = await service
      .from('organization_members')
      .select('role')
      .eq('org_id', masterOrgId)
      .eq('user_id', inviteeId)
      .single()
    expect(member.data?.role).toBe('org_admin')

    // convite consumido: o link não serve duas vezes
    expect(await fetchPendingInvitation(service, token)).toBeNull()

    // A convidada NÃO tem app_metadata.role (a conta nasce por admin.createUser
    // sem metadata). O portão do CMS é `is_member_staff`, que olha o banco.
    const asInvitee = clientAs(signUserJwt(inviteeId, 'user').jwt)
    const staff = await asInvitee.rpc('is_member_staff')
    expect(staff.error).toBeNull()
    expect(staff.data).toBe(true)
    const canEdit = await asInvitee.rpc('can_edit_site', { p_site_id: masterSiteId })
    expect(canEdit.error).toBeNull()
    expect(canEdit.data).toBe(true)

    // org_admin da organização RAIZ é, por definição, super_admin: não existe
    // "administradora que não é super_admin" enquanto houver uma organização só.
    const superAdmin = await asInvitee.rpc('is_super_admin')
    expect(superAdmin.data).toBe(true)

    // ...mas /admin é fechado por `is_admin()`, que lê o papel do JWT — a
    // convidada fica fora de /admin (inclusive de /admin/users).
    const isAdmin = await asInvitee.rpc('is_admin')
    expect(isAdmin.data).toBe(false)
  })
})
