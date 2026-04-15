import type { SupabaseClient } from '@supabase/supabase-js'

export function generateInviteToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function makeInvitation(
  admin: SupabaseClient,
  tracker: string[],
  opts: { email: string; orgId: string; role: 'owner'|'admin'|'editor'|'author'; invitedBy: string; expiresIn?: number },
): Promise<{ id: string; token: string }> {
  const token = generateInviteToken()
  const { data, error } = await admin.from('invitations').insert({
    email: opts.email, org_id: opts.orgId, role: opts.role, token, invited_by: opts.invitedBy,
    expires_at: opts.expiresIn ? new Date(Date.now() + opts.expiresIn).toISOString() : undefined,
  }).select('id').single()
  if (error || !data) throw error ?? new Error('invitation insert failed')
  tracker.push(data.id)
  return { id: data.id, token }
}
