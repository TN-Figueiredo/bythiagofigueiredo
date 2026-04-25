'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string }

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

/* ------------------------------------------------------------------ */
/*  Schemas                                                           */
/* ------------------------------------------------------------------ */

const exportFiltersSchema = z.object({
  status: z
    .enum(['confirmed', 'pending', 'unsubscribed', ''])
    .optional()
    .default(''),
  search: z.string().max(200).optional().default(''),
  typeId: z.string().uuid().optional(),
})

const exportSchema = z.object({
  format: z.enum(['csv', 'json']),
  filters: exportFiltersSchema.optional().default({}),
})

const batchUnsubscribeSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
})

const toggleTrackingConsentSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
})

/* ------------------------------------------------------------------ */
/*  Actions                                                           */
/* ------------------------------------------------------------------ */

export async function exportSubscribers(
  format: 'csv' | 'json',
  filters?: { status?: string; search?: string; typeId?: string },
): Promise<ActionResult<string>> {
  const parsed = exportSchema.safeParse({ format, filters })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  let query = supabase
    .from('newsletter_subscriptions')
    .select('id, email, status, newsletter_type_id, tracking_consent, created_at, unsubscribed_at, locale')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  const f = parsed.data.filters
  if (f.status) query = query.eq('status', f.status)
  if (f.search) query = query.ilike('email', `%${f.search}%`)
  if (f.typeId) query = query.eq('newsletter_type_id', f.typeId)

  const { data: rows, error } = await query
  if (error) return { ok: false, error: error.message }

  // Exclude anonymized rows (LGPD)
  const filtered = (rows ?? []).filter(
    (r) => !/^[a-f0-9]{8,}\.\.\.@anon$/.test(r.email as string),
  )

  if (parsed.data.format === 'csv') {
    const header = 'id,email,status,newsletter_type_id,tracking_consent,created_at,unsubscribed_at,locale'
    const csvRows = filtered.map((r) =>
      [
        r.id,
        `"${String(r.email).replace(/"/g, '""')}"`,
        r.status,
        r.newsletter_type_id ?? '',
        r.tracking_consent ?? false,
        r.created_at,
        r.unsubscribed_at ?? '',
        r.locale ?? '',
      ].join(','),
    )
    return { ok: true, data: [header, ...csvRows].join('\n') }
  }

  return { ok: true, data: JSON.stringify(filtered, null, 2) }
}

export async function batchUnsubscribe(
  ids: string[],
): Promise<ActionResult> {
  const parsed = batchUnsubscribeSchema.safeParse({ ids })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('newsletter_subscriptions')
    .update({ status: 'unsubscribed', unsubscribed_at: now })
    .in('id', parsed.data.ids)
    .eq('site_id', siteId)
    .neq('status', 'unsubscribed')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/cms/subscribers')
  return { ok: true }
}

export async function toggleTrackingConsent(
  id: string,
  enabled: boolean,
): Promise<ActionResult> {
  const parsed = toggleTrackingConsentSchema.safeParse({ id, enabled })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('newsletter_subscriptions')
    .update({ tracking_consent: parsed.data.enabled })
    .eq('id', parsed.data.id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/cms/subscribers')
  return { ok: true }
}
