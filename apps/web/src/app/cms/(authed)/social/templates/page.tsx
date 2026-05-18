import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listTemplates } from '@/lib/social/actions/templates'
import { TemplateGrid } from './_components/template-grid'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const result = await listTemplates(ctx.siteId)
  const templates = result.ok ? result.data : []

  return (
    <>
      <CmsTopbar title="Templates" />
      <div className="p-6">
        <TemplateGrid templates={templates} siteId={ctx.siteId} />
      </div>
    </>
  )
}
