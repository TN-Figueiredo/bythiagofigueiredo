'use client'

import { useState, useCallback, useId, type KeyboardEvent } from 'react'

interface FaqItem {
  q: string
  a: string
}

interface FaqAccordionProps {
  items: FaqItem[]
  sectionTitle: string
  sectionId?: string
}

export function FaqAccordion({ items, sectionTitle, sectionId }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState(-1)
  const baseId = useId()

  const toggle = useCallback(
    (i: number) => setOpenIndex((prev) => (prev === i ? -1 : i)),
    [],
  )

  const handleKeyDown = useCallback(
    (i: number, e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggle(i)
      }
    },
    [toggle],
  )

  return (
    <section aria-labelledby={sectionId} style={{ maxWidth: 880, margin: '0 auto' }}>
      <h2
        id={sectionId}
        style={{
          fontFamily: 'var(--font-fraunces-var), serif',
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--pb-ink)',
          marginBottom: 24,
        }}
      >
        {sectionTitle}
      </h2>
      <div>
        {items.map((item, i) => {
          const isOpen = openIndex === i
          const buttonId = `${baseId}-btn-${i}`
          const panelId = `${baseId}-panel-${i}`
          return (
            <div
              key={i}
              style={{
                borderBottom: i < items.length - 1 ? '1px dashed var(--pb-line)' : undefined,
              }}
            >
              <button
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(i)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-fraunces-var), serif',
                  fontSize: 17,
                  fontWeight: 500,
                  color: 'var(--pb-ink)',
                }}
              >
                {item.q}
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 18,
                    color: 'var(--pb-muted)',
                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                    marginLeft: 16,
                  }}
                >
                  +
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                style={{
                  overflow: 'hidden',
                  maxHeight: isOpen ? 500 : 0,
                  opacity: isOpen ? 1 : 0,
                  transition: 'max-height 0.2s ease-out, opacity 0.2s ease-out',
                }}
              >
                <p
                  className={isOpen ? 'nl-fade-in' : ''}
                  style={{
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: 'var(--pb-muted)',
                    paddingBottom: 16,
                    margin: 0,
                  }}
                >
                  {item.a}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
