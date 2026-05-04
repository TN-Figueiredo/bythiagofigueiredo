import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface AboutData {
  headline: string | null
  subtitle: string | null
  about_md: string | null
  about_compiled: string | null
  about_photo_url: string | null
  photo_caption: string | null
  photo_location: string | null
  about_cta_links: {
    kicker: string
    signature: string
    links: Array<{ type: 'internal' | 'social'; key: string; label: string }>
  } | null
  social_links: Record<string, string> | null
  display_name: string
}

const ABOUT_COLUMNS = [
  'headline', 'subtitle', 'about_md', 'about_compiled',
  'about_photo_url', 'photo_caption', 'photo_location',
  'about_cta_links', 'social_links', 'display_name',
].join(', ')

async function fetchAboutData(siteId: string): Promise<AboutData | null> {
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb
    .from('authors')
    .select(ABOUT_COLUMNS)
    .eq('site_id', siteId)
    .eq('is_default', true)
    .single()

  if (error || !data) return null

  // Cast to unknown first because the generated Supabase types don't yet
  // include the new columns added in migration 20260504000002.
  const row = data as unknown as AboutData

  const hasAboutContent =
    row.headline || row.subtitle || row.about_md ||
    row.about_compiled || row.about_photo_url

  if (!hasAboutContent) return null

  return row
}

export function getAboutData(siteId: string): Promise<AboutData | null> {
  return unstable_cache(
    fetchAboutData,
    [`about:${siteId}`],
    { tags: [`about:${siteId}`], revalidate: 300 },
  )(siteId)
}
