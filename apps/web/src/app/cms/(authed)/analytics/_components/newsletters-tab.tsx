'use client'

interface NewslettersTabProps {
  period: string
}

const EDITIONS = [
  {
    subject: 'Sprint 5 wrap-up: LGPD + SEO + Newsletter Engine',
    sentAt: '2026-04-22',
    delivered: 4731,
    opens: 2104,
    openRate: 44.5,
    clicks: 618,
    clickRate: 13.1,
    bounces: 89,
    status: 'sent',
  },
  {
    subject: 'TypeScript 5.5 + React 19 RC — what you need to know',
    sentAt: '2026-04-15',
    delivered: 4698,
    opens: 1934,
    openRate: 41.2,
    clicks: 542,
    clickRate: 11.5,
    bounces: 62,
    status: 'sent',
  },
  {
    subject: 'Multi-tenant CMS: from zero to prod in 8 weeks',
    sentAt: '2026-04-08',
    delivered: 4612,
    opens: 2312,
    openRate: 50.1,
    clicks: 731,
    clickRate: 15.8,
    bounces: 48,
    status: 'sent',
  },
  {
    subject: 'Resend + Supabase: self-hosted email done right',
    sentAt: '2026-04-01',
    delivered: 4580,
    opens: 1876,
    openRate: 41.0,
    clicks: 489,
    clickRate: 10.7,
    bounces: 71,
    status: 'sent',
  },
]

const TOP_LINKS = [
  { url: 'https://bythiagofigueiredo.com/blog/pt-BR/cms-architecture', clicks: 312 },
  { url: 'https://bythiagofigueiredo.com/blog/en/lgpd-phase-deletion', clicks: 218 },
  { url: 'https://github.com/TN-Figueiredo/cms', clicks: 187 },
  { url: 'https://bythiagofigueiredo.com/campaigns/newsletter-kit', clicks: 143 },
  { url: 'https://resend.com/docs', clicks: 96 },
]

function statusColor(status: string) {
  if (status === 'sent') return 'var(--cms-green, #22c55e)'
  if (status === 'failed') return 'var(--cms-red, #ef4444)'
  return 'var(--cms-text-dim, #52525b)'
}

export function NewslettersTab({ period: _period }: NewslettersTabProps) {
  return (
    <div className="space-y-6">
      {/* Edition performance table */}
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-cms-border">
          <h3 className="text-sm font-medium text-cms-text">Edition Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--cms-bg, #0f1117)' }}>
                {['Subject', 'Sent', 'Delivered', 'Open Rate', 'Clicks', 'Click Rate', 'Bounces'].map((h) => (
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
              {EDITIONS.map((ed) => (
                <tr
                  key={ed.subject}
                  className="border-t border-cms-border hover:bg-cms-bg transition-colors"
                >
                  <td className="px-4 py-3 text-cms-text max-w-xs">
                    <div className="truncate">{ed.subject}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--cms-text-dim, #52525b)' }}>
                      {ed.sentAt}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-cms-text-muted tabular-nums">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                      style={{ background: statusColor(ed.status) }}
                    />
                    {ed.delivered.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-cms-text-muted tabular-nums">{ed.delivered.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums font-medium" style={{ color: 'var(--cms-green, #22c55e)' }}>
                    {ed.openRate}%
                  </td>
                  <td className="px-4 py-3 text-cms-text-muted tabular-nums">{ed.clicks.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--cms-cyan, #06b6d4)' }}>
                    {ed.clickRate}%
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--cms-red, #ef4444)' }}>
                    {ed.bounces}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top clicked links */}
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5">
        <h3 className="text-sm font-medium text-cms-text mb-3">Top Clicked Links</h3>
        <div className="space-y-2">
          {TOP_LINKS.map((link, idx) => (
            <div
              key={link.url}
              className="flex items-center gap-3 text-xs py-1.5 border-b border-cms-border last:border-0"
            >
              <span
                className="text-[11px] tabular-nums w-4 shrink-0 text-right"
                style={{ color: 'var(--cms-text-dim, #52525b)' }}
              >
                {idx + 1}
              </span>
              <span className="text-cms-text flex-1 truncate font-mono text-[11px]">{link.url}</span>
              <span className="text-cms-text-muted tabular-nums shrink-0">{link.clicks} clicks</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
