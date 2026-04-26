'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { captureServerActionError } from '@/lib/sentry-wrap'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AD_APP_ID } from '@/lib/ads/config'

const PUBLISHER_ID_RE = /^pub-\d{10,16}$/

export async function savePublisherId(publisherId: string): Promise<void> {
  await requireArea('admin')

  if (!PUBLISHER_ID_RE.test(publisherId)) {
    throw new Error(
      `Invalid publisher ID format. Expected pub-XXXXXXXXXX, got: ${publisherId}`,
    )
  }

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('ad_network_settings').upsert(
    {
      app_id: AD_APP_ID,
      network: 'adsense',
      publisher_id: publisherId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'app_id,network' },
  )

  if (error) {
    captureServerActionError(error, { action: 'save_publisher_id' })
    throw new Error(error.message)
  }

  revalidateTag('ads')
  revalidatePath('/admin/settings/ads')
}
