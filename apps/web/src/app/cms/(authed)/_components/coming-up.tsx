import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import Link from 'next/link'

type UpcomingItem = {
  id: string
  title: string
  date: string
  type: 'post' | 'newsletter'
  href: string
}

export async function ComingUp() {
  const supabase = getSupabaseServiceClient()
  const { siteId } = await getSiteContext()
  const today = new Date().toISOString().split('T')[0]

  const [postsRes, editionsRes] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('id, slot_date, blog_translations(title, locale)')
      .eq('site_id', siteId)
      .eq('status', 'queued')
      .gte('slot_date', today)
      .order('slot_date', { ascending: true })
      .limit(3),
    supabase
      .from('newsletter_editions')
      .select('id, scheduled_at, subject')
      .eq('site_id', siteId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(3),
  ])

  const items: UpcomingItem[] = [
    ...(postsRes.data ?? []).map((p) => {
      const translations = p.blog_translations as Array<{ title: string; locale: string }> | null
      return {
        id: p.id as string,
        title: translations?.[0]?.title ?? 'Untitled',
        date: (p.slot_date as string | null) ?? '',
        type: 'post' as const,
        href: `/cms/blog/${p.id}/edit`,
      }
    }),
    ...(editionsRes.data ?? []).map((e) => ({
      id: e.id as string,
      title: (e.subject as string | null) ?? 'Untitled',
      date: ((e.scheduled_at as string | null) ?? '').split('T')[0] ?? '',
      type: 'newsletter' as const,
      href: `/cms/newsletters/${e.id}/edit`,
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)

  if (items.length === 0) {
    return <p className="text-sm text-cms-text-dim">Nothing scheduled yet.</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`flex items-center gap-3 p-3 rounded-[var(--cms-radius)] bg-cms-bg border-l-[3px] hover:bg-cms-surface-hover transition-colors ${
            item.type === 'post' ? 'border-l-cms-accent' : 'border-l-cms-green'
          }`}
        >
          <span className="text-sm">{item.type === 'post' ? '📝' : '📰'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-cms-text truncate">{item.title}</div>
            <div className="text-[11px] text-cms-text-dim">{item.date}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
