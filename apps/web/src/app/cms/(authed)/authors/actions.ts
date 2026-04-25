'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

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
  sort_order: z.number().int().min(0).optional(),
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
  revalidatePath('/cms/authors')
  return { ok: true }
}

export async function deleteAuthor(id: string): Promise<ActionResult> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

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
  revalidatePath('/cms/authors')
  return { ok: true }
}

export async function setDefaultAuthor(id: string): Promise<ActionResult> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

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
  revalidatePath('/cms/authors')
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
