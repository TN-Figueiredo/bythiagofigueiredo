import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getStoryCounts, getStories } from '@/lib/social/actions/stories'
import { StoriesGallery } from './_components/stories-gallery'

export const dynamic = 'force-dynamic'

export default async function StoriesPage() {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const countsResult = await getStoryCounts(ctx.siteId)
  const counts = countsResult.ok
    ? countsResult.data
    : { drafts: 0, live: 0, expired: 0, scheduled: 0 }

  return (
    <>
      <CmsTopbar title="Stories" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-cms-text">Instagram Stories</h1>
            <p className="text-sm text-cms-text-muted mt-0.5">
              Crie e gerencie stories em formato 9:16
            </p>
          </div>
          <Link
            href="/cms/social/stories/new"
            className="inline-flex items-center gap-2 rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Nova Story
          </Link>
        </div>

        <StoriesGallery siteId={ctx.siteId} initialCounts={counts} fetchStories={getStories} />
      </div>
    </>
  )
}
