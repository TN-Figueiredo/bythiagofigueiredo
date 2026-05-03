'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { compileMdx, uploadContentAsset, isSafeUrl, type CompiledMdx } from '@tn-figueiredo/cms'
import { postRepo } from '@/lib/cms/repositories'
import { blogRegistry } from '@/lib/cms/registry'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireSiteAdminForRow } from '@/lib/cms/auth-guards'
import { revalidateBlogPostSeo } from '@/lib/seo/cache-invalidation'
import { parseMdxFrontmatter, SeoExtrasValidationError } from '@/lib/seo/frontmatter'
import type { ZodIssue } from 'zod'

export interface SavePostActionInput {
  content_mdx: string
  title: string
  slug: string
  excerpt?: string | null
  meta_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
  cover_image_url?: string | null
  tag_id?: string | null
}

export type SavePostActionResult =
  | { ok: true; postId?: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'compile_failed'; message: string }
  | { ok: false; error: 'invalid_seo_extras'; details: ZodIssue[] }
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
  if (!isSafeUrl(input.og_image_url)) {
    return { ok: false, error: 'validation_failed', fields: { og_image_url: 'invalid_url' } }
  }
  if (!isSafeUrl(input.cover_image_url)) {
    return { ok: false, error: 'validation_failed', fields: { cover_image_url: 'invalid_url' } }
  }

  const { siteId } = await requireSiteAdminForRow('blog_posts', id)

  // Sprint 5b PR-C: parse YAML frontmatter (seo_extras) BEFORE compile.
  // Stripped content is what we compile + persist so the editor doesn't
  // re-render the frontmatter as MDX body on next open.
  let parsed: ReturnType<typeof parseMdxFrontmatter>
  try {
    parsed = parseMdxFrontmatter(input.content_mdx)
  } catch (e) {
    if (e instanceof SeoExtrasValidationError) {
      return { ok: false, error: 'invalid_seo_extras', details: e.issues }
    }
    throw e
  }
  const { content: strippedContent, seoExtras } = parsed

  let compiled: CompiledMdx
  try {
    compiled = await compileMdx(strippedContent, blogRegistry)
  } catch (e) {
    return {
      ok: false,
      error: 'compile_failed',
      message: e instanceof Error ? e.message : String(e),
    }
  }

  try {
    await postRepo().update(id, {
      ...(input.cover_image_url !== undefined ? { cover_image_url: input.cover_image_url } : {}),
      translation: {
        locale,
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt ?? null,
        content_mdx: strippedContent,
        content_compiled: compiled.compiledSource,
        content_toc: compiled.toc,
        reading_time_min: compiled.readingTimeMin,
        ...(input.meta_title !== undefined ? { meta_title: input.meta_title } : {}),
        ...(input.meta_description !== undefined ? { meta_description: input.meta_description } : {}),
        ...(input.og_image_url !== undefined ? { og_image_url: input.og_image_url } : {}),
      },
    })
  } catch (e) {
    return {
      ok: false,
      error: 'db_error',
      message: e instanceof Error ? e.message : String(e),
    }
  }

  {
    const supabase = getSupabaseServiceClient()
    const postPatch: Record<string, unknown> = { locale }
    if (input.tag_id !== undefined) postPatch.tag_id = input.tag_id
    await supabase.from('blog_posts').update(postPatch).eq('id', id)
  }

  // Workaround: @tn-figueiredo/cms@0.2.0 `UpdatePostInput.translation` does
  // NOT expose `seo_extras` (only set added by Sprint 5b PR-A migration
  // 20260501000002). Apply the column update via the service-role client
  // directly. Authorization already enforced via `requireSiteAdminForRow`.
  // TODO(cms): when @tn-figueiredo/cms ships seo_extras in UpdatePostInput,
  // collapse this into the call above.
  //
  // We only write when frontmatter actually parsed to a non-null value so
  // submitting the editor with plain MDX (no `---` block) leaves the existing
  // seo_extras untouched. To clear it the editor must emit an explicit
  // `seo_extras: {}` block (rejected by the Zod `.strict()` schema as empty
  // — Sprint 6+ admin UI will surface a "remove extras" affordance).
  if (seoExtras !== null) {
    try {
      const supabase = getSupabaseServiceClient()
      await supabase
        .from('blog_translations')
        .update({ seo_extras: seoExtras })
        .eq('post_id', id)
        .eq('locale', locale)
    } catch (e) {
      return {
        ok: false,
        error: 'db_error',
        message: e instanceof Error ? e.message : String(e),
      }
    }
  }

  revalidateBlogPostSeo(siteId, id, locale, input.slug)
  revalidateTag('blog-hub')
  return { ok: true, postId: id }
}

export async function publishPost(id: string): Promise<void> {
  const { siteId } = await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().publish(id)
  for (const tx of post.translations) {
    revalidateBlogPostSeo(siteId, id, tx.locale, tx.slug)
  }
}

export async function unpublishPost(id: string): Promise<void> {
  const { siteId } = await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().unpublish(id)
  for (const tx of post.translations) {
    revalidateBlogPostSeo(siteId, id, tx.locale, tx.slug)
  }
}

export async function archivePost(id: string): Promise<void> {
  const { siteId } = await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().archive(id)
  // Sprint 5b PR-C bug fix: previously only `revalidatePath('/blog/${locale}')`
  // was called for the FIRST translation. The slug page was missed (stale
  // archived post visible until next on-demand revalidate). The SEO helper
  // covers both the index AND the slug page, plus tag-based invalidation.
  for (const tx of post.translations) {
    revalidateBlogPostSeo(siteId, id, tx.locale, tx.slug)
  }
}

export type DeletePostResult =
  | { ok: true }
  | { ok: false; error: 'already_published' | 'not_found' | 'db_error'; message?: string }

export async function deletePost(id: string): Promise<DeletePostResult> {
  const { siteId } = await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().getById(id)
  if (!post) return { ok: false, error: 'not_found' }
  if (post.status !== 'draft' && post.status !== 'archived') {
    // Stale delete attempt from a list view that showed the post as deletable
    // before it was published elsewhere. Surface explicitly so the UI can
    // re-render.
    return { ok: false, error: 'already_published' }
  }
  try {
    await postRepo().delete(id)
  } catch (e) {
    return {
      ok: false,
      error: 'db_error',
      message: e instanceof Error ? e.message : String(e),
    }
  }
  for (const tx of post.translations) {
    revalidateBlogPostSeo(siteId, id, tx.locale, tx.slug)
  }
  revalidatePath('/cms/blog')
  return { ok: true }
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
