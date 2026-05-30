import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
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
import { SocialBreadcrumb } from '../_components/shared/social-breadcrumb'
import { SocialPageHeader } from '../_components/shared/social-page-header'
import { ComposerShell } from './_components/composer-shell'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    mode?: string
    post?: string
    draft?: string
    lang?: string
  }>
}

export default async function CompositorPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const params = await searchParams

  // lang: explicit override or fall back to site default
  const langParam = params.lang === 'en' ? 'en' : params.lang === 'pt' ? 'pt-BR' : null
  const uiLocale = langParam ?? (ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en')
  const t = getSocialStrings(uiLocale)

  // Source mode: ?mode=cms|blank maps to ComposerShell's sourceMode
  // Also keep legacy ?mode=text|image|video for backward compat
  const legacyModes = ['text', 'image', 'video'] as const
  type LegacyMode = (typeof legacyModes)[number]
  const isLegacyMode = legacyModes.includes(params.mode as LegacyMode)

  const composerMode: 'text' | 'image' | 'video' = isLegacyMode
    ? (params.mode as LegacyMode)
    : 'text'
  const sourceMode: 'cms' | 'freeform' =
    params.mode === 'blank' ? 'freeform' : 'cms'

  // Connections
  const result = await getConnections(ctx.siteId)
  const connections = result.ok
    ? result.data.map((c) => ({ provider: c.provider, account_name: c.account_name }))
    : []

  // Edit mode: ?post={id} or ?draft={id}
  const postOrDraftId = params.post ?? params.draft
  let editPostId: string | undefined
  let editDeliveries:
    | Array<{
        id: string
        provider: Provider
        status: string
        platform_post_id: string | null
      }>
    | undefined

  if (postOrDraftId) {
    const postResult = await getSocialPost(postOrDraftId)
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

  const isEditing = !!editPostId
  const pageTitle = isEditing ? 'Editar Post' : 'Novo Post'

  const breadcrumb = (
    <SocialBreadcrumb
      crumbs={[
        { label: 'Social', href: '/cms/social' },
        { label: pageTitle },
      ]}
    />
  )

  return (
    <div className="p-6">
      <SocialPageHeader breadcrumb={breadcrumb} title={pageTitle} />
      <Suspense fallback={<CompositorSkeleton />}>
        <ComposerShell
          connections={connections}
          strings={t}
          initialMode={composerMode}
          initialSourceMode={sourceMode}
          editPostId={editPostId}
          editDeliveries={editDeliveries}
          onCreateSocialPost={createSocialPost}
          onCreateFromContent={createFromContentAction}
          onGetContentForSocialPost={getContentForSocialPost}
          onEditPublishedPost={editPublishedPost}
          onCheckDuplicates={checkDuplicatesAction}
          onFetchQueueSlot={fetchQueueSlot}
        />
      </Suspense>
    </div>
  )
}

function CompositorSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] animate-pulse">
      <div className="space-y-4">
        <div className="h-12 rounded-lg bg-cms-surface" />
        <div className="h-40 rounded-lg bg-cms-surface" />
        <div className="h-32 rounded-lg bg-cms-surface" />
      </div>
      <div className="h-[500px] rounded-lg bg-cms-surface" />
    </div>
  )
}
