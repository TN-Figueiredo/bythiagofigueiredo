import { notFound } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { markAsPosted } from '@/lib/social/actions'
import { ReadyToPost, type SlideInfo } from './_components/ready-to-post'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SlideComposition = {
  background?: {
    type?: string
    url?: string
  }
  elements?: Array<{ type?: string; src?: string }>
}

/** Extract the first usable image URL from a slide composition (background or first image element). */
function extractSlideImageUrl(slide: SlideComposition): string | undefined {
  if (slide.background?.url) return slide.background.url
  const imgEl = slide.elements?.find((el) => el.type === 'image' && el.src)
  return imgEl?.src
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReadyToPostPage({ params }: Props) {
  const { id } = await params
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const supabase = getSupabaseServiceClient()

  const { data: post, error } = await supabase
    .from('social_posts')
    .select('id, status, content, story_slides, published_at')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (error || !post) {
    notFound()
  }

  const content = post.content as { title?: string; media_urls?: string[]; url?: string; description?: string }
  const shortUrl = content.url ?? ''
  const title = content.title ?? content.description ?? 'Story'

  // ---------------------------------------------------------------------------
  // Build slide list
  // Multi-slide story: iterate story_slides and extract image URLs
  // Legacy single-image post: fall back to content.media_urls[0]
  // ---------------------------------------------------------------------------

  let slides: SlideInfo[] | undefined
  let legacyImageUrl: string | undefined

  const rawSlides = post.story_slides as SlideComposition[] | null

  if (rawSlides && Array.isArray(rawSlides) && rawSlides.length > 0) {
    slides = rawSlides.map((slide, i) => ({
      index: i + 1,
      imageUrl: extractSlideImageUrl(slide),
    }))
  } else {
    // Legacy: single image post
    legacyImageUrl = content.media_urls?.[0]
    if (!legacyImageUrl) {
      notFound()
    }
  }

  return (
    <ReadyToPost
      postId={post.id as string}
      title={title}
      slides={slides}
      imageUrl={legacyImageUrl}
      shortUrl={shortUrl}
      status={post.status as string}
      onMarkAsPosted={markAsPosted}
    />
  )
}
