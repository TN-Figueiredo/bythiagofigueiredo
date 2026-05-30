import { getSocialPost } from '@/lib/social/actions'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { DrawerShell } from '../../_components/drawer-shell'
import { DrawerContent } from '../../_components/drawer-content'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PostDrawerPage({ params }: Props) {
  const { id } = await params
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const result = await getSocialPost(id)
  if (!result.ok) return null

  return (
    <DrawerShell>
      <DrawerContent post={result.data} siteId={ctx.siteId} />
    </DrawerShell>
  )
}
