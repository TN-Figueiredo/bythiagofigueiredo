import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getConnections } from '@/lib/social/actions'
import { getSocialStrings } from '../_i18n'
import { ComposerShell } from './_components/composer-shell'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ mode?: string }>
}

export default async function SocialComposerPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const mode = (['text', 'image', 'video'].includes(params.mode ?? '')
    ? params.mode
    : 'text') as 'text' | 'image' | 'video'

  const result = await getConnections(ctx.siteId)
  const connections = result.ok
    ? result.data.map((c) => ({ provider: c.provider, account_name: c.account_name }))
    : []

  return (
    <>
      <CmsTopbar title={t.composer.title} />
      <div className="p-6">
        <ComposerShell connections={connections} strings={t} initialMode={mode} />
      </div>
    </>
  )
}
