import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PostEditionEditor } from './post-edition-editor'

export const dynamic = 'force-dynamic'

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await getSiteContext()
  const sp = await searchParams
  const locale = typeof sp?.locale === 'string' ? sp.locale : ctx.defaultLocale
  const tagId = typeof sp?.tag === 'string' ? sp.tag : undefined

  const supabase = getSupabaseServiceClient()

  // Fetch tags and site config in parallel
  const [tagsResult, siteResult] = await Promise.all([
    supabase
      .from('blog_tags')
      .select('id, name, color')
      .eq('site_id', ctx.siteId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('sites')
      .select('supported_locales')
      .eq('id', ctx.siteId)
      .single(),
  ])

  const tags = (tagsResult.data ?? []) as Array<{ id: string; name: string; color: string }>
  const supportedLocales = (siteResult.data?.supported_locales as string[] | null) ?? [ctx.defaultLocale]

  return (
    <PostEditionEditor
      locale={locale}
      tagId={tagId}
      defaultLocale={ctx.defaultLocale}
      tags={tags}
      supportedLocales={supportedLocales}
    />
  )
}
