import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'

export default async function BlogIndex() {
  const ctx = await getSiteContext()
  redirect(`/blog/${ctx.defaultLocale}`)
}
