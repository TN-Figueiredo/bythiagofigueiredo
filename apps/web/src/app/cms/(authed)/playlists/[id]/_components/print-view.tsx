import type {
  PlaylistRow,
  PlaylistItemEnriched,
  PlaylistEdgeRow,
  ContentType,
} from '@/lib/playlists/types'

const TYPE_LABEL: Record<ContentType, string> = {
  video: 'Video',
  blog_post: 'Blog',
  newsletter: 'Newsletter',
  pipeline: 'Pipeline',
}

const LANG_LABEL: Record<string, string> = {
  'pt-br': 'PT-BR',
  en: 'EN',
}

const TH: React.CSSProperties = {
  padding: '2mm 2mm',
  fontWeight: 600,
  color: '#666',
  fontSize: '7pt',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const TD: React.CSSProperties = {
  padding: '2mm 2mm',
  fontSize: '7pt',
  color: '#666',
  verticalAlign: 'top',
}

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  idea:      { backgroundColor: 'transparent', color: '#999', border: '1px solid #ccc' },
  published: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  done:      { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  draft:     { backgroundColor: '#fff3e0', color: '#e65100' },
  _default:  { backgroundColor: '#f3f3f3', color: '#666' },
}

interface PrintViewProps {
  playlist: PlaylistRow
  filterLabel: string
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  viewNumbers: Map<string, number | null>
}

export function PrintView({ playlist, filterLabel, items, edges, viewNumbers }: PrintViewProps) {
  const visibleItems = items
    .filter(item => viewNumbers.get(item.id) !== null)
    .sort((a, b) => (viewNumbers.get(a.id) ?? 0) - (viewNumbers.get(b.id) ?? 0))

  const name = playlist.name_en || playlist.name_pt
  const description = playlist.description_en || playlist.description_pt
  const totalItems = items.length
  const visibleCount = visibleItems.length
  const isFiltered = visibleCount < totalItems

  const typeCounts: Partial<Record<ContentType, number>> = {}
  const langCounts: Record<string, number> = {}
  for (const item of visibleItems) {
    if (item.content_type) typeCounts[item.content_type] = (typeCounts[item.content_type] ?? 0) + 1
    if (item.language) langCounts[item.language] = (langCounts[item.language] ?? 0) + 1
  }

  const nextMap = new Map<string, string>()
  for (const edge of edges) {
    if (edge.edge_type === 'sequence') nextMap.set(edge.source_item_id, edge.target_item_id)
  }
  const itemTitleMap = new Map(items.map(i => [i.id, i.title]))

  const summaryParts: string[] = []
  if (isFiltered) summaryParts.push(`${totalItems} total`)
  if (filterLabel) summaryParts.push(`Filter: ${filterLabel}`)
  for (const [type, count] of Object.entries(typeCounts)) {
    summaryParts.push(`${TYPE_LABEL[type as ContentType]}: ${count}`)
  }
  for (const [lang, count] of Object.entries(langCounts)) {
    summaryParts.push(`${LANG_LABEL[lang] ?? lang}: ${count}`)
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm 15mm; }
          .playlist-print { display: block !important; }
        }
      `}</style>

      <div className="hidden" style={{ fontSize: '11pt', color: '#111', background: '#fff' }}>
        <div className="playlist-print" style={{ display: 'none' }}>

          {/* Header */}
          <header style={{ borderBottom: '2pt solid #111', paddingBottom: '5mm', marginBottom: '5mm' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '18pt', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{name}</h1>
                {description && (
                  <p style={{ fontSize: '9pt', color: '#555', marginTop: '2mm' }}>{description}</p>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: '8pt', color: '#999', flexShrink: 0, marginLeft: '10mm' }}>
                <p style={{ margin: 0 }}>{new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</p>
                <p style={{ margin: 0, marginTop: '1mm', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {playlist.status}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '3mm', fontSize: '8pt', color: '#666' }}>
              <span style={{ fontWeight: 600 }}>{visibleCount} items</span>
              {summaryParts.length > 0 && (
                <span style={{ marginLeft: '3mm', color: '#999' }}>
                  {' · '}{summaryParts.join(' · ')}
                </span>
              )}
            </div>
          </header>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                <th style={{ ...TH, width: '7mm', padding: '2mm 1mm', color: '#999' }}>#</th>
                <th style={{ ...TH, padding: '2mm 3mm' }}>Title</th>
                <th style={{ ...TH, width: '14mm' }}>Type</th>
                <th style={{ ...TH, width: '10mm' }}>Lang</th>
                <th style={{ ...TH, width: '14mm' }}>Status</th>
                <th style={{ ...TH, width: '35mm' }}>Next</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, idx) => {
                const num = viewNumbers.get(item.id) ?? idx + 1
                const nextId = nextMap.get(item.id)
                const nextTitle = nextId ? itemTitleMap.get(nextId) : null
                const statusKey = item.status ?? '_default'
                const statusStyle = STATUS_STYLES[statusKey] ?? STATUS_STYLES._default

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #eee',
                      breakInside: 'avoid',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : '#fafafa',
                      printColorAdjust: 'exact',
                      WebkitPrintColorAdjust: 'exact',
                    } as React.CSSProperties}
                  >
                    <td style={{ ...TD, padding: '2mm 1mm', textAlign: 'right', color: '#bbb', fontWeight: 700, fontSize: '8pt' }}>
                      {num}
                    </td>
                    <td style={{ ...TD, padding: '2mm 3mm', color: '#111' }}>
                      <span style={{ fontWeight: 500, textDecoration: item.is_ghost ? 'line-through' : 'none', color: item.is_ghost ? '#bbb' : '#111' }}>
                        {item.title}
                      </span>
                      {item.metadata && (
                        <span style={{ display: 'block', fontSize: '7pt', color: '#999', marginTop: '0.5mm' }}>
                          {item.metadata}
                        </span>
                      )}
                    </td>
                    <td style={TD}>
                      {item.content_type ? TYPE_LABEL[item.content_type] : '—'}
                    </td>
                    <td style={TD}>
                      {item.language ? LANG_LABEL[item.language] ?? item.language : '—'}
                    </td>
                    <td style={{ ...TD, fontSize: '7pt' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.5mm 2mm',
                        borderRadius: '2mm',
                        fontSize: '6.5pt',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        ...statusStyle,
                        printColorAdjust: 'exact',
                        WebkitPrintColorAdjust: 'exact',
                      } as React.CSSProperties}>
                        {item.status ?? '—'}
                      </span>
                    </td>
                    <td style={{ ...TD, color: '#777', maxWidth: '35mm', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nextTitle ? `→ ${nextTitle}` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Footer */}
          <footer style={{
            marginTop: '6mm',
            paddingTop: '3mm',
            borderTop: '1px solid #ddd',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '7pt',
            color: '#bbb',
          }}>
            <span>ByThiagoFigueiredo · Playlist Editor</span>
            <span>{visibleCount} items · {edges.length} connections</span>
          </footer>
        </div>
      </div>
    </>
  )
}
