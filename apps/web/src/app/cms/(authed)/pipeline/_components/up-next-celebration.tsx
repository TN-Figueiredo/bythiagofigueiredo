'use client'

import { useState, useEffect, useCallback } from 'react'
import { getFormatIcon } from '@/lib/pipeline/gem-design'
import { getISOWeek, getISOWeekYear } from 'date-fns'

export interface CelebrationItem {
  id: string
  code: string
  title_pt: string | null
  format: string
}

interface UpNextCelebrationProps {
  items: CelebrationItem[]
}

function getDismissKey(): string {
  const now = new Date()
  const week = getISOWeek(now)
  const year = getISOWeekYear(now)
  return `celebration-dismissed-${year}-W${String(week).padStart(2, '0')}`
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(getDismissKey()) === '1'
  } catch {
    return false
  }
}

export function UpNextCelebration({ items }: UpNextCelebrationProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(isDismissed())
    const handler = (e: StorageEvent) => {
      if (e.key === getDismissKey()) setDismissed(e.newValue === '1')
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(getDismissKey(), '1')
    } catch { /* localStorage unavailable */ }
    setDismissed(true)
  }, [])

  const weekCount = items.length
  if (items.length === 0 || dismissed) return null

  return (
    <section
      data-testid="celebration-banner"
      className="flex items-center gap-3 rounded-lg px-4 py-3"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(16,185,129,0.08) 100%)',
        border: '1px solid var(--gem-border)',
        color: 'var(--gem-text)',
      }}
    >
      <span className="text-lg" role="img" aria-label="celebration">
        🎉
      </span>
      <span className="flex items-center gap-2 text-sm flex-1">
        <span>
          Esta semana:{' '}
          <strong style={{ color: 'var(--gem-done)' }}>
            {weekCount} {weekCount === 1 ? 'item publicado' : 'itens publicados'}.
          </strong>
        </span>
        <span className="flex items-center gap-1" data-testid="celebration-icons">
          {items.map((item) => {
            const { icon, label } = getFormatIcon(item.format)
            return (
              <span
                key={item.id}
                title={item.title_pt ?? item.code}
                aria-label={label}
                className="text-base"
              >
                {icon}
              </span>
            )
          })}
        </span>
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:outline-none"
        style={{ color: 'var(--gem-muted)' }}
        aria-label="Dispensar celebracao"
        data-testid="celebration-dismiss"
      >
        ✕
      </button>
    </section>
  )
}
