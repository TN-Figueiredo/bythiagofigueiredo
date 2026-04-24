import { cms } from '@/lib/cms/admin'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { ScheduleClient } from '@tn-figueiredo/cms-admin/schedule/client'

export default async function SchedulePage() {
  const data = await cms.contentQueue.getCalendarData()

  return (
    <div>
      <CmsTopbar title="Schedule" />
      <ScheduleClient
        posts={data.posts}
        editions={data.editions}
        cadence={data.cadence}
        backlog={data.backlog}
      />
    </div>
  )
}
