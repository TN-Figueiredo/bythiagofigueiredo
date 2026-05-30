'use client'

import { useRef, useCallback } from 'react'
import { FlaskConical, Image, Type, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TestType } from '@/lib/youtube/ab-types'
import { Badge } from './ab-primitives'

interface StepTipoProps {
  selected: TestType | null
  onSelect: (type: TestType) => void
}

const TYPES: Array<{
  type: TestType
  icon: LucideIcon
  title: string
  desc: string
  badge?: string
}> = [
  { type: 'combo',       icon: FlaskConical, title: 'Combo',       desc: 'Thumb + título testados juntos',      badge: 'Recomendado' },
  { type: 'thumbnail',   icon: Image,        title: 'Miniatura',   desc: 'Só a miniatura muda' },
  { type: 'title',       icon: Type,         title: 'Título',      desc: 'Só o título muda' },
  { type: 'description', icon: FileText,     title: 'Descrição',   desc: 'Descrição + links rastreados',        badge: 'Pontual' },
]

export function StepTipo({ selected, onSelect }: StepTipoProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = TYPES.findIndex(t => t.type === selected)
      let nextIndex = currentIndex

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        nextIndex = (currentIndex + 1) % TYPES.length
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        nextIndex = (currentIndex - 1 + TYPES.length) % TYPES.length
      } else {
        return
      }

      const next = TYPES[nextIndex]
      if (!next) return
      onSelect(next.type)

      // Move focus to the newly selected card
      const cards = containerRef.current?.querySelectorAll<HTMLDivElement>('[role="radio"]')
      cards?.[nextIndex]?.focus()
    },
    [selected, onSelect],
  )

  return (
    <>
      <p className="text-xs text-cms-text-dim mb-3 leading-relaxed">
        Escolha o que vai ser rotacionado no YouTube. Thumb e título andam juntos — é a dupla que decide o clique.
      </p>
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Test type"
      className="grid grid-cols-2 gap-3"
      onKeyDown={handleKeyDown}
    >
      {TYPES.map(({ type, icon: Icon, title, desc, badge }) => {
        const isSelected = selected === type
        return (
          <div
            key={type}
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected || (selected === null && type === TYPES[0]?.type) ? 0 : -1}
            onClick={() => onSelect(type)}
            onKeyDown={e => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                onSelect(type)
              }
            }}
            className={[
              'relative flex flex-col gap-2 rounded-lg border p-3 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:ring-offset-1',
              isSelected
                ? 'border-cms-accent bg-cms-accent-subtle'
                : 'border-cms-border bg-cms-surface hover:border-cms-accent/50 hover:bg-cms-surface/80',
            ].join(' ')}
          >
            {/* Icon box */}
            <div
              className={[
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                isSelected ? 'bg-cms-accent/20' : 'bg-cms-border/60',
              ].join(' ')}
            >
              <Icon
                className={['w-4 h-4', isSelected ? 'text-cms-accent' : 'text-cms-text-dim'].join(' ')}
                aria-hidden="true"
              />
            </div>

            {/* Text */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={['text-xs font-semibold', isSelected ? 'text-cms-accent' : 'text-cms-text'].join(' ')}>
                  {title}
                </span>
                {badge && (
                  <Badge tone={type === 'combo' ? 'accent' : 'neutral'}>
                    {badge}
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-cms-text-dim leading-snug">{desc}</p>
            </div>

            {/* Selected indicator dot */}
            {isSelected && (
              <span
                aria-hidden="true"
                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cms-accent"
              />
            )}
          </div>
        )
      })}
    </div>
    </>
  )
}
