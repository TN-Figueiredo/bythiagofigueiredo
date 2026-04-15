'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { compileMdx, uploadContentAsset, type CompiledMdx } from '@tn-figueiredo/cms'
import { postRepo } from '../../../../../../lib/cms/repositories'
import { blogRegistry } from '../../../../../../lib/cms/registry'
import { getSiteContext } from '../../../../../../lib/cms/site-context'
import { getSupabaseServiceClient } from '../../../../../../lib/supabase/service'

/**
 * Guard: ensure the current authenticated user has site-admin rights on the
 * site that owns the given post. Throws on missing post or unauthorized user.
 *
 * Uses a user-scoped SSR Supabase client so the `can_admin_site` RPC runs
 * under the caller's JWT (service-role would bypass RLS and the RPC's
 * internal auth.uid() check).
 */
async function requireSiteAdmin(postId: string): Promise<{ siteId: string }> {
  const post = await postRepo().getById(postId)
  if (!post) {
    throw new Error('post_not_found')
  }
  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )
  const { data: allowed, error } = await userClient.rpc('can_admin_site', { p_site_id: post.site_id })
  if (error) {
    throw new Error(`authz_check_failed: ${error.message}`)
  }
  if (!allowed) {
    throw new Error('forbidden')
  }
  return { siteId: post.site_id }
}

export interface SavePostActionInput {
  content_mdx: string
  title: string
  slug: string
  excerpt?: string | null
}

export type SavePostActionResult =
  | { ok: true; postId?: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'compile_failed'; message: string }
  | { ok: false; error: 'db_error'; message: string }

export async function savePost(
  id: string,
  locale: string,
  input: SavePostActionInput,
): Promise<SavePostActionResult> {
  if (!input.title.trim()) {
    return { ok: false, error: 'validation_failed', fields: { title: 'required' } }
  }
  if (!input.slug.trim()) {
    return { ok: false, error: 'validation_failed', fields: { slug: 'required' } }
  }

  await requireSiteAdmin(id)

  let compiled: CompiledMdx
  try {
    compiled = await compileMdx(input.content_mdx, blogRegistry)
  } catch (e) {
    return {
      ok: false,
      error: 'compile_failed',
      message: e instanceof Error ? e.message : String(e),
    }
  }

  try {
    await postRepo().update(id, {
      translation: {
        locale,
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt ?? null,
        content_mdx: input.content_mdx,
        content_compiled: compiled.compiledSource,
        content_toc: compiled.toc,
        reading_time_min: compiled.readingTimeMin,
      },
    })
  } catch (e) {
    return {
      ok: false,
      error: 'db_error',
      message: e instanceof Error ? e.message : String(e),
    }
  }

  revalidatePath(`/blog/${locale}`)
  revalidatePath(`/blog/${locale}/${input.slug}`)
  return { ok: true, postId: id }
}

export async function publishPost(id: string): Promise<void> {
  await requireSiteAdmin(id)
  const post = await postRepo().publish(id)
  const tx = post.translations[0]
  if (tx) {
    revalidatePath(`/blog/${tx.locale}`)
    revalidatePath(`/blog/${tx.locale}/${tx.slug}`)
  }
}

export async function unpublishPost(id: string): Promise<void> {
  await requireSiteAdmin(id)
  const post = await postRepo().unpublish(id)
  const tx = post.translations[0]
  if (tx) {
    revalidatePath(`/blog/${tx.locale}`)
    revalidatePath(`/blog/${tx.locale}/${tx.slug}`)
  }
}

export async function archivePost(id: string): Promise<void> {
  await requireSiteAdmin(id)
  const post = await postRepo().archive(id)
  const tx = post.translations[0]
  if (tx) revalidatePath(`/blog/${tx.locale}`)
}

export async function deletePost(id: string): Promise<void> {
  await requireSiteAdmin(id)
  const post = await postRepo().getById(id)
  if (post && (post.status === 'draft' || post.status === 'archived')) {
    await postRepo().delete(id)
    const tx = post.translations[0]
    if (tx) revalidatePath(`/blog/${tx.locale}`)
  }
}

// readonly, no authz needed
export async function compilePreview(source: string): Promise<CompiledMdx> {
  return compileMdx(source, blogRegistry)
}

export async function uploadAsset(file: File, postId: string): Promise<{ url: string }> {
  await requireSiteAdmin(postId)
  const ctx = await getSiteContext()
  const result = await uploadContentAsset(getSupabaseServiceClient(), {
    siteId: ctx.siteId,
    contentType: 'blog',
    contentId: postId,
    file,
    filename: file.name,
  })
  return { url: result.signedUrl }
}
