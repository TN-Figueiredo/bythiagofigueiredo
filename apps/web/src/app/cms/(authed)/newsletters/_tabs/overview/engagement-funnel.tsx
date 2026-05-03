'use client'

import type { NewsletterHubStrings } from '../../_i18n/types'

interface FunnelProps {
  funnel: { sent: number; delivered: number; opened: number; clicked: number }
  strings?: NewsletterHubStrings
}

export function EngagementFunnel({ funnel, strings }: FunnelProps) {
  const s = strings?.overview
  const stages = [
    { label: s?.sent ?? 'Sent', value: funnel.sent, pct: 100 },
    { label: s?.delivered ?? 'Delivered', value: funnel.delivered, pct: funnel.sent > 0 ? (funnel.delivered / funnel.sent) * 100 : 0 },
    { label: s?.opened ?? 'Opened', value: funnel.opened, pct: funnel.delivered > 0 ? (funnel.opened / funnel.delivered) * 100 : 0 },
    { label: s?.clicked ?? 'Clicked', value: funnel.clicked, pct: funnel.opened > 0 ? (funnel.clicked / funnel.opened) * 100 : 0 },
  ]

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{s?.engagementFunnel ?? 'Engagement Funnel'}</h3>
      <div className="space-y-2">
        {stages.map((st, i) => (
          <div key={st.label} className="flex items-center gap-3">
            <span className="w-16 text-[10px] font-medium text-gray-400">{st.label}</span>
            <div className="flex-1">
              <div
                className="h-5 rounded bg-indigo-500 transition-all"
                style={{ width: `${Math.max(4, (st.value / (funnel.sent || 1)) * 100)}%`, opacity: 1 - i * 0.15 }}
              />
            </div>
            <span className="w-16 text-right text-[10px] tabular-nums text-gray-300">{st.value.toLocaleString()}</span>
            <span className="w-12 text-right text-[9px] tabular-nums text-gray-500">{st.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
