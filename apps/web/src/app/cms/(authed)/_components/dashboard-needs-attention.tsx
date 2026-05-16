'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AttentionItem, AttentionPriority } from './dashboard-queries'

interface DashboardNeedsAttentionProps {
  items: AttentionItem[]
}

const PRIORITY_STYLES: Record<AttentionPriority, string> = {
  P1: 'border-l-red-500',
  P2: 'border-l-amber-500',
  P3: 'border-l-blue-500',
}

const PRIORITY_DOT: Record<AttentionPriority, string> = {
  P1: 'bg-red-500',
  P2: 'bg-amber-500',
  P3: 'bg-blue-500',
}

export function DashboardNeedsAttention({ items }: DashboardNeedsAttentionProps) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return (
      <div
        className="rounded-xl border border-[var(--bdr-1)] bg-[var(--bg-2)]/40 p-5"
        data-testid="needs-attention"
      >
        <h2 className="mb-3 text-sm font-semibold text-[var(--t2)]">
          Precisa de Atenção
        </h2>
        <p
          className="text-sm text-[var(--t5)]"
          data-testid="needs-attention-empty"
        >
          Tudo em ordem
        </p>
      </div>
    )
  }

  const visibleItems = expanded ? items : items.slice(0, 3)
  const hasMore = items.length > 3 && !expanded

  return (
    <div
      className="rounded-xl border border-[var(--bdr-1)] bg-[var(--bg-2)]/40 p-5"
      data-testid="needs-attention"
    >
      <h2 className="mb-3 text-sm font-semibold text-[var(--t2)]">
        Precisa de Atenção
      </h2>
      <ul className="space-y-2" data-testid="needs-attention-list">
        {visibleItems.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={`block rounded-lg border-l-[3px] bg-[var(--bg-2)]/60 px-4 py-3 transition-colors hover:bg-[var(--bg-3)]/50 ${PRIORITY_STYLES[item.priority]}`}
              data-testid={`attention-item-${item.priority}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority]}`}
                />
                <span className="truncate text-sm font-medium text-[var(--t2)]">
                  {item.title}
                </span>
              </div>
              <p className="ml-4 mt-0.5 text-xs text-[var(--t5)]">
                {item.reason}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(true)}
          className="mt-3 text-xs font-medium text-[var(--acc)] hover:text-[var(--acc)]/80 transition-colors"
          data-testid="needs-attention-expand"
        >
          Ver todos ({items.length})
        </button>
      )}
    </div>
  )
}
