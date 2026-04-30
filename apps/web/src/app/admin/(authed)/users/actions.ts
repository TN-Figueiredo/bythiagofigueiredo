'use server'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { inviteTemplate } from '@tn-figueiredo/email'
import type { IEmailTemplate } from '@tn-figueiredo/email'

// email@0.2.0 typed templates use strict interfaces that don't satisfy
// Record<string, unknown> index signature — cast once here.
const invite = inviteTemplate as unknown as IEmailTemplate<Record<string, unknown>>
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { getEmailService } from '../../../../../lib/email/service'
import { getEmailSender } from '../../../../../lib/email/sender'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { getClientIp, isValidInet } from '../../../../../lib/request-ip'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getUserClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
}

async function requireOrgAdmin(orgId: string): Promise<{ userId: string; email: string }> {
  const userClient = await getUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) throw new Error('not_authenticated')
  const { data: role } = await userClient.rpc('org_role', { p_org_id: orgId })
  if (role !== 'owner' && role !== 'admin' && role !== 'org_admin') {
    throw new Error('forbidden')
  }
  return { userId: user.id, email: user.email ?? '' }
}

/**
 * Track G3 helper: inject caller IP + User-Agent into the DB session GUC
 * so the `tg_audit_mutation` trigger records who did what from where.
 *
 * Must be called via the USER-SCOPED client (not service-role) so the GUC
 * lands on the same connection that will do the subsequent mutations.
 * With service-role each REST call can pick a different pooled connection
 * and the GUC would be invisible to the audit trigger.
 */
async function setAuditContext(userClient: SupabaseClient): Promise<void> {
  const h = await headers()
  const ipRaw = getClientIp(h)
  const ip = ipRaw && isValidInet(ipRaw) ? ipRaw : ''
  const ua = h.get('user-agent') ?? ''
  try {
    await userClient.rpc('set_audit_context', { p_ip: ip, p_user_agent: ua })
  } catch (e) {
    // Non-fatal: trigger falls back to inet_client_addr(). Log and continue.
    console.warn('[set_audit_context] failed', e)
  }
}

// ─── existing actions (kept for backward-compat with admin-users-actions.test.ts) ─

export async function createInvitation(input: {
  email: string
  role: 'admin' | 'editor' | 'author'
}) {
  const ctx = await getSiteContext()
  const { userId: invitedBy, email: inviterEmail } = await requireOrgAdmin(ctx.orgId)

  const supabase = getSupabaseServiceClient()
  const token = generateToken()

  const { data: inv, error } = await supabase
    .from('invitations')
    .insert({
      email: input.email,
      org_id: ctx.orgId,
      role: input.role,
      token,
      invited_by: invitedBy,
    })
    .select('id, expires_at')
    .single()

  if (error) {
    // I10: never surface raw db error.message to callers — log internally
    console.error('[createInvitation] db error', error.code, error.message)
    if (error.message.match(/rate_limit_exceeded/)) {
      redirect('/admin/users?notice=invite_rate_limited')
    }
    if (error.code === '23505') {
      redirect('/admin/users?notice=invite_duplicate')
    }
    if (error.code === '23503') {
      redirect('/admin/users?notice=invite_failed')
    }
    redirect('/admin/users?notice=invite_failed')
  }

  // Get org name for email
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', ctx.orgId)
    .single()

  const sender = await getEmailSender(ctx.siteId)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  const acceptUrl = `${baseUrl}/signup/invite/${token}`

  // Send invite email
  try {
    const result = await getEmailService().sendTemplate(
      invite,
      sender,
      input.email,
      {
        inviterName: inviterEmail.split('@')[0]!,
        orgName: org?.name ?? 'TN Figueiredo',
        role: input.role,
        acceptUrl,
        expiresAt: new Date(inv.expires_at as string),
        branding: { brandName: sender.brandName, primaryColor: sender.primaryColor },
      },
      ctx.defaultLocale,
    )

    // I14: subject uses org name instead of inviter PII
    await supabase.from('sent_emails').insert({
      site_id: ctx.siteId,
      template_name: 'invite',
      to_email: input.email,
      subject: `Você foi convidado para ${org?.name ?? 'a organização'}`,
      provider: process.env.EMAIL_PROVIDER ?? 'ses',
      provider_message_id: result.messageId,
      status: 'queued',
      metadata: { invitation_id: inv.id },
    })
  } catch (e) {
    // Log but don't fail invitation
    console.error('[invite_email_send_failed]', e)
  }

  revalidatePath('/admin/users')
  redirect('/admin/users?notice=invite_created')
}

export async function revokeInvitation(invitationId: string) {
  const supabase = getSupabaseServiceClient()
  const { data: row } = await supabase
    .from('invitations')
    .select('org_id')
    .eq('id', invitationId)
    .maybeSingle()
  if (!row) throw new Error('not_found')
  const { userId } = await requireOrgAdmin(row.org_id as string)

  await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString(), revoked_by_user_id: userId })
    .eq('id', invitationId)
  revalidatePath('/admin/users')
  redirect('/admin/users?notice=invitation_revoked')
}

export async function resendInvitation(invitationId: string): Promise<void> {
  const supabase = getSupabaseServiceClient()
  const { data: row } = await supabase
    .from('invitations')
    .select('id, email, role, org_id, token, expires_at, invited_by, organization:organizations(name)')
    .eq('id', invitationId)
    .maybeSingle()
  if (!row) throw new Error('not_found')
  await requireOrgAdmin(row.org_id as string)

  // I4: atomic increment with 30s cooldown guard BEFORE sending — RPC returns boolean
  const { data: updated } = await supabase.rpc('increment_invitation_resend', { p_id: invitationId })

  if (!updated) {
    redirect('/admin/users?notice=resend_too_soon')
  }

  const ctx = await getSiteContext()
  const sender = await getEmailSender(ctx.siteId)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  const acceptUrl = `${baseUrl}/signup/invite/${row.token as string}`

  // I12: resolve real inviter name from auth.users metadata, fallback to email local-part
  const orgName = (row.organization as { name?: string } | null)?.name ?? 'TN Figueiredo'
  let inviterName = orgName
  if (row.invited_by) {
    const { data: inviterUser } = await supabase.auth.admin.getUserById(row.invited_by as string)
    if (inviterUser.user) {
      const meta = inviterUser.user.user_metadata as Record<string, string> | undefined
      inviterName =
        meta?.full_name ??
        meta?.name ??
        (inviterUser.user.email ? inviterUser.user.email.split('@')[0]! : orgName)
    }
  }

  await getEmailService().sendTemplate(
    invite,
    sender,
    row.email as string,
    {
      inviterName,
      orgName,
      role: row.role as 'admin' | 'editor' | 'author' | 'owner',
      acceptUrl,
      expiresAt: new Date(row.expires_at as string),
      branding: { brandName: sender.brandName, primaryColor: sender.primaryColor },
    },
    ctx.defaultLocale,
  )

  revalidatePath('/admin/users')
  redirect('/admin/users?notice=resend_sent')
}

// ─── Track G3: new scope-aware actions ────────────────────────────────────────

/**
 * Scope-aware invite creation. Replaces the legacy flat `role` field with
 * a (scope, role, site_ids) tuple:
 *
 * - scope=org  → role='org_admin', site_ids ignored (1 row in invitations)
 * - scope=site → role ∈ editor|reporter, 1 row per site_id (independent
 *   raw tokens so revoking/resending one doesn't leak to the others).
 *
 * Calls `set_audit_context(ip, ua)` on the session client BEFORE mutations
 * so the audit trigger records network context for the INSERT.
 */
export async function createInvitationAction(input: {
  email: string
  scope: 'org' | 'site'
  role: 'org_admin' | 'editor' | 'reporter'
  site_ids: string[]
}): Promise<void> {
  const ctx = await getSiteContext()
  const { userId: invitedBy, email: inviterEmail } = await requireOrgAdmin(ctx.orgId)

  // Validate scope/role shape up-front (mirrors the DB check constraint).
  if (input.scope === 'org' && input.role !== 'org_admin') {
    redirect('/admin/users?notice=invite_failed')
  }
  if (
    input.scope === 'site' &&
    (input.role === 'org_admin' || input.site_ids.length === 0)
  ) {
    redirect('/admin/users?notice=invite_failed')
  }

  const userClient = await getUserClient()
  await setAuditContext(userClient)

  const supabase = getSupabaseServiceClient()

  // Fan out: 1 row for org, N rows for site.
  const targets =
    input.scope === 'org'
      ? [{ site_id: null as string | null, token: generateToken() }]
      : input.site_ids.map((site_id) => ({ site_id, token: generateToken() }))

  const insertRows = targets.map((t) => ({
    email: input.email,
    org_id: ctx.orgId,
    site_id: t.site_id,
    role_scope: input.scope,
    role: input.role,
    token: t.token,
    invited_by: invitedBy,
  }))

  const { data: inserted, error } = await supabase
    .from('invitations')
    .insert(insertRows)
    .select('id, token, expires_at, site_id')

  if (error) {
    console.error('[createInvitationAction] db error', error.code, error.message)
    if (error.message.match(/rate_limit_exceeded/)) {
      redirect('/admin/users?notice=invite_rate_limited')
    }
    if (error.code === '23505') {
      redirect('/admin/users?notice=invite_duplicate')
    }
    redirect('/admin/users?notice=invite_failed')
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', ctx.orgId)
    .single()
  const orgName = org?.name ?? 'TN Figueiredo'

  const sender = await getEmailSender(ctx.siteId)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

  // Map RBAC v3 roles (org_admin|editor|reporter) to the legacy vocabulary
  // the @tn-figueiredo/email invite template still uses
  // (admin|editor|author|owner). 'reporter' gets 'author'; 'org_admin' gets
  // 'admin'. Template copy is informational — the server-side authz is what
  // enforces the actual role on accept.
  const emailRole: 'admin' | 'editor' | 'author' | 'owner' =
    input.role === 'org_admin' ? 'admin'
    : input.role === 'reporter' ? 'author'
    : 'editor'

  // Send one email per invitation row so the recipient gets an independent
  // link per site (plan's "independent raw tokens" requirement).
  for (const row of inserted ?? []) {
    const acceptUrl = `${baseUrl}/signup/invite/${row.token as string}`
    try {
      const result = await getEmailService().sendTemplate(
        invite,
        sender,
        input.email,
        {
          inviterName: inviterEmail.split('@')[0]!,
          orgName,
          role: emailRole,
          acceptUrl,
          expiresAt: new Date(row.expires_at as string),
          branding: { brandName: sender.brandName, primaryColor: sender.primaryColor },
        },
        ctx.defaultLocale,
      )

      await supabase.from('sent_emails').insert({
        site_id: (row.site_id as string | null) ?? ctx.siteId,
        template_name: 'invite',
        to_email: input.email,
        subject: `Você foi convidado para ${orgName}`,
        provider: process.env.EMAIL_PROVIDER ?? 'ses',
        provider_message_id: result.messageId,
        status: 'queued',
        metadata: { invitation_id: row.id },
      })
    } catch (e) {
      console.error('[invite_email_send_failed]', e)
    }
  }

  revalidatePath('/admin/users')
  redirect('/admin/users?notice=invite_created')
}

/**
 * Reassign a user's owned content (blog_posts + campaigns) on a given site
 * to a different user. Thin wrapper over `reassign_content` RPC which does
 * all the authz + cascade. RPC raises on insufficient access or if the
 * target user isn't org_admin/super_admin/site-editor.
 */
export async function reassignContentAction(input: {
  from_user: string
  to_user: string
  site_id: string
}): Promise<void> {
  const ctx = await getSiteContext()
  await requireOrgAdmin(ctx.orgId)

  const userClient = await getUserClient()
  await setAuditContext(userClient)

  const { error } = await userClient.rpc('reassign_content', {
    p_from_user: input.from_user,
    p_to_user: input.to_user,
    p_site_id: input.site_id,
  })

  if (error) {
    console.error('[reassignContentAction] rpc error', error.message)
    redirect(`/admin/users/${input.from_user}/edit?notice=reassign_failed`)
  }

  revalidatePath('/admin/users')
  redirect(`/admin/users/${input.from_user}/edit?notice=reassigned`)
}

/**
 * Change a user's role on a specific site (editor ↔ reporter).
 * `org_admin` is org-level; it lives in organization_members and isn't
 * editable here.
 */
export async function updateSiteMembershipRoleAction(input: {
  user_id: string
  site_id: string
  role: 'editor' | 'reporter'
}): Promise<void> {
  const ctx = await getSiteContext()
  await requireOrgAdmin(ctx.orgId)

  const userClient = await getUserClient()
  await setAuditContext(userClient)

  const { error } = await userClient
    .from('site_memberships')
    .update({ role: input.role })
    .eq('user_id', input.user_id)
    .eq('site_id', input.site_id)

  if (error) {
    console.error('[updateSiteMembershipRoleAction] db error', error.message)
    redirect(`/admin/users/${input.user_id}/edit?notice=update_failed`)
  }

  revalidatePath(`/admin/users/${input.user_id}/edit`)
  redirect(`/admin/users/${input.user_id}/edit?notice=role_updated`)
}

/**
 * Revoke a user's access to a site by deleting the site_memberships row.
 * Does NOT reassign their content — the caller should run
 * `reassignContentAction` first if they want to preserve authorship on
 * that site. If they skip reassign, rows are left with the old owner_user_id
 * until someone else picks them up.
 */
export async function revokeSiteMembershipAction(input: {
  user_id: string
  site_id: string
}): Promise<void> {
  const ctx = await getSiteContext()
  await requireOrgAdmin(ctx.orgId)

  const userClient = await getUserClient()
  await setAuditContext(userClient)

  const { error } = await userClient
    .from('site_memberships')
    .delete()
    .eq('user_id', input.user_id)
    .eq('site_id', input.site_id)

  if (error) {
    console.error('[revokeSiteMembershipAction] db error', error.message)
    redirect(`/admin/users/${input.user_id}/edit?notice=revoke_failed`)
  }

  revalidatePath(`/admin/users/${input.user_id}/edit`)
  redirect(`/admin/users/${input.user_id}/edit?notice=revoked`)
}
