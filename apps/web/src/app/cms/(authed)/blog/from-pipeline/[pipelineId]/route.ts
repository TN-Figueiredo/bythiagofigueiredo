import { redirect, notFound } from 'next/navigation'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { resolvePipelineEditorTarget } from '@/lib/pipeline/editor-routing'
import { createPostFromPipeline } from '../../actions'

export const dynamic = 'force-dynamic'

/**
 * Bridge that lands every blog pipeline item in the staged editor.
 *
 * Implemented as a GET Route Handler (not a page): createPostFromPipeline calls
 * revalidateTag, which is illegal during a Server Component render but fine here.
 * Cards link to it with a plain <a> (never next/link) so prefetch can't trigger
 * the GET and silently create a post on hover.
 *
 * Find-or-create + idempotent: linkPostToItem stamps content_pipeline.blog_post_id,
 * so a second open of the same item reuses the post instead of creating another.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pipelineId: string }> },
) {
  const { pipelineId } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })

  const svc = getSupabaseServiceClient()
  const { data: item } = await svc
    .from('content_pipeline')
    .select('id, blog_post_id, format, language')
    .eq('id', pipelineId)
    .eq('site_id', siteId)
    .single()

  if (!item) notFound()

  const target = resolvePipelineEditorTarget({
    blog_post_id: (item.blog_post_id as string | null) ?? null,
    format: item.format as string,
  })

  if (target.kind === 'edit') redirect(`/cms/blog/${target.postId}/edit`)
  if (target.kind === 'detail') redirect(`/cms/pipeline/items/${pipelineId}`)

  // kind === 'create' — lazily materialize the blog post, then open it.
  const locale = item.language === 'en' ? 'en' : 'pt-BR'
  const result = await createPostFromPipeline(siteId, pipelineId, locale)
  if (result.ok) redirect(`/cms/blog/${result.postId}/edit`)

  // Lost a race (linked between read and create) — re-read and use it.
  const { data: relinked } = await svc
    .from('content_pipeline')
    .select('blog_post_id')
    .eq('id', pipelineId)
    .single()
  if (relinked?.blog_post_id) redirect(`/cms/blog/${relinked.blog_post_id}/edit`)

  // Genuine failure — fall back to the legacy detail rather than a dead end.
  redirect(`/cms/pipeline/items/${pipelineId}`)
}
