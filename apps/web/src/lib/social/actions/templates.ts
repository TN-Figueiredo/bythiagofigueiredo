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
import {
  createTemplateSchema,
  updateTemplateSchema,
  aspectRatioSchema,
  type SocialTemplate,
  type TemplateAspectRatio,
} from '../template-schemas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSocialTemplate(row: Record<string, unknown>): SocialTemplate {
  return {
    id: String(row.id ?? ''),
    site_id: (row.site_id as string) ?? null,
    name: String(row.name ?? ''),
    aspect_ratio: (row.aspect_ratio as TemplateAspectRatio) ?? '1:1',
    composition: row.composition as SocialTemplate['composition'],
    thumbnail_url: (row.thumbnail_url as string) ?? null,
    is_default: Boolean(row.is_default),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

async function uploadThumbnail(base64: string, templateId: string): Promise<string> {
  const { put } = await import('@vercel/blob')
  const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) throw new Error('Invalid base64 image')
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]!
  const buffer = Buffer.from(matches[2]!, 'base64')
  const blob = await put(`social-templates/${templateId}.${ext}`, buffer, {
    access: 'public',
    contentType: `image/${matches[1]}`,
  })
  return blob.url
}

// ---------------------------------------------------------------------------
// listTemplates
// ---------------------------------------------------------------------------

export async function listTemplates(
  siteId: string,
  aspectRatio?: TemplateAspectRatio,
): Promise<ActionResult<SocialTemplate[]>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'Invalid site ID' }
  if (aspectRatio) {
    const ratioParsed = aspectRatioSchema.safeParse(aspectRatio)
    if (!ratioParsed.success) return { ok: false, error: 'Invalid aspect ratio' }
  }

  try {
    await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Return site-specific templates + global defaults (site_id IS NULL)
    let query = supabase
      .from('social_templates')
      .select('*')
      .or(`site_id.eq.${idParsed.data},site_id.is.null`)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (aspectRatio) {
      query = query.eq('aspect_ratio', aspectRatio)
    }

    const { data, error } = await query

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'listTemplates' } })
      return { ok: false, error: error.message }
    }

    return { ok: true, data: (data ?? []).map(r => toSocialTemplate(r as Record<string, unknown>)) }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'listTemplates' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// getTemplate
// ---------------------------------------------------------------------------

export async function getTemplate(
  id: string,
): Promise<ActionResult<SocialTemplate>> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid template ID' }

  try {
    await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('social_templates')
      .select('*')
      .eq('id', parsed.data)
      .single()

    if (error || !data) return { ok: false, error: 'Template not found' }

    return { ok: true, data: toSocialTemplate(data as Record<string, unknown>) }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getTemplate' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// createTemplate
// ---------------------------------------------------------------------------

export async function createTemplate(data: {
  name: string
  aspectRatio: TemplateAspectRatio
  composition: SocialTemplate['composition']
  thumbnailBase64?: string
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createTemplateSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const templateId = crypto.randomUUID()
    let thumbnailUrl: string | null = null

    if (parsed.data.thumbnailBase64) {
      thumbnailUrl = await uploadThumbnail(String(parsed.data.thumbnailBase64), templateId)
    }

    const row = {
      id: templateId,
      site_id: siteId,
      name: parsed.data.name,
      aspect_ratio: parsed.data.aspectRatio,
      composition: parsed.data.composition,
      thumbnail_url: thumbnailUrl,
      is_default: false,
    }

    const { error } = await supabase.from('social_templates').insert(row)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'createTemplate' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: templateId } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'createTemplate' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// updateTemplate
// ---------------------------------------------------------------------------

export async function updateTemplate(
  id: string,
  data: {
    name?: string
    composition?: SocialTemplate['composition']
    thumbnailBase64?: string
  },
): Promise<ActionResult> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { ok: false, error: 'Invalid template ID' }
  const parsed = updateTemplateSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Verify template exists and belongs to this site (not a system template)
    const { data: existing, error: fetchError } = await supabase
      .from('social_templates')
      .select('id, site_id')
      .eq('id', idParsed.data)
      .single()

    if (fetchError || !existing) return { ok: false, error: 'Template not found' }

    // Cannot edit system defaults (site_id IS NULL)
    if (existing.site_id === null) {
      return { ok: false, error: 'Cannot edit system default templates' }
    }

    if (existing.site_id !== siteId) {
      return { ok: false, error: 'forbidden' }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.name !== undefined) patch.name = parsed.data.name
    if (parsed.data.composition !== undefined) patch.composition = parsed.data.composition

    if (parsed.data.thumbnailBase64) {
      patch.thumbnail_url = await uploadThumbnail(String(parsed.data.thumbnailBase64), idParsed.data)
    }

    const { error } = await supabase
      .from('social_templates')
      .update(patch)
      .eq('id', idParsed.data)
      .eq('site_id', siteId)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'updateTemplate' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'updateTemplate' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// deleteTemplate
// ---------------------------------------------------------------------------

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid template ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Check if template exists and is deletable
    const { data: existing, error: fetchError } = await supabase
      .from('social_templates')
      .select('id, site_id')
      .eq('id', parsed.data)
      .single()

    if (fetchError || !existing) return { ok: false, error: 'Template not found' }

    // System defaults cannot be deleted
    if (existing.site_id === null) {
      return { ok: false, error: 'Cannot delete system default templates' }
    }

    if (existing.site_id !== siteId) {
      return { ok: false, error: 'forbidden' }
    }

    const { error } = await supabase
      .from('social_templates')
      .delete()
      .eq('id', parsed.data)
      .eq('site_id', siteId)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'deleteTemplate' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'deleteTemplate' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// setDefaultTemplate
// ---------------------------------------------------------------------------

export async function setDefaultTemplate(
  id: string,
  siteId: string,
): Promise<ActionResult> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { ok: false, error: 'Invalid template ID' }
  const siteParsed = z.string().uuid().safeParse(siteId)
  if (!siteParsed.success) return { ok: false, error: 'Invalid site ID' }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (siteParsed.data !== authorizedSiteId) {
      return { ok: false, error: 'forbidden' }
    }

    const supabase = getSupabaseServiceClient()

    // Get template to know its aspect ratio
    const { data: template, error: fetchError } = await supabase
      .from('social_templates')
      .select('id, aspect_ratio, site_id')
      .eq('id', idParsed.data)
      .single()

    if (fetchError || !template) return { ok: false, error: 'Template not found' }

    // Verify template is accessible by this site (either site-owned or global)
    if (template.site_id !== null && template.site_id !== authorizedSiteId) {
      return { ok: false, error: 'forbidden' }
    }

    // Unset previous default for this site + aspect ratio
    await supabase
      .from('social_templates')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('site_id', authorizedSiteId)
      .eq('aspect_ratio', template.aspect_ratio as string)
      .eq('is_default', true)

    // If the template is a global one, duplicate it for this site as default
    if (template.site_id === null) {
      // For globals, we set the default via sites.social_defaults or
      // create a site-scoped copy. For simplicity, we'll just track it in
      // a site-specific row. But since the unique index uses COALESCE,
      // we need to ensure we only have one default per site+ratio.
      // The global template IS the default — just mark it.
      // However, the unique index prevents two defaults for the same
      // coalesced site_id + ratio. Global defaults use the zero UUID.
      // We'll only unset site-scoped defaults and let the global be the
      // fallback. Instead, create a site copy.
      const { data: globalTmpl } = await supabase
        .from('social_templates')
        .select('*')
        .eq('id', idParsed.data)
        .single()

      if (globalTmpl) {
        const copyId = crypto.randomUUID()
        await supabase.from('social_templates').insert({
          id: copyId,
          site_id: authorizedSiteId,
          name: globalTmpl.name as string,
          aspect_ratio: globalTmpl.aspect_ratio as string,
          composition: globalTmpl.composition,
          thumbnail_url: globalTmpl.thumbnail_url as string | null,
          is_default: true,
        })
      }
    } else {
      // Set this template as default
      const { error } = await supabase
        .from('social_templates')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', idParsed.data)

      if (error) {
        Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'setDefaultTemplate' } })
        return { ok: false, error: error.message }
      }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'setDefaultTemplate' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// duplicateTemplate
// ---------------------------------------------------------------------------

export async function duplicateTemplate(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid template ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data: source, error: fetchError } = await supabase
      .from('social_templates')
      .select('*')
      .eq('id', parsed.data)
      .single()

    if (fetchError || !source) return { ok: false, error: 'Template not found' }

    // Verify accessibility: global templates or site-owned
    if (source.site_id !== null && source.site_id !== siteId) {
      return { ok: false, error: 'forbidden' }
    }

    const copyId = crypto.randomUUID()
    const row = {
      id: copyId,
      site_id: siteId,
      name: `Copy of ${source.name as string}`,
      aspect_ratio: source.aspect_ratio as string,
      composition: source.composition,
      thumbnail_url: source.thumbnail_url as string | null,
      is_default: false,
    }

    const { error } = await supabase.from('social_templates').insert(row)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'duplicateTemplate' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: copyId } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'duplicateTemplate' } })
    throw err
  }
}
