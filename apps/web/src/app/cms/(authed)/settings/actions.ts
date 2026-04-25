'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

type ActionResult = { ok: true } | { ok: false; error: string }

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
