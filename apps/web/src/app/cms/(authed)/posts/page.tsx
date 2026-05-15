import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { PostsBoard } from './_components/posts-board'
import type { PostBoardItem } from './_components/post-card'
import type { SocialConfig } from '@/lib/social/types'

export const metadata = { title: 'Posts' }

export default async function PostsPage() {
  const { siteId } = await getSiteContext()
  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const svc = getSupabaseServiceClient()
  const { data: posts, error } = await svc
    .from('blog_posts')
    .select(`
      id,
      status,
      cover_image_url,
      scheduled_at,
      published_at,
      social_config,
      blog_translations(locale, title, excerpt),
      content_pipeline!content_pipeline_blog_post_id_fkey(code)
    `)
    .eq('site_id', siteId)
    .in('status', ['draft', 'scheduled', 'published'])
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw error

  const items: PostBoardItem[] = (posts ?? []).map((post: Record<string, unknown>) => {
    const translations = (post.blog_translations ?? []) as Array<{ locale: string; title: string; excerpt: string | null }>
    const primaryTx = translations[0]
    const socialConfig = post.social_config as SocialConfig | null
    const pipeline = (post.content_pipeline ?? []) as Array<{ code: string }>

    return {
      id: post.id as string,
      title: primaryTx?.title ?? 'Untitled',
      hook: primaryTx?.excerpt ?? null,
      status: post.status as string,
      coverImageUrl: post.cover_image_url as string | null,
      locales: translations.map(tx => tx.locale),
      socialPlatforms: socialConfig?.enabled ? socialConfig.platforms : [],
      scheduledAt: post.scheduled_at as string | null,
      publishedAt: post.published_at as string | null,
      pipelineCode: pipeline[0]?.code ?? null,
      sortOrder: 0,
    }
  })

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--gem-text, #e2e8f0)' }}>Posts</h1>
      </div>
      <PostsBoard items={items} />
    </div>
  )
}
