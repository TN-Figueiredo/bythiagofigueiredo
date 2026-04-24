import { postRepo } from '@/lib/cms/repositories'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { SeoExtrasSchema, type SeoExtras } from '@/lib/seo/jsonld/extras-schema'

/**
 * Fetch translations for a post by slug + compute cross-locale slug map.
 * `getBySlug` only returns the matching translation (inner join), so we
 * follow up with `getById` to enumerate all available translations — this
 * drives both the hreflang alternates and the locale switcher links.
 */
export async function loadPostWithLocales(siteId: string, locale: string, slug: string) {
  const post = await postRepo().getBySlug({ siteId, locale, slug })
  if (!post) return null
  const full = await postRepo().getById(post.id)
  const translations = full?.translations ?? post.translations
  // Sprint 5b audit R2 — enrich translations with seo_extras via direct
  // supabase query. @tn-figueiredo/cms PostTranslation type doesn't expose
  // the column (schema added in PR-A migration 02 but package types not
  // bumped). This unblocks C-maximalist FAQ/HowTo/Video rich results.
  // Swap to `tx.seo_extras` direct access once cms@0.3.0 ships the field.
  const extrasByLocale = await loadSeoExtrasByLocale(post.id)
  return { post, translations, full, extrasByLocale }
}

export async function loadSeoExtrasByLocale(postId: string): Promise<Map<string, SeoExtras | null>> {
  try {
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('blog_translations')
      .select('locale, seo_extras')
      .eq('post_id', postId)
    if (error || !data) return new Map()
    const map = new Map<string, SeoExtras | null>()
    for (const row of data) {
      const raw = (row as { locale: string; seo_extras: unknown }).seo_extras
      if (raw == null) {
        map.set((row as { locale: string }).locale, null)
        continue
      }
      const parsed = SeoExtrasSchema.safeParse(raw)
      map.set((row as { locale: string }).locale, parsed.success ? parsed.data : null)
    }
    return map
  } catch {
    // Supabase env vars missing (unit tests) or transient DB failure —
    // graceful degrade: page still renders without extras rich results.
    // Production env always has the vars; the catch is test-safety only.
    return new Map()
  }
}

// Sprint 5b PR-C C.4 — adapt @tn-figueiredo/cms PostTranslation rows to the
// TranslationInput shape expected by the SEO factories + builders.
// PostTranslation does not currently expose `cover_image_url` (it lives on
// Post) nor `seo_extras` (schema added in PR-A migration 02 but cms package
// types not bumped). We propagate the post-level cover image to every
// translation and plumb seo_extras via `loadSeoExtrasByLocale` direct
// query (audit R2 fix). Swap to `tx.seo_extras`/`tx.cover_image_url` once
// cms@0.3.0 ships the fields.
export type TxIn = {
  locale: string
  slug: string
  title: string
  excerpt: string | null
  cover_image_url: string | null
  seo_extras: SeoExtras | null
}
export function toTranslationInputs(
  postCover: string | null,
  translations: Array<{
    locale: string
    slug: string
    title: string
    excerpt: string | null
  }>,
  extrasByLocale: Map<string, SeoExtras | null>,
): TxIn[] {
  return translations.map((t) => ({
    locale: t.locale,
    slug: t.slug,
    title: t.title,
    excerpt: t.excerpt,
    cover_image_url: postCover,
    seo_extras: extrasByLocale.get(t.locale) ?? null,
  }))
}
