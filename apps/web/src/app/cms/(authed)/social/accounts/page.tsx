import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getConnections, disconnectSocial } from '@/lib/social/actions'
import { getSocialStrings } from '../_i18n'
import { ConnectionsGrid } from './_components/connections-grid'
import { AutomationsList } from './_components/automations-list'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function SocialAccountsPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const tab = params.tab ?? 'connections'

  const result = await getConnections(ctx.siteId)
  const connections = result.ok ? result.data : []

  return (
    <>
      <CmsTopbar title={t.accounts.title} />
      <div className="p-6 space-y-6">
        <div className="flex gap-2 border-b border-cms-border pb-2">
          <a
            href="/cms/social/accounts"
            className={`px-3 py-1.5 text-sm font-medium ${tab === 'connections' ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
          >
            {t.accounts.tabs.connections}
          </a>
          <a
            href="/cms/social/accounts?tab=automations"
            className={`px-3 py-1.5 text-sm font-medium ${tab === 'automations' ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
          >
            {t.accounts.tabs.automations}
          </a>
        </div>
        {tab === 'connections' && (
          <ConnectionsGrid connections={connections} siteId={ctx.siteId} strings={t} onDisconnect={disconnectSocial} />
        )}
        {tab === 'automations' && (
          <AutomationsList strings={t} />
        )}
      </div>
    </>
  )
}
