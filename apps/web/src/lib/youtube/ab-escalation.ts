import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createNotification } from '@/lib/notifications/create'
import { ResendEmailAdapter } from '@tn-figueiredo/email'

/**
 * Checks cron_health for 3+ consecutive days of failures and escalates:
 * 1. Creates a priority-1 in-app notification with email delivery
 * 2. Sends a direct email via Resend as a fallback
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

  // Get site admin user_id
  const { data: owner } = await supabase
    .from('site_users')
    .select('user_id')
    .eq('site_id', siteId)
    .eq('role', 'super_admin')
    .limit(1)
    .single()

  if (!owner) return false

  // Create high-priority in-app notification (with email channel)
  // The dedup_key prevents duplicate notifications on same day
  const result = await createNotification({
    site_id: siteId,
    user_id: owner.user_id,
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

  if (result.suppressed) return false

  // Direct Resend email as additional escalation path
  await sendEscalationEmail(owner.user_id, cronName, health, daysSinceSuccess)

  return result.success
}

async function sendEscalationEmail(
  userId: string,
  cronName: string,
  health: { consecutive_failures: number; last_failure_at: string | null; last_success_at: string | null },
  daysSinceSuccess: number,
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const supabase = getSupabaseServiceClient()

  // Use auth.admin API to get user email (auth.users not directly queryable)
  const { data: userData, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !userData?.user?.email) return

  const fromDomain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  try {
    const adapter = new ResendEmailAdapter(resendKey)

    const textBody = [
      `O cron "${cronName}" está com ${health.consecutive_failures} falhas consecutivas.`,
      '',
      `Último sucesso: ${health.last_success_at ?? 'nunca'}`,
      `Último erro: ${health.last_failure_at ?? 'desconhecido'}`,
      '',
      `Verifique em: ${appUrl}/cms/youtube/ab-lab`,
    ].join('\n')

    await adapter.send({
      from: { email: `alerts@${fromDomain}`, name: 'AB Lab Alerts' },
      to: userData.user.email,
      subject: `⚠️ ${cronName} falhando há ${Math.floor(daysSinceSuccess)} dias`,
      html: `<p>${textBody.replace(/\n/g, '<br>')}</p>`,
      text: textBody,
    })
  } catch {
    // Silently fail — the in-app notification was already created
  }
}
