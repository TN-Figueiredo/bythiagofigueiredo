'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { inviteTemplate } from '@tn-figueiredo/email'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getEmailService } from '../../../../lib/email/service'
import { getEmailSender } from '../../../../lib/email/sender'
import { getSiteContext } from '../../../../lib/cms/site-context'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function requireOrgAdmin(orgId: string): Promise<{ userId: string; email: string }> {
  const cookieStore = await cookies()
  const userClient = createServerClient(
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
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) throw new Error('not_authenticated')
  const { data: role } = await userClient.rpc('org_role', { p_org_id: orgId })
  if (role !== 'owner' && role !== 'admin') throw new Error('forbidden')
  return { userId: user.id, email: user.email ?? '' }
}

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
    if (error.message.match(/rate_limit_exceeded/)) {
      return { ok: false as const, error: 'Limite de 20 convites/hora excedido' }
    }
    if (error.code === '23505') {
      return { ok: false as const, error: 'Já existe um convite pendente para esse email' }
    }
    return { ok: false as const, error: `db_error: ${error.message}` }
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
      inviteTemplate,
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
      provider: 'brevo',
      provider_message_id: result.messageId,
      status: 'queued',
      metadata: { invitation_id: inv.id },
    })
  } catch (e) {
    // Log but don't fail invitation
    console.error('[invite_email_send_failed]', e)
  }

  revalidatePath('/admin/users')
  return { ok: true as const, invitationId: inv.id }
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
}

export async function resendInvitation(invitationId: string) {
  const supabase = getSupabaseServiceClient()
  const { data: row } = await supabase
    .from('invitations')
    .select('id, email, role, org_id, token, expires_at, invited_by, organization:organizations(name)')
    .eq('id', invitationId)
    .maybeSingle()
  if (!row) throw new Error('not_found')
  await requireOrgAdmin(row.org_id as string)

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
    inviteTemplate,
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

  // I13: atomic increment via RPC — avoids read-modify-write race condition
  await supabase.rpc('increment_invitation_resend', { p_id: invitationId })

  revalidatePath('/admin/users')
}
