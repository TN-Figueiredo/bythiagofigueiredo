import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getSocialPost } from '@/lib/social/actions'
import { getSocialStrings } from '../_i18n'
import { PostDetail } from '../_components/post-detail'
import { SourceCard } from './_components/source-card'
import { PipelineCompact } from './_components/pipeline-compact'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SocialPostDetailPage({ params }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const { id } = await params

  const result = await getSocialPost(id)
  if (!result.ok) notFound()

  const post = result.data as typeof result.data & {
    source_content_type?: string | null
    source_content_id?: string | null
    pipeline_steps?: Array<{ step: string; status: string; at?: string }>
  }
  const hasSource = post.source_content_type && post.source_content_id
  const hasPipeline = Array.isArray(post.pipeline_steps) && post.pipeline_steps.length > 0

  return (
    <>
      <CmsTopbar title={t.detail.title} />
      <div className="p-6 space-y-4">
        {(hasSource || hasPipeline) && (
          <div className="flex flex-wrap items-start gap-4">
            {hasSource && (
              <SourceCard
                contentType={post.source_content_type!}
                contentId={post.source_content_id!}
                title={post.content.title ?? post.content.description ?? 'Conteúdo'}
              />
            )}
            {hasPipeline && (
              <PipelineCompact steps={post.pipeline_steps!} />
            )}
          </div>
        )}
        <PostDetail post={post} strings={t} />
      </div>
    </>
  )
}
