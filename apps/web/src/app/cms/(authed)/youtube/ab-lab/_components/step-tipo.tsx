'use client'

import { useRef, useCallback } from 'react'
import { Layers, Image, Type } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TestType } from '@/lib/youtube/ab-types'
import { FRASE_COMBO } from './ab-constants'

interface StepTipoProps {
  selected: TestType | null
  onSelect: (type: TestType) => void
}

const TYPES: Array<{
  type: TestType
  icon: LucideIcon
  title: string
  desc: string
  extra?: string
}> = [
  { type: 'combo',     icon: Layers, title: 'Título + thumbnail', desc: 'Os dois mudam juntos.', extra: FRASE_COMBO },
  { type: 'thumbnail', icon: Image,  title: 'Thumbnail',          desc: 'Só a miniatura muda' },
  { type: 'title',     icon: Type,   title: 'Título',             desc: 'Só o título muda' },
]

export function StepTipo({ selected, onSelect }: StepTipoProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = TYPES.findIndex(t => t.type === selected)
      let nextIndex = currentIndex
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextIndex = (currentIndex + 1) % TYPES.length }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); nextIndex = (currentIndex - 1 + TYPES.length) % TYPES.length }
      else return
      const next = TYPES[nextIndex]
      if (!next) return
      onSelect(next.type)
      containerRef.current?.querySelectorAll<HTMLDivElement>('[role="radio"]')?.[nextIndex]?.focus()
    },
    [selected, onSelect],
  )

  return (
    <div>
      <p className="text-[13.5px] text-cms-text-dim m-0 mb-[18px]">
        Escolha o que vai ser rotacionado no YouTube.
      </p>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label="Tipo de teste"
        className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-[14px]"
        onKeyDown={handleKeyDown}
      >
        {TYPES.map(({ type, icon: Icon, title, desc, extra }, index) => {
          const isSelected = selected === type
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || (selected === null && type === TYPES[0]?.type) ? 0 : -1}
              onClick={() => onSelect(type)}
              className={`text-left rounded-[12px] p-[18px] cursor-pointer transition-[0.15s] focus:outline-none focus-visible:ring-2 focus-visible:ring-cms-accent relative${index === 0 ? ' min-[480px]:col-span-2' : ''}`}
              style={{
                border: isSelected ? '1.5px solid var(--cms-accent)' : '1.5px solid var(--cms-border, #332D25)',
                background: isSelected ? 'var(--accent-soft, rgba(255,130,64,0.08))' : 'var(--cms-surface-hover)',
              }}
            >
              {/* Icon row */}
              <div className="flex items-center gap-[12px] mb-[10px]">
                <div
                  className="flex items-center justify-center rounded-[10px]"
                  style={{
                    width: 38, height: 38,
                    background: isSelected ? 'var(--cms-accent)' : 'var(--cms-surface)',
                    border: isSelected ? 'none' : '1px solid var(--cms-border, #332D25)',
                    color: isSelected ? 'rgb(26,18,12)' : 'var(--cms-text)',
                  }}
                >
                  <Icon size={20} aria-hidden="true" />
                </div>
                <span className="text-[16px] font-semibold text-cms-text">{title}</span>
              </div>
              <div className="text-[12.5px] text-cms-text-dim">{desc}</div>
              {extra && (
                <div className="text-[12.5px] text-cms-text-muted mt-[6px]">{extra}</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
