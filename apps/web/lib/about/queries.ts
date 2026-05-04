import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface AboutData {
  // From authors (shared)
  authorId: string
  display_name: string
  about_photo_url: string | null
  social_links: Record<string, string> | null
  // From author_about_translations (locale-specific)
  locale: string
  headline: string | null
  subtitle: string | null
  about_md: string | null
  about_compiled: string | null
  photo_caption: string | null
  photo_location: string | null
  about_cta_links: {
    kicker: string
    signature: string
    links: Array<{ type: 'internal' | 'social'; key: string; label: string }>
  } | null
  // Aggregated
  availableLocales: string[]
}

interface AuthorRow {
  id: string
  display_name: string
  about_photo_url: string | null
  social_links: Record<string, string> | null
}

interface TranslationRow {
  locale: string
  headline: string | null
  subtitle: string | null
  about_md: string | null
  about_compiled: string | null
  photo_caption: string | null
  photo_location: string | null
  about_cta_links: AboutData['about_cta_links']
}

async function fetchAboutData(siteId: string, locale: string): Promise<AboutData | null> {
  const sb = getSupabaseServiceClient()

  // Phase 1: shared author fields
  const { data: author, error: authorErr } = await sb
    .from('authors')
    .select('id, display_name, about_photo_url, social_links')
    .eq('site_id', siteId)
    .eq('is_default', true)
    .single()

  if (authorErr || !author) return null
  const a = author as unknown as AuthorRow

  // Phase 2: all translations for this author, prefer requested locale
  const { data: translations } = await sb
    .from('author_about_translations')
    .select('locale, headline, subtitle, about_md, about_compiled, photo_caption, photo_location, about_cta_links')
    .eq('author_id', a.id)
    .order('locale', { ascending: true })
    .limit(50)

  const txRows = (translations ?? []) as unknown as TranslationRow[]
  const tx = txRows.find((t) => t.locale === locale) ?? txRows[0]
  if (!tx) return null

  const availableLocales = txRows.map((t) => t.locale)

  return {
    authorId: a.id,
    display_name: a.display_name,
    about_photo_url: a.about_photo_url,
    social_links: a.social_links,
    locale: tx.locale,
    headline: tx.headline,
    subtitle: tx.subtitle,
    about_md: tx.about_md,
    about_compiled: tx.about_compiled,
    photo_caption: tx.photo_caption,
    photo_location: tx.photo_location,
    about_cta_links: tx.about_cta_links,
    availableLocales,
  }
}

export function getAboutData(siteId: string, locale: string = 'pt-BR'): Promise<AboutData | null> {
  return unstable_cache(
    () => fetchAboutData(siteId, locale),
    [`about:${siteId}:${locale}`],
    { tags: [`about:${siteId}`], revalidate: 300 },
  )()
}
