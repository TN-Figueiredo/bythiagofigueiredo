import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { NotificationCreateSchema, type NotificationCreateInput } from './schemas'
import type { INotification, DeliveryChannel } from './types'

const RATE_LIMIT_MAX = 100 // max notifications per user per hour

export interface CreateNotificationResult {
  success: boolean
  notificationId?: string
  suppressed?: boolean
  error?: string
}

/**
 * Creates a notification and enqueues delivery rows for enabled channels.
 *
 * Flow (Spec Section 1.3):
 * 1. Zod validation (NotificationCreateSchema)
 * 2. Self-action suppression check
 * 3. Atomic rate limit check (max 100/user/hour)
 * 4. Cooldown / dedup check
 * 5. INSERT notification row (triggers Realtime for in-app)
 * 6. INSERT delivery rows per enabled channel
 *
 * Uses service role client — this function runs server-side only.
 */
export async function createNotification(
  input: NotificationCreateInput
): Promise<CreateNotificationResult> {
  // 1. Zod validation
  const parsed = NotificationCreateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    }
  }
  const data = parsed.data

  // 2. Self-action suppression
  if (data.actor_id && data.actor_id === data.user_id) {
    return { success: true, suppressed: true }
  }

  const supabase = getSupabaseServiceClient()

  // 3. Rate limit check
  const { data: recentCount, error: rateErr } = await supabase.rpc(
    'count_recent_notifications',
    { p_user_id: data.user_id, p_interval: '1 hour' }
  )

  if (rateErr) {
    // If RPC doesn't exist yet, fall back to inline query
    const { count, error: countErr } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', data.user_id)
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString())

    if (!countErr && (count ?? 0) >= RATE_LIMIT_MAX) {
      return { success: false, error: `rate limit exceeded (${RATE_LIMIT_MAX}/hour)` }
    }
  } else if (typeof recentCount === 'number' && recentCount >= RATE_LIMIT_MAX) {
    return { success: false, error: `rate limit exceeded (${RATE_LIMIT_MAX}/hour)` }
  }

  // 4. Cooldown / dedup check via dedup_key
  // The UNIQUE partial index idx_notifications_dedup handles dedup at DB level.
  // Cooldown is checked if notification_types has a cooldown_secs value.
  if (data.dedup_key) {
    const { data: typeRow } = await supabase
      .from('notification_types')
      .select('cooldown_secs')
      .eq('type', data.type)
      .single()

    if (typeRow?.cooldown_secs) {
      const cooldownThreshold = new Date(
        Date.now() - typeRow.cooldown_secs * 1000
      ).toISOString()

      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', data.user_id)
        .eq('site_id', data.site_id)
        .eq('dedup_key', data.dedup_key)
        .gte('created_at', cooldownThreshold)
        .limit(1)

      if (existing && existing.length > 0) {
        return { success: true, suppressed: true }
      }
    }
  }

  // 5. INSERT notification row
  const { data: inserted, error: insertErr } = await supabase
    .from('notifications')
    .insert({
      site_id: data.site_id,
      user_id: data.user_id,
      type: data.type,
      domain: data.domain,
      priority: data.priority,
      title: data.title,
      message: data.message ?? null,
      payload: data.payload ?? null,
      dedup_key: data.dedup_key ?? null,
      group_key: data.group_key ?? null,
      suggested_action: data.suggested_action ?? null,
      action_href: data.action_href ?? null,
    })
    .select()
    .single()

  if (insertErr) {
    // Dedup unique constraint violation = silent success
    if (insertErr.message?.includes('idx_notifications_dedup')) {
      return { success: true, suppressed: true }
    }
    return { success: false, error: insertErr.message }
  }

  const notificationId = (inserted as INotification).id

  // 6. Determine channels and INSERT delivery rows
  const channelsToDeliver = await resolveChannels(supabase, data)

  if (channelsToDeliver.length > 0) {
    const deliveryRows = channelsToDeliver.map((channel) => ({
      notification_id: notificationId,
      channel,
      status: 'pending' as const,
      attempts: 0,
      next_retry_at: new Date().toISOString(),
    }))

    await supabase.from('notification_deliveries').insert(deliveryRows)
  }

  return { success: true, notificationId }
}

/**
 * Resolve which channels a notification should be delivered to.
 * Checks user preferences and explicit channel overrides.
 */
async function resolveChannels(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  data: NotificationCreateInput
): Promise<DeliveryChannel[]> {
  // If explicit channels provided, use those
  if (data.channels && data.channels.length > 0) {
    return data.channels
  }

  // Look up user preferences for this domain
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('channel_email, channel_push, channel_telegram')
    .eq('user_id', data.user_id)
    .eq('site_id', data.site_id)
    .is('category', null) // global defaults
    .maybeSingle()

  if (!prefs) return [] // No preferences = in-app only (no external delivery)

  const channels: DeliveryChannel[] = []
  if (prefs.channel_email) channels.push('email')
  if (prefs.channel_push) channels.push('push')
  if (prefs.channel_telegram) channels.push('telegram')

  // Also check domain-specific preferences (override global)
  const { data: domainPrefs } = await supabase
    .from('notification_preferences')
    .select('channel_email, channel_push, channel_telegram')
    .eq('user_id', data.user_id)
    .eq('site_id', data.site_id)
    .eq('category', data.domain)
    .maybeSingle()

  if (domainPrefs) {
    // Domain-specific overrides: only deliver if both global AND domain are enabled
    const finalChannels: DeliveryChannel[] = []
    if (prefs.channel_email && domainPrefs.channel_email) finalChannels.push('email')
    if (prefs.channel_push && domainPrefs.channel_push) finalChannels.push('push')
    if (prefs.channel_telegram && domainPrefs.channel_telegram) finalChannels.push('telegram')
    return finalChannels
  }

  return channels
}
