// apps/web/src/app/api/waitlists/dsar/[token]/route.ts
// FASE 1: inert no-oracle stub. No crypto / service-client imports yet — the Fase-1 body
// never uses them. The live token lookup (Fase 2) needs the unsubscribe_tokens.source
// column, which does not exist until the Fase-2 token migration.

interface Ctx { params: Promise<{ token: string }> }
const NEUTRAL = () => Response.json({ data: [] }, { status: 200 }) // no oracle

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params
  if (!token || token.length < 16) return NEUTRAL()
  // FASE 2: source-namespaced waitlist tokens do not exist yet (unsubscribe_tokens.source
  // lands in the Fase-2 migration; no waitlist tokens are issued in Fase 1). Resolving a
  // token here could only match a newsletter token (out of scope), so short-circuit. This
  // is an intentional inert no-oracle response, not an accidental error path.
  return NEUTRAL()
}

// ── Fase 2 wiring (paste into GET when the source column + token issuance ship). ──
// Add `export const dynamic = 'force-dynamic'` (per-email data must never be cached).
// Re-add imports: `import crypto from 'node:crypto'` and the service client (six-`../`
// deep-relative like the sibling routes), then:
//   const hash = crypto.createHash('sha256').update(token).digest('hex')
//   const supabase = getSupabaseServiceClient()
//   const { data: tok, error: tokErr } = await supabase.from('unsubscribe_tokens')
//     .select('site_id, email, source').eq('token_hash', hash).eq('source', 'waitlist').maybeSingle()
//   if (tokErr || !tok) return NEUTRAL()
//   const { data } = await supabase.from('waitlist_signups')
//     .select('email, consent_launch_notification, consent_text_version, status, source_surface, created_at')
//     .eq('site_id', tok.site_id).eq('email', tok.email).is('anonymized_at', null)
//   return new Response(JSON.stringify({ data: data ?? [] }, null, 2), { status: 200,
//     headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="waitlist-data.json"' } })
