import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listTemplates } from '@/lib/social/actions/templates'
import { getSocialDefaults, getQueueSlotConfig, saveQueueSlotConfig } from '@/lib/social/actions/settings'
import { TemplateMatrix } from './_components/template-matrix'
import { QueueSchedule } from './_components/queue-schedule'
import type { QueueSlotConfig } from '@/lib/social/queue'

export const dynamic = 'force-dynamic'

export default async function SettingsSocialPage() {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const [templatesResult, defaultsResult, queueSlotsResult] = await Promise.all([
    listTemplates(ctx.siteId),
    getSocialDefaults(ctx.siteId),
    getQueueSlotConfig(ctx.siteId),
  ])

  const templates = templatesResult.ok ? templatesResult.data : []
  const defaults = defaultsResult.ok ? defaultsResult.data : {}
  const queueSlots = queueSlotsResult.ok ? queueSlotsResult.data : {}

  async function handleSaveQueueSlots(config: QueueSlotConfig): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const result = await saveQueueSlotConfig(ctx.siteId, config)
    return result.ok ? { ok: true } : { ok: false, error: result.error }
  }

  return (
    <>
      <CmsTopbar title="Social Settings" />
      <div className="p-6 space-y-8">
        <TemplateMatrix
          siteId={ctx.siteId}
          templates={templates}
          defaults={defaults}
        />
        <hr className="border-cms-border" />
        <QueueSchedule
          initialConfig={queueSlots}
          onSave={handleSaveQueueSlots}
        />
      </div>
    </>
  )
}
