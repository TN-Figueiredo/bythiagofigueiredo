'use client'

interface CampaignsTabProps {
  period: string
}

const LOCALE_FLAG: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
}

const CAMPAIGNS = [
  {
    title: 'Sprint 5 Launch Pack',
    status: 'active',
    submissions: 312,
    convRate: 8.4,
    locales: [
      { locale: 'pt-BR', submissions: 187 },
      { locale: 'en', submissions: 125 },
    ],
    updatedAt: '2026-04-22',
  },
  {
    title: 'Developer Newsletter Q1',
    status: 'active',
    submissions: 198,
    convRate: 6.2,
    locales: [
      { locale: 'pt-BR', submissions: 98 },
      { locale: 'en', submissions: 100 },
    ],
    updatedAt: '2026-04-18',
  },
  {
    title: 'LGPD Compliance Kit',
    status: 'active',
    submissions: 143,
    convRate: 5.1,
    locales: [
      { locale: 'pt-BR', submissions: 143 },
    ],
    updatedAt: '2026-04-15',
  },
  {
    title: 'CMS Architecture Deep-Dive',
    status: 'draft',
    submissions: 0,
    convRate: 0,
    locales: [
      { locale: 'en', submissions: 0 },
    ],
    updatedAt: '2026-04-20',
  },
  {
    title: 'Newsletter Engine Webinar',
    status: 'archived',
    submissions: 87,
    convRate: 3.9,
    locales: [
      { locale: 'pt-BR', submissions: 52 },
      { locale: 'en', submissions: 35 },
    ],
    updatedAt: '2026-03-30',
  },
]

function campaignStatusColor(status: string): string {
  if (status === 'active') return 'var(--cms-green, #22c55e)'
  if (status === 'draft') return 'var(--cms-amber, #f59e0b)'
  return 'var(--cms-text-dim, #52525b)'
}

const CAMPAIGN_KPIS = [
  { label: 'Total Submissions', value: '2,214' },
  { label: 'Avg Download Rate', value: '8.6%' },
  { label: 'Avg per Campaign', value: '554' },
  { label: 'Active Campaigns', value: '4' },
]

export function CampaignsTab({ period: _period }: CampaignsTabProps) {
  const sorted = [...CAMPAIGNS].sort((a, b) => b.submissions - a.submissions)

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CAMPAIGN_KPIS.map((kpi) => (
          <div key={kpi.label} className="rounded-[10px] p-4 border"
            style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
            <p className="text-[11px] mb-1" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{kpi.label}</p>
            <p className="text-2xl font-semibold" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Campaign ranked table */}
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-cms-border">
          <h3 className="text-sm font-medium text-cms-text">Campaign Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--cms-bg, #0f1117)' }}>
                {['#', 'Campaign', 'Status', 'Submissions', 'Conv. Rate', 'Locales', 'Updated'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left font-medium"
                    style={{ color: 'var(--cms-text-dim, #52525b)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((campaign, idx) => (
                <tr
                  key={campaign.title}
                  className="border-t border-cms-border hover:bg-cms-bg transition-colors"
                >
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--cms-text-dim, #52525b)' }}>
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 text-cms-text font-medium max-w-[180px]">
                    <div className="truncate">{campaign.title}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: campaignStatusColor(campaign.status) }}
                      />
                      <span className="capitalize" style={{ color: campaignStatusColor(campaign.status) }}>
                        {campaign.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-cms-text tabular-nums font-semibold">
                    {campaign.submissions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium" style={{ color: 'var(--cms-cyan, #06b6d4)' }}>
                    {campaign.convRate > 0 ? `${campaign.convRate}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {campaign.locales.map((l) => (
                        <span
                          key={l.locale}
                          title={`${l.locale}: ${l.submissions} submissions`}
                          className="text-base leading-none cursor-default"
                        >
                          {LOCALE_FLAG[l.locale] ?? l.locale}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--cms-text-dim, #52525b)' }}>
                    {campaign.updatedAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Locale split summary */}
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5">
        <h3 className="text-sm font-medium text-cms-text mb-3">Locale Split (All Campaigns)</h3>
        <div className="space-y-2">
          {[
            { locale: 'pt-BR', flag: '\u{1F1E7}\u{1F1F7}', total: 480, pct: 64 },
            { locale: 'en', flag: '\u{1F1FA}\u{1F1F8}', total: 260, pct: 36 },
          ].map((row) => (
            <div key={row.locale} className="flex items-center gap-3">
              <span className="text-base leading-none w-6 shrink-0">{row.flag}</span>
              <span className="text-xs text-cms-text-muted w-12">{row.locale}</span>
              <div className="flex-1 h-5 bg-cms-bg rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${row.pct}%`, background: 'var(--cms-accent, #6366f1)', opacity: 0.7 }}
                />
              </div>
              <span className="text-xs text-cms-text-muted tabular-nums w-16 text-right">
                {row.total} ({row.pct}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
