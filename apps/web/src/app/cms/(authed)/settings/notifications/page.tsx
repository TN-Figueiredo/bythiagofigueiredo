import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { TelegramConnect } from './_components/telegram-connect'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Notification Settings',
}

export default async function NotificationsSettingsPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const userId = authRes.user.id

  const supabase = getSupabaseServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', userId)
    .maybeSingle()

  const chatId = profile?.telegram_chat_id ?? null
  const isConnected = Boolean(chatId)

  return (
    <>
      <CmsTopbar title="Notification Settings" />
      <div className="p-6 max-w-lg space-y-6">
        <div>
          <h2 className="text-base font-semibold text-cms-text">Telegram</h2>
          <p className="mt-1 text-sm text-cms-text-muted">
            Connect your Telegram account to receive story-ready notifications.
          </p>
        </div>
        <TelegramConnect
          userId={userId}
          isConnected={isConnected}
          chatId={chatId}
        />
      </div>
    </>
  )
}
