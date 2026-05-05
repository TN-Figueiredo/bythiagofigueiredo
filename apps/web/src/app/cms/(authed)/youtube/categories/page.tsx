import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CategoriesConnected, type CategoryRow } from './categories-connected'

export const dynamic = 'force-dynamic'

export default async function YouTubeCategoriesPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const { data: rawCategories } = await supabase
    .from('youtube_categories')
    .select(
      'id, slug, name_pt, name_en, description_pt, description_en, color, match_keywords, auto_approve, sort_order',
    )
    .eq('site_id', siteId)
    .order('sort_order', { ascending: true })

  const categories: CategoryRow[] = (rawCategories ?? []).map((c) => ({
    id: c.id as string,
    slug: c.slug as string,
    namePt: c.name_pt as string,
    nameEn: c.name_en as string,
    descriptionPt: (c.description_pt as string | null) ?? null,
    descriptionEn: (c.description_en as string | null) ?? null,
    color: c.color as string,
    matchKeywords: (c.match_keywords as string[]) ?? [],
    autoApprove: (c.auto_approve as boolean) ?? false,
    sortOrder: (c.sort_order as number) ?? 0,
  }))

  return (
    <div className="flex flex-col gap-6">
      <CategoriesConnected categories={categories} />
    </div>
  )
}
