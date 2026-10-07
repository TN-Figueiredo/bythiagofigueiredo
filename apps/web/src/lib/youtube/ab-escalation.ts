import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createNotification } from '@/lib/notifications/create'
import { getEmailService } from '@/lib/email/service'
import { getSiteOwners, logSemDestinatario } from '@/lib/notifications/get-site-owners'

/**
 * Checks cron_health for 3+ consecutive days of failures and escalates:
 * 1. Creates a priority-1 in-app notification with email delivery
 * 2. Sends a direct email via SES as a fallback
 *
 * Returns true if escalation was sent, false if not needed or deduped.
 */
export async function checkAndEscalate(cronName: string, siteId: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient()

  const { data: health } = await supabase
    .from('cron_health')
    .select('consecutive_failures, last_failure_at, last_success_at')
    .eq('cron_name', cronName)
    .single()

  if (!health || health.consecutive_failures < 3) return false

  // Check if failing for 3+ calendar days
  const referenceDate = health.last_success_at ?? health.last_failure_at
  if (!referenceDate) return false

  const daysSinceSuccess = health.last_success_at
    ? (Date.now() - new Date(health.last_success_at).getTime()) / 86_400_000
    : (Date.now() - new Date(health.last_failure_at!).getTime()) / 86_400_000 + 3 // assume worst case

  if (daysSinceSuccess < 3) return false

  const today = new Date().toISOString().slice(0, 10)
  const dedupKey = `escalation-${cronName}-${today}`

  // Donos do site = org_admin da organização raiz (o `site_users`/'super_admin' antigo nunca existiu).
  const owners = await getSiteOwners(supabase, siteId)
  if (owners.length === 0) {
    // Escalonamento sem a quem escalar: visível no log, nunca "nada a fazer" mudo.
    logSemDestinatario(`ab-escalation:${cronName}`, siteId)
    return false
  }

  let sent = false
  for (const owner of owners) {
    // Create high-priority in-app notification (with email channel)
    // The dedup_key prevents duplicate notifications on same day
    const result = await createNotification({
      site_id: siteId,
      user_id: owner.userId,
      type: 'cron_escalation',
      domain: 'system',
      priority: 1,
      title: `${cronName} falhando há ${Math.floor(daysSinceSuccess)} dias`,
      message: `O cron "${cronName}" está com ${health.consecutive_failures} falhas consecutivas. Último sucesso: ${health.last_success_at ?? 'nunca'}. Último erro: ${health.last_failure_at ?? 'desconhecido'}.`,
      dedup_key: dedupKey,
      action_href: '/cms/youtube/ab-lab',
      suggested_action: 'Verificar configuração e logs',
      channels: ['email'],
    })

    if (result.suppressed) continue

    // Direct SES email as additional escalation path
    await sendEscalationEmail(owner.email, cronName, health, daysSinceSuccess)
    sent = sent || result.success
  }

  return sent
}

async function sendEscalationEmail(
  email: string | null,
  cronName: string,
  health: { consecutive_failures: number; last_failure_at: string | null; last_success_at: string | null },
  daysSinceSuccess: number,
): Promise<void> {
  if (!email) return

  const fromDomain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  try {
    const textBody = [
      `O cron "${cronName}" está com ${health.consecutive_failures} falhas consecutivas.`,
      '',
      `Último sucesso: ${health.last_success_at ?? 'nunca'}`,
      `Último erro: ${health.last_failure_at ?? 'desconhecido'}`,
      '',
      `Verifique em: ${appUrl}/cms/youtube/ab-lab`,
    ].join('\n')

    await getEmailService().send({
      from: { email: `alerts@${fromDomain}`, name: 'AB Lab Alerts' },
      to: email,
      subject: `⚠️ ${cronName} falhando há ${Math.floor(daysSinceSuccess)} dias`,
      html: `<p>${textBody.replace(/\n/g, '<br>')}</p>`,
      text: textBody,
    })
  } catch {
    // Silently fail — the in-app notification was already created
  }
}
