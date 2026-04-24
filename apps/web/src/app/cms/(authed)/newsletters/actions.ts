'use server'

import { revalidatePath } from 'next/cache'
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

export async function saveEdition(
  editionId: string,
  patch: { subject?: string; preheader?: string; content_mdx?: string; segment?: string },
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_editions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}

export async function createEdition(
  newsletterTypeId: string,
  subject: string,
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
      newsletter_type_id: newsletterTypeId,
      subject,
      status: 'draft',
      created_by: user?.id,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true, editionId: data.id }
}

export async function scheduleEdition(
  editionId: string,
  scheduledAt: string,
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()
  const { error, count } = await supabase
    .from('newsletter_editions')
    .update({ status: 'scheduled', scheduled_at: scheduledAt })
    .eq('id', editionId)
    .in('status', ['draft', 'ready'])
  if (error) return { ok: false, error: error.message }
  if (count === 0) return { ok: false, error: 'edition_not_schedulable' }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}

export async function cancelEdition(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'cancelled' })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}

export async function sendTestEmail(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()
  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('subject, content_html, content_mdx, newsletter_type_id')
    .eq('id', editionId)
    .single()
  if (!edition) return { ok: false, error: 'not_found' }

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('sender_name, sender_email')
    .eq('id', edition.newsletter_type_id)
    .single()

  const senderName = type?.sender_name ?? 'Thiago Figueiredo'
  const senderEmail = type?.sender_email ?? 'newsletter@bythiagofigueiredo.com'

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  const toEmail = user?.email
  if (!toEmail) return { ok: false, error: 'no_user_email' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const html = await render(Newsletter({
    subject: edition.subject,
    preheader: undefined,
    contentHtml: edition.content_html ?? `<p>${edition.content_mdx ?? ''}</p>`,
    typeName: type?.sender_name ?? 'Newsletter',
    typeColor: '#ea580c',
    unsubscribeUrl: `${appUrl}/newsletter/unsubscribe`,
    archiveUrl: `${appUrl}/newsletter/archive`,
  }))

  const emailService = getEmailService()
  await emailService.send({
    from: { name: senderName, email: senderEmail },
    to: toEmail,
    subject: `[TEST] ${edition.subject}`,
    html,
  })

  await supabase
    .from('newsletter_editions')
    .update({ test_sent_at: new Date().toISOString() })
    .eq('id', editionId)

  return { ok: true }
}

export async function assignToSlot(
  editionId: string,
  slotDate: string,
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'queued',
      slot_date: slotDate,
      queue_position: null,
    })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  revalidatePath('/cms/schedule')
  return { ok: true }
}

export async function unslotEdition(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'ready',
      slot_date: null,
      scheduled_at: null,
    })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  revalidatePath('/cms/schedule')
  return { ok: true }
}

export async function updateCadence(
  typeId: string,
  patch: { cadence_days?: number; preferred_send_time?: string; cadence_paused?: boolean },
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .update(patch)
    .eq('id', typeId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters/settings')
  revalidatePath('/cms/schedule')
  return { ok: true }
}
