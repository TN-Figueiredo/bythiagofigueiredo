import Link from 'next/link'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Newsletter Archive',
}

export const dynamic = 'force-dynamic'

export default async function NewsletterArchiveListPage() {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: editions } = await supabase
    .from('newsletter_editions')
    .select('id, subject, sent_at, newsletter_types(name, color)')
    .eq('site_id', ctx.siteId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(100)

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Newsletter Archive</h1>

      {(editions ?? []).length === 0 ? (
        <p className="text-gray-500">No newsletters published yet.</p>
      ) : (
        <ul className="space-y-4">
          {(editions ?? []).map((e) => {
            const typeName = Array.isArray(e.newsletter_types)
              ? e.newsletter_types[0]?.name
              : (e.newsletter_types as { name: string } | null)?.name
            const typeColor = Array.isArray(e.newsletter_types)
              ? e.newsletter_types[0]?.color
              : (e.newsletter_types as { color: string } | null)?.color

            return (
              <li key={e.id}>
                <Link
                  href={`/newsletter/archive/${e.id}`}
                  className="block rounded-lg border p-4 hover:border-orange-400 transition-colors"
                  style={{ borderLeftColor: typeColor ?? '#C14513', borderLeftWidth: 4 }}
                >
                  <p className="text-sm text-gray-500 mb-1">
                    {typeName ?? 'Newsletter'} · {new Date(e.sent_at!).toLocaleDateString()}
                  </p>
                  <h2 className="font-semibold">{e.subject}</h2>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
