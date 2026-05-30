import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PreferencesClient } from './_components/preferences-client'
import type {
  NotificationDomain,
  ChannelKey,
  FrequencyPreset,
} from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Preferencias de notificacao',
}

export default async function NotificationsSettingsPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const userId = authRes.user.id

  const supabase = getSupabaseServiceClient()

  // Fetch profile (telegram), user email, and notification preferences in parallel
  const [profileRes, userRes, prefsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', userId)
      .maybeSingle(),
    supabase.auth.admin.getUserById(userId),
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('site_id', siteId),
  ])

  const chatId = profileRes.data?.telegram_chat_id ?? null
  const isConnected = Boolean(chatId)
  const userEmail = userRes.data?.user?.email ?? null

  // Parse saved preferences into structured shape
  const rows = prefsRes.data ?? []
  const globalRow = rows.find((r) => r.category === null)
  const catRows = rows.filter((r) => r.category !== null)

  const savedChannels: Record<ChannelKey, boolean> | null = globalRow
    ? {
        in_app: true,
        email: globalRow.channel_email,
        push: globalRow.channel_push,
        telegram: globalRow.channel_telegram,
      }
    : null

  const savedPreset: FrequencyPreset | null = globalRow
    ? (globalRow.frequency_mode as FrequencyPreset)
    : null

  const savedCategories: Record<
    NotificationDomain,
    Record<ChannelKey, boolean>
  > | null =
    catRows.length > 0
      ? (Object.fromEntries(
          catRows.map((r) => [
            r.category as NotificationDomain,
            {
              in_app: r.channel_in_app,
              email: r.channel_email,
              push: r.channel_push,
              telegram: r.channel_telegram,
            },
          ])
        ) as Record<NotificationDomain, Record<ChannelKey, boolean>>)
      : null

  const savedQuiet = globalRow
    ? {
        enabled: globalRow.quiet_hours_enabled,
        start: globalRow.quiet_hours_start as string,
        end: globalRow.quiet_hours_end as string,
      }
    : null

  return (
    <>
      <CmsTopbar title="Preferencias" />
      <div className="p-6">
        <PreferencesClient
          userId={userId}
          isConnected={isConnected}
          chatId={chatId}
          userEmail={userEmail}
          savedChannels={savedChannels}
          savedPreset={savedPreset}
          savedCategories={savedCategories}
          savedQuiet={savedQuiet}
        />
      </div>
    </>
  )
}
