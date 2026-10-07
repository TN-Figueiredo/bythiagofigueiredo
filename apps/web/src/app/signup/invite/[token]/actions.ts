'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { captureServerActionError } from '../../../../lib/sentry-wrap'
import { fetchPendingInvitation } from './invitation-lookup'

// ─── helpers ─────────────────────────────────────────────────────────────────

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
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>,
        ) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )
}

// ─── action: accept for already-authenticated user ───────────────────────────

/**
 * Called when the visitor is already signed in with the invited e-mail.
 *
 * Usa a MESMA sobrecarga do fluxo de senha —
 * `accept_invitation_atomic(p_token_hash, p_user_id)` — porque só ela respeita o
 * escopo do convite (org → organization_members, site → site_memberships). A
 * sobrecarga antiga de um argumento grava sempre em organization_members e
 * estoura no CHECK da tabela para convites de site (papel editor/reporter): toda
 * pessoa que já tinha conta via "rpc_failed" ao aceitar um convite de editora.
 *
 * A sobrecarga de dois argumentos não confere de quem é o convite, então a
 * checagem de e-mail é feita aqui (a página também faz, mas uma server action é
 * chamável direto): o usuário vem de `auth.getUser()` (validado no servidor) e o
 * e-mail precisa bater com o do convite.
 *
 * Redirects to /cms on success, or back to the invite page with ?error=<code> on failure.
 */
export async function acceptInviteForCurrentUser(token: string): Promise<void> {
  const supabase = await getUserClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/signup/invite/${token}?error=unauthenticated`)
  }

  const service = getSupabaseServiceClient()
  const inv = await fetchPendingInvitation(service, token)
  if (!inv) {
    redirect(`/signup/invite/${token}?error=not_found`)
  }

  const userEmail = (user.email ?? '').trim().toLowerCase()
  if (userEmail === '' || userEmail !== inv.email.trim().toLowerCase()) {
    redirect(`/signup/invite/${token}?error=email_mismatch`)
  }

  const { data, error } = await service.rpc('accept_invitation_atomic', {
    p_token_hash: token,
    p_user_id: user.id,
  })

  if (error || !data) {
    captureServerActionError(
      error ?? new Error('accept_invitation_atomic returned null'),
      { action: 'accept_invitation', path: 'current_user' },
    )
    redirect(`/signup/invite/${token}?error=rpc_failed`)
  }

  redirect('/cms')
}

// ─── action: sign up + accept for new user ───────────────────────────────────

/**
 * Full flow for a new user accepting an invite:
 *
 *  1. Validate invitation via `get_invitation_by_token` (see invitation-lookup.ts).
 *  2. Create the auth user via service-role admin (`email_confirm: true`).
 *  3. Call `accept_invitation_atomic(p_token_hash, p_user_id)` — the RBAC v3
 *     two-arg overload binds the target user explicitly so we don't need a
 *     session yet. Returns `{ redirect_url, role_scope, role, org_id, site_id }`.
 *  4. On partial failure (user created but RPC errors): delete the newly
 *     created auth user via `admin.auth.admin.deleteUser` to keep the table
 *     clean. The RPC is transactional (FOR UPDATE + UPDATE invitations) so
 *     a raised exception means no row was mutated; the user we just created
 *     would be orphaned unless we roll it back.
 *  5. On success: cross-domain redirect to `result.redirect_url` — the
 *     master ring's `/cms/login` for org-scope invites, or the site's
 *     primary_domain `/cms/login` for site-scope invites.
 *
 * Redirects to /cms/login (same-origin fallback) or the remote site on
 * success; back to the invite page with ?error=<code> on any failure.
 */
export async function acceptInviteWithPassword(
  token: string,
  password: string,
): Promise<void> {
  const service = getSupabaseServiceClient()

  // Step 1 — Convite pendente (a RPC já exclui aceito/revogado/expirado).
  const inv = await fetchPendingInvitation(service, token)
  if (!inv) {
    redirect(`/signup/invite/${token}?error=not_found`)
  }

  const invitedEmail = inv.email

  // Step 2 — Create auth user via admin API (bypasses email confirmation flow)
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: invitedEmail,
    password,
    email_confirm: true,
  })

  if (createErr || !created.user) {
    if (createErr?.message?.match(/already registered/i)) {
      redirect(`/signup/invite/${token}?error=email_already_registered`)
    }
    redirect(`/signup/invite/${token}?error=signup_failed`)
  }

  const userId = created.user.id

  // Step 3 — Accept invitation atomically using the RBAC v3 two-arg RPC so we
  // don't need a user session yet. Service-role bypasses RLS; the SECURITY
  // DEFINER function itself enforces the invariants (token match, not expired,
  // not revoked, FOR UPDATE).
  const { data: acceptData, error: acceptErr } = await service.rpc(
    'accept_invitation_atomic',
    { p_token_hash: token, p_user_id: userId },
  )

  if (acceptErr || !acceptData) {
    // Partial-failure cleanup: the user was created but the invitation RPC
    // failed (token mismatch/expired/revoked/exception). Delete the orphan
    // auth user so the inviter can retry cleanly.
    console.error(
      '[acceptInviteWithPassword] accept_invitation_atomic failed — cleaning up orphan user',
      acceptErr?.message ?? 'no data returned',
    )
    captureServerActionError(
      acceptErr ??
        new Error(`accept_invitation_atomic returned null: ${JSON.stringify(acceptData)}`),
      { action: 'accept_invitation', path: 'signup_with_password' },
    )
    try {
      await service.auth.admin.deleteUser(userId)
    } catch (cleanupErr) {
      // If cleanup also fails, log but still redirect to error — admin can
      // manually sweep orphans via /admin/users.
      console.error('[acceptInviteWithPassword] orphan cleanup failed', cleanupErr)
    }
    redirect(`/signup/invite/${token}?error=rpc_failed`)
  }

  // Step 4 — Cross-domain redirect to the target's /cms/login.
  // RPC returns: { redirect_url, role_scope, role, org_id, site_id }
  const result = acceptData as {
    redirect_url?: string
    role_scope?: string
    role?: string
    org_id?: string
    site_id?: string
  }

  if (result.redirect_url) {
    redirect(result.redirect_url)
  }

  // Same-origin fallback if the RPC response is missing redirect_url for
  // some reason (defensive — shouldn't happen in practice).
  redirect('/cms/login')
}

// ─── action: redirect helper (used in server-action forms) ───────────────────

export async function redirectToCms() {
  redirect('/cms')
}
