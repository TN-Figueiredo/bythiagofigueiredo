import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { ScheduleConnected } from './schedule-connected'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface SchedulePost {
  id: string
  title: string
  status: string
  slot_date: string | null
  queue_position: number | null
  published_at: string | null
  author_name: string | null
}

export interface ScheduleEdition {
  id: string
  subject: string
  status: string
  slot_date: string | null
  queue_position: number | null
  scheduled_at: string | null
  newsletter_type_name: string | null
}

/* ------------------------------------------------------------------ */
/*  Data loader                                                       */
/* ------------------------------------------------------------------ */

async function ScheduleData() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const editRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const readOnly = !editRes.ok

  const supabase = getSupabaseServiceClient()

  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const cutoff = thirtyDaysFromNow.toISOString().split('T')[0]!
  const today = new Date().toISOString().split('T')[0]!

  const [
    scheduledPostsRes,
    backlogPostsRes,
    scheduledEditionsRes,
    backlogEditionsRes,
  ] = await Promise.all([
    // Scheduled posts (next 30 days)
    supabase
      .from('blog_posts')
      .select(`
        id,
        status,
        slot_date,
        queue_position,
        published_at,
        blog_translations!inner(title),
        authors!inner(name)
      `)
      .eq('site_id', siteId)
      .not('slot_date', 'is', null)
      .lte('slot_date', cutoff)
      .in('status', ['queued', 'ready'])
      .order('slot_date'),

    // Backlog posts (ready, no slot)
    supabase
      .from('blog_posts')
      .select(`
        id,
        status,
        slot_date,
        queue_position,
        published_at,
        blog_translations!inner(title),
        authors!inner(name)
      `)
      .eq('site_id', siteId)
      .eq('status', 'ready')
      .is('slot_date', null)
      .order('queue_position', { ascending: true, nullsFirst: false }),

    // Scheduled editions (next 30 days)
    supabase
      .from('newsletter_editions')
      .select(`
        id,
        subject,
        status,
        slot_date,
        queue_position,
        scheduled_at,
        newsletter_types!inner(name)
      `)
      .eq('site_id', siteId)
      .not('slot_date', 'is', null)
      .lte('slot_date', cutoff)
      .in('status', ['queued', 'ready', 'scheduled'])
      .order('slot_date'),

    // Backlog editions (ready, no slot)
    supabase
      .from('newsletter_editions')
      .select(`
        id,
        subject,
        status,
        slot_date,
        queue_position,
        scheduled_at,
        newsletter_types!inner(name)
      `)
      .eq('site_id', siteId)
      .eq('status', 'ready')
      .is('slot_date', null)
      .order('queue_position', { ascending: true, nullsFirst: false }),
  ])

  // Map raw data to typed arrays
  const mapPost = (row: Record<string, unknown>): SchedulePost => {
    const translations = row.blog_translations as
      | { title: string }[]
      | { title: string }
      | null
    const author = row.authors as { name: string } | null
    const title = Array.isArray(translations)
      ? translations[0]?.title ?? 'Untitled'
      : (translations as { title: string } | null)?.title ?? 'Untitled'
    return {
      id: row.id as string,
      title,
      status: row.status as string,
      slot_date: row.slot_date as string | null,
      queue_position: row.queue_position as number | null,
      published_at: row.published_at as string | null,
      author_name: author?.name ?? null,
    }
  }

  const mapEdition = (row: Record<string, unknown>): ScheduleEdition => {
    const nlType = row.newsletter_types as { name: string } | null
    return {
      id: row.id as string,
      subject: row.subject as string,
      status: row.status as string,
      slot_date: row.slot_date as string | null,
      queue_position: row.queue_position as number | null,
      scheduled_at: row.scheduled_at as string | null,
      newsletter_type_name: nlType?.name ?? null,
    }
  }

  const scheduledPosts = (scheduledPostsRes.data ?? []).map(mapPost)
  const backlogPosts = (backlogPostsRes.data ?? []).map(mapPost)
  const scheduledEditions = (scheduledEditionsRes.data ?? []).map(mapEdition)
  const backlogEditions = (backlogEditionsRes.data ?? []).map(mapEdition)

  return (
    <ScheduleConnected
      scheduledPosts={scheduledPosts}
      backlogPosts={backlogPosts}
      scheduledEditions={scheduledEditions}
      backlogEditions={backlogEditions}
      today={today}
      readOnly={readOnly}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  Skeleton fallback                                                 */
/* ------------------------------------------------------------------ */

function ScheduleSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-[#0f172a]">
      {/* Backlog sidebar skeleton */}
      <div className="w-64 shrink-0 border-r border-slate-700 p-4">
        <div className="mb-4 h-6 w-24 animate-pulse rounded bg-slate-700" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="mb-3 h-16 animate-pulse rounded-lg bg-slate-800"
          />
        ))}
      </div>
      {/* Calendar grid skeleton */}
      <div className="flex-1 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-8 w-40 animate-pulse rounded bg-slate-700" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-20 animate-pulse rounded bg-slate-700"
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-slate-800"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function SchedulePage() {
  return (
    <div>
      <CmsTopbar title="Schedule" />
      <Suspense fallback={<ScheduleSkeleton />}>
        <ScheduleData />
      </Suspense>
    </div>
  )
}
