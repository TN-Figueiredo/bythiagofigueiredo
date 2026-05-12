'use client'

import { useState } from 'react'
import type { FaqItem } from '@/lib/contact/types'

interface Props {
  items: FaqItem[]
  locale: string
}

export function FaqSection({ items, locale }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (items.length === 0) return null

  const heading =
    locale === 'pt-BR' ? 'Perguntas frequentes' : 'Frequently asked questions'

  function toggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index))
  }

  return (
    <section aria-labelledby="faq-heading" className="mt-6">
      <h2
        id="faq-heading"
        className="text-pb-ink mb-4 text-xl"
        style={{ fontFamily: 'var(--font-fraunces-var)', fontWeight: 600 }}
      >
        {heading}
      </h2>

      <div className="flex flex-col divide-y divide-pb-line border border-pb-line rounded-lg overflow-hidden bg-pb-paper">
        {items.map((item, index) => {
          const isOpen = openIndex === index
          return (
            <div key={index}>
              <button
                type="button"
                onClick={() => toggle(index)}
                className="flex items-center justify-between w-full px-4 py-3.5 text-left gap-3 text-pb-ink hover:bg-pb-line/30 transition-colors"
                aria-expanded={isOpen}
              >
                <span
                  className="font-medium text-sm leading-snug"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {item.q}
                </span>
                <span
                  className="shrink-0 text-pb-muted transition-transform duration-200"
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    fontSize: 16,
                  }}
                >
                  ›
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1">
                  <p
                    className="text-pb-muted text-[15px] leading-relaxed"
                    style={{ fontFamily: 'var(--font-source-serif-var)' }}
                  >
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
