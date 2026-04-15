'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'

// ─── types ───────────────────────────────────────────────────────────────────

export type AcceptResult =
  | { ok: true; org_id: string }
  | { ok: false; error: string }

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
 * Called when the visitor is already signed in and we just need to run the
 * atomic accept RPC (which binds auth.uid() server-side).
 */
export async function acceptInviteForCurrentUser(token: string): Promise<AcceptResult> {
  const supabase = await getUserClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'not_authenticated' }
  }

  // RPC signature: accept_invitation_atomic(p_token text)
  // auth.uid() is bound server-side — no p_user_id param.
  const { data, error } = await supabase.rpc('accept_invitation_atomic', {
    p_token: token,
  })

  if (error) {
    return { ok: false, error: `rpc_failed: ${error.message}` }
  }

  // RPC returns json: { ok: boolean, error?: string, org_id?: string }
  return data as AcceptResult
}

// ─── action: sign up + accept for new user ───────────────────────────────────

export type AcceptWithPasswordResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string }

/**
 * Full flow for a new user:
 *  1. Validate invitation details via get_invitation_by_token (anon-safe).
 *  2. Create the auth user via service-role admin (email_confirm: true).
 *  3. Sign the new user in (establishes a session so auth.uid() resolves).
 *  4. Call accept_invitation_atomic(p_token) — RPC uses auth.uid() internally.
 *  5. On RPC failure: compensate by deleting the newly created user.
 */
export async function acceptInviteWithPassword(
  token: string,
  password: string,
): Promise<AcceptWithPasswordResult> {
  const service = getSupabaseServiceClient()

  // Step 1 — Fetch invitation details (anon-safe RPC, used only for email lookup)
  const { data: rows, error: invErr } = await service.rpc('get_invitation_by_token', {
    p_token: token,
  })

  if (invErr || !rows || (Array.isArray(rows) && rows.length === 0)) {
    return { ok: false, error: 'invalid_or_expired' }
  }

  // get_invitation_by_token returns SETOF (table function) → array
  const inv = Array.isArray(rows) ? rows[0] : rows
  if (!inv || inv.expired) {
    return { ok: false, error: 'invalid_or_expired' }
  }

  const invitedEmail = String(inv.email)

  // Step 2 — Create auth user via admin API (bypasses email confirmation flow)
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: invitedEmail,
    password,
    email_confirm: true,
  })

  if (createErr || !created.user) {
    if (createErr?.message?.match(/already registered/i)) {
      return { ok: false, error: 'email_already_registered' }
    }
    return { ok: false, error: 'signup_failed' }
  }

  const userId = created.user.id

  // Step 3 — Sign the new user in so auth.uid() resolves in the RPC
  const userClient = await getUserClient()

  // C6: clear any pre-existing session before establishing the new one
  await userClient.auth.signOut()

  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email: invitedEmail,
    password,
  })

  if (signInErr) {
    // Compensate: delete the user we just created
    await service.auth.admin.deleteUser(userId)
    // C6: clear orphan session cookie on failure path
    await userClient.auth.signOut()
    return { ok: false, error: 'signin_after_signup_failed' }
  }

  // Step 4 — Accept invitation atomically (RPC binds auth.uid() server-side)
  const { data: acceptData, error: acceptErr } = await userClient.rpc(
    'accept_invitation_atomic',
    { p_token: token },
  )

  if (acceptErr || (acceptData && !(acceptData as { ok: boolean }).ok)) {
    // Compensate: delete the user we just created
    await service.auth.admin.deleteUser(userId)
    // C6: clear orphan session cookie on RPC failure path
    await userClient.auth.signOut()

    const rpcError =
      acceptErr?.message ??
      ((acceptData as { ok: false; error: string } | null)?.error ?? 'accept_failed')

    return { ok: false, error: rpcError }
  }

  return { ok: true, redirectTo: '/cms' }
}

// ─── action: redirect helper (used in server-action forms) ───────────────────

export async function redirectToCms() {
  redirect('/cms')
}
