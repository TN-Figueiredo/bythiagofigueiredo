'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  type ActionResult,
  SENTRY_TAG,
  zodError,
  requireEditAccess,
  revalidateSocialPaths,
} from './_shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const CONTENT_TYPES = ['blog', 'newsletter', 'campaign', 'video'] as const
const PLATFORMS = ['facebook', 'instagram', 'bluesky'] as const

export type SocialContentType = (typeof CONTENT_TYPES)[number]
export type SocialPlatform = (typeof PLATFORMS)[number]

// Matrix key format: "blog:facebook" -> template UUID
export type SocialDefaults = Record<string, string>

const socialDefaultsEntrySchema = z.object({
  contentType: z.enum(CONTENT_TYPES),
  platform: z.enum(PLATFORMS),
  templateId: z.string().uuid().nullable(),
})

const updateSocialDefaultsSchema = z.object({
  entries: z.array(socialDefaultsEntrySchema),
})

// ---------------------------------------------------------------------------
// getSocialDefaults
// ---------------------------------------------------------------------------

export async function getSocialDefaults(
  siteId: string,
): Promise<ActionResult<SocialDefaults>> {
  const parsed = z.string().uuid().safeParse(siteId)
  if (!parsed.success) return { ok: false, error: 'Invalid site ID' }

  try {
    await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('sites')
      .select('social_defaults')
      .eq('id', parsed.data)
      .single()

    if (error || !data) return { ok: false, error: 'Site not found' }

    return {
      ok: true,
      data: (data.social_defaults as SocialDefaults) ?? {},
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getSocialDefaults' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// updateSocialDefaults
// ---------------------------------------------------------------------------

export async function updateSocialDefaults(
  siteId: string,
  data: {
    entries: Array<{
      contentType: SocialContentType
      platform: SocialPlatform
      templateId: string | null
    }>
  },
): Promise<ActionResult> {
  const siteParsed = z.string().uuid().safeParse(siteId)
  if (!siteParsed.success) return { ok: false, error: 'Invalid site ID' }
  const parsed = updateSocialDefaultsSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (siteParsed.data !== authorizedSiteId) {
      return { ok: false, error: 'forbidden' }
    }

    const supabase = getSupabaseServiceClient()

    // Build the social_defaults JSON object
    // First, fetch current defaults to merge
    const { data: site, error: fetchError } = await supabase
      .from('sites')
      .select('social_defaults')
      .eq('id', authorizedSiteId)
      .single()

    if (fetchError || !site) return { ok: false, error: 'Site not found' }

    const current = (site.social_defaults as SocialDefaults) ?? {}

    // Apply updates
    for (const entry of parsed.data.entries) {
      const key = `${entry.contentType}:${entry.platform}`
      if (entry.templateId === null) {
        delete current[key]
      } else {
        current[key] = entry.templateId
      }
    }

    const { error } = await supabase
      .from('sites')
      .update({ social_defaults: current })
      .eq('id', authorizedSiteId)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'updateSocialDefaults' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'updateSocialDefaults' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// Queue slots
// ---------------------------------------------------------------------------

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
type DayKey = (typeof DAY_KEYS)[number]

const queueSlotConfigSchema = z.record(
  z.enum(DAY_KEYS),
  z.array(z.number().int().min(0).max(23)),
)

export async function getQueueSlotConfig(
  siteId: string,
): Promise<ActionResult<Partial<Record<DayKey, number[]>>>> {
  const parsed = z.string().uuid().safeParse(siteId)
  if (!parsed.success) return { ok: false, error: 'Invalid site ID' }

  try {
    await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('sites')
      .select('social_defaults')
      .eq('id', parsed.data)
      .single()

    if (error || !data) return { ok: false, error: 'Site not found' }

    const defaults = data.social_defaults as Record<string, unknown> | null
    const slots = (defaults?.queue_slots ?? {}) as Partial<Record<DayKey, number[]>>
    return { ok: true, data: slots }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getQueueSlotConfig' } })
    throw err
  }
}

export async function saveQueueSlotConfig(
  siteId: string,
  config: Partial<Record<string, number[]>>,
): Promise<ActionResult> {
  const siteParsed = z.string().uuid().safeParse(siteId)
  if (!siteParsed.success) return { ok: false, error: 'Invalid site ID' }
  const configParsed = queueSlotConfigSchema.safeParse(config)
  if (!configParsed.success) return { ok: false, error: zodError(configParsed.error) }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (siteParsed.data !== authorizedSiteId) {
      return { ok: false, error: 'forbidden' }
    }

    const supabase = getSupabaseServiceClient()

    // Fetch current social_defaults to merge
    const { data: site, error: fetchError } = await supabase
      .from('sites')
      .select('social_defaults')
      .eq('id', authorizedSiteId)
      .single()

    if (fetchError || !site) return { ok: false, error: 'Site not found' }

    const current = (site.social_defaults as Record<string, unknown>) ?? {}
    current.queue_slots = configParsed.data

    const { error } = await supabase
      .from('sites')
      .update({ social_defaults: current })
      .eq('id', authorizedSiteId)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'saveQueueSlotConfig' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'saveQueueSlotConfig' } })
    throw err
  }
}
