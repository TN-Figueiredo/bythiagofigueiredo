import { getSupabaseServiceClient } from '@/lib/supabase/service'

type Severity = 'critical' | 'info'

export async function recordCronSuccess(cronName: string, severity: Severity = 'info') {
  const supabase = getSupabaseServiceClient()
  await supabase.from('cron_health').upsert(
    {
      cron_name: cronName,
      last_success_at: new Date().toISOString(),
      consecutive_failures: 0,
      severity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cron_name' },
  )
}

export async function recordCronFailure(cronName: string, error: string, severity: Severity = 'info') {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('cron_health')
    .select('consecutive_failures')
    .eq('cron_name', cronName)
    .single()

  const failures = (data?.consecutive_failures ?? 0) + 1

  await supabase.from('cron_health').upsert(
    {
      cron_name: cronName,
      last_failure_at: new Date().toISOString(),
      last_error: error,
      consecutive_failures: failures,
      severity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cron_name' },
  )
}

export async function getCronHealth(cronName: string) {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('cron_health')
    .select('*')
    .eq('cron_name', cronName)
    .single()
  return data
}
