'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteAdminForRow } from '@/lib/cms/auth-guards'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getEmailService } from '@/lib/email/service'
import { render } from '@react-email/render'
import { Newsletter } from '@/emails/newsletter'
import { revalidateNewsletterTypeSeo } from '@/lib/seo/cache-invalidation'
import { generateCadenceSlots, describePattern, computeScheduledAt } from '@/lib/newsletter/cadence-slots'
import type { CadencePattern } from '@/lib/newsletter/cadence-pattern'

type ActionResult =
  | { ok: true; editionId?: string }
  | { ok: false; error: string }

async function getUserClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
}

// ─── Edition CRUD ───────────────────────────────────────────────────────────

export async function saveEdition(
  editionId: string,
  patch: {
    subject?: string
    preheader?: string
    content_json?: string
    content_html?: string
    content_mdx?: string
    segment?: string
    notes?: string
    newsletter_type_id?: string | null
  },
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('newsletter_editions')
    .select('status')
    .eq('id', editionId)
    .single()

  const editableStatuses = ['idea', 'draft', 'ready', 'scheduled']
  if (!current || !editableStatuses.includes(current.status)) {
    return { ok: false, error: 'edition_locked' }
  }

  const dbPatch: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }
  if (patch.content_json) {
    dbPatch.content_json = JSON.parse(patch.content_json)
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update(dbPatch)
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true }
}

export async function createEdition(
  data: {
    subject: string
    preheader?: string
    content_json?: string
    content_html?: string
    newsletter_type_id?: string | null
    segment?: string
  },
): Promise<ActionResult> {
  if (!data.subject?.trim()) return { ok: false, error: 'subject_required' }

  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  if (data.newsletter_type_id) {
    const { data: type } = await supabase
      .from('newsletter_types')
      .select('id, active')
      .eq('id', data.newsletter_type_id)
      .eq('site_id', ctx.siteId)
      .single()

    if (!type) return { ok: false, error: 'type_not_found' }
    if (!type.active) return { ok: false, error: 'type_inactive' }
  }

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()

  const insertPayload: Record<string, unknown> = {
    site_id: ctx.siteId,
    newsletter_type_id: data.newsletter_type_id ?? null,
    subject: data.subject.trim(),
    status: 'draft',
    created_by: user?.id,
  }
  if (data.preheader) insertPayload.preheader = data.preheader
  if (data.content_json) insertPayload.content_json = JSON.parse(data.content_json)
  if (data.content_html) insertPayload.content_html = data.content_html
  if (data.segment) insertPayload.segment = data.segment

  const { data: row, error } = await supabase
    .from('newsletter_editions')
    .insert(insertPayload)
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true, editionId: row.id }
}

export async function createIdea(
  title: string,
  notes?: string,
  typeId?: string,
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('newsletter_editions')
    .insert({
      site_id: ctx.siteId,
      newsletter_type_id: typeId ?? null,
      subject: title,
      notes: notes ?? null,
      status: 'idea',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true, editionId: data.id }
}

export async function convertIdeaToEdition(
  editionId: string,
  typeId: string,
  subject?: string,
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  // Verify current status is 'idea'
  const { data: current } = await supabase
    .from('newsletter_editions')
    .select('status')
    .eq('id', editionId)
    .single()
  if (!current || current.status !== 'idea') {
    return { ok: false, error: 'only_ideas_can_be_converted' }
  }

  // Verify type belongs to this site
  const { data: type } = await supabase
    .from('newsletter_types')
    .select('id')
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
    .single()
  if (!type) return { ok: false, error: 'invalid_type' }

  const updateData: Record<string, unknown> = {
    status: 'draft',
    newsletter_type_id: typeId,
    updated_at: new Date().toISOString(),
  }
  if (subject) updateData.subject = subject

  const { error } = await supabase
    .from('newsletter_editions')
    .update(updateData)
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true }
}

export async function duplicateEdition(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: source } = await supabase
    .from('newsletter_editions')
    .select('subject, preheader, content_json, content_html, content_mdx, newsletter_type_id, segment, site_id')
    .eq('id', editionId)
    .single()
  if (!source) return { ok: false, error: 'not_found' }

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()

  const { data, error } = await supabase
    .from('newsletter_editions')
    .insert({
      site_id: source.site_id,
      newsletter_type_id: source.newsletter_type_id,
      subject: `Copy of ${source.subject}`,
      preheader: source.preheader,
      content_json: source.content_json,
      content_html: source.content_html,
      content_mdx: source.content_mdx,
      segment: source.segment,
      status: 'draft',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true, editionId: data.id }
}

// ─── Lifecycle Actions ──────────────────────────────────────────────────────

export async function scheduleEdition(
  editionId: string,
  scheduledAt: string,
): Promise<ActionResult & { conflict?: { subject: string; scheduledAt: string } }> {
  await requireSiteAdminForRow('newsletter_editions', editionId)

  const parsed = new Date(scheduledAt)
  if (isNaN(parsed.getTime())) {
    return { ok: false, error: 'invalid_date_format' }
  }
  if (parsed.getTime() <= Date.now()) {
    return { ok: false, error: 'schedule_in_past' }
  }

  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('status, newsletter_type_id')
    .eq('id', editionId)
    .single()

  if (!edition) return { ok: false, error: 'not_found' }

  const schedulableStatuses = ['idea', 'draft', 'ready', 'scheduled']
  if (!schedulableStatuses.includes(edition.status)) {
    return { ok: false, error: 'edition_not_schedulable' }
  }

  let conflict: { subject: string; scheduledAt: string } | undefined
  if (edition.newsletter_type_id) {
    const twoHoursMs = 2 * 60 * 60 * 1000
    const rangeStart = new Date(parsed.getTime() - twoHoursMs).toISOString()
    const rangeEnd = new Date(parsed.getTime() + twoHoursMs).toISOString()

    const { data: conflicts } = await supabase
      .from('newsletter_editions')
      .select('id, subject, scheduled_at')
      .eq('newsletter_type_id', edition.newsletter_type_id)
      .eq('status', 'scheduled')
      .neq('id', editionId)
      .gte('scheduled_at', rangeStart)
      .lte('scheduled_at', rangeEnd)
      .limit(1)

    const firstConflict = conflicts?.[0]
    if (firstConflict) {
      conflict = { subject: firstConflict.subject ?? '', scheduledAt: firstConflict.scheduled_at ?? '' }
    }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'scheduled', scheduled_at: scheduledAt })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true, ...(conflict ? { conflict } : {}) }
}

export async function cancelEdition(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('status')
    .eq('id', editionId)
    .single()

  const cancellableStatuses = ['idea', 'draft', 'ready', 'scheduled', 'queued']
  if (!edition || !cancellableStatuses.includes(edition.status)) {
    return { ok: false, error: 'cannot_cancel' }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'cancelled', scheduled_at: null })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true }
}

export async function sendNow(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('status, newsletter_type_id, site_id')
    .eq('id', editionId)
    .single()
  if (!edition) return { ok: false, error: 'not_found' }

  const sendableStatuses = ['idea', 'draft', 'ready', 'scheduled']
  if (!sendableStatuses.includes(edition.status)) {
    return { ok: false, error: 'cannot_send' }
  }

  if (!edition.newsletter_type_id) {
    return { ok: false, error: 'no_type_assigned' }
  }

  const { count } = await supabase
    .from('newsletter_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', edition.newsletter_type_id)
    .eq('status', 'confirmed')

  if (!count || count === 0) {
    return { ok: false, error: 'no_subscribers' }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'scheduled', scheduled_at: new Date().toISOString() })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true }
}

export async function revertToDraft(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('status')
    .eq('id', editionId)
    .single()
  if (!edition) return { ok: false, error: 'not_found' }

  if (!['cancelled', 'failed'].includes(edition.status)) {
    return { ok: false, error: 'cannot_revert' }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'draft', scheduled_at: null, slot_date: null })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true }
}

// ─── Testing & Preview ──────────────────────────────────────────────────────

export async function sendTestEmail(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('subject, content_html, content_mdx, newsletter_type_id, status, test_sent_at')
    .eq('id', editionId)
    .single()
  if (!edition) return { ok: false, error: 'not_found' }

  const testableStatuses = ['idea', 'draft', 'ready']
  if (!testableStatuses.includes(edition.status)) {
    return { ok: false, error: 'edition_not_testable' }
  }

  if (edition.test_sent_at) {
    const lastSent = new Date(edition.test_sent_at).getTime()
    if (Date.now() - lastSent < 60_000) {
      return { ok: false, error: 'rate_limited' }
    }
  }

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('name, sender_name, sender_email, color')
    .eq('id', edition.newsletter_type_id)
    .single()

  const senderName = type?.sender_name ?? 'Thiago Figueiredo'
  const senderEmail = type?.sender_email ?? 'newsletter@bythiagofigueiredo.com'
  const typeColor = type?.color ?? '#ea580c'

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  const toEmail = user?.email
  if (!toEmail) return { ok: false, error: 'no_user_email' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  let contentHtml = edition.content_html
  if (contentHtml) {
    const { sanitizeForEmail } = await import('@/lib/newsletter/email-sanitizer')
    contentHtml = sanitizeForEmail(contentHtml, typeColor)
  } else {
    contentHtml = `<p>${edition.content_mdx ?? ''}</p>`
  }

  const html = await render(Newsletter({
    subject: edition.subject,
    preheader: undefined,
    contentHtml,
    typeName: type?.name ?? 'Newsletter',
    typeColor,
    unsubscribeUrl: `${appUrl}/newsletter/unsubscribe`,
    archiveUrl: `${appUrl}/newsletter/archive/${editionId}`,
  }))

  try {
    const emailService = getEmailService()
    await emailService.send({
      from: { name: senderName, email: senderEmail },
      to: toEmail,
      subject: `[TEST] ${edition.subject}`,
      html,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'email_send_failed'
    return { ok: false, error: message }
  }

  try {
    await supabase
      .from('newsletter_editions')
      .update({ test_sent_at: new Date().toISOString() })
      .eq('id', editionId)
  } catch {
    // Non-critical: test email was sent successfully, timestamp update failure is acceptable
  }

  return { ok: true }
}

export async function renderEmailPreview(
  editionId: string,
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('subject, preheader, content_html, newsletter_type_id, site_id')
    .eq('id', editionId)
    .single()
  if (!edition) return { ok: false, error: 'not_found' }
  if (!edition.content_html) return { ok: false, error: 'no_content' }

  let typeName = 'Newsletter'
  let typeColor = '#7c3aed'

  if (edition.newsletter_type_id) {
    const { data: type } = await supabase
      .from('newsletter_types')
      .select('name, color')
      .eq('id', edition.newsletter_type_id)
      .single()
    if (type) {
      typeName = type.name as string
      typeColor = (type.color ?? '#7c3aed') as string
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  const { sanitizeForEmail } = await import('@/lib/newsletter/email-sanitizer')
  const sanitizedHtml = sanitizeForEmail(edition.content_html, typeColor)

  const html = await render(Newsletter({
    subject: edition.subject,
    preheader: edition.preheader ?? undefined,
    contentHtml: sanitizedHtml,
    typeName,
    typeColor,
    unsubscribeUrl: `${appUrl}/newsletter/unsubscribe`,
    archiveUrl: `${appUrl}/newsletter/archive/${editionId}`,
  }))

  return { ok: true, html }
}

// ─── Queue & Slot Management ────────────────────────────────────────────────

export async function assignToSlot(
  editionId: string,
  slotDate: string,
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('newsletter_editions')
    .select('status')
    .eq('id', editionId)
    .single()

  const slottableStatuses = ['draft', 'ready']
  if (!current || !slottableStatuses.includes(current.status)) {
    return { ok: false, error: 'invalid_status_for_slot' }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'queued',
      slot_date: slotDate,
      queue_position: null,
    })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  revalidatePath('/cms/schedule')
  return { ok: true }
}

export async function unslotEdition(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('newsletter_editions')
    .select('status')
    .eq('id', editionId)
    .single()

  if (!current || current.status !== 'queued') {
    return { ok: false, error: 'not_queued' }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'ready',
      slot_date: null,
      scheduled_at: null,
    })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  revalidatePath('/cms/schedule')
  return { ok: true }
}

// ─── Cadence Slot Scheduling ───────────────────────────────────────────────

/**
 * CAS scheduling for cadence editions — claims a slot_date on the unique index.
 * Returns `{ ok: false, error: 'slot_taken' }` if the slot is already occupied.
 */
export async function scheduleEditionToSlot(
  editionId: string,
  slotDate: string,
  typeId: string,
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  // Validate slotDate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate)) {
    return { ok: false, error: 'invalid_date_format' }
  }

  // Fetch preferred_send_time and site timezone
  const { data: typeRow } = await supabase
    .from('newsletter_types')
    .select('preferred_send_time, site_id')
    .eq('id', typeId)
    .single()
  if (!typeRow) return { ok: false, error: 'type_not_found' }

  const { data: siteRow } = await supabase
    .from('sites')
    .select('timezone')
    .eq('id', typeRow.site_id)
    .single()

  const siteTimezone = (siteRow?.timezone as string) ?? 'America/Sao_Paulo'
  const sendTime = (typeRow.preferred_send_time as string) ?? '09:00'
  // preferred_send_time is stored as time (HH:MM:SS); extract HH:MM
  const sendTimeHHMM = sendTime.slice(0, 5)

  const scheduledAt = computeScheduledAt(slotDate, sendTimeHHMM, siteTimezone)

  // CAS update: only if status = 'ready' AND edition belongs to this type
  const { error } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'scheduled',
      slot_date: slotDate,
      scheduled_at: scheduledAt,
      edition_kind: 'cadence',
      newsletter_type_id: typeId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', editionId)
    .eq('status', 'ready')

  if (error) {
    // Unique index violation: slot already taken
    if (error.code === '23505') {
      return { ok: false, error: 'slot_taken' }
    }
    return { ok: false, error: error.message }
  }

  revalidateNewsletterHub()
  revalidatePath('/cms/schedule')
  return { ok: true }
}

/**
 * Swap: new edition takes an occupied slot, old edition returns to Ready.
 * Atomic: clears old edition's slot, then CAS-schedules new edition.
 */
export async function swapSlotEdition(
  newEditionId: string,
  slotDate: string,
  typeId: string,
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', newEditionId)
  const supabase = getSupabaseServiceClient()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate)) {
    return { ok: false, error: 'invalid_date_format' }
  }

  // Find the current occupant of this slot
  const { data: occupant } = await supabase
    .from('newsletter_editions')
    .select('id, status')
    .eq('newsletter_type_id', typeId)
    .eq('edition_kind', 'cadence')
    .eq('slot_date', slotDate)
    .not('status', 'in', '("cancelled","archived")')
    .single()

  if (!occupant) {
    return { ok: false, error: 'slot_not_occupied' }
  }

  if (['sending', 'sent'].includes(occupant.status)) {
    return { ok: false, error: 'occupant_locked' }
  }

  // Move the old edition back to ready
  const { error: clearErr } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'ready',
      slot_date: null,
      scheduled_at: null,
      edition_kind: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', occupant.id)

  if (clearErr) return { ok: false, error: clearErr.message }

  // Now schedule the new edition to the freed slot (includes revalidation)
  const result = await scheduleEditionToSlot(newEditionId, slotDate, typeId)
  if (!result.ok && result.error === 'slot_taken') {
    // Race condition — restore the old edition (best-effort)
    await supabase
      .from('newsletter_editions')
      .update({ status: 'scheduled', slot_date: slotDate, edition_kind: 'cadence', updated_at: new Date().toISOString() })
      .eq('id', occupant.id)
    revalidateNewsletterHub()
    return { ok: false, error: 'slot_taken' }
  }

  return result
}

/**
 * Schedule as a special edition — free date, no cadence slot claim.
 */
export async function scheduleEditionAsSpecial(
  editionId: string,
  scheduledAt: string,
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)

  const parsed = new Date(scheduledAt)
  if (isNaN(parsed.getTime())) {
    return { ok: false, error: 'invalid_date_format' }
  }
  if (parsed.getTime() <= Date.now()) {
    return { ok: false, error: 'schedule_in_past' }
  }

  const supabase = getSupabaseServiceClient()

  const { data: rows, error } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt,
      edition_kind: 'special',
      slot_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', editionId)
    .eq('status', 'ready')
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!rows || rows.length === 0) return { ok: false, error: 'edition_not_ready' }

  revalidateNewsletterHub()
  revalidatePath('/cms/schedule')
  return { ok: true }
}

export type SlotInfo = {
  date: string
  dayOfWeek: string
  formattedDate: string
  time: string
  timezone: string
  occupied: boolean
  occupiedEdition?: { id: string; displayId: string; subject: string }
}

type AvailableSlotsResult =
  | { ok: true; slots: SlotInfo[]; patternDescription: string }
  | { ok: false; error: string }

/**
 * Compute the next cadence slots for a given newsletter type.
 * Returns both empty and occupied slots (with edition info for occupied ones).
 */
export async function getAvailableSlots(
  typeId: string,
  maxSlots?: number,
): Promise<AvailableSlotsResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  const { data: typeRow } = await supabase
    .from('newsletter_types')
    .select('cadence_pattern, preferred_send_time, site_id')
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
    .single()
  if (!typeRow) return { ok: false, error: 'type_not_found' }

  const cadencePattern = typeRow.cadence_pattern as CadencePattern | null
  if (!cadencePattern) return { ok: false, error: 'no_cadence_pattern' }

  const { data: siteRow } = await supabase
    .from('sites')
    .select('timezone')
    .eq('id', typeRow.site_id)
    .single()

  const siteTimezone = (siteRow?.timezone as string) ?? 'America/Sao_Paulo'
  const sendTime = (typeRow.preferred_send_time as string) ?? '09:00'
  const sendTimeHHMM = sendTime.slice(0, 5)

  const today = new Date().toISOString().slice(0, 10)

  // Fetch occupied editions for this type's slots
  const { data: occupiedRows } = await supabase
    .from('newsletter_editions')
    .select('id, slot_date, subject, display_id')
    .eq('newsletter_type_id', typeId)
    .eq('edition_kind', 'cadence')
    .not('status', 'in', '("cancelled","archived")')
    .gte('slot_date', today)

  const occupiedMap = new Map<string, { id: string; displayId: string; subject: string }>()
  for (const r of occupiedRows ?? []) {
    occupiedMap.set(r.slot_date as string, {
      id: r.id as string,
      displayId: (r.display_id as string) ?? '',
      subject: (r.subject as string) ?? '',
    })
  }

  // Generate candidate slot dates (both empty and occupied)
  const slotsNeeded = maxSlots ?? 6
  const candidates = generateCadenceSlots(cadencePattern, {
    from: today,
    maxSlots: slotsNeeded,
  })

  const locale = (ctx.defaultLocale ?? 'pt-BR') as 'en' | 'pt-BR'

  const slots: SlotInfo[] = candidates.map((date) => {
    const occupied = occupiedMap.get(date)
    return {
      date,
      dayOfWeek: formatDayOfWeek(date, locale),
      formattedDate: formatSlotDate(date, locale),
      time: sendTimeHHMM,
      timezone: siteTimezone,
      occupied: !!occupied,
      occupiedEdition: occupied ?? undefined,
    }
  })

  return { ok: true, slots, patternDescription: describePattern(cadencePattern, locale) }
}

function formatDayOfWeek(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  return date.toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' })
}

function formatSlotDate(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ─── Type & Cadence Management ──────────────────────────────────────────────

export async function updateCadence(
  typeId: string,
  patch: { cadence_days?: number; preferred_send_time?: string; cadence_paused?: boolean; cadence_start_date?: string },
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .update(patch)
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  revalidatePath('/cms/newsletters/settings')
  revalidatePath('/cms/schedule')
  return { ok: true }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function ensureUniqueSlug(supabase: ReturnType<typeof getSupabaseServiceClient>, slug: string): Promise<string> {
  const { data } = await supabase
    .from('newsletter_types')
    .select('slug')
    .like('slug', `${slug}%`)
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug))
  if (!taken.has(slug)) return slug
  for (let i = 2; i < 100; i++) {
    const candidate = `${slug}-${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${slug}-${Date.now()}`
}

function revalidateNewsletterHub() {
  revalidatePath('/cms/newsletters')
  revalidateTag('newsletter-hub')
}

export async function createNewsletterType(data: {
  name: string
  locale: string
  color?: string
  tagline?: string
  slug?: string
  description?: string
  badge?: string
  colorDark?: string
  ogImageUrl?: string
  landingPromise?: string[]
  sortOrder?: number
}): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  const { data: existing } = await supabase
    .from('newsletter_types')
    .select('id')
    .eq('site_id', ctx.siteId)
    .eq('locale', data.locale)
    .eq('name', data.name)
    .maybeSingle()

  if (existing) return { ok: false, error: 'name_already_exists' }

  const baseSlug = data.slug?.trim() || generateSlug(data.name)
  const slug = await ensureUniqueSlug(supabase, baseSlug)

  const landingContent = data.landingPromise?.length
    ? { promise: data.landingPromise.filter((s) => s.trim()) }
    : {}

  const { data: created, error } = await supabase
    .from('newsletter_types')
    .insert({
      site_id: ctx.siteId,
      name: data.name,
      locale: data.locale,
      slug,
      color: data.color ?? '#7c3aed',
      color_dark: data.colorDark ?? null,
      tagline: data.tagline ?? null,
      description: data.description ?? null,
      badge: data.badge ?? null,
      og_image_url: data.ogImageUrl ?? null,
      landing_content: landingContent,
      sort_order: data.sortOrder ?? 99,
      active: true,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  revalidateNewsletterTypeSeo(ctx.siteId, slug)
  return { ok: true, editionId: created.id }
}

export async function updateNewsletterType(
  typeId: string,
  patch: {
    name?: string
    tagline?: string
    locale?: string
    color?: string
    colorDark?: string | null
    slug?: string
    description?: string | null
    badge?: string | null
    ogImageUrl?: string | null
    landingPromise?: string[]
    sortOrder?: number
    active?: boolean
    cadence_paused?: boolean
  },
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('newsletter_types')
    .select('slug')
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
    .single()
  if (!current) return { ok: false, error: 'not_found' }

  const updateData: Record<string, unknown> = {}
  if (patch.name !== undefined) updateData.name = patch.name
  if (patch.tagline !== undefined) updateData.tagline = patch.tagline
  if (patch.locale !== undefined) updateData.locale = patch.locale
  if (patch.color !== undefined) updateData.color = patch.color
  if (patch.colorDark !== undefined) updateData.color_dark = patch.colorDark
  if (patch.slug !== undefined) updateData.slug = patch.slug
  if (patch.description !== undefined) updateData.description = patch.description
  if (patch.badge !== undefined) updateData.badge = patch.badge
  if (patch.ogImageUrl !== undefined) updateData.og_image_url = patch.ogImageUrl
  if (patch.sortOrder !== undefined) updateData.sort_order = patch.sortOrder
  if (patch.active !== undefined) updateData.active = patch.active
  if (patch.cadence_paused !== undefined) updateData.cadence_paused = patch.cadence_paused
  if (patch.landingPromise !== undefined) {
    updateData.landing_content = patch.landingPromise.length
      ? { promise: patch.landingPromise.filter((s) => s.trim()) }
      : {}
  }

  const { error } = await supabase
    .from('newsletter_types')
    .update(updateData)
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }

  const oldSlug = current.slug as string
  const newSlug = (patch.slug ?? oldSlug) as string
  if (oldSlug !== newSlug) revalidateNewsletterTypeSeo(ctx.siteId, oldSlug)
  revalidateNewsletterHub()
  revalidateNewsletterTypeSeo(ctx.siteId, newSlug)
  return { ok: true }
}

export async function deleteNewsletterType(
  typeId: string,
  opts?: { confirmed?: boolean; confirmText?: string },
): Promise<{ ok: true } | { ok: false; error: string; subscriberCount?: number; editionCount?: number }> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('id, name, slug')
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
    .single()
  if (!type) return { ok: false, error: 'not_found' }

  const { count: subscriberCount } = await supabase
    .from('newsletter_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', typeId)
    .eq('status', 'confirmed')

  const { count: editionCount } = await supabase
    .from('newsletter_editions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_type_id', typeId)

  const subs = subscriberCount ?? 0
  const editions = editionCount ?? 0

  if (!opts?.confirmed) {
    return { ok: false, error: 'requires_confirmation', subscriberCount: subs, editionCount: editions }
  }

  if (subs > 0 && opts.confirmText !== type.name) {
    return { ok: false, error: 'confirm_text_mismatch', subscriberCount: subs, editionCount: editions }
  }

  if (editions > 0) {
    await supabase
      .from('newsletter_editions')
      .update({ newsletter_type_id: null, status: 'idea' })
      .eq('newsletter_type_id', typeId)
      .in('status', ['draft', 'ready', 'idea'])
  }

  await supabase
    .from('newsletter_subscriptions')
    .update({ newsletter_id: null })
    .eq('newsletter_id', typeId)

  const typeSlug = type.slug as string
  const { error } = await supabase
    .from('newsletter_types')
    .delete()
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  revalidateNewsletterTypeSeo(ctx.siteId, typeSlug)
  return { ok: true }
}

export async function getNewsletterTypeForEdit(typeId: string): Promise<
  | { ok: true; type: {
      id: string; name: string; tagline: string | null; locale: string; slug: string
      badge: string | null; description: string | null; color: string; colorDark: string | null
      ogImageUrl: string | null; landingPromise: string[]; cadenceDays: number
      cadenceStartDate: string | null; cadencePaused: boolean; subscriberCount: number; editionCount: number
    }}
  | { ok: false; error: string }
> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('id, name, tagline, locale, slug, badge, description, color, color_dark, og_image_url, landing_content, cadence_days, cadence_start_date, cadence_paused')
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
    .single()
  if (!type) return { ok: false, error: 'not_found' }

  const { count: subscriberCount } = await supabase
    .from('newsletter_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', typeId)
    .eq('status', 'confirmed')

  const { count: editionCount } = await supabase
    .from('newsletter_editions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_type_id', typeId)

  const lc = type.landing_content as { promise?: string[] } | null
  return {
    ok: true,
    type: {
      id: type.id as string,
      name: type.name as string,
      tagline: type.tagline as string | null,
      locale: type.locale as string,
      slug: type.slug as string,
      badge: type.badge as string | null,
      description: type.description as string | null,
      color: type.color as string,
      colorDark: type.color_dark as string | null,
      ogImageUrl: type.og_image_url as string | null,
      landingPromise: lc?.promise ?? [],
      cadenceDays: type.cadence_days as number,
      cadenceStartDate: type.cadence_start_date as string | null,
      cadencePaused: !!type.cadence_paused,
      subscriberCount: subscriberCount ?? 0,
      editionCount: editionCount ?? 0,
    },
  }
}

// ─── Image Upload ───────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 2 * 1024 * 1024

export async function uploadNewsletterImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = formData.get('file') as File | null
  const editionId = formData.get('editionId') as string | null
  if (!file || !editionId) return { ok: false, error: 'missing_fields' }

  await requireSiteAdminForRow('newsletter_editions', editionId)

  if (file.size > MAX_IMAGE_SIZE) return { ok: false, error: 'file_too_large' }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'unsupported_format' }

  const supabase = getSupabaseServiceClient()
  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('site_id')
    .eq('id', editionId)
    .single()
  if (!edition) return { ok: false, error: 'not_found' }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const uuid = crypto.randomUUID()
  const path = `${edition.site_id}/${editionId}/${uuid}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage
    .from('newsletter-assets')
    .upload(path, buffer, { contentType: file.type })
  if (error) return { ok: false, error: error.message }

  const { data: { publicUrl } } = supabase.storage
    .from('newsletter-assets')
    .getPublicUrl(path)

  return { ok: true, url: publicUrl }
}

export async function uploadNewsletterTypeImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'missing_file' }

  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  if (file.size > MAX_IMAGE_SIZE) return { ok: false, error: 'file_too_large' }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'unsupported_format' }

  const supabase = getSupabaseServiceClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const uuid = crypto.randomUUID()
  const path = `${ctx.siteId}/types/${uuid}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage
    .from('newsletter-assets')
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (error) return { ok: false, error: error.message }

  const { data: { publicUrl } } = supabase.storage
    .from('newsletter-assets')
    .getPublicUrl(path)

  return { ok: true, url: publicUrl }
}

// ─── Delete ─────────────────────────────────────────────────────────────────

type DeleteResult =
  | { ok: true }
  | { ok: false; error: string; impactLevel?: 'low' | 'medium' | 'high' }

export async function deleteEdition(
  editionId: string,
  opts?: { confirmed?: boolean; confirmText?: string },
): Promise<DeleteResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('status, subject, content_html, content_json, scheduled_at, site_id')
    .eq('id', editionId)
    .single()

  if (!edition) return { ok: false, error: 'not_found' }

  const hasContent = !!(edition.content_html || edition.content_json)
  const isSent = edition.status === 'sent'
  const isScheduled = edition.status === 'scheduled'

  let impactLevel: 'low' | 'medium' | 'high' = 'low'
  if (isSent) impactLevel = 'high'
  else if (hasContent || isScheduled) impactLevel = 'medium'

  if (impactLevel === 'high' && opts?.confirmText !== 'DELETE') {
    return { ok: false, error: 'requires_confirmation', impactLevel: 'high' }
  }
  if (impactLevel === 'medium' && !opts?.confirmed) {
    return { ok: false, error: 'requires_confirmation', impactLevel: 'medium' }
  }

  if (edition.status === 'scheduled') {
    await supabase
      .from('newsletter_editions')
      .update({ status: 'cancelled', scheduled_at: null })
      .eq('id', editionId)
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .delete()
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }

  const { data: files } = await supabase.storage
    .from('newsletter-assets')
    .list(`${edition.site_id}/${editionId}`)
  if (files && files.length > 0) {
    const paths = files.map((f) => `${edition.site_id}/${editionId}/${f.name}`)
    await supabase.storage.from('newsletter-assets').remove(paths)
  }

  revalidateNewsletterHub()
  return { ok: true }
}

// ─── Retry ──────────────────────────────────────────────────────────────────

export async function retryEdition(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('id, status, retry_count, max_retries')
    .eq('id', editionId)
    .single()

  if (!edition) return { ok: false, error: 'not_found' }
  if (edition.status !== 'failed') return { ok: false, error: 'edition_not_failed' }

  const retryCount = edition.retry_count ?? 0
  const maxRetries = edition.max_retries ?? 3
  if (retryCount >= maxRetries) return { ok: false, error: 'max_retries_exceeded' }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'scheduled',
      retry_count: retryCount + 1,
      error_message: null,
      scheduled_at: new Date().toISOString(),
    })
    .eq('id', editionId)

  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true }
}

// ─── Newsletter Hub Actions ────────────────────────────────────────────────

export async function reassignEditionType(
  editionId: string,
  typeId: string | null,
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  if (typeId) {
    const { data: type } = await supabase
      .from('newsletter_types')
      .select('id')
      .eq('id', typeId)
      .eq('site_id', ctx.siteId)
      .single()
    if (!type) return { ok: false, error: 'type_not_found' }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ newsletter_type_id: typeId, updated_at: new Date().toISOString() })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true }
}

export async function moveEdition(
  editionId: string,
  newStatus: string,
  scheduledFor?: string,
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const validStatuses = ['idea', 'draft', 'ready', 'review', 'scheduled', 'cancelled']
  if (!validStatuses.includes(newStatus)) {
    return { ok: false, error: 'invalid_target_status' }
  }

  const { data: current } = await supabase
    .from('newsletter_editions')
    .select('status, newsletter_type_id')
    .eq('id', editionId)
    .single()
  if (!current) return { ok: false, error: 'not_found' }

  const immutableStatuses = ['sending', 'sent']
  if (immutableStatuses.includes(current.status)) {
    return { ok: false, error: 'edition_locked' }
  }

  if ((newStatus === 'ready' || newStatus === 'scheduled') && !current.newsletter_type_id) {
    return { ok: false, error: 'type_required' }
  }

  const patch: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
  if (newStatus === 'review' && current.status !== 'review') {
    patch.review_entered_at = new Date().toISOString()
  }

  if (newStatus === 'scheduled') {
    if (!scheduledFor) {
      return { ok: false, error: 'scheduled_for_required' }
    }
    const parsed = new Date(scheduledFor)
    if (isNaN(parsed.getTime())) {
      return { ok: false, error: 'invalid_date' }
    }
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    if (parsed.getTime() < fiveMinAgo) {
      return { ok: false, error: 'date_in_past' }
    }
    patch.scheduled_at = scheduledFor
  }

  if (current.status === 'scheduled' && newStatus !== 'scheduled') {
    patch.scheduled_at = null
    patch.slot_date = null
  }

  const { data: rows, error } = await supabase
    .from('newsletter_editions')
    .update(patch)
    .eq('id', editionId)
    .eq('status', current.status)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!rows || rows.length === 0) return { ok: false, error: 'conflict' }
  revalidateNewsletterHub()
  return { ok: true }
}

export async function toggleCadence(
  typeId: string,
  paused: boolean,
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .update({ cadence_paused: paused })
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true }
}

export async function updateSendTime(
  typeId: string,
  time: string,
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .update({ preferred_send_time: time })
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true }
}

export async function toggleWorkflow(
  _workflowId: string,
  _enabled: boolean,
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  revalidateTag('newsletter-automations')
  return { ok: true }
}

export async function updateCadencePattern(
  typeId: string,
  pattern: CadencePattern,
  sendTime: string,
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  // Validate pattern generates at least 1 slot in the next 365 days
  const today = new Date().toISOString().slice(0, 10)
  const slots = generateCadenceSlots(pattern, { from: today, maxSlots: 1 })
  if (slots.length === 0) return { ok: false, error: 'no_slots_generated' }

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .update({ cadence_pattern: pattern as unknown as Record<string, unknown>, preferred_send_time: sendTime })
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)

  if (error) return { ok: false, error: error.message }
  revalidateTag('newsletter-hub')
  revalidateTag('newsletter-schedule')
  return { ok: true }
}
