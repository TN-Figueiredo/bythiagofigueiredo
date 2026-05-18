import { notFound } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { markAsPosted } from '@/lib/social/actions'
import { ReadyToPost } from './_components/ready-to-post'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReadyToPostPage({ params }: Props) {
  const { id } = await params
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const supabase = getSupabaseServiceClient()

  const { data: post, error } = await supabase
    .from('social_posts')
    .select('id, status, content, published_at')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (error || !post) {
    notFound()
  }

  const content = post.content as { title?: string; media_urls?: string[]; url?: string }
  const imageUrl = content.media_urls?.[0]
  const shortUrl = content.url

  if (!imageUrl || !shortUrl) {
    notFound()
  }

  return (
    <ReadyToPost
      postId={post.id as string}
      title={content.title ?? 'Story'}
      imageUrl={imageUrl}
      shortUrl={shortUrl}
      status={post.status as string}
      onMarkAsPosted={markAsPosted}
    />
  )
}
