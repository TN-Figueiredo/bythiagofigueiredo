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

// "Reenviar" respondia sempre "Aguarde 30 segundos": a ação chamava a função
// pelo service client (auth.uid() nulo → 'insufficient_access') e lia `data`
// como boolean, quando o retorno é void. O teste unitário mockava
// `{ data: true }` — um retorno que a função nunca dá.
describe.skipIf(skipIfNoLocalDb())('increment_invitation_resend: contrato com o banco local', () => {
  let service: SupabaseClient
  let orgId = ''
  let siteId = ''
  let adminId = ''
  let editorId = ''
  let invitationId = ''
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`

  const readInvite = async () =>
    (
      await service
        .from('invitations')
        .select('resend_count, last_sent_at')
        .eq('id', invitationId)
        .single()
    ).data as { resend_count: number; last_sent_at: string }

  beforeAll(async () => {
    service = getSupabaseServiceClient()
    const org = await service
      .from('organizations')
      .select('id')
      .is('parent_org_id', null)
      .limit(1)
      .single()
    orgId = org.data!.id as string
    const site = await service.from('sites').select('id').eq('org_id', orgId).limit(1).single()
    siteId = site.data!.id as string

    adminId = await insertAuthUser(`reenvio-dono-${stamp}@example.test`)
    editorId = await insertAuthUser(`reenvio-editora-${stamp}@example.test`)
    const m = await service
      .from('organization_members')
      .insert({ org_id: orgId, user_id: adminId, role: 'org_admin' })
    expect(m.error).toBeNull()
    const sm = await service
      .from('site_memberships')
      .insert({ site_id: siteId, user_id: editorId, role: 'editor' })
    expect(sm.error).toBeNull()

    const inv = await service
      .from('invitations')
      .insert({
        email: `reenvio-convidada-${stamp}@example.test`,
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
  })

  afterAll(async () => {
    if (invitationId) await service.from('invitations').delete().eq('id', invitationId)
    await service.from('site_memberships').delete().eq('site_id', siteId).eq('user_id', editorId)
    await service.from('organization_members').delete().eq('org_id', orgId).eq('user_id', adminId)
    if (adminId) await deleteAuthUser(adminId)
    if (editorId) await deleteAuthUser(editorId)
  })

  it('convite recém-criado está no intervalo: exceção resend_cooldown, nada incrementa', async () => {
    const asAdmin = clientAs(signUserJwt(adminId, 'user').jwt)
    const res = await asAdmin.rpc('increment_invitation_resend', { p_id: invitationId })
    expect(res.error?.message).toMatch(/resend_cooldown/)
    expect((await readInvite()).resend_count).toBe(0)
  })

  it('passados os 30 s o org_admin reenvia: retorno void (data null, sem erro) e o contador sobe', async () => {
    const past = new Date(Date.now() - 31_000).toISOString()
    await service.from('invitations').update({ last_sent_at: past }).eq('id', invitationId)

    const asAdmin = clientAs(signUserJwt(adminId, 'user').jwt)
    const res = await asAdmin.rpc('increment_invitation_resend', { p_id: invitationId })
    expect(res.error).toBeNull()
    expect(res.data).toBeNull()

    const after = await readInvite()
    expect(after.resend_count).toBe(1)
    expect(new Date(after.last_sent_at).getTime()).toBeGreaterThan(new Date(past).getTime())

    // ...e o intervalo volta a valer imediatamente
    const again = await asAdmin.rpc('increment_invitation_resend', { p_id: invitationId })
    expect(again.error?.message).toMatch(/resend_cooldown/)
    expect((await readInvite()).resend_count).toBe(1)
  })

  it('pelo service client a função recusa (auth.uid() nulo) — por isso a ação usa o client do usuário', async () => {
    await service
      .from('invitations')
      .update({ last_sent_at: new Date(Date.now() - 31_000).toISOString() })
      .eq('id', invitationId)
    const res = await service.rpc('increment_invitation_resend', { p_id: invitationId })
    expect(res.error?.message).toMatch(/insufficient_access/)
    expect((await readInvite()).resend_count).toBe(1)
  })

  it('a editora do site não reenvia convites', async () => {
    const asEditor = clientAs(signUserJwt(editorId, 'user').jwt)
    const res = await asEditor.rpc('increment_invitation_resend', { p_id: invitationId })
    expect(res.error?.message).toMatch(/insufficient_access/)
    expect((await readInvite()).resend_count).toBe(1)
  })
})

// /admin/users mostrava UUID no lugar do e-mail sempre que o GoTrue não
// devolvia o usuário. `admin_user_directory` lê auth.users direto — e, por
// devolver e-mails, só o service role pode chamá-la.
describe.skipIf(skipIfNoLocalDb())('admin_user_directory: contrato com o banco local', () => {
  let service: SupabaseClient
  let userId = ''
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`
  const email = `diretorio-${stamp}@example.test`

  beforeAll(async () => {
    service = getSupabaseServiceClient()
    userId = await insertAuthUser(email)
  })
  afterAll(async () => {
    if (userId) await deleteAuthUser(userId)
  })

  it('devolve o e-mail de um usuário que o GoTrue não carrega (linha inserida à mão) e ignora ids desconhecidos', async () => {
    const res = await service.rpc('admin_user_directory', {
      p_user_ids: [userId, randomUUID()],
    })
    expect(res.error).toBeNull()
    expect(res.data).toEqual([{ user_id: userId, email, display_name: null }])
  })

  it('usuário autenticado comum e anônimo não executam (a função devolve e-mails)', async () => {
    const asUser = clientAs(signUserJwt(userId, 'user').jwt)
    const denied = await asUser.rpc('admin_user_directory', { p_user_ids: [userId] })
    expect(denied.error?.code).toBe('42501')
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    const deniedAnon = await anon.rpc('admin_user_directory', { p_user_ids: [userId] })
    expect(deniedAnon.error?.code).toBe('42501')
  })
})
