import { getSiteContext } from '@/lib/cms/site-context'
import { NewPostEditor } from './new-post-editor'

export const dynamic = 'force-dynamic'

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await getSiteContext()
  const sp = await searchParams
  const locale = typeof sp?.locale === 'string' ? sp.locale : ctx.defaultLocale
  const tagId = typeof sp?.tag === 'string' ? sp.tag : undefined

  return <NewPostEditor locale={locale} tagId={tagId} defaultLocale={ctx.defaultLocale} />
}
