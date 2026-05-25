'use client'

import { getFormatIcon } from '@/lib/pipeline/gem-design'

export interface CelebrationItem {
  id: string
  code: string
  title_pt: string | null
  format: string
}

interface UpNextCelebrationProps {
  items: CelebrationItem[]
}

export function UpNextCelebration({ items }: UpNextCelebrationProps) {
  const weekCount = items.length
  if (items.length === 0) return null

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
      <span className="flex items-center gap-2 text-sm">
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
    </section>
  )
}
