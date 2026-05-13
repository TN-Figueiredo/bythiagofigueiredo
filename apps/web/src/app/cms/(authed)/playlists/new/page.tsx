import { getSiteContext } from '@/lib/cms/site-context'
import { NewPlaylistForm } from './_form'

export const dynamic = 'force-dynamic'

export default async function NewPlaylistPage() {
  const { siteId } = await getSiteContext()

  return <NewPlaylistForm siteId={siteId} />
}
