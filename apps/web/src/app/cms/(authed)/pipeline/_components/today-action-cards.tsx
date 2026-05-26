'use client'

import Link from 'next/link'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import type { TodayAction } from '@/lib/pipeline/up-next-types'

interface TodayActionCardsProps {
  actions: TodayAction[]
  overflow: number
}

const URGENCY_STYLES: Record<string, { bg: string; color: string }> = {
  overdue: { bg: 'rgba(252,165,165,0.15)', color: '#fca5a5' },
  today: { bg: 'rgba(252,211,77,0.15)', color: '#fcd34d' },
  tomorrow: { bg: 'rgba(165,180,252,0.15)', color: '#a5b4fc' },
  this_week: { bg: 'rgba(148,163,184,0.10)', color: '#94a3b8' },
}

function ActionCard({ action }: { action: TodayAction }) {
  const colors = FORMAT_COLORS[action.format] ?? { accent: '#6366f1', text: '#a5b4fc', border: '#312e81' }
  const urgencyStyle = URGENCY_STYLES[action.urgency] ?? URGENCY_STYLES['this_week']!
  const isBatch = action.batchItems && action.batchItems.length > 0
  const href = isBatch
    ? `/cms/pipeline?stage=${action.stage}&format=${action.format}${action.channelLabel ? `&channel=${encodeURIComponent(action.channelLabel)}` : ''}`
    : `/cms/pipeline/items/${action.id}`

  return (
    <li>
      <Link
        href={href}
        className="group flex items-stretch gap-3 rounded-lg border p-3 transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:outline-none"
        style={{
          background: 'var(--gem-surface)',
          borderColor: 'var(--gem-border)',
        }}
        aria-label={isBatch
          ? `${action.itemTitle}. ${action.effortEstimate} total.`
          : `${action.itemTitle}. ${action.effortEstimate}.`}
      >
        <div
          className="w-[3px] shrink-0 rounded-full"
          style={{ background: colors.accent }}
        />
        <span className="sr-only">{action.format === 'video' ? 'Video' : action.format === 'blog_post' ? 'Blog' : action.format === 'newsletter' ? 'Newsletter' : action.format}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: urgencyStyle.bg, color: urgencyStyle.color }}
            >
              {action.urgency}
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
              style={{
                background: `color-mix(in srgb, ${colors.accent} 10%, transparent)`,
                color: colors.text,
              }}
            >
              <span>{action.effort}</span>
              <span aria-hidden>·</span>
              <span>{action.effortEstimate}</span>
            </span>
          </div>

          <p
            className="text-sm font-medium truncate"
            style={{ color: 'var(--gem-text)' }}
            title={action.itemTitle}
          >
            {action.itemTitle}
          </p>

          <p
            className="text-[11px] mt-0.5 truncate"
            style={{ color: 'var(--gem-muted)' }}
          >
            {action.actionLabel}
            {action.deadline && <> · {action.deadline.label}</>}
          </p>

          {action.channelLabel && (
            <p
              className="text-[10px] mt-0.5"
              style={{ color: 'var(--gem-dim)' }}
            >
              {action.channelLabel}
            </p>
          )}

          {action.playlistContext && (
            <p
              className="text-[10px] mt-0.5"
              style={{ color: 'var(--gem-dim)' }}
            >
              {action.playlistContext.name} {action.playlistContext.position}/{action.playlistContext.total}
            </p>
          )}
        </div>
      </Link>
    </li>
  )
}

export function TodayActionCards({ actions, overflow }: TodayActionCardsProps) {
  return (
    <section aria-label="Acoes de hoje">
      {actions.length > 0 ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actions.map(action => (
            <ActionCard key={action.id} action={action} />
          ))}
        </ul>
      ) : (
        <p
          className="text-sm py-4 text-center"
          style={{ color: 'var(--gem-dim)' }}
        >
          Nada urgente — bom dia para novas ideias.
        </p>
      )}

      {overflow > 0 && (
        <p
          className="text-[11px] mt-2 text-center"
          style={{ color: 'var(--gem-muted)' }}
          aria-label={`${overflow} acoes adicionais`}
        >
          +{overflow} acoes adicionais
        </p>
      )}
    </section>
  )
}
