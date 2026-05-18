import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import {
  getConnections,
  getSocialPost,
  createSocialPost,
  createFromContentAction,
  getContentForSocialPost,
  editPublishedPost,
  checkDuplicatesAction,
  getNextQueueSlotAction,
} from '@/lib/social/actions'
import type { Provider } from '@tn-figueiredo/social'
import { getSocialStrings } from '../_i18n'
import { ComposerShell } from './_components/composer-shell'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ mode?: string; post?: string }>
}

export default async function SocialComposerPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const mode = (['text', 'image', 'video'].includes(params.mode ?? '')
    ? params.mode
    : 'text') as 'text' | 'image' | 'video'

  const result = await getConnections(ctx.siteId)
  const connections = result.ok
    ? result.data.map((c) => ({ provider: c.provider, account_name: c.account_name }))
    : []

  // Edit mode: load existing post when ?post={id} is present
  let editPostId: string | undefined
  let editDeliveries: Array<{
    id: string
    provider: Provider
    status: string
    platform_post_id: string | null
  }> | undefined

  if (params.post) {
    const postResult = await getSocialPost(params.post)
    if (postResult.ok) {
      editPostId = postResult.data.id
      editDeliveries = postResult.data.deliveries.map((d) => ({
        id: d.id,
        provider: d.provider,
        status: d.status,
        platform_post_id: d.platform_post_id,
      }))
    }
  }

  const fetchQueueSlot = async (timezone: string) => {
    'use server'
    const res = await getNextQueueSlotAction(ctx.siteId, timezone)
    return res.ok ? res.data : null
  }

  return (
    <>
      <CmsTopbar title={editPostId ? 'Editar Post' : t.composer.title} />
      <div className="p-6">
        <ComposerShell
          connections={connections}
          strings={t}
          initialMode={mode}
          editPostId={editPostId}
          editDeliveries={editDeliveries}
          onCreateSocialPost={createSocialPost}
          onCreateFromContent={createFromContentAction}
          onGetContentForSocialPost={getContentForSocialPost}
          onEditPublishedPost={editPublishedPost}
          onCheckDuplicates={checkDuplicatesAction}
          onFetchQueueSlot={fetchQueueSlot}
        />
      </div>
    </>
  )
}
