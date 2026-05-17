import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { MediaLibraryPage as MediaLibraryClient } from './media-library-page'

export const dynamic = 'force-dynamic'

export default async function MediaPage() {
  const { siteId, defaultLocale } = await getSiteContext()
  const locale = (defaultLocale === 'pt-BR' ? 'pt-BR' : 'en') as 'en' | 'pt-BR'

  return (
    <div>
      <CmsTopbar title={locale === 'pt-BR' ? 'Mídia' : 'Media'} />
      <MediaLibraryClient locale={locale} siteId={siteId} />
    </div>
  )
}
