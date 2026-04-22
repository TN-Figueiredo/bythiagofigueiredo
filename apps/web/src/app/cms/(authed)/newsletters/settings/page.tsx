import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { updateCadence } from '../actions'
import { NewsletterSettings } from '@tn-figueiredo/newsletter-admin/client'
import type { NewsletterTypeSettings } from '@tn-figueiredo/newsletter-admin'

export const dynamic = 'force-dynamic'

export default async function NewsletterSettingsPage() {
  const supabase = getSupabaseServiceClient()
  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, locale, color, cadence_days, preferred_send_time, cadence_paused, sender_name, sender_email, reply_to')
    .eq('active', true)
    .order('sort_order')

  const settingsTypes: NewsletterTypeSettings[] = (types ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    locale: t.locale as string,
    color: (t.color as string) ?? '#ea580c',
    cadence_days: (t.cadence_days as number) ?? 7,
    preferred_send_time: (t.preferred_send_time as string) ?? '09:00',
    cadence_paused: (t.cadence_paused as boolean) ?? false,
    sender_name: t.sender_name as string | null,
    sender_email: t.sender_email as string | null,
    reply_to: t.reply_to as string | null,
  }))

  async function handleSave(typeId: string, data: { cadence_days: number; preferred_send_time: string; cadence_paused: boolean }) {
    'use server'
    await updateCadence(typeId, data)
  }

  return <NewsletterSettings types={settingsTypes} onSave={handleSave} />
}
