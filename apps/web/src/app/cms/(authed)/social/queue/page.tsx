import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listSocialPosts } from '@/lib/social/actions'
import { getSocialStrings } from '../_i18n'
import { QueueList } from './_components/queue-list'

export const dynamic = 'force-dynamic'

export default async function SocialQueuePage() {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)

  const result = await listSocialPosts(ctx.siteId, { status: 'scheduled' })
  const posts = result.ok ? result.data : []

  const queuedPosts = posts
    .filter((p) => p.scheduled_at)
    .sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() -
        new Date(b.scheduled_at!).getTime(),
    )

  return (
    <>
      <CmsTopbar title={t.posts.tabs.queue} />
      <div className="p-6">
        <QueueList posts={queuedPosts} strings={t} />
      </div>
    </>
  )
}
