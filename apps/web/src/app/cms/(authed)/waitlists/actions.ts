'use server'

import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ringContext } from '@/lib/cms/repositories'
import { slugify } from '@/lib/blog/slugify'
// No `@/lib/waitlists/*` alias (scrub lives under apps/web/lib, not src/) — deep
// relative, same as the signup route.
import { redactMessage } from '../../../../../lib/waitlists/scrub'

/**
 * Result shape for the waitlist create/update actions. Mirrors
 * `SaveCampaignResult`: a discriminated union so the connected island can map
 * each failure to a UI affordance (field error vs. toast vs. 403 card).
 */
export type WaitlistActionResult =
  | { ok: true; waitlistId: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'slug_taken' }
  | { ok: false; error: 'forbidden'; message?: string }
  | { ok: false; error: 'db_error'; message: string }

const PG_UNIQUE_VIOLATION = '23505'

interface WaitlistFormInput {
  slug: string
  name: string
  description: string | null
  senderName: string | null
  senderEmail: string | null
  replyTo: string | null
  intro: string | null
  campaignId: string | null
  locale: string | null
}

function readForm(form: FormData): WaitlistFormInput {
  const get = (k: string): string => {
    const v = form.get(k)
    return typeof v === 'string' ? v.trim() : ''
  }
  const name = get('name')
  // Slug is auto-slugified on the client; the server normalizes + trusts it,
  // falling back to the name so a missing slug surfaces as a slug field error
  // only when the name is also empty.
  const slug = slugify(get('slug') || name)
  const orNull = (k: string): string | null => get(k) || null
  return {
    slug,
    name,
    description: orNull('description'),
    senderName: orNull('sender_name'),
    senderEmail: orNull('sender_email'),
    replyTo: orNull('reply_to'),
    intro: orNull('intro'),
    campaignId: orNull('campaign_id'),
    locale: orNull('locale'),
  }
}

/**
 * Validate that `senderEmail`'s domain is one of the site's owned domains.
 * Returns a field-error string, or null when valid / no sender email given.
 * `ringContext().getSite()` reads the site row (which carries `domains`).
 */
async function senderEmailFieldError(siteId: string, senderEmail: string | null): Promise<string | null> {
  if (!senderEmail) return null
  const at = senderEmail.lastIndexOf('@')
  if (at < 1 || at === senderEmail.length - 1) return 'Enter a valid email address.'
  const domain = senderEmail.slice(at + 1).toLowerCase()
  const site = await ringContext().getSite(siteId)
  const domains = (site?.domains ?? []).map((d) => d.toLowerCase())
  if (!domains.includes(domain)) {
    return domains.length > 0
      ? `Sender email must use one of this site's domains: ${domains.join(', ')}.`
      : 'This site has no verified sender domains yet.'
  }
  return null
}

/** Shared field validation for create/update. */
async function validate(siteId: string, input: WaitlistFormInput): Promise<Record<string, string>> {
  const fields: Record<string, string> = {}
  if (!input.name) fields.name = 'Name is required.'
  if (!input.slug) fields.slug = 'Slug is required.'
  const senderErr = await senderEmailFieldError(siteId, input.senderEmail)
  if (senderErr) fields.sender_email = senderErr
  return fields
}

/** Scalar columns written by both create and update (status excluded — Task 16 owns it). */
function scalarPatch(input: WaitlistFormInput) {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    campaign_id: input.campaignId,
    sender_name: input.senderName,
    sender_email: input.senderEmail,
    reply_to: input.replyTo,
    intro_mdx: input.intro,
  }
}

/**
 * Create a waitlist under the current site context. `requireSiteScope` gates
 * the service client (which bypasses RLS). Slug collisions are decided by the
 * `(site_id, slug)` unique constraint surfacing as 23505 in the INSERT catch —
 * NOT a pre-SELECT — so two concurrent creates yield exactly one winner.
 * Status is left to its DB default ('draft'); transitions are Task 16.
 */
export async function createWaitlist(form: FormData): Promise<WaitlistActionResult> {
  const ctx = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!scope.ok) return { ok: false, error: 'forbidden', message: scope.reason }

  const input = readForm(form)
  const fields = await validate(ctx.siteId, input)
  if (Object.keys(fields).length > 0) return { ok: false, error: 'validation_failed', fields }

  const supabase = getSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('waitlists')
      .insert({ site_id: ctx.siteId, ...scalarPatch(input) })
      .select('id')
      .single()
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) return { ok: false, error: 'slug_taken' }
      throw error
    }
    const waitlistId = (data as { id: string }).id

    // Seed the default-locale translations row so the public surface + editor
    // always have a row to read/patch (consent_label is NOT NULL, defaults '').
    const { error: tErr } = await supabase.from('waitlist_translations').insert({
      waitlist_id: waitlistId,
      locale: input.locale || ctx.defaultLocale,
      headline: input.name,
    })
    if (tErr) throw tErr

    return { ok: true, waitlistId }
  } catch (e) {
    return { ok: false, error: 'db_error', message: redactMessage(e instanceof Error ? e.message : String(e)) }
  }
}

/**
 * Update a waitlist's scalar fields. IDOR-guarded: the UPDATE is constrained to
 * the current site (`.eq('site_id', ctx.siteId)`), so a cross-site id matches
 * zero rows and returns `forbidden` (never touching another ring's data). Slug
 * collisions surface the same way as create (23505 → slug_taken). Status is not
 * updatable here (Task 16 owns transitions).
 */
export async function updateWaitlist(id: string, form: FormData): Promise<WaitlistActionResult> {
  const ctx = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!scope.ok) return { ok: false, error: 'forbidden', message: scope.reason }

  const input = readForm(form)
  const fields = await validate(ctx.siteId, input)
  if (Object.keys(fields).length > 0) return { ok: false, error: 'validation_failed', fields }

  const supabase = getSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('waitlists')
      .update(scalarPatch(input))
      .eq('id', id)
      .eq('site_id', ctx.siteId)
      .select('id')
      .maybeSingle()
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) return { ok: false, error: 'slug_taken' }
      throw error
    }
    if (!data) return { ok: false, error: 'forbidden', message: 'not_found_or_cross_site' }
    return { ok: true, waitlistId: (data as { id: string }).id }
  } catch (e) {
    return { ok: false, error: 'db_error', message: redactMessage(e instanceof Error ? e.message : String(e)) }
  }
}
