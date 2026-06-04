import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { createServerClient } from '@tn-figueiredo/auth-nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { linkPostToItem } from '@/lib/pipeline/blog-link'

export const dynamic = 'force-dynamic'

export default async function BlogPipelineItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })

  const supabase = getSupabaseServiceClient()
  const { data: pipelineItem } = await supabase
    .from('content_pipeline')
    .select('blog_post_id, language, title_pt, title_en')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!pipelineItem) redirect('/cms/blog')

  if (pipelineItem.blog_post_id) {
    redirect(`/cms/blog/${pipelineItem.blog_post_id}/edit`)
  }

  const cookieStore = await cookies()
  const userClient = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
    },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) redirect('/cms/blog')

  const locale = pipelineItem.language === 'en' ? 'en' : 'pt-BR'
  const title = (locale === 'pt-BR' ? pipelineItem.title_pt : pipelineItem.title_en) || 'Novo post'
  const slug = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'novo-post'

  let { data: author } = await supabase
    .from('authors')
    .select('id')
    .eq('site_id', siteId)
    .eq('user_id', user.id)
    .single()

  if (!author) {
    const { data: fallback } = await supabase
      .from('authors')
      .select('id')
      .eq('site_id', siteId)
      .limit(1)
      .single()
    author = fallback
  }

  if (!author) {
    console.error('[pipeline→blog] no author found for site', siteId)
    redirect('/cms/blog')
  }

  const { data: newPost, error: createError } = await supabase
    .from('blog_posts')
    .insert({
      site_id: siteId,
      author_id: author.id,
      status: 'draft',
      locale,
    })
    .select('id')
    .single()

  if (createError || !newPost) {
    console.error('[pipeline→blog] create failed:', createError)
    redirect('/cms/blog')
  }

  const { error: txError } = await supabase
    .from('blog_translations')
    .insert({ post_id: newPost.id, locale, title, slug, content_mdx: '' })

  if (txError) {
    console.error('[pipeline→blog] translation insert failed:', txError)
  }

  await supabase
    .from('content_pipeline')
    .update({ blog_post_id: newPost.id })
    .eq('id', id)

  await linkPostToItem(id, newPost.id, siteId, user.id).catch((e) => {
    console.error('[pipeline→blog] link failed:', e)
  })

  redirect(`/cms/blog/${newPost.id}/edit`)
}
