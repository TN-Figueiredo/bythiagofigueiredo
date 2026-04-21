import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { generateSlots } from '../../../../../lib/content-queue/slots'
import Link from 'next/link'
import { assignBlogToSlot, publishBlogNow, unslotBlogPost } from './actions'

export const dynamic = 'force-dynamic'

export default async function ContentQueuePage() {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // Fetch blog backlog (ready, not slotted)
  const { data: backlog } = await supabase
    .from('blog_posts')
    .select('id, status, queue_position, created_at, blog_translations(title, locale)')
    .eq('site_id', ctx.siteId)
    .in('status', ['ready', 'draft'])
    .is('slot_date', null)
    .order('queue_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(50)

  // Fetch queued/scheduled blog posts
  const { data: slotted } = await supabase
    .from('blog_posts')
    .select('id, status, slot_date, queue_position, blog_translations(title, locale)')
    .eq('site_id', ctx.siteId)
    .in('status', ['queued', 'scheduled'])
    .not('slot_date', 'is', null)
    .order('slot_date', { ascending: true })
    .limit(50)

  // Fetch newsletter editions in queue
  const { data: nlEditions } = await supabase
    .from('newsletter_editions')
    .select('id, subject, status, slot_date, newsletter_type_id')
    .eq('site_id', ctx.siteId)
    .in('status', ['ready', 'queued', 'scheduled'])
    .order('slot_date', { ascending: true, nullsFirst: false })
    .limit(50)

  // Fetch cadence configs
  const { data: blogCadences } = await supabase
    .from('blog_cadence')
    .select('*')
    .eq('site_id', ctx.siteId)

  const { data: nlTypes } = await supabase
    .from('newsletter_types')
    .select('id, name, locale, cadence_days, cadence_start_date, cadence_paused, last_sent_at')
    .eq('site_id', ctx.siteId)
    .eq('active', true)

  // Suppress unused variable warning — nlTypes is fetched for future use
  void nlTypes

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Content Queue</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Backlog */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Backlog</h2>
          {(backlog ?? []).length === 0 ? (
            <p className="text-gray-400 text-sm">No items in backlog. Mark posts as &quot;Ready&quot; to add them here.</p>
          ) : (
            <ul className="space-y-2">
              {(backlog ?? []).map((post) => {
                const translations = post.blog_translations as Array<{ title: string; locale: string }> | null
                const title = translations?.[0]?.title ?? 'Untitled'
                const locale = translations?.[0]?.locale
                const cadence = blogCadences?.find(c => c.locale === locale)
                return (
                  <li key={post.id} className="flex items-center justify-between rounded border p-3">
                    <div>
                      <Link href={`/cms/blog/${post.id}/edit`} className="font-medium text-orange-600 hover:underline text-sm">
                        {title}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">{post.status}</span>
                    </div>
                    <div className="flex gap-2">
                      {cadence ? (
                        <form action={async () => {
                          'use server'
                          const slots = generateSlots({
                            cadenceDays: cadence.cadence_days,
                            startDate: cadence.cadence_start_date ?? today,
                            lastSentAt: cadence.last_published_at ?? null,
                            paused: cadence.cadence_paused ?? false,
                          }, { today, count: 1 })
                          if (slots[0]) await assignBlogToSlot(post.id, slots[0])
                        }}>
                          <button className="text-xs text-gray-500 hover:text-blue-600" data-testid="assign-slot-btn">Assign slot</button>
                        </form>
                      ) : null}
                      <form action={async () => {
                        'use server'
                        await publishBlogNow(post.id)
                      }}>
                        <button className="text-xs text-gray-500 hover:text-orange-600" data-testid="publish-now-btn">Publish now</button>
                      </form>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Timeline */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Scheduled</h2>
          <ul className="space-y-2">
            {(slotted ?? []).map((post) => {
              const translations = post.blog_translations as Array<{ title: string; locale: string }> | null
              const title = translations?.[0]?.title ?? 'Untitled'
              return (
                <li key={post.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <span className="text-xs font-mono text-gray-400 mr-2">{post.slot_date}</span>
                    <Link href={`/cms/blog/${post.id}/edit`} className="font-medium text-sm">
                      {title}
                    </Link>
                  </div>
                  <form action={async () => {
                    'use server'
                    await unslotBlogPost(post.id)
                  }}>
                    <button className="text-xs text-gray-500 hover:text-red-600">Unslot</button>
                  </form>
                </li>
              )
            })}
            {(nlEditions ?? []).filter(e => e.slot_date).map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded border border-blue-100 p-3">
                <div>
                  <span className="text-xs font-mono text-gray-400 mr-2">{e.slot_date}</span>
                  <Link href={`/cms/newsletters/${e.id}/edit`} className="font-medium text-sm text-blue-600">
                    {e.subject}
                  </Link>
                  <span className="ml-2 text-xs text-blue-400">{e.newsletter_type_id}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
