import type { AnalyticsTab } from '../types'

interface Props {
  tab: AnalyticsTab
}

const TAB_LABELS: Record<AnalyticsTab, string> = {
  overview: 'Overview',
  youtube: 'YouTube',
  content: 'Conteudo',
  links: 'Links',
  audience: 'Audiencia',
  fans: 'Fas',
}

export default function ComingSoonStub({ tab }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24" data-testid="coming-soon-stub">
      <div className="rounded-lg border border-cms-border bg-cms-surface px-8 py-10 text-center">
        <p className="text-lg font-medium text-cms-text">{TAB_LABELS[tab]}</p>
        <p className="mt-2 text-sm text-cms-text-muted">Coming soon</p>
      </div>
    </div>
  )
}
