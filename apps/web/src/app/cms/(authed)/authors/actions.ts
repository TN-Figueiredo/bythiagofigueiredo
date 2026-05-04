'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { revalidateAuthor, revalidateAbout } from '@/lib/newsletter/cache-invalidation'
import { compileMdx, defaultComponents } from '@tn-figueiredo/cms'

type ActionResult = { ok: true } | { ok: false; error: string }

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
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

const socialLinksSchema = z
  .record(z.string().url().or(z.literal('')))
  .optional()
  .default({})

const createAuthorSchema = z.object({
  display_name: z.string().min(1, 'Name is required').max(200),
  bio: z.string().max(2000).optional(),
  type: z.enum(['linked', 'virtual']).default('virtual'),
  user_id: z.string().uuid().nullable().optional(),
  social_links: socialLinksSchema,
  avatar_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

const updateAuthorSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  bio: z.string().max(2000).nullable().optional(),
  social_links: z
    .record(z.string().url().or(z.literal('')))
    .optional(),
  avatar_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
  avatar_url: z.string().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
})

const aboutSchema = z.object({
  headline:      z.string().max(200).optional(),
  subtitle:      z.string().max(500).optional(),
  aboutMd:       z.string().max(50000).optional(),
  photoCaption:  z.string().max(200).optional(),
  photoLocation: z.string().max(100).optional(),
  aboutCtaLinks: z.object({
    kicker:    z.string().max(100),
    signature: z.string().max(200),
    links: z.array(z.object({
      type:  z.enum(['internal', 'social']),
      key:   z.string(),
      label: z.string().max(50),
    })).max(10),
  }).optional().nullable(),
})

/* ------------------------------------------------------------------ */
/*  Actions                                                           */
/* ------------------------------------------------------------------ */

export async function createAuthor(input: {
  display_name: string
  bio?: string
  type?: 'linked' | 'virtual'
  user_id?: string | null
  social_links?: Record<string, string>
  avatar_color?: string
}): Promise<ActionResult> {
  const parsed = createAuthorSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const slug = slugify(parsed.data.display_name)

  const { error } = await supabase.from('authors').insert({
    site_id: siteId,
    display_name: parsed.data.display_name,
    name: parsed.data.display_name,
    slug,
    bio: parsed.data.bio ?? null,
    user_id: parsed.data.user_id ?? null,
    social_links: parsed.data.social_links ?? {},
    avatar_color: parsed.data.avatar_color ?? null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/authors')
  return { ok: true }
}

export async function updateAuthor(
  id: string,
  data: {
    display_name?: string
    bio?: string | null
    social_links?: Record<string, string>
    avatar_color?: string | null
    avatar_url?: string | null
    sort_order?: number
  },
): Promise<ActionResult> {
  const parsed = updateAuthorSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.display_name) {
    updateData.name = parsed.data.display_name
    updateData.slug = slugify(parsed.data.display_name)
  }

  const { error } = await supabase
    .from('authors')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidateAuthor(id)
  revalidatePath('/cms/authors')
  return { ok: true }
}

export async function deleteAuthor(id: string): Promise<ActionResult> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Check if this is the default author — cannot be deleted
  const { data: authorRow } = await supabase
    .from('authors')
    .select('id, is_default')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (authorRow?.is_default) {
    return {
      ok: false,
      error: 'Default author cannot be deleted. Remove the default flag first.',
    }
  }

  // Check for posts assigned to this author
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('author_id', id)
    .eq('site_id', siteId)
    .limit(1)

  if (posts && posts.length > 0) {
    return {
      ok: false,
      error: 'Cannot delete author with assigned posts. Reassign posts first.',
    }
  }

  const { error } = await supabase
    .from('authors')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidateAuthor(id)
  revalidatePath('/cms/authors')
  return { ok: true }
}

export async function setDefaultAuthor(id: string): Promise<ActionResult> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Fetch old default author ID so we can invalidate its cache after the swap
  const { data: oldDefault } = await supabase
    .from('authors')
    .select('id')
    .eq('site_id', siteId)
    .eq('is_default', true)
    .single()

  // Clear existing default
  const { error: clearError } = await supabase
    .from('authors')
    .update({ is_default: false })
    .eq('site_id', siteId)
    .eq('is_default', true)
  if (clearError) return { ok: false, error: clearError.message }

  // Set new default
  const { error } = await supabase
    .from('authors')
    .update({ is_default: true })
    .eq('id', id)
    .eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }

  // Invalidate caches for both old and new default authors
  if (oldDefault && oldDefault.id !== id) {
    revalidateAuthor(oldDefault.id)
  }
  revalidateAuthor(id)
  revalidatePath('/cms/authors')
  revalidateAbout(siteId)
  return { ok: true }
}

export async function reorderAuthors(
  orderedIds: string[],
): Promise<ActionResult> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('authors')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
      .eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/cms/authors')
  return { ok: true }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_AVATAR_SIZE = 2 * 1024 * 1024

export async function uploadAuthorAvatar(
  authorId: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'No file provided' }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type))
    return { ok: false, error: 'Only JPEG, PNG, and WebP are allowed' }
  if (file.size > MAX_AVATAR_SIZE)
    return { ok: false, error: 'File must be under 2 MB' }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${authorId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('author-avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: urlData } = supabase.storage
    .from('author-avatars')
    .getPublicUrl(path)

  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`

  const { error: updateError } = await supabase
    .from('authors')
    .update({ avatar_url: avatarUrl })
    .eq('id', authorId)
    .eq('site_id', siteId)
  if (updateError) return { ok: false, error: updateError.message }

  revalidateAuthor(authorId)
  revalidatePath('/cms/authors')
  return { ok: true, url: avatarUrl }
}

export async function updateAuthorAbout(
  authorId: string,
  locale: string,
  input: z.input<typeof aboutSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const siteId = await requireEditAccess()

  const parsed = aboutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  // Validate locale against site's supported_locales
  const sb = getSupabaseServiceClient()
  const { data: siteRow } = await sb
    .from('sites')
    .select('supported_locales')
    .eq('id', siteId)
    .single()

  const supportedLocales = (siteRow as unknown as { supported_locales: string[] } | null)?.supported_locales ?? []
  if (!supportedLocales.includes(locale)) {
    return { ok: false, error: 'unsupported_locale' }
  }

  const data = parsed.data
  const updates: Record<string, unknown> = {
    author_id: authorId,
    locale,
  }

  if (data.headline !== undefined) updates.headline = data.headline || null
  if (data.subtitle !== undefined) updates.subtitle = data.subtitle || null
  if (data.photoCaption !== undefined) updates.photo_caption = data.photoCaption || null
  if (data.photoLocation !== undefined) updates.photo_location = data.photoLocation || null
  if (data.aboutCtaLinks !== undefined) updates.about_cta_links = data.aboutCtaLinks

  if (data.aboutMd !== undefined) {
    updates.about_md = data.aboutMd || null
    if (data.aboutMd) {
      try {
        const compiled = await compileMdx(data.aboutMd, defaultComponents)
        updates.about_compiled = compiled.compiledSource
      } catch {
        return { ok: false, error: 'compile_failed' }
      }
    } else {
      updates.about_compiled = null
    }
  }

  const { error } = await sb
    .from('author_about_translations')
    .upsert(updates, { onConflict: 'author_id,locale' })

  if (error) return { ok: false, error: error.message }

  revalidateAuthor(authorId)
  revalidateAbout(siteId)
  revalidatePath('/about')

  return { ok: true }
}

export async function getAuthorAboutTranslations(
  authorId: string,
): Promise<Record<string, {
  headline: string | null
  subtitle: string | null
  aboutMd: string | null
  photoCaption: string | null
  photoLocation: string | null
  aboutCtaLinks: {
    kicker: string
    signature: string
    links: Array<{ type: 'internal' | 'social'; key: string; label: string }>
  } | null
} | null>> {
  await requireEditAccess()
  const sb = getSupabaseServiceClient()

  const { data } = await sb
    .from('author_about_translations')
    .select('locale, headline, subtitle, about_md, photo_caption, photo_location, about_cta_links')
    .eq('author_id', authorId)

  const result: Record<string, unknown> = {}
  for (const row of (data ?? []) as unknown as Array<{
    locale: string
    headline: string | null
    subtitle: string | null
    about_md: string | null
    photo_caption: string | null
    photo_location: string | null
    about_cta_links: unknown
  }>) {
    result[row.locale] = {
      headline: row.headline,
      subtitle: row.subtitle,
      aboutMd: row.about_md,
      photoCaption: row.photo_caption,
      photoLocation: row.photo_location,
      aboutCtaLinks: row.about_cta_links,
    }
  }

  return result as Record<string, any>
}

export async function uploadAuthorAboutPhoto(
  authorId: string,
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const siteId = await requireEditAccess()

  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'no_file' }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'invalid_type' }
  if (file.size > MAX_AVATAR_SIZE) return { ok: false, error: 'too_large' }

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${authorId}/about.${ext}`

  const sb = getSupabaseServiceClient()
  const { error: uploadError } = await sb.storage
    .from('author-avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: urlData } = sb.storage.from('author-avatars').getPublicUrl(path)
  const url = `${urlData.publicUrl}?v=${Date.now()}`

  await sb.from('authors').update({ about_photo_url: url }).eq('id', authorId).eq('site_id', siteId)

  revalidateAuthor(authorId)
  revalidateAbout(siteId)
  revalidatePath('/about')

  return { ok: true, url }
}
