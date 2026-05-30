/**
 * Notification system types.
 * Maps 1:1 to the notifications / notification_preferences DB tables.
 */

export type NotificationDomain =
  | 'pipeline'
  | 'youtube'
  | 'newsletter'
  | 'social'
  | 'links'
  | 'blog'
  | 'media'
  | 'system'

export type FrequencyPreset = 'calm' | 'regular' | 'power'

export type ChannelKey = 'in_app' | 'email' | 'push' | 'telegram'

export interface INotification {
  id: string
  site_id: string
  user_id: string | null
  type: string
  domain: NotificationDomain
  priority: 1 | 2 | 3 | 4 | 5
  title: string
  message: string | null
  payload: Record<string, unknown> | null
  dedup_key: string | null
  group_key: string | null
  read_at: string | null
  dismissed_at: string | null
  expired_at: string | null
  snoozed_until: string | null
  suggested_action: string | null
  action_href: string | null
  created_at: string
}

export interface INotificationPreferences {
  id: string
  user_id: string
  site_id: string
  category: NotificationDomain | null // null = global defaults
  channel_in_app: boolean
  channel_email: boolean
  channel_push: boolean
  channel_telegram: boolean
  frequency_preset: FrequencyPreset
  quiet_hours_enabled: boolean
  quiet_hours_start: string // HH:MM
  quiet_hours_end: string // HH:MM
  quiet_hours_timezone: string
  email_consent_at: string | null
  push_consent_at: string | null
  updated_at: string
}

/** Channel metadata for rendering the channels grid */
export interface ChannelMeta {
  key: ChannelKey
  label: string
  icon: string
  description: string
}

/** Frequency preset metadata */
export interface PresetMeta {
  key: FrequencyPreset
  label: string
  subtitle: string
  description: string
}

// --- Channel adapter interface (server-side) ---

export interface ChannelResult {
  success: boolean
  error?: string
}

export interface IChannelAdapter {
  channel: 'email' | 'push' | 'telegram'
  send(notification: INotification, user: IUserProfile): Promise<ChannelResult>
  healthCheck(): Promise<boolean>
}

export interface IUserProfile {
  id: string
  email: string | null
  telegram_chat_id: string | null
}

// --- Delivery row (maps to notification_deliveries table) ---

export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'dead'
export type DeliveryChannel = 'email' | 'push' | 'telegram'

export interface INotificationDelivery {
  id: string
  notification_id: string
  channel: DeliveryChannel
  status: DeliveryStatus
  attempts: number
  next_retry_at: string | null
  last_error: string | null
  sent_at: string | null
  created_at: string
}

// --- State management (useReducer + Context) ---

export interface NotificationState {
  items: INotification[]
  unreadCount: number
  hasCritical: boolean
  lastReceived: string | null  // ISO timestamp for gap recovery
  isRecovering: boolean
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected'
}

export type NotificationAction =
  | { type: 'SET_INITIAL'; items: INotification[]; lastReceived: string | null }
  | { type: 'ADD'; item: INotification }
  | { type: 'MARK_READ'; id: string }
  | { type: 'MARK_UNREAD'; id: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'DISMISS'; id: string }
  | { type: 'BULK_DISMISS'; ids: string[] }
  | { type: 'RECOVERY_START' }
  | { type: 'RECOVERY_COMPLETE'; items: INotification[] }
  | { type: 'CONNECTION_STATUS'; status: NotificationState['connectionStatus'] }
  | { type: 'REVERT_READ'; id: string }
  | { type: 'REVERT_DISMISS'; id: string; item: INotification }

// --- notification_types reference row ---

export interface INotificationType {
  type: string
  domain: NotificationDomain
  priority: 1 | 2 | 3 | 4 | 5
  min_role: string
  title_template: string
  description: string | null
  dedup_key: string | null
  group_key: string | null
  cooldown_secs: number | null
  phase: 1 | 2
}

// --- Push subscription row ---

export interface IPushSubscription {
  id: string
  user_id: string
  site_id: string
  endpoint: string
  p256dh: string
  auth: string
  device_label: string | null
  failure_count: number
  created_at: string
}

// --- Telegram connection token row ---

export interface ITelegramConnectionToken {
  id: string
  user_id: string
  site_id: string
  token: string
  expires_at: string
  used_at: string | null
  created_at: string
}
