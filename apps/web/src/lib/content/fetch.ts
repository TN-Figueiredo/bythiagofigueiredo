import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function getPageContent<T extends Record<string, string>>(
  siteId: string,
  page: string,
  locale: string,
  defaults: { en: T; pt: T },
): Promise<T> {
  const fetcher = unstable_cache(
    async () => {
      const supabase = getSupabaseServiceClient()
      const { data: rows } = await supabase
        .from('page_content')
        .select('locale, content')
        .eq('site_id', siteId)
        .eq('page', page)
        .in('locale', ['en', 'pt-BR'])

      const en = (rows?.find((r) => r.locale === 'en')?.content as Partial<T>) ?? {}
      const target =
        locale === 'pt-BR'
          ? ((rows?.find((r) => r.locale === 'pt-BR')?.content as Partial<T>) ?? {})
          : en

      const base = locale === 'pt-BR' ? defaults.pt : defaults.en
      return { ...base, ...en, ...target } as T
    },
    ['page-content', page, siteId, locale],
    { tags: [`page-content:${page}`], revalidate: 3600 },
  )

  return fetcher()
}
