import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listTemplates } from '@/lib/social/actions/templates'
import { getSocialDefaults } from '@/lib/social/actions/settings'
import { TemplateMatrix } from './_components/template-matrix'

export const dynamic = 'force-dynamic'

export default async function SettingsSocialPage() {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const [templatesResult, defaultsResult] = await Promise.all([
    listTemplates(ctx.siteId),
    getSocialDefaults(ctx.siteId),
  ])

  const templates = templatesResult.ok ? templatesResult.data : []
  const defaults = defaultsResult.ok ? defaultsResult.data : {}

  return (
    <>
      <CmsTopbar title="Social Settings" />
      <div className="p-6 space-y-8">
        <TemplateMatrix
          siteId={ctx.siteId}
          templates={templates}
          defaults={defaults}
        />
      </div>
    </>
  )
}
