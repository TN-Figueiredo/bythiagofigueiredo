import { notFound } from 'next/navigation'
import { campaignRepo } from '../../../../../../lib/cms/repositories'
import { getSiteContext } from '../../../../../../lib/cms/site-context'
import {
  saveCampaign,
  publishCampaign,
  unpublishCampaign,
  archiveCampaign,
  deleteCampaign,
  type SaveCampaignPatch,
  type SaveCampaignTranslationPatch,
} from './actions'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditCampaignPage({ params }: Props) {
  const { id } = await params
  const campaign = await campaignRepo().getById(id)
  if (!campaign) notFound()
  const ctx = await getSiteContext()
  if (campaign.site_id !== ctx.siteId) {
    // Cross-ring access: surface as 404 to avoid leaking existence.
    notFound()
  }

  const primary = campaign.translations[0]
  const label = primary?.meta_title ?? primary?.slug ?? campaign.interest

  // FIXME: wire full CampaignEditor once T30 ships (parallel agent is building
  // `packages/cms/src/editor/campaign-*`). Once exported from @tn-figueiredo/cms,
  // replace the placeholder below and pass:
  //   onSave={async (patch, translations) => saveCampaign(id, patch, translations)}
  const onSave = async (
    patch: SaveCampaignPatch,
    translations: SaveCampaignTranslationPatch[],
  ) => {
    'use server'
    return saveCampaign(id, patch, translations)
  }
  // Suppress unused-var lint — onSave is the wired callback for the future editor.
  void onSave

  return (
    <main>
      <header>
        <h1>Editando campanha: {label}</h1>
        <p>
          Status: <span data-status={campaign.status}>{campaign.status}</span>
        </p>
      </header>

      {/* FIXME: wire full CampaignEditor once T30 ships */}
      <div role="region" aria-label="CampaignEditor placeholder">
        CampaignEditor TBD — will mount @tn-figueiredo/cms CampaignEditor and
        invoke saveCampaign(id, patch, translations) on save.
      </div>

      <section aria-label="Translations">
        <h2>Traduções</h2>
        <ul>
          {campaign.translations.map((tx) => (
            <li key={tx.id}>
              <strong>{tx.locale}</strong> — {tx.slug}
              {tx.meta_title ? ` — ${tx.meta_title}` : ''}
            </li>
          ))}
        </ul>
      </section>

      <div>
        {campaign.status !== 'published' && (
          <form
            action={async () => {
              'use server'
              await publishCampaign(id)
            }}
          >
            <button type="submit">Publicar</button>
          </form>
        )}
        {campaign.status === 'published' && (
          <form
            action={async () => {
              'use server'
              await unpublishCampaign(id)
            }}
          >
            <button type="submit">Despublicar</button>
          </form>
        )}
        {campaign.status !== 'archived' && (
          <form
            action={async () => {
              'use server'
              await archiveCampaign(id)
            }}
          >
            <button type="submit">Arquivar</button>
          </form>
        )}
        {(campaign.status === 'draft' || campaign.status === 'archived') && (
          <form
            action={async () => {
              'use server'
              await deleteCampaign(id)
            }}
          >
            <button type="submit">Excluir</button>
          </form>
        )}
      </div>
    </main>
  )
}
