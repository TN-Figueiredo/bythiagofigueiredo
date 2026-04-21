import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { updateCadence } from '../actions'

export const dynamic = 'force-dynamic'

export default async function NewsletterSettingsPage() {
  const supabase = getSupabaseServiceClient()
  const { data: types } = await supabase
    .from('newsletter_types')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Newsletter Settings</h1>

      {(types ?? []).map((t) => (
        <section key={t.id} className="rounded-lg border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color as string }} />
            <h2 className="text-lg font-semibold">{t.name as string}</h2>
            <span className="text-sm text-gray-400">{t.locale as string}</span>
            {(t.cadence_paused as boolean) && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Paused</span>
            )}
          </div>

          <form
            action={async (formData: FormData) => {
              'use server'
              await updateCadence(t.id as string, {
                cadence_days: parseInt(formData.get('cadence_days') as string, 10),
                preferred_send_time: formData.get('preferred_send_time') as string,
                cadence_paused: formData.get('cadence_paused') === 'true',
              })
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Cadence (days)</label>
              <input
                name="cadence_days"
                type="number"
                min={1}
                max={365}
                defaultValue={t.cadence_days as number}
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Send time</label>
              <input
                name="preferred_send_time"
                type="time"
                defaultValue={(t.preferred_send_time as string) ?? '09:00'}
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Paused</label>
              <select
                name="cadence_paused"
                defaultValue={String(t.cadence_paused)}
                className="w-full rounded border px-3 py-2"
              >
                <option value="false">Active</option>
                <option value="true">Paused</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <p className="text-xs text-gray-400 mb-2">
                Sender: {(t.sender_name as string) ?? 'Thiago Figueiredo'} &lt;
                {(t.sender_email as string) ?? 'newsletter@bythiagofigueiredo.com'}&gt;
                {(t.reply_to as string) && ` · Reply-to: ${t.reply_to as string}`}
              </p>
              <button
                type="submit"
                className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
              >
                Save
              </button>
            </div>
          </form>
        </section>
      ))}
    </div>
  )
}
