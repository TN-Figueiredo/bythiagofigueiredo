import { NextRequest } from 'next/server'
import { getCronHealth, recordCronSuccess } from '@/lib/cron-health'
import { createNotification } from '@/lib/notifications/create'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const rotateHealth = await getCronHealth('ab-rotate')

  const rotateRanToday =
    rotateHealth?.last_success_at &&
    rotateHealth.last_success_at.slice(0, 10) === today

  if (!rotateRanToday) {
    const supabase = getSupabaseServiceClient()
    const { data: activeTests } = await supabase
      .from('ab_tests')
      .select('site_id')
      .eq('status', 'active')
      .limit(1)

    if (activeTests && activeTests.length > 0) {
      await createNotification({
        site_id: activeTests[0].site_id,
        type: 'youtube.rotation_missed',
        domain: 'youtube',
        priority: 1,
        title: 'Rotação A/B não executou hoje',
        message: `O cron ab-rotate não rodou hoje (${today}). Último sucesso: ${rotateHealth?.last_success_at ?? 'nunca'}.`,
        action_href: '/cms/youtube/ab-lab',
        dedup_key: `rotation-missed-${today}`,
      })
    }
  }

  await recordCronSuccess('ab-watchdog', 'info')

  return Response.json({
    status: 'ok',
    rotate_healthy: !!rotateRanToday,
    last_rotate: rotateHealth?.last_success_at ?? null,
  })
}
