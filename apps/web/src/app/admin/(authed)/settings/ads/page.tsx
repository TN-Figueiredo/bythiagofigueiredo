import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AD_APP_ID } from '@/lib/ads/config'
import { savePublisherId } from './_actions'

export const dynamic = 'force-dynamic'

export default async function AdSenseSettingsPage() {
  await requireArea('admin')
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('ad_network_settings')
    .select('publisher_id, connected_at')
    .eq('app_id', AD_APP_ID)
    .eq('network', 'adsense')
    .maybeSingle()

  const row = data as { publisher_id?: string; connected_at?: string } | null
  const currentPublisherId = row?.publisher_id ?? ''

  return (
    <div className="space-y-6 p-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Google AdSense</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure o Publisher ID para exibir anuncios do AdSense.
        </p>
      </div>

      <div className="rounded border border-border p-4 space-y-2">
        <p className="text-sm font-medium">Status</p>
        <p className="text-sm text-muted-foreground">
          {currentPublisherId
            ? `Conectado: ${currentPublisherId}`
            : 'Nao conectado'}
        </p>
      </div>

      <form
        action={async (formData: FormData) => {
          'use server'
          const id = (formData.get('publisher_id') as string | null)?.trim() ?? ''
          await savePublisherId(id)
        }}
        className="space-y-4"
      >
        <div className="space-y-1">
          <label
            htmlFor="publisher_id"
            className="text-sm font-medium"
          >
            Publisher ID
          </label>
          <input
            id="publisher_id"
            name="publisher_id"
            type="text"
            defaultValue={currentPublisherId}
            placeholder="pub-0000000000000000"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Formato: pub-XXXXXXXXXX (10-16 digitos)
          </p>
        </div>
        <button
          type="submit"
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Salvar
        </button>
      </form>

      <div className="rounded border border-border p-4 space-y-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">OAuth routes (Sprint 8.5)</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>GET /api/adsense/authorize -- redirect to Google OAuth</li>
          <li>GET /api/adsense/callback -- handle OAuth code exchange</li>
          <li>POST /api/adsense/disconnect -- revoke token + clear settings</li>
          <li>GET /api/adsense/status -- check connection status</li>
        </ul>
      </div>
    </div>
  )
}
