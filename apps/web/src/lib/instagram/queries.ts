import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { resolveSlots } from './slots'
import type { InstagramAccountPublic, InstagramPostRow, InstagramFeedSlotRow, ResolvedSlot } from './types'

export const getInstagramFeedData = unstable_cache(
  async (
    siteId: string,
    locale: string,
    count?: number,
  ): Promise<{ account: InstagramAccountPublic | null; slots: ResolvedSlot[] }> => {
    const supabase = getSupabaseServiceClient()
    const dbLocale = locale.startsWith('pt') ? 'pt' : locale.startsWith('en') ? 'en' : locale

    const { data: account } = await supabase
      .from('instagram_accounts_public')
      .select('*')
      .eq('site_id', siteId)
      .in('locale', [dbLocale, 'all'])
      .order('locale', { ascending: true })
      .limit(1)
      .single()

    if (!account) return { account: null, slots: [] }

    const effectiveCount = count ?? (account as InstagramAccountPublic).display_slots

    const [postsRes, slotsRes] = await Promise.all([
      supabase
        .from('instagram_posts')
        .select('*')
        .eq('account_id', account.id)
        .order('ig_timestamp', { ascending: false })
        .limit(50),
      supabase
        .from('instagram_feed_slots')
        .select('*')
        .eq('account_id', account.id)
        .order('position'),
    ])

    const posts = (postsRes.data ?? []) as InstagramPostRow[]
    const feedSlots = (slotsRes.data ?? []) as InstagramFeedSlotRow[]
    const resolved = resolveSlots(feedSlots, posts, effectiveCount)

    return {
      account: account as InstagramAccountPublic,
      slots: resolved,
    }
  },
  ['instagram-feed-data'],
  { revalidate: 900, tags: ['instagram-feed'] },
)
