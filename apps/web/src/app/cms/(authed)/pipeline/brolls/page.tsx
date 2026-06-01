import { Suspense } from 'react'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import { BRollLibrary } from './_components/broll-library'
import { BRollErrorBoundary } from './_components/broll-error-boundary'
import { BRollGridSkeleton } from './_components/broll-skeleton'

export const dynamic = 'force-dynamic'

export default async function BRollPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [assetsRes, totalRes, pessoalRes, genericoRes, readyRes, pendingRes] = await Promise.all([
    supabase.from('broll_assets').select('*').eq('site_id', siteId).order('created_at', { ascending: false }).limit(50),
    supabase.from('broll_assets').select('id', { count: 'exact', head: true }).eq('site_id', siteId),
    supabase.from('broll_assets').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('source_type', 'pessoal'),
    supabase.from('broll_assets').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('source_type', 'generico'),
    supabase.from('broll_assets').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'ready'),
    supabase.from('broll_assets').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'pending'),
  ])

  if (assetsRes.error) console.error('[broll] assets query:', assetsRes.error.message)

  const assets = (assetsRes.data ?? []) as BRollAssetRow[]
  const stats = {
    total: totalRes.count ?? 0,
    pessoal: pessoalRes.count ?? 0,
    generico: genericoRes.count ?? 0,
    ready: readyRes.count ?? 0,
    pending: pendingRes.count ?? 0,
  }

  return (
    <>
      <CmsTopbar title="Pipeline — B-Roll Library" />
      <div className="p-4 gem-pipeline-theme" style={{ height: 'calc(100vh - 6rem)', ...GEM_CSS_VARS } as React.CSSProperties}>
        <BRollErrorBoundary>
          <Suspense fallback={<div style={{ padding: 24 }}><BRollGridSkeleton /></div>}>
            <BRollLibrary initialAssets={assets} stats={stats} />
          </Suspense>
        </BRollErrorBoundary>
      </div>
    </>
  )
}
