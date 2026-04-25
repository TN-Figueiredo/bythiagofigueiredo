'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

type ActionResult = { ok: true } | { ok: false; error: string }

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
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

export async function updateBranding(input: {
  logo_url: string
  primary_color: string
}): Promise<ActionResult> {
  const parsed = brandingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const { siteId } = await getSiteContext()
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
  const { siteId } = await getSiteContext()
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
  const { siteId } = await getSiteContext()
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
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .update(data)
    .eq('id', id)
    .eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function createNewsletterType(
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .insert({ ...data, site_id: siteId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function deleteNewsletterType(id: string): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
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
  const { siteId } = await getSiteContext()
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
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_cadence')
    .upsert({ ...data, locale, site_id: siteId }, { onConflict: 'site_id,locale' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateSiteLocales(data: {
  default_locale: string
  supported_locales: string[]
}): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('sites')
    .update(data)
    .eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function disableCms(): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
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
  const { siteId } = await getSiteContext()
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
