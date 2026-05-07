import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { MediaLibraryConnected } from './media-library-connected'

export default async function MediaLibraryPage() {
  const { siteId, defaultLocale } = await getSiteContext()
  const locale = (defaultLocale === 'pt-BR' ? 'pt-BR' : 'en') as 'en' | 'pt-BR'

  return (
    <div>
      <CmsTopbar title={locale === 'pt-BR' ? 'Mídia' : 'Media'} />
      <MediaLibraryConnected locale={locale} siteId={siteId} />
    </div>
  )
}
