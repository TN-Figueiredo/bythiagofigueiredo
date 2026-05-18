// apps/web/src/lib/links/auto-link.ts
//
// Automatic tracked-link lifecycle.
// Generic — works for blog, newsletter, campaign, or any source type.
// Decoupled from social — every published content gets a short link,
// regardless of social_config.enabled.

import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { normalizeAllUtmFields, slugifyForCampaign } from '@tn-figueiredo/links'

// ---------------------------------------------------------------------------
// Shared utility — cryptographic short-code generator (rejection sampling)
// ---------------------------------------------------------------------------

export function generateShortCode(length = 7): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  // Discard bytes >= 248 to avoid modulo bias (256 % 62 = 8)
  const limit = Math.floor(256 / alphabet.length) * alphabet.length
  const result: string[] = []
  while (result.length < length) {
    const bytes = new Uint8Array(length * 2) // over-provision to reduce iterations
    crypto.getRandomValues(bytes)
    for (const b of bytes) {
      if (b >= limit) continue
      result.push(alphabet[b % alphabet.length]!)
      if (result.length === length) break
    }
  }
  return result.join('')
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnsureResult {
  linkId: string
  code: string
  isNew: boolean
}

// ---------------------------------------------------------------------------
// 1. ensureTrackedLink — idempotent "upsert" for tracked links
// ---------------------------------------------------------------------------

/**
 * Ensures a tracked link exists for a given source.
 *
 * If a link already exists (source_type + source_id), it is
 * returned as-is and reactivated if previously deactivated.
 * Otherwise a new link is created with ON CONFLICT DO NOTHING semantics
 * to handle concurrent publish races safely.
 *
 * The caller is responsible for building the destinationUrl.
 */
export async function ensureTrackedLink(
  supabase: SupabaseClient,
  siteId: string,
  sourceId: string,
  sourceType: string,
  destinationUrl: string,
  title: string,
  utmCampaign?: string,
): Promise<EnsureResult | null> {
  try {
    // Check for existing link first
    const { data: existing, error: lookupError } = await supabase
      .from('tracked_links')
      .select('id, code, active')
      .eq('site_id', siteId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .maybeSingle()

    if (lookupError) {
      Sentry.captureException(
        new Error(`ensureTrackedLink lookup failed: ${lookupError.message}`),
        { tags: { component: 'auto-link', action: 'lookup' } },
      )
      return null
    }

    if (existing) {
      // Reactivate if it was previously deactivated (unpublish -> republish)
      if (!existing.active) {
        const { error: reactivateError } = await supabase
          .from('tracked_links')
          .update({ active: true })
          .eq('id', existing.id)

        if (reactivateError) {
          Sentry.captureException(
            new Error(`ensureTrackedLink reactivate failed: ${reactivateError.message}`),
            { tags: { component: 'auto-link', action: 'reactivate' } },
          )
        }
      }

      return {
        linkId: existing.id as string,
        code: existing.code as string,
        isNew: false,
      }
    }

    // Create new tracked link
    const shortCode = generateShortCode()

    const { data: linkData, error: insertError } = await supabase
      .from('tracked_links')
      .insert({
        site_id: siteId,
        destination_url: destinationUrl,
        code: shortCode,
        title,
        redirect_type: 307,
        source_type: sourceType,
        source_id: sourceId,
        ...normalizeAllUtmFields({
          utm_medium: sourceType === 'social' ? 'social' : sourceType === 'newsletter' ? 'email' : 'referral',
          utm_campaign: utmCampaign ?? `${sourceType}-${slugifyForCampaign(title) || sourceId.slice(0, 8)}`,
        }),
        active: true,
      })
      .select('id, code')
      .single()

    if (insertError) {
      // ON CONFLICT DO NOTHING — another request won the race.
      // Re-fetch the winner's row.
      const { data: raced } = await supabase
        .from('tracked_links')
        .select('id, code')
        .eq('site_id', siteId)
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
        .maybeSingle()

      if (raced) {
        return {
          linkId: raced.id as string,
          code: raced.code as string,
          isNew: false,
        }
      }

      Sentry.captureException(
        new Error(`ensureTrackedLink insert failed: ${insertError.message}`),
        { tags: { component: 'auto-link', action: 'insert' } },
      )
      return null
    }

    return {
      linkId: linkData.id as string,
      code: linkData.code as string,
      isNew: true,
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'auto-link', action: 'ensureTrackedLink' },
      extra: { siteId, sourceId, sourceType },
    })
    return null
  }
}

// ---------------------------------------------------------------------------
// 2. deactivateSourceLinks — called on unpublish / archive
// ---------------------------------------------------------------------------

/**
 * Deactivates all tracked links for a given source.
 * Returns the count of links deactivated.
 */
export async function deactivateSourceLinks(
  supabase: SupabaseClient,
  sourceId: string,
  sourceType: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('tracked_links')
      .update({ active: false })
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .select('id')

    if (error) {
      Sentry.captureException(
        new Error(`deactivateSourceLinks failed: ${error.message}`),
        { tags: { component: 'auto-link', action: 'deactivate' } },
      )
      return 0
    }

    return data?.length ?? 0
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'auto-link', action: 'deactivateSourceLinks' },
      extra: { sourceId, sourceType },
    })
    return 0
  }
}

// ---------------------------------------------------------------------------
// 3. reactivateSourceLinks — called on republish
// ---------------------------------------------------------------------------

/**
 * Reactivates all tracked links for a given source.
 * Returns the count of links reactivated.
 */
export async function reactivateSourceLinks(
  supabase: SupabaseClient,
  sourceId: string,
  sourceType: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('tracked_links')
      .update({ active: true })
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .select('id')

    if (error) {
      Sentry.captureException(
        new Error(`reactivateSourceLinks failed: ${error.message}`),
        { tags: { component: 'auto-link', action: 'reactivate' } },
      )
      return 0
    }

    return data?.length ?? 0
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'auto-link', action: 'reactivateSourceLinks' },
      extra: { sourceId, sourceType },
    })
    return 0
  }
}
