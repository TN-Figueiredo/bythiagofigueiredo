'use server'

import { revalidatePath } from 'next/cache'
import { compileMdx, uploadContentAsset, type CompiledMdx } from '@tn-figueiredo/cms'
import { postRepo } from '../../../../../../lib/cms/repositories'
import { blogRegistry } from '../../../../../../lib/cms/registry'
import { getSiteContext } from '../../../../../../lib/cms/site-context'
import { getSupabaseServiceClient } from '../../../../../../lib/supabase/service'
import { requireSiteAdminForRow } from '../../../../../../lib/cms/auth-guards'

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

  await requireSiteAdminForRow('blog_posts', id)

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
  await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().publish(id)
  const tx = post.translations[0]
  if (tx) {
    revalidatePath(`/blog/${tx.locale}`)
    revalidatePath(`/blog/${tx.locale}/${tx.slug}`)
  }
}

export async function unpublishPost(id: string): Promise<void> {
  await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().unpublish(id)
  const tx = post.translations[0]
  if (tx) {
    revalidatePath(`/blog/${tx.locale}`)
    revalidatePath(`/blog/${tx.locale}/${tx.slug}`)
  }
}

export async function archivePost(id: string): Promise<void> {
  await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().archive(id)
  const tx = post.translations[0]
  if (tx) revalidatePath(`/blog/${tx.locale}`)
}

export async function deletePost(id: string): Promise<void> {
  await requireSiteAdminForRow('blog_posts', id)
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
  await requireSiteAdminForRow('blog_posts', postId)
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
