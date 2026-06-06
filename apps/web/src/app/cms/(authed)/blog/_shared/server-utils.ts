import { revalidatePath, revalidateTag } from 'next/cache'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

export async function requireEditScope(siteId: string): Promise<void> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  }
}

export function revalidateBlogHub(siteId?: string): void {
  revalidateTag('blog-hub')
  revalidateTag('pipeline-blog')
  revalidateTag('sidebar-badges')
  revalidatePath('/cms/blog')
  if (siteId) revalidateTag(`sitemap:${siteId}`)
}

export function generateTagSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
