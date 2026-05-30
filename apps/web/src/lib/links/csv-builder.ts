import type { LinkDisplay } from '@tn-figueiredo/links-admin'
import { SOURCE_LABELS, type SourceId } from '@tn-figueiredo/links-admin'
import { generateCsv, type CsvRow } from '@tn-figueiredo/links/analytics'

const COLUMNS = [
  'Titulo',
  'Slug',
  'Origem',
  'Destino',
  'Status',
  'Cliques',
  'Unicos',
  'CTR',
  'Saude',
  'Criado em',
]

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    active: 'Ativo',
    paused: 'Pausado',
    expired: 'Expirado',
  }
  return map[s] ?? s
}

export function buildLinksCsv(links: LinkDisplay[]): string {
  const rows: CsvRow[] = links.map(l => ({
    Titulo: l.title,
    Slug: l.slug,
    Origem: SOURCE_LABELS[l.source as SourceId] ?? l.source,
    Destino: l.dest,
    Status: statusLabel(l.status),
    Cliques: String(l.clicks),
    Unicos: String(l.unique),
    CTR: `${l.ctr}%`,
    Saude: l.health,
    'Criado em': l.created,
  }))

  return generateCsv(COLUMNS, rows)
}
