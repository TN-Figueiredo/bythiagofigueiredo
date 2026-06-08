import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { loadVideoHub } from '@/lib/pipeline/load-video-hub'
import { HubHeader } from './_components/hub-header'
import { StatRow } from './_components/stat-row'
import { VideoHub } from './_components/video-hub'
import './video.css'

export const dynamic = 'force-dynamic'

export default async function VideoHubPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })

  const data = await loadVideoHub(siteId)

  return (
    <div className="video-hub-page">
      <HubHeader />
      <StatRow stats={data.stats} />
      <VideoHub data={data} />
    </div>
  )
}
