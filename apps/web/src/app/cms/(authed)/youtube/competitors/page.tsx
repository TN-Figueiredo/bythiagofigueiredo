import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { DEFAULT_CHANNEL_LIMIT, UNLOCK_STEP } from '@/lib/youtube/competitor-slots'
import { loadRows, rowsToDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { createObservatory } from '@/lib/youtube/observatorio'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { ObservatoryChromeServer } from './_chrome/chrome-server'
import type { ObsSearchParams } from './_chrome/resolve-niche'
import { CanaisScreen } from './_canais/canais-screen'
import { buildCanaisView } from './_canais/view-model'
import { addChannelFromCanais, removeCompetitorChannel, syncCompetitorNow, unlockMoreChannels } from './actions'
import { getUserNiche, setChannelNiche } from './niche-actions'

export const metadata = { title: 'Competidores' }
export const dynamic = 'force-dynamic'
/** "Sincronizar concorrentes" (chrome) runs under the page's limit: every Observatório page keeps 60 s. */
export const maxDuration = 60

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** "+25" is for admins only: site_users.role ∈ {super_admin, org_admin} (unlockMoreChannels checks it again). */
async function canUnlockChannels(siteId: string): Promise<boolean> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return false
  const { data } = await getSupabaseServiceClient().from('site_users').select('role').eq('site_id', siteId).eq('user_id', res.user.id).maybeSingle()
  return !!data && ['super_admin', 'org_admin'].includes(data.role as string)
}

/** Canais (port of canais.html) inside the Observatório chrome. */
export default async function CompetitorsPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const { siteId } = await getSiteContext()
  const now = observatoryNow()
  const [rows, canUnlock] = await Promise.all([loadRows({ siteId, now }), canUnlockChannels(siteId)])
  const obs = createObservatory(rowsToDataset(rows, now))
  // The chrome persists a valid ?niche= and drops an invalid one; here it is only read.
  const niche = parseNiche(one(sp.niche)) ?? await getUserNiche()
  const view = buildCanaisView(obs, {
    niche, limit: rows.settings?.channel_limit ?? DEFAULT_CHANNEL_LIMIT, unlockStep: UNLOCK_STEP,
    channel: one(sp.channel), tab: one(sp.tab), add: one(sp.add), filter: one(sp.filter), scale: one(sp.scale), fmt: one(sp.fmt),
    layout: one(sp.layout), sort: one(sp.sort), dir: one(sp.dir), nicheEditor: one(sp.nicheEditor),
  })
  return (
    <ObservatoryChromeServer tab="canais" searchParams={sp} obs={obs}>
      <CanaisScreen
        view={view} canUnlock={canUnlock}
        onAdd={addChannelFromCanais} onRemove={removeCompetitorChannel} onUnlock={unlockMoreChannels}
        onSetNiche={setChannelNiche} onSyncOne={syncCompetitorNow}
      />
    </ObservatoryChromeServer>
  )
}
