import { getSupabaseServiceClient } from '@/lib/supabase/service'

type Severity = 'critical' | 'info'

export async function recordCronSuccess(cronName: string, severity: Severity = 'info') {
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('cron_health').upsert(
    {
      cron_name: cronName,
      last_success_at: new Date().toISOString(),
      consecutive_failures: 0,
      severity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cron_name' },
  )

  if (error) {
    console.error(`[cron-health] Failed to record success for ${cronName}:`, error)
  }
}

export async function recordCronFailure(cronName: string, error: string, severity: Severity = 'info') {
  const supabase = getSupabaseServiceClient()

  // Race condition note: each cron_name has at most ONE concurrent Vercel cron instance,
  // so this read-then-write is safe in practice.
  const { data } = await supabase
    .from('cron_health')
    .select('consecutive_failures')
    .eq('cron_name', cronName)
    .single()

  const failures = (data?.consecutive_failures ?? 0) + 1

  const { error: upsertError } = await supabase.from('cron_health').upsert(
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

  if (upsertError) {
    console.error(`[cron-health] Failed to record failure for ${cronName}:`, upsertError)
  }
}

export async function getCronHealth(cronName: string) {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('cron_health')
    .select('*')
    .eq('cron_name', cronName)
    .single()

  if (error) {
    console.error(`[cron-health] Failed to get health for ${cronName}:`, error)
  }

  return data
}
