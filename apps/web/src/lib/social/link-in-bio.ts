import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildShortUrl } from '@/lib/links/short-url'

const MAX_ENTRIES = 20
const SENTRY_TAG = { component: 'social-link-in-bio' }

export interface LinkinBioEntry {
  id: string
  title: string
  shortUrl: string
  thumbnailUrl: string | null
  createdAt: string
}

export async function getLinkinBioEntries(siteId: string): Promise<LinkinBioEntry[]> {
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_in_bio_entries')
    .select(`
      id,
      position,
      created_at,
      social_posts!inner(content),
      tracked_links!inner(id, code, destination_url)
    `)
    .eq('site_id', siteId)
    .order('position', { ascending: true })
    .limit(MAX_ENTRIES)

  if (error || !data) {
    Sentry.captureException(error, { tags: SENTRY_TAG })
    return []
  }

  return data.map((row) => {
    const post = row.social_posts as unknown as { content: { title?: string; media_urls?: string[] } }
    const link = row.tracked_links as unknown as { id: string; code: string; destination_url: string }

    return {
      id: row.id as string,
      title: post.content.title ?? 'Untitled',
      shortUrl: buildShortUrl(link.code),
      thumbnailUrl: post.content.media_urls?.[0] ?? null,
      createdAt: row.created_at as string,
    }
  })
}

export async function addLinkinBioEntry(input: {
  siteId: string
  postId: string
  linkId: string
}): Promise<void> {
  const supabase = getSupabaseServiceClient()

  try {
    // Shift all existing entries down by 1 in a single bulk update (avoids N+1 queries)
    await supabase.rpc('shift_link_in_bio_positions', {
      p_site_id: input.siteId,
      p_min_position: 0,
    })

    // Insert new entry at position 0
    const { error: insertError } = await supabase
      .from('link_in_bio_entries')
      .insert({
        site_id: input.siteId,
        post_id: input.postId,
        link_id: input.linkId,
        position: 0,
      })

    if (insertError) {
      throw insertError
    }

    // Auto-prune: remove entries beyond MAX_ENTRIES
    const { data: overflow } = await supabase
      .from('link_in_bio_entries')
      .select('id')
      .eq('site_id', input.siteId)
      .order('position', { ascending: true })
      .range(MAX_ENTRIES, MAX_ENTRIES + 100)

    if (overflow && overflow.length > 0) {
      const overflowIds = overflow.map((r) => r.id as string)
      await supabase
        .from('link_in_bio_entries')
        .delete()
        .in('id', overflowIds)
    }
  } catch (err) {
    Sentry.captureException(err, { tags: SENTRY_TAG })
  }
}
