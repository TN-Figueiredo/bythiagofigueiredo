'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { lookupChannelByHandle, type ChannelLookupResult } from '@/lib/youtube/api-client'

type ActionResult = { ok: true } | { ok: false; error: string }
type LookupResult = { ok: true; channel: ChannelLookupResult } | { ok: false; error: string }

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }
  return siteId
}

const brandingSchema = z.object({
  logo_url: z.string().startsWith('https://').or(z.literal('')),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
})

const identitySchema = z.object({
  identity_type: z.enum(['person', 'organization']),
  twitter_handle: z.string().regex(/^[A-Za-z0-9_]{1,15}$/).or(z.literal('')),
})

const seoSchema = z.object({
  seo_default_og_image: z
    .string()
    .startsWith('https://')
    .or(z.literal(''))
    .nullable(),
})

const newsletterTypeUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cadence_days: z.number().int().min(1).max(365).nullable().optional(),
  preferred_send_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  cadence_paused: z.boolean().optional(),
  sender_name: z.string().max(100).nullable().optional(),
  sender_email: z.string().email().nullable().optional(),
  reply_to: z.string().email().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
  sort_order: z.number().int().min(0).optional(),
})

const newsletterTypeCreateSchema = z.object({
  name: z.string().min(1).max(100),
  sort_order: z.number().int().min(0).optional(),
})

const blogCadenceSchema = z.object({
  cadence_days: z.number().int().min(1).max(365).nullable().optional(),
  preferred_send_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  cadence_start_date: z.string().nullable().optional(),
})

const localesSchema = z.object({
  default_locale: z.string().min(2).max(10),
  supported_locales: z.array(z.string().min(2).max(10)).min(1),
})

export async function updateBranding(input: {
  logo_url: string
  primary_color: string
}): Promise<ActionResult> {
  const parsed = brandingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('sites')
    .update(parsed.data)
    .eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidateTag('seo-config')
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateIdentity(input: {
  identity_type: string
  twitter_handle: string
}): Promise<ActionResult> {
  const parsed = identitySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('sites')
    .update(parsed.data)
    .eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidateTag('seo-config')
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateSeoDefaults(input: {
  seo_default_og_image: string | null
}): Promise<ActionResult> {
  const parsed = seoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('sites')
    .update(parsed.data)
    .eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidateTag('seo-config')
  return { ok: true }
}

export async function updateNewsletterType(
  id: string,
  data: {
    name?: string
    cadence_days?: number | null
    preferred_send_time?: string
    cadence_paused?: boolean
    sender_name?: string | null
    sender_email?: string | null
    reply_to?: string | null
    color?: string | null
    sort_order?: number
  },
): Promise<ActionResult> {
  const parsed = newsletterTypeUpdateSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .update(parsed.data)
    .eq('id', id)
    .eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function createNewsletterType(data: {
  name: string
  sort_order?: number
}): Promise<ActionResult> {
  const parsed = newsletterTypeCreateSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .insert({ ...parsed.data, site_id: siteId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function deleteNewsletterType(id: string): Promise<ActionResult> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function reorderNewsletterTypes(
  orderedIds: string[],
): Promise<ActionResult> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('newsletter_types')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
      .eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateBlogCadence(
  locale: string,
  data: {
    cadence_days?: number | null
    preferred_send_time?: string
    cadence_start_date?: string | null
  },
): Promise<ActionResult> {
  const parsed = blogCadenceSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_cadence')
    .upsert(
      { ...parsed.data, locale, site_id: siteId },
      { onConflict: 'site_id,locale' },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateSiteLocales(data: {
  default_locale: string
  supported_locales: string[]
}): Promise<ActionResult> {
  const parsed = localesSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  if (!parsed.data.supported_locales.includes(parsed.data.default_locale)) {
    return {
      ok: false,
      error: 'Default locale must be in supported locales',
    }
  }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('sites')
    .update(parsed.data)
    .eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function disableCms(): Promise<ActionResult> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('sites')
    .update({ cms_enabled: false })
    .eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms')
  return { ok: true }
}

const syncScheduleSchema = z.object({
  channel_id: z.string().uuid(),
  sync_enabled: z.boolean(),
  sync_schedules: z.array(z.object({
    day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    hour: z.number().int().min(0).max(23),
    tz: z.string(),
    label: z.string(),
  })),
  schedule_label: z.string().trim().transform(v => v || null).nullable().optional(),
})

export async function updateYouTubeChannelSettings(input: z.infer<typeof syncScheduleSchema>): Promise<ActionResult> {
  const parsed = syncScheduleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_channels')
    .update({
      sync_enabled: parsed.data.sync_enabled,
      sync_schedules: parsed.data.sync_schedules,
      schedule_label: parsed.data.schedule_label ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.channel_id).eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidateTag('youtube')
  revalidatePath('/cms/settings')
  return { ok: true }
}

const timezoneSchema = z.object({
  timezone: z.string().min(1).max(100),
})

export async function updateSiteTimezone(input: {
  timezone: string
}): Promise<ActionResult> {
  const parsed = timezoneSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const validTimezones = Intl.supportedValuesOf('timeZone')
  if (!validTimezones.includes(parsed.data.timezone)) {
    return { ok: false, error: 'Invalid IANA timezone' }
  }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('sites')
    .update({ timezone: parsed.data.timezone, updated_at: new Date().toISOString() })
    .eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidateTag('seo-config')
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function deleteSite(confirmSlug: string): Promise<ActionResult> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { data: site } = await supabase
    .from('sites')
    .select('slug')
    .eq('id', siteId)
    .single()
  if (!site || site.slug !== confirmSlug)
    return { ok: false, error: 'Slug confirmation does not match' }
  const { error } = await supabase.from('sites').delete().eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

const handleInputSchema = z.object({
  handleOrUrl: z.string().min(1, 'Handle or URL is required').max(200),
})

export async function lookupYouTubeChannel(input: z.infer<typeof handleInputSchema>): Promise<LookupResult> {
  const parsed = handleInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { ok: false, error: 'YouTube API key not configured' }

  try {
    const channel = await lookupChannelByHandle(parsed.data.handleOrUrl, apiKey)
    if (!channel) return { ok: false, error: 'Channel not found. Check the handle and try again.' }
    return { ok: true, channel }
  } catch (e) {
    if (e instanceof Error && e.message === 'quotaExceeded') {
      return { ok: false, error: 'YouTube API limit reached. Try again later.' }
    }
    console.error('[youtube] channel lookup failed:', e instanceof Error ? e.message : e)
    return { ok: false, error: 'Failed to look up channel. Please try again.' }
  }
}

const addChannelSchema = z.object({
  channelId: z.string().min(1),
  locale: z.enum(['pt', 'en']),
  handle: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  uploadsPlaylistId: z.string().min(1),
  subscriberCount: z.number().int().min(0),
  videoCount: z.number().int().min(0),
  thumbnailUrl: z.string().url().nullable(),
  bannerUrl: z.string().url().nullable(),
  customUrl: z.string().nullable(),
})

export async function addYouTubeChannel(input: z.infer<typeof addChannelSchema>): Promise<ActionResult> {
  const parsed = addChannelSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Check locale not taken
  const { data: existing } = await supabase
    .from('youtube_channels')
    .select('id, name')
    .eq('site_id', siteId)
    .eq('locale', parsed.data.locale)
    .limit(1)
  if (existing && existing.length > 0) {
    return { ok: false, error: `Locale ${parsed.data.locale} is already assigned to "${existing[0]!.name}".` }
  }

  // Check channel not already registered
  const { data: dup } = await supabase
    .from('youtube_channels')
    .select('id, locale')
    .eq('site_id', siteId)
    .eq('channel_id', parsed.data.channelId)
    .limit(1)
  if (dup && dup.length > 0) {
    return { ok: false, error: `This channel is already registered as ${dup[0]!.locale}.` }
  }

  const { error } = await supabase.from('youtube_channels').insert({
    site_id: siteId,
    channel_id: parsed.data.channelId,
    locale: parsed.data.locale,
    handle: parsed.data.handle,
    name: parsed.data.name,
    description: parsed.data.description,
    uploads_playlist_id: parsed.data.uploadsPlaylistId,
    subscriber_count: parsed.data.subscriberCount,
    video_count: parsed.data.videoCount,
    thumbnail_url: parsed.data.thumbnailUrl,
    banner_url: parsed.data.bannerUrl,
    custom_url: parsed.data.customUrl,
    sync_enabled: true,
    sync_schedules: [],
  })

  if (error) return { ok: false, error: error.message }

  // Trigger first sync in background
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    fetch(`${baseUrl}/api/cron/sync-youtube?mode=manual`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` },
    }).catch((err) => {
      console.warn('[youtube] background sync trigger failed:', err instanceof Error ? err.message : err)
    })
  }

  revalidateTag('youtube')
  revalidatePath('/cms/settings')
  revalidatePath('/')
  return { ok: true }
}

const removeChannelSchema = z.object({
  channelId: z.string().uuid(),
})

export async function removeYouTubeChannel(input: z.infer<typeof removeChannelSchema>): Promise<ActionResult> {
  const parsed = removeChannelSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id')
    .eq('id', parsed.data.channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return { ok: false, error: 'Channel not found' }

  // Delete in order: comments → videos → sync log → channel
  const { data: videoIds } = await supabase
    .from('youtube_videos')
    .select('id')
    .eq('channel_id', channel.id)

  if (videoIds && videoIds.length > 0) {
    const ids = videoIds.map(v => v.id as string)
    const { error: commentsErr } = await supabase.from('youtube_curated_comments').delete().in('video_id', ids)
    if (commentsErr) return { ok: false, error: `Failed to delete comments: ${commentsErr.message}` }
    const { error: videosErr } = await supabase.from('youtube_videos').delete().eq('channel_id', channel.id)
    if (videosErr) return { ok: false, error: `Failed to delete videos: ${videosErr.message}` }
  }

  const { error: logErr } = await supabase.from('youtube_sync_log').delete().eq('channel_id', channel.id)
  if (logErr) return { ok: false, error: `Failed to delete sync logs: ${logErr.message}` }

  const { error } = await supabase.from('youtube_channels').delete().eq('id', channel.id).eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }

  revalidateTag('youtube')
  revalidatePath('/cms/settings')
  revalidatePath('/')
  return { ok: true }
}

// ── Instagram ──────────────────────────────────────────────────────

const instagramAccountSchema = z.object({
  handle: z.string().min(1).max(50),
  locale: z.enum(['pt', 'en']),
})

const instagramSettingsSchema = z.object({
  accountId: z.string().uuid(),
  sync_enabled: z.boolean().optional(),
  display_slots: z.number().int().min(1).max(12).optional(),
  layout_type: z.enum(['grid', 'scatter']).optional(),
})

const instagramTokenSchema = z.object({
  accountId: z.string().uuid(),
  accessToken: z.string().min(1),
})

const instagramSlotSchema = z.object({
  accountId: z.string().uuid(),
  slots: z.array(z.object({
    position: z.number().int().min(1).max(12),
    postId: z.string().uuid().nullable(),
  })),
})

export async function addInstagramAccount(input: {
  handle: string
  locale: string
}): Promise<ActionResult> {
  const parsed = instagramAccountSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('instagram_accounts')
    .insert({
      site_id: siteId,
      handle: parsed.data.handle,
      locale: parsed.data.locale,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function removeInstagramAccount(input: {
  accountId: string
}): Promise<ActionResult> {
  const parsed = z.object({ accountId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('instagram_accounts')
    .delete()
    .eq('id', parsed.data.accountId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  revalidateTag('instagram-feed')
  return { ok: true }
}

export async function updateInstagramSettings(input: {
  accountId: string
  sync_enabled?: boolean
  display_slots?: number
  layout_type?: 'grid' | 'scatter'
}): Promise<ActionResult> {
  const parsed = instagramSettingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { accountId, ...updates } = parsed.data

  const { error } = await supabase
    .from('instagram_accounts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', accountId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  revalidateTag('instagram-feed')
  return { ok: true }
}

export async function setInstagramToken(input: {
  accountId: string
  accessToken: string
}): Promise<ActionResult> {
  const parsed = instagramTokenSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  let igUserId: string | null = null
  try {
    const { fetchInstagramProfile } = await import('@/lib/instagram/api-client')
    const profile = await fetchInstagramProfile(parsed.data.accessToken)
    igUserId = profile.id
  } catch {
    return { ok: false, error: 'Invalid token — could not fetch Instagram profile' }
  }

  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('instagram_accounts')
    .update({
      access_token: parsed.data.accessToken,
      ig_user_id: igUserId,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.accountId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function triggerInstagramSync(input: {
  accountId: string
}): Promise<ActionResult> {
  const parsed = z.object({ accountId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return { ok: false, error: 'CRON_SECRET not configured' }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(
      `${baseUrl}/api/cron/instagram-sync?mode=manual&accountId=${parsed.data.accountId}`,
      { headers: { authorization: `Bearer ${cronSecret}` } },
    )
    if (!res.ok) return { ok: false, error: `Sync failed: ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sync request failed' }
  }

  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateInstagramSlots(input: {
  accountId: string
  slots: { position: number; postId: string | null }[]
}): Promise<ActionResult> {
  const parsed = instagramSlotSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const rows = parsed.data.slots.map((s) => ({
    account_id: parsed.data.accountId,
    position: s.position,
    post_id: s.postId,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('instagram_feed_slots')
    .upsert(rows, { onConflict: 'account_id,position' })

  if (error) return { ok: false, error: error.message }
  revalidateTag('instagram-feed')
  revalidatePath('/cms/settings')
  return { ok: true }
}
