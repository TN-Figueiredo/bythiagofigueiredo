import { cms } from '@/lib/cms/admin'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { ScheduleConnected } from './schedule-connected'

export default async function SchedulePage() {
  const data = await cms.contentQueue.getCalendarData()

  return (
    <div>
      <CmsTopbar title="Schedule" />
      <ScheduleConnected
        posts={data.posts}
        editions={data.editions}
        cadence={data.cadence}
        backlog={data.backlog}
      />
    </div>
  )
}
