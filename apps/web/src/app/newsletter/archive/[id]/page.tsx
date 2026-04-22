import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('newsletter_editions')
    .select('subject')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .eq('status', 'sent')
    .maybeSingle()
  return { title: data?.subject ?? 'Newsletter' }
}

export default async function NewsletterArchivePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('subject, content_html, sent_at, newsletter_types(name, color)')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .eq('status', 'sent')
    .maybeSingle()

  if (!edition) return notFound()

  const rawType = edition.newsletter_types
  const newsletterType = Array.isArray(rawType)
    ? (rawType[0] as { name: string; color: string } | undefined) ?? null
    : (rawType as unknown as { name: string; color: string } | null)

  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <p className="text-sm text-gray-500 mb-1">
          {newsletterType?.name} · {new Date(edition.sent_at as string).toLocaleDateString()}
        </p>
        <h1 className="text-3xl font-bold">{edition.subject as string}</h1>
      </header>
      {edition.content_html ? (
        <div dangerouslySetInnerHTML={{ __html: edition.content_html as string }} />
      ) : (
        <p className="text-gray-400">Content not available.</p>
      )}
    </article>
  )
}
