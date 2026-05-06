import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { NewLinkFormWrapper } from './_form'

export const dynamic = 'force-dynamic'

export default async function NewLinkPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!authRes.ok) redirect('/cms')

  return <NewLinkFormWrapper siteId={siteId} />
}
