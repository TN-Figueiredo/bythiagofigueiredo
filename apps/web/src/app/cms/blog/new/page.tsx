import { redirect } from 'next/navigation'
import { postRepo } from '../../../../../lib/cms/repositories'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  // Sprint 2 assumes single author = seeded thiago. Sprint 3 will add author picker.
  const { data: author, error } = await supabase
    .from('authors')
    .select('id')
    .eq('slug', 'thiago')
    .maybeSingle()

  if (error || !author) {
    throw new Error('Default author "thiago" not found — seed may not have run')
  }

  const uniqueSlug = `sem-titulo-${Date.now()}`
  const post = await postRepo().create({
    site_id: ctx.siteId,
    author_id: author.id,
    initial_translation: {
      locale: ctx.defaultLocale,
      title: 'Sem título',
      slug: uniqueSlug,
      content_mdx: '',
    },
  })

  redirect(`/cms/blog/${post.id}/edit`)
}
