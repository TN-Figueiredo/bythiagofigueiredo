import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PreferencesClient } from './_components/preferences-client'

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
  const { data: profile } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', userId)
    .maybeSingle()

  const chatId = profile?.telegram_chat_id ?? null
  const isConnected = Boolean(chatId)

  return (
    <>
      <CmsTopbar title="Preferencias" />
      <div className="p-6">
        <PreferencesClient
          userId={userId}
          isConnected={isConnected}
          chatId={chatId}
        />
      </div>
    </>
  )
}
