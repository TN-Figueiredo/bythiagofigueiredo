import Link from 'next/link'
import type { ContentStatus } from '@tn-figueiredo/cms'
import { campaignRepo } from '../../../../lib/cms/repositories'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { deleteCampaign } from './[id]/edit/actions'
import { DeleteCampaignButton } from './_components/delete-campaign-button'

interface Props {
  searchParams: Promise<{ status?: string; locale?: string; search?: string }>
}

export default async function CmsCampaignsListPage({ searchParams }: Props) {
  const sp = await searchParams
  const ctx = await getSiteContext()
  const status = (sp.status as ContentStatus | undefined) ?? undefined
  const locale = sp.locale ?? ctx.defaultLocale
  const search = sp.search

  const campaigns = await campaignRepo().list({
    siteId: ctx.siteId,
    locale,
    status,
    search,
    perPage: 50,
  })

  return (
    <main>
      <header>
        <h1>Campaigns</h1>
        <Link href="/cms/campaigns/new">+ Nova campanha</Link>
      </header>
      <form method="get">
        <select name="status" defaultValue={status ?? ''} aria-label="status filter">
          <option value="">Todos</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select name="locale" defaultValue={locale} aria-label="locale filter">
          <option value="pt-BR">pt-BR</option>
          <option value="en">en</option>
        </select>
        <input
          type="search"
          name="search"
          placeholder="Buscar..."
          defaultValue={search ?? ''}
          aria-label="title search"
        />
        <button type="submit">Filtrar</button>
      </form>
      {campaigns.length === 0 ? (
        <p>Nenhuma campanha encontrada.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Slug</th>
              <th>Interesse</th>
              <th>Título</th>
              <th>Agendado</th>
              <th>Publicado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>
                  <span data-status={c.status}>{c.status}</span>
                </td>
                <td>
                  <Link href={`/cms/campaigns/${c.id}/edit`}>{c.translation.slug}</Link>
                </td>
                <td>{c.interest}</td>
                <td>{c.translation.meta_title ?? c.translation.context_tag ?? '—'}</td>
                <td>{/* scheduled_for not on list item */}—</td>
                <td>{c.published_at ? <time>{c.published_at}</time> : '—'}</td>
                <td>
                  {(c.status === 'draft' || c.status === 'archived') && (
                    <DeleteCampaignButton
                      campaignId={c.id}
                      campaignLabel={c.translation.meta_title ?? c.translation.slug}
                      onDelete={deleteCampaign}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}

export const dynamic = 'force-dynamic'
