'use server'

import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { revalidateSiteBranding } from '@/lib/seo/cache-invalidation'

/**
 * Sprint 5b PR-C Task C.9 — admin site branding/identity/SEO-defaults actions.
 *
 * Three server actions that mutate `sites.*` and flush the broad `seo-config`
 * cache tag via `revalidateSiteBranding()`. Cache granularity is intentionally
 * broad (invalidates every site's config at once) because branding edits are
 * rare; finer tags can land in a later sprint when a second ring is live.
 *
 * All three require the caller to pass the admin-area gate (`requireArea('admin')`
 * → `is_admin()` RPC → super_admin or admin org role). Validation uses Zod with
 * `.strict()` so unknown keys are rejected up-front. Unexpected failures are
 * captured to Sentry with `{ component: 'admin-sites-actions', action: '<name>' }`.
 */

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; details?: unknown }

// ── Shared primitives ─────────────────────────────────────────────────────

// 6-char hex (#RRGGBB) — matches the existing `sites.primary_color` vocabulary.
// We deliberately do NOT accept 3-char hex (#RGB) so downstream consumers
// (OG route, email sender) never have to expand shortforms.
const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'invalid_hex_color')

const HttpsUrl = z
  .string()
  .url('invalid_url')
  .refine((u) => u.startsWith('https://'), 'must_be_https')

// Twitter/X handle: 1–15 alphanumerics or underscore, NO leading `@`.
const TwitterHandle = z
  .string()
  .regex(/^[A-Za-z0-9_]{1,15}$/, 'invalid_twitter_handle')

const SiteId = z.string().uuid('invalid_site_id')

const CmsEnabledSchema = z
  .object({
    siteId: SiteId,
    cmsEnabled: z.boolean(),
  })
  .strict()

// ── Input schemas ─────────────────────────────────────────────────────────

const BrandingSchema = z
  .object({
    siteId: SiteId,
    primaryColor: HexColor.optional(),
    logoUrl: HttpsUrl.optional(),
  })
  .strict()

const IdentitySchema = z
  .object({
    siteId: SiteId,
    identityType: z.enum(['person', 'organization']),
    // `null` explicitly clears the handle; `undefined` leaves it untouched.
    twitterHandle: TwitterHandle.nullable().optional(),
  })
  .strict()

const SeoDefaultsSchema = z
  .object({
    siteId: SiteId,
    // Same null-vs-undefined contract as twitterHandle above.
    defaultOgImage: HttpsUrl.nullable().optional(),
  })
  .strict()

// ── Actions ───────────────────────────────────────────────────────────────

export async function updateSiteBranding(
  input: { siteId: string; primaryColor?: string; logoUrl?: string },
): Promise<ActionResult> {
  const parsed = BrandingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', details: parsed.error.issues }
  }

  try {
    // Redirects on denial — treat as an unrecoverable control-flow signal.
    await requireArea('admin')

    const patch: Record<string, unknown> = {}
    if (parsed.data.primaryColor !== undefined) {
      patch.primary_color = parsed.data.primaryColor
    }
    if (parsed.data.logoUrl !== undefined) {
      patch.logo_url = parsed.data.logoUrl
    }

    // Nothing to patch = no-op success. Still invalidate so callers who
    // triggered the action with empty intent get a cache-warm response.
    if (Object.keys(patch).length === 0) {
      revalidateSiteBranding()
      return { ok: true }
    }

    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('sites')
      .update(patch)
      .eq('id', parsed.data.siteId)

    if (error) {
      Sentry.captureException(error, {
        tags: { component: 'admin-sites-actions', action: 'updateSiteBranding' },
      })
      return { ok: false, error: 'db_error', details: error.message }
    }

    revalidateSiteBranding()
    return { ok: true }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'admin-sites-actions', action: 'updateSiteBranding' },
    })
    throw err
  }
}

export async function updateSiteIdentity(
  input: {
    siteId: string
    identityType: 'person' | 'organization'
    twitterHandle?: string | null
  },
): Promise<ActionResult> {
  const parsed = IdentitySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', details: parsed.error.issues }
  }

  try {
    await requireArea('admin')

    const patch: Record<string, unknown> = {
      identity_type: parsed.data.identityType,
    }
    if (parsed.data.twitterHandle !== undefined) {
      // `null` clears the handle; a real string writes it through.
      patch.twitter_handle = parsed.data.twitterHandle
    }

    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('sites')
      .update(patch)
      .eq('id', parsed.data.siteId)

    if (error) {
      Sentry.captureException(error, {
        tags: { component: 'admin-sites-actions', action: 'updateSiteIdentity' },
      })
      return { ok: false, error: 'db_error', details: error.message }
    }

    revalidateSiteBranding()
    return { ok: true }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'admin-sites-actions', action: 'updateSiteIdentity' },
    })
    throw err
  }
}

export async function updateSiteCmsEnabled(
  input: { siteId: string; cmsEnabled: boolean },
): Promise<ActionResult> {
  const parsed = CmsEnabledSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', details: parsed.error.issues }
  }

  try {
    await requireArea('admin')

    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('sites')
      .update({ cms_enabled: parsed.data.cmsEnabled })
      .eq('id', parsed.data.siteId)

    if (error) {
      Sentry.captureException(error, {
        tags: { component: 'admin-sites-actions', action: 'updateSiteCmsEnabled' },
      })
      return { ok: false, error: 'db_error', details: error.message }
    }

    revalidateSiteBranding()
    return { ok: true }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'admin-sites-actions', action: 'updateSiteCmsEnabled' },
    })
    throw err
  }
}

export async function updateSiteSeoDefaults(
  input: { siteId: string; defaultOgImage?: string | null },
): Promise<ActionResult> {
  const parsed = SeoDefaultsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', details: parsed.error.issues }
  }

  try {
    await requireArea('admin')

    const patch: Record<string, unknown> = {}
    if (parsed.data.defaultOgImage !== undefined) {
      patch.seo_default_og_image = parsed.data.defaultOgImage
    }

    if (Object.keys(patch).length === 0) {
      revalidateSiteBranding()
      return { ok: true }
    }

    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('sites')
      .update(patch)
      .eq('id', parsed.data.siteId)

    if (error) {
      Sentry.captureException(error, {
        tags: { component: 'admin-sites-actions', action: 'updateSiteSeoDefaults' },
      })
      return { ok: false, error: 'db_error', details: error.message }
    }

    revalidateSiteBranding()
    return { ok: true }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'admin-sites-actions', action: 'updateSiteSeoDefaults' },
    })
    throw err
  }
}
