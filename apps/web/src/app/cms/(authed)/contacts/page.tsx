import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { ContactsConnected, type ContactKpis } from './contacts-connected'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

interface Props {
  searchParams: Promise<{
    status?: string
    q?: string
    page?: string
  }>
}

export default async function CmsContactsPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId } = await getSiteContext()

  // RBAC: require at least view access
  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  // Reporters get read-only
  const editRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const readOnly = !editRes.ok

  const supabase = getSupabaseServiceClient()
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  // Fetch submissions and KPI data in parallel
  const [submissionsRes, totalRes, pendingRes, repliedRes, delta30dRes, avgResponseRes] =
    await Promise.all([
      // Main submissions query
      supabase
        .from('contact_submissions')
        .select(
          'id, name, email, message, submitted_at, replied_at, anonymized_at, ip, user_agent, consent_processing, consent_marketing',
        )
        .eq('site_id', siteId)
        .order('submitted_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),

      // Total count
      supabase
        .from('contact_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId),

      // Pending count + oldest
      supabase
        .from('contact_submissions')
        .select('submitted_at')
        .eq('site_id', siteId)
        .is('replied_at', null)
        .is('anonymized_at', null)
        .order('submitted_at', { ascending: true })
        .limit(1),

      // Replied count
      supabase
        .from('contact_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .not('replied_at', 'is', null),

      // 30-day delta: submissions in last 30 days
      supabase
        .from('contact_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .gte('submitted_at', new Date(Date.now() - 30 * 86400000).toISOString()),

      // Average response time (submissions with replied_at)
      supabase
        .from('contact_submissions')
        .select('submitted_at, replied_at')
        .eq('site_id', siteId)
        .not('replied_at', 'is', null)
        .is('anonymized_at', null)
        .order('replied_at', { ascending: false })
        .limit(100),
    ])

  const submissions = (submissionsRes.data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    email: s.email as string,
    message: s.message as string,
    submitted_at: s.submitted_at as string,
    replied_at: s.replied_at as string | null,
    anonymized_at: s.anonymized_at as string | null,
    ip: s.ip as string | null,
    user_agent: s.user_agent as string | null,
    consent_processing: s.consent_processing as boolean,
    consent_marketing: s.consent_marketing as boolean,
  }))

  const total = totalRes.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pendingCount = pendingRes.data?.length
    ? (await supabase
        .from('contact_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .is('replied_at', null)
        .is('anonymized_at', null)
      ).count ?? 0
    : 0
  const repliedCount = repliedRes.count ?? 0
  const totalDelta30d = delta30dRes.count ?? 0

  // Oldest pending days
  let oldestPendingDays: number | null = null
  if (pendingRes.data && pendingRes.data.length > 0 && pendingRes.data[0]) {
    const oldest = new Date(pendingRes.data[0].submitted_at as string)
    oldestPendingDays = Math.floor((Date.now() - oldest.getTime()) / 86400000)
  }

  // Reply rate
  const nonAnonymizedTotal = total - (submissions.filter((s) => s.anonymized_at).length > 0
    ? (await supabase
        .from('contact_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .not('anonymized_at', 'is', null)
      ).count ?? 0
    : 0)
  const replyRate = nonAnonymizedTotal > 0 ? (repliedCount / nonAnonymizedTotal) * 100 : 0

  // Avg response time
  let avgResponseHours: number | null = null
  if (avgResponseRes.data && avgResponseRes.data.length > 0) {
    const diffs = avgResponseRes.data.map((r) => {
      const submitted = new Date(r.submitted_at as string).getTime()
      const replied = new Date(r.replied_at as string).getTime()
      return (replied - submitted) / 3600000
    })
    avgResponseHours = diffs.reduce((a, b) => a + b, 0) / diffs.length
  }

  const kpis: ContactKpis = {
    total,
    totalDelta30d,
    pending: pendingCount,
    oldestPendingDays,
    replied: repliedCount,
    replyRate,
    avgResponseHours,
  }

  return (
    <div>
      <CmsTopbar
        title="Contacts"
        actions={
          <span className="text-xs text-slate-500">
            {total} total
          </span>
        }
      />
      <ContactsConnected
        submissions={submissions}
        kpis={kpis}
        readOnly={readOnly}
        page={page}
        totalPages={totalPages}
      />
    </div>
  )
}
