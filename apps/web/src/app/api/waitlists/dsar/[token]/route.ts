// apps/web/src/app/api/waitlists/dsar/[token]/route.ts
// FASE 2 (live): LGPD Art. 18 ACCESS — given a valid, unburned, in-TTL waitlist rights token,
// return the data subject's (non-anonymized) waitlist signups as a machine-readable download.
// No oracle: any invalid/unknown/short/expired/used token yields a neutral empty 200 (never
// reveals whether an email/token exists). Erasure lives on /waitlists/manage/[token].
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { hashWaitlistDsarToken, isWaitlistDsarTokenShape, isWaitlistDsarTokenFresh } from '../../../../../../lib/waitlists/dsar-token'

export const dynamic = 'force-dynamic' // per-email data must never be cached

interface Ctx { params: Promise<{ token: string }> }
const NEUTRAL = () => Response.json({ data: [] }, { status: 200 }) // no oracle

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params
  if (!isWaitlistDsarTokenShape(token)) return NEUTRAL()

  const hash = hashWaitlistDsarToken(token)
  const supabase = getSupabaseServiceClient()
  const { data: tok } = await supabase
    .from('waitlist_dsar_tokens')
    .select('site_id, email, created_at, used_at')
    .eq('token_hash', hash)
    .maybeSingle()
  // Unknown, burned, or expired token → neutral (a leaked link can't outlive its TTL).
  if (!tok || !isWaitlistDsarTokenFresh(tok)) return NEUTRAL()

  // Narrowed projection (no ip/user_agent — parity with the LGPD export adapter).
  const { data } = await supabase
    .from('waitlist_signups')
    .select('email, consent_launch_notification, consent_text_version, status, source_surface, created_at')
    .eq('site_id', tok.site_id)
    .eq('email', tok.email)
    .is('anonymized_at', null)

  return new Response(JSON.stringify({ data: data ?? [] }, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="waitlist-data.json"',
      'cache-control': 'no-store',
    },
  })
}
