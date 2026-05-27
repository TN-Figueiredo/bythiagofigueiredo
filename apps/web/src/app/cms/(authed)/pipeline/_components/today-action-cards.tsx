'use client'

import Link from 'next/link'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { gemMix } from '@/lib/pipeline/gem-design'
import type { TodayAction } from '@/lib/pipeline/up-next-types'

interface TodayActionCardsProps {
  actions: TodayAction[]
  overflow: number
}

const URGENCY_LABELS: Record<string, string> = {
  overdue: 'Atrasado',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  this_week: 'Esta semana',
}

const URGENCY_STYLES: Record<string, { bg: string; color: string }> = {
  overdue: { bg: gemMix('--gem-danger', 15), color: 'var(--gem-danger)' },
  today: { bg: gemMix('--gem-accent', 15), color: 'var(--gem-accent)' },
  tomorrow: { bg: gemMix('--gem-muted', 15), color: 'var(--gem-muted)' },
  this_week: { bg: gemMix('--gem-dim', 15), color: 'var(--gem-dim)' },
}

const FORMAT_LABELS: Record<string, string> = {
  video: 'Video',
  blog_post: 'Blog',
  newsletter: 'Newsletter',
}

const URGENCY_DISPLAY_ORDER = ['overdue', 'today', 'tomorrow', 'this_week'] as const

function ActionCard({ action }: { action: TodayAction }) {
  const colors = FORMAT_COLORS[action.format] ?? { accent: 'var(--gem-accent)', text: 'var(--gem-muted)', border: 'var(--gem-border)' }
  const isBatch = action.batchItems && action.batchItems.length > 0

  const href = action.isPhantom
    ? `/cms/pipeline/items/new?format=${action.format}`
    : isBatch
      ? `/cms/pipeline?stage=${action.stage}&format=${action.format}${action.channelLabel ? `&channel=${encodeURIComponent(action.channelLabel)}` : ''}`
      : `/cms/pipeline/items/${action.id}`

  return (
    <li>
      <Link
        href={href}
        className="group flex items-stretch gap-3 rounded-lg border p-3 cursor-pointer motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
        style={{
          background: 'var(--gem-surface)',
          borderColor: 'var(--gem-border)',
        }}
        aria-label={isBatch
          ? `${action.itemTitle}. ${URGENCY_LABELS[action.urgency] ?? action.urgency}. ${action.effortEstimate} total.`
          : `${action.itemTitle}. ${URGENCY_LABELS[action.urgency] ?? action.urgency}. ${action.effortEstimate}.`}
      >
        <div
          className="w-[3px] shrink-0 rounded-full"
          style={{ background: colors.accent }}
        />
        <span className="sr-only">{FORMAT_LABELS[action.format] ?? action.format}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
              style={{
                background: gemMix(colors.accent, 10),
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
            className="text-xs mt-0.5 truncate"
            style={{ color: 'var(--gem-muted)' }}
          >
            {action.actionLabel}
            {' · '}{action.deadline.label}
          </p>

          {action.channelLabel && (
            <p
              className="text-[10px] mt-0.5"
              style={{ color: 'var(--gem-dim)' }}
            >
              {action.channelLabel}
            </p>
          )}

          {action.playlistContext && action.playlistContext.total != null && (
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

function UrgencyGroup({ urgency, actions }: { urgency: string; actions: TodayAction[] }) {
  const style = URGENCY_STYLES[urgency] ?? URGENCY_STYLES['this_week']!
  const label = URGENCY_LABELS[urgency] ?? urgency

  return (
    <div className="space-y-2">
      <h3
        className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2"
        style={{ color: style.color }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: style.color }}
          aria-hidden="true"
        />
        {label}
        <span
          className="text-[10px] font-normal"
          style={{ color: 'var(--gem-dim)' }}
        >
          ({actions.length})
        </span>
      </h3>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map(action => (
          <ActionCard key={action.id} action={action} />
        ))}
      </ul>
    </div>
  )
}

export function TodayActionCards({ actions, overflow }: TodayActionCardsProps) {
  const grouped = new Map<string, TodayAction[]>()
  for (const action of actions) {
    const key = action.urgency
    let group = grouped.get(key)
    if (!group) {
      group = []
      grouped.set(key, group)
    }
    group.push(action)
  }

  return (
    <section
      aria-label="Fila de producao"
      className="border-l-2 pl-4"
      style={{ borderLeftColor: 'var(--gem-accent)' }}
    >
      <h2
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--gem-muted)' }}
      >
        Fila de Produção
      </h2>
      {actions.length > 0 ? (
        <div className="space-y-4">
          {URGENCY_DISPLAY_ORDER.map(urgency => {
            const group = grouped.get(urgency)
            if (!group || group.length === 0) return null
            return <UrgencyGroup key={urgency} urgency={urgency} actions={group} />
          })}
        </div>
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
          className="text-xs mt-2 text-center"
          style={{ color: 'var(--gem-muted)' }}
          aria-live="polite"
        >
          +{overflow} ações adicionais
        </p>
      )}
    </section>
  )
}
