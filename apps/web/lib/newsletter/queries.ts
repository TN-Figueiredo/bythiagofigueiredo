// apps/web/lib/newsletter/queries.ts
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export interface NewsletterType {
  id: string
  slug: string
  locale: 'en' | 'pt-BR'
  name: string
  tagline: string | null
  description: string | null
  color: string
  color_dark: string | null
  badge: string | null
  cadence_days: number
  cadence_label: string | null
  landing_content: { promise?: string[] } | null
  og_image_url: string | null
  active: boolean
  site_id: string
  updated_at: string
}

export interface NewsletterStats {
  subscriberCount: number
  editionsCount: number
  daysSinceLastEdition: number | null
}

export interface RecentEdition {
  id: string
  subject: string
  preheader: string | null
  sent_at: string
}

export async function getNewsletterTypeBySlug(
  slug: string,
): Promise<NewsletterType | null> {
  const { data } = await supabaseAnon
    .from('newsletter_types')
    .select(
      'id, slug, locale, name, tagline, description, color, color_dark, badge, cadence_days, cadence_label, landing_content, og_image_url, active, site_id, updated_at',
    )
    .eq('slug', slug)
    .single()

  return data as NewsletterType | null
}

export async function getNewsletterStats(
  typeId: string,
  siteId: string,
): Promise<NewsletterStats> {
  const supabase = getSupabaseServiceClient()

  const [subs, editions] = await Promise.all([
    supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('newsletter_id', typeId)
      .eq('site_id', siteId)
      .eq('status', 'confirmed'),
    supabase
      .from('newsletter_editions')
      .select('sent_at')
      .eq('newsletter_type_id', typeId)
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1),
  ])

  const subscriberCount = subs.count ?? 0
  const editionsCountRes = await supabase
    .from('newsletter_editions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_type_id', typeId)
    .eq('site_id', siteId)
    .eq('status', 'sent')

  const editionsCount = editionsCountRes.count ?? 0
  const lastSentAt = editions.data?.[0]?.sent_at
  const daysSinceLastEdition = lastSentAt
    ? Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 86400000)
    : null

  return { subscriberCount, editionsCount, daysSinceLastEdition }
}

export async function getRecentEditions(
  typeId: string,
  siteId: string,
  limit = 3,
): Promise<RecentEdition[]> {
  const { data } = await supabaseAnon
    .from('newsletter_editions')
    .select('id, subject, preheader, sent_at')
    .eq('newsletter_type_id', typeId)
    .eq('site_id', siteId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as RecentEdition[]
}

export const getActiveTypeCount = unstable_cache(
  async (siteId: string): Promise<number> => {
    const supabase = getSupabaseServiceClient()
    const { count } = await supabase
      .from('newsletter_types')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('active', true)

    return count ?? 0
  },
  ['newsletter-active-type-count'],
  { tags: ['newsletter:types:count'], revalidate: 3600 },
)

export async function getActiveTypesForNotFound(
  siteId: string,
): Promise<
  Array<{
    slug: string
    name: string
    tagline: string | null
    color: string
    locale: string
  }>
> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('newsletter_types')
    .select('slug, name, tagline, color, locale')
    .eq('site_id', siteId)
    .eq('active', true)
    .order('sort_order')

  return (data ?? []) as Array<{
    slug: string
    name: string
    tagline: string | null
    color: string
    locale: string
  }>
}
