import { headers } from 'next/headers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface Ctx { params: Promise<{ slug: string }> }
const PUBLIC_STATUSES = ['open', 'closed', 'launched'] as const

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params
  const h = await headers()
  const siteId = h.get('x-site-id')
  // x-default-locale is the REQUEST-side locale header middleware always sets; x-locale is
  // response-side and may be null on the request — so x-default-locale is the primary branch.
  const locale = h.get('x-default-locale') ?? h.get('x-locale') ?? 'en'
  if (!siteId) return Response.json({ error: 'no_site' }, { status: 404 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('waitlists')
    .select('id, status, name, description, waitlist_translations(locale, headline, subheadline, consent_label, button_label, success_headline, success_body, duplicate_headline, duplicate_body, closed_message, launched_message)')
    .eq('site_id', siteId).eq('slug', slug).maybeSingle()

  if (error || !data || !PUBLIC_STATUSES.includes(data.status as (typeof PUBLIC_STATUSES)[number])) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }
  const tx = (data.waitlist_translations ?? []).find((t) => t.locale === locale)
    ?? (data.waitlist_translations ?? [])[0] ?? null
  return Response.json({ status: data.status, name: data.name, description: data.description, tx })
}
