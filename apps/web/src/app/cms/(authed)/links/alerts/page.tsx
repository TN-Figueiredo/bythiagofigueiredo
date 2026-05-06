import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AlertRulesEditor } from '@tn-figueiredo/links-admin/client'
import type { AlertRule } from '@tn-figueiredo/links-admin'
import { saveAlertRule, deleteAlertRule } from '../actions'

export const dynamic = 'force-dynamic'

export default async function AlertRulesPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  // Fetch existing alert rules for this site
  const { data: rules } = await supabase
    .from('link_alerts')
    .select('id, link_id, metric, condition, active, notify_channels, created_at, tracked_links(title, code)')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  const formattedRules: AlertRule[] = (rules ?? []).map((r) => {
    const cond = r.condition as Record<string, unknown> | null
    const channels = r.notify_channels as Array<{ type: string; url?: string }> | null
    const hasWebhook = channels?.some(c => c.type === 'webhook')
    const webhookChannel = channels?.find(c => c.type === 'webhook')

    // Map window_minutes to window string
    const windowMinutes = (cond?.window_minutes as number) ?? 1440
    let window: AlertRule['window'] = '24h'
    if (windowMinutes <= 60) window = '1h'
    else if (windowMinutes <= 360) window = '6h'
    else if (windowMinutes <= 1440) window = '24h'
    else window = '7d'

    return {
      id: r.id as string,
      metric: r.metric as AlertRule['metric'],
      condition: ((cond?.operator as string) ?? 'gt') as AlertRule['condition'],
      threshold: (cond?.threshold as number) ?? 0,
      window,
      channel: hasWebhook ? 'webhook' as const : 'email' as const,
      webhookUrl: (webhookChannel?.url as string) ?? undefined,
      active: r.active as boolean,
    }
  })

  async function handleSave(rule: Omit<AlertRule, 'id'>) {
    'use server'
    // We need a link_id to save -- for now we just return ok: false
    // In practice this would be part of the UI form state
    void rule
    return { ok: false as const }
  }

  async function handleDelete(id: string) {
    'use server'
    const result = await deleteAlertRule(id)
    return { ok: result.ok }
  }

  return (
    <AlertRulesEditor
      rules={formattedRules}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  )
}
