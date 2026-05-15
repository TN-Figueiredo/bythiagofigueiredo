import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listSocialPosts } from '@/lib/social/actions'
import { getSocialStrings } from './_i18n'
import { PostsFeed } from './_components/posts-feed'
import { PostsCalendar } from './_components/posts-calendar'
import { PostsQueue } from './_components/posts-queue'
import { PostsDrafts } from './_components/posts-drafts'
import Link from 'next/link'
import type { Provider } from '@tn-figueiredo/social'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function SocialPostsPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const tab = params.tab ?? 'feed'

  const result = await listSocialPosts(ctx.siteId)
  const posts = result.ok ? result.data : []

  let platformsByPost = new Map<string, Provider[]>()
  const postIds = posts.map(p => p.id)
  if (postIds.length > 0) {
    const supabase = getSupabaseServiceClient()
    const { data: deliveries } = await supabase
      .from('social_deliveries')
      .select('post_id, provider')
      .in('post_id', postIds)
    for (const d of (deliveries ?? []) as Array<{ post_id: string; provider: Provider }>) {
      const existing = platformsByPost.get(d.post_id) ?? []
      if (!existing.includes(d.provider)) existing.push(d.provider)
      platformsByPost.set(d.post_id, existing)
    }
  }
  const platformsMap = Object.fromEntries(platformsByPost)

  return (
    <>
      <CmsTopbar title={t.posts.title} />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 border-b border-cms-border pb-2">
            {(['feed', 'calendar', 'queue', 'drafts'] as const).map(tabId => (
              <a
                key={tabId}
                href={tabId === 'feed' ? '/cms/social' : `/cms/social?tab=${tabId}`}
                aria-current={tab === tabId ? 'page' : undefined}
                className={`px-3 py-1.5 text-sm font-medium ${tab === tabId ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
              >
                {t.posts.tabs[tabId]}
              </a>
            ))}
          </div>
          <Link
            href="/cms/social/new"
            className="rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
          >
            {t.posts.newPost}
          </Link>
        </div>

        {tab === 'feed' && <PostsFeed posts={posts} siteId={ctx.siteId} strings={t} platformsByPost={platformsMap} />}
        {tab === 'calendar' && <PostsCalendar posts={posts} strings={t} />}
        {tab === 'queue' && <PostsQueue posts={posts} strings={t} />}
        {tab === 'drafts' && <PostsDrafts posts={posts} strings={t} />}
      </div>
    </>
  )
}
