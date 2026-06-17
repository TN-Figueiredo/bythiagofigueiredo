'use server'

import * as Sentry from '@sentry/nextjs'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ringContext } from '@/lib/cms/repositories'
import { slugify } from '@/lib/blog/slugify'
import { escapeCsv } from '@/lib/cms/csv'
// No `@/lib/waitlists/*` alias (scrub lives under apps/web/lib, not src/) — deep
// relative, same as the signup route.
import { redactMessage } from '../../../../../lib/waitlists/scrub'
import { getLogger } from '../../../../../lib/logger'
import { isWaitlistStatus, LEGAL_TRANSITIONS, type WaitlistStatus } from '../../../../../lib/waitlists/status'

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

/** Narrowing guard for the `.select('id')` projection — strict TS, no `as` cast. */
function requireRowId(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof (data as { id: unknown }).id === 'string'
  ) {
    return (data as { id: string }).id
  }
  throw new Error('expected a row with a string id')
}

/** Narrowing guard for the `.select('status')` projection — strict TS, no `as` cast. */
function requireStatus(data: unknown): WaitlistStatus {
  if (
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    isWaitlistStatus((data as { status: unknown }).status)
  ) {
    return (data as { status: WaitlistStatus }).status
  }
  throw new Error('expected a row with a valid waitlist status')
}

/** Narrowing guard for the `.select('slug')` projection — strict TS, no `as` cast. */
function requireSlug(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'slug' in data &&
    typeof (data as { slug: unknown }).slug === 'string'
  ) {
    return (data as { slug: string }).slug
  }
  throw new Error('expected a row with a string slug')
}

/** Postgres SQLSTATE off an unknown caught error, without an `any` cast. */
function errCode(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const c = (e as { code: unknown }).code
    if (typeof c === 'string') return c
  }
  return 'unknown'
}

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
    const waitlistId = requireRowId(data)

    // Seed the default-locale translations row so the public surface + editor
    // always have a row to read/patch (consent_label is NOT NULL, defaults '').
    // The two writes are NOT in a single DB transaction (two PostgREST calls), so
    // on translation failure we explicitly roll back the just-created waitlist row
    // to avoid a half-created list (a waitlist with no default-locale translation).
    // Rollback is site-scoped — never touches another ring's data.
    // CROSS-FILE FOLLOW-UP (WL-09): the durable fix is a SECURITY DEFINER RPC
    // `create_waitlist_with_translation(...)` (mirroring `waitlist_signup`) added via
    // `npm run db:new`; until that migration exists, this compensating delete keeps
    // the two writes coherent.
    const { error: tErr } = await supabase.from('waitlist_translations').insert({
      waitlist_id: waitlistId,
      locale: input.locale || ctx.defaultLocale,
      headline: input.name,
    })
    if (tErr) {
      const { error: rollbackErr } = await supabase
        .from('waitlists')
        .delete()
        .eq('id', waitlistId)
        .eq('site_id', ctx.siteId)
      if (rollbackErr) {
        // The compensating delete itself failed — surface the orphaned-row window so it
        // is observable until the WL-09 atomic RPC lands (the parent-row delete reaps the
        // translation via ON DELETE CASCADE once cleaned up).
        getLogger().error('[createWaitlist] rollback failed — orphaned waitlist row', {
          code: rollbackErr.code,
          waitlistId,
        })
        Sentry.captureException(
          new Error(`createWaitlist rollback ${rollbackErr.code}: ${redactMessage(rollbackErr.message ?? '')}`),
          { tags: { component: 'waitlist', action: 'createWaitlist' } },
        )
      }
      throw tErr
    }

    return { ok: true, waitlistId }
  } catch (e) {
    // Log-then-capture (M8), matching queries.ts + signup/route.ts. Never hand the RAW
    // caught error to Sentry — a Postgres message can echo the submitted email/IP — so
    // wrap a redacted, code-tagged Error.
    getLogger().error('[createWaitlist]', { code: errCode(e) })
    Sentry.captureException(
      new Error(`createWaitlist ${errCode(e)}: ${redactMessage(e instanceof Error ? e.message : String(e))}`),
      { tags: { component: 'waitlist', action: 'createWaitlist' } },
    )
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
    return { ok: true, waitlistId: requireRowId(data) }
  } catch (e) {
    getLogger().error('[updateWaitlist]', { code: errCode(e) })
    Sentry.captureException(
      new Error(`updateWaitlist ${errCode(e)}: ${redactMessage(e instanceof Error ? e.message : String(e))}`),
      { tags: { component: 'waitlist', action: 'updateWaitlist' } },
    )
    return { ok: false, error: 'db_error', message: redactMessage(e instanceof Error ? e.message : String(e)) }
  }
}

export type WaitlistTransitionResult =
  | { ok: true; status: WaitlistStatus }
  | { ok: false; error: 'forbidden'; message?: string }
  | { ok: false; error: 'illegal_transition' }
  | { ok: false; error: 'fase1_only_draft' }
  | { ok: false; error: 'status_changed' }
  | { ok: false; error: 'db_error'; message: string }

/**
 * Move a waitlist between statuses via compare-and-set. `from` is the status the
 * caller believes is current (the status-strip renders buttons off it); the CAS
 * `.eq('status', from)` returns 0 rows if someone changed it underneath us
 * (`status_changed`) and also closes cross-site IDOR via `.eq('site_id')`.
 *
 * M6 LGPD Fase-1 gate: no list may go `open` until the DSAR + unsubscribe rights
 * paths ship (Fase 2). `WAITLIST_ACCEPT_PUBLIC_SIGNUPS` is unset by default, so prod
 * stays draft-only and fail-closed. Both the illegal-transition and the Fase-1 gate
 * return BEFORE any DB round-trip.
 */
export async function transitionWaitlistStatus(
  id: string,
  from: WaitlistStatus,
  to: WaitlistStatus,
): Promise<WaitlistTransitionResult> {
  const ctx = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!scope.ok) return { ok: false, error: 'forbidden', message: scope.reason }

  if (!LEGAL_TRANSITIONS[from]?.includes(to)) return { ok: false, error: 'illegal_transition' }

  if (to === 'open' && process.env.WAITLIST_ACCEPT_PUBLIC_SIGNUPS !== 'true') {
    return { ok: false, error: 'fase1_only_draft' }
  }

  const supabase = getSupabaseServiceClient()
  try {
    const { data, error } = await supabase
      .from('waitlists')
      .update({ status: to })
      .eq('id', id)
      .eq('site_id', ctx.siteId)
      .eq('status', from)
      .select('status')
      .maybeSingle()
    if (error) throw error
    if (!data) return { ok: false, error: 'status_changed' }
    return { ok: true, status: requireStatus(data) }
  } catch (e) {
    getLogger().error('[transitionWaitlistStatus]', { code: errCode(e) })
    Sentry.captureException(
      new Error(`transitionWaitlistStatus ${errCode(e)}: ${redactMessage(e instanceof Error ? e.message : String(e))}`),
      { tags: { component: 'waitlist', action: 'transitionWaitlistStatus' } },
    )
    return { ok: false, error: 'db_error', message: redactMessage(e instanceof Error ? e.message : String(e)) }
  }
}

export interface ExportSignupsOpts {
  status?: 'pending' | 'suppressed'
  /** Default true — exclude suppressed rows unless a status filter explicitly selects them. */
  excludeSuppressed?: boolean
  /** ISO date-range bounds on created_at (inclusive). */
  from?: string
  to?: string
}

export type ExportSignupsResult =
  | { ok: true; filename: string; csv: string }
  | { ok: false; error: 'forbidden'; message?: string }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'db_error'; message: string }

const CSV_COLUMNS = ['email', 'status', 'suppression_reason', 'source_surface', 'locale', 'created_at'] as const

/**
 * Export a waitlist's signups as CSV. IDOR-guarded: the waitlist is resolved with
 * `.eq('id').eq('site_id')` (404 if not owned) and the signups query is scoped by BOTH
 * `site_id` AND `waitlist_id`. Anonymized rows are omitted. Every cell runs through the
 * shared `escapeCsv` (formula-injection-safe). Honors the export-dialog options.
 */
export async function exportWaitlistSignups(
  waitlistId: string,
  opts: ExportSignupsOpts = {},
): Promise<ExportSignupsResult> {
  const ctx = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })
  if (!scope.ok) return { ok: false, error: 'forbidden', message: scope.reason }

  const supabase = getSupabaseServiceClient()
  try {
    const { data: wl, error: wlErr } = await supabase
      .from('waitlists')
      .select('slug')
      .eq('id', waitlistId)
      .eq('site_id', ctx.siteId)
      .maybeSingle()
    if (wlErr) throw wlErr
    if (!wl) return { ok: false, error: 'not_found' }
    const slug = requireSlug(wl)

    let q = supabase
      .from('waitlist_signups')
      .select(CSV_COLUMNS.join(', '))
      .eq('site_id', ctx.siteId)
      .eq('waitlist_id', waitlistId)
      .is('anonymized_at', null)
    if (opts.status) q = q.eq('status', opts.status)
    else if (opts.excludeSuppressed !== false) q = q.neq('status', 'suppressed')
    if (opts.from) q = q.gte('created_at', opts.from)
    if (opts.to) q = q.lte('created_at', opts.to)

    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) throw error

    // The dynamic .select(string) makes the typed client infer GenericStringError[]; the
    // shape is known (our column list), so narrow through unknown.
    const rows = (data ?? []) as unknown as Array<Record<(typeof CSV_COLUMNS)[number], unknown>>
    const lines = [CSV_COLUMNS.join(',')]
    for (const r of rows) {
      lines.push(CSV_COLUMNS.map((col) => escapeCsv(r[col])).join(','))
    }
    const csv = lines.join('\r\n')
    const date = new Date().toISOString().slice(0, 10)
    return { ok: true, filename: `waitlist-${slug}-${date}.csv`, csv }
  } catch (e) {
    getLogger().error('[exportWaitlistSignups]', { code: errCode(e) })
    Sentry.captureException(
      new Error(`exportWaitlistSignups ${errCode(e)}: ${redactMessage(e instanceof Error ? e.message : String(e))}`),
      { tags: { component: 'waitlist', action: 'exportWaitlistSignups' } },
    )
    return { ok: false, error: 'db_error', message: redactMessage(e instanceof Error ? e.message : String(e)) }
  }
}

export type LaunchWaitlistResult = { ok: false; error: 'not_implemented' }

/**
 * Launch broadcast — STUB until Fase 2. The real publish-guarded broadcast (SES send +
 * `(open|closed)→launching→launched` lifecycle) ships in Fase 2; for now this always
 * returns `not_implemented` so the broadcast dialog can wire its confirm without sending.
 */
export async function launchWaitlist(_waitlistId: string): Promise<LaunchWaitlistResult> {
  return { ok: false, error: 'not_implemented' }
}
