import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLogger } from '../../../../../lib/logger'
import { redactMessage } from '../../../../../lib/waitlists/scrub'
import { isPublicWaitlistStatus } from '../../../../../lib/waitlists/status'

interface Ctx { params: Promise<{ slug: string }> }

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params
  const h = await headers()
  const siteId = h.get('x-site-id')
  if (!siteId) return Response.json({ error: 'no_site' }, { status: 404 })

  // Only the public mount-GET consumer (embed/inline form) hits this route, and it reads
  // status + name. Select/return just those (+ description) — don't over-expose the full
  // localized translations block (consent/button/success copy) to anonymous clients
  // (WL-SEC-1). Add fields to the response AND the client Zod schema together if needed.
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('waitlists')
    .select('id, status, name, description')
    .eq('site_id', siteId).eq('slug', slug).maybeSingle()

  // A real DB/network error must be observed (otherwise it is indistinguishable from a
  // genuine not-found). We still return 404 to avoid an existence oracle on the public route.
  if (error) {
    getLogger().error('[waitlists_status_route]', { code: error.code })
    Sentry.captureException(
      new Error(`waitlists_status_route ${error.code}: ${redactMessage(error.message ?? '')}`),
      { tags: { component: 'waitlist' } },
    )
    return Response.json({ error: 'not_found' }, { status: 404 })
  }
  if (!data || !isPublicWaitlistStatus(data.status)) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }
  return Response.json({ status: data.status, name: data.name, description: data.description })
}
