import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getSocialPost } from '@/lib/social/actions'
import { getSocialStrings } from '../_i18n'
import { PostDetail } from '../_components/post-detail'
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

  return (
    <>
      <CmsTopbar title={t.detail.title} />
      <div className="p-6">
        <PostDetail post={result.data} strings={t} />
      </div>
    </>
  )
}
