'use client'

import { memo, useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { getFormatIcon, gemMix } from '@/lib/pipeline/gem-design'
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

export const UpNextCelebration = memo(function UpNextCelebration({ items }: UpNextCelebrationProps) {
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
      role="status"
      aria-live="polite"
      data-testid="celebration-banner"
      className="flex items-center gap-3 rounded-lg px-4 py-3"
      style={{
        background: `linear-gradient(135deg, ${gemMix('--gem-accent', 12)} 0%, ${gemMix('--gem-done', 8)} 100%)`,
        border: '1px solid var(--gem-border)',
        color: 'var(--gem-text)',
      }}
    >
      <span className="text-lg" role="img" aria-label="celebração">
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
                role="img"
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
        className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md motion-safe:transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
        style={{ color: 'var(--gem-muted)' }}
        aria-label="Dispensar celebração"
        data-testid="celebration-dismiss"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </section>
  )
})
