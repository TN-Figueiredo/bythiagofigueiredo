import type { SupabaseClient } from '@supabase/supabase-js'

export interface CampaignFixtureOptions {
  interest?: string
  status?: 'draft' | 'scheduled' | 'published' | 'archived'
  published_at?: string | null
  scheduled_for?: string | null
  site_id?: string | null
}

/**
 * Insert a campaign row via an admin Supabase client. Pushes the id onto the
 * provided tracker array so the caller's `afterAll` can clean up with a single
 * `.delete().in('id', tracker)`.
 */
export async function makeCampaign(
  admin: SupabaseClient,
  tracker: string[],
  opts: CampaignFixtureOptions = {}
): Promise<string> {
  const payload: Record<string, unknown> = {
    interest: opts.interest ?? 'creator',
    ...opts,
  }
  const { data, error } = await admin.from('campaigns').insert(payload).select('id').single()
  if (error || !data) throw error ?? new Error('campaign insert failed')
  tracker.push(data.id)
  return data.id
}

/**
 * Convenience wrapper: insert a published-in-the-past campaign so submissions
 * are immediately allowed under the Sprint 1b "published guard" policy.
 */
export async function makePublishedCampaign(
  admin: SupabaseClient,
  tracker: string[],
  opts: Omit<CampaignFixtureOptions, 'status' | 'published_at'> = {}
): Promise<string> {
  return makeCampaign(admin, tracker, {
    ...opts,
    status: 'published',
    published_at: new Date(Date.now() - 60_000).toISOString(),
  })
}
