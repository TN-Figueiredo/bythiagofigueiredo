'use client'

import { useState, useEffect } from 'react'
import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { adLabel } from './ad-label'

export function DoormanAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (dismissed) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => setVisible(true), reduce ? 0 : 300)
    return () => clearTimeout(t)
  }, [dismissed])

  if (dismissed) return null

  const label = adLabel(creative.type, locale)

  return (
    <div
      className="relative flex w-full flex-wrap items-center gap-3.5"
      style={{
        background: creative.brandColor,
        color: '#FFF',
        padding: '12px 20px',
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
        transition:
          'transform 0.4s cubic-bezier(.2,.8,.2,1), opacity 0.4s',
      }}
    >
      <div
        className="font-jetbrains uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 2,
          background: 'rgba(255,255,255,0.18)',
        }}
      >
        {label}
      </div>

      <div
        className="min-w-[240px] flex-1"
        style={{ fontSize: 14, lineHeight: 1.4 }}
      >
        <strong className="font-semibold">{creative.title}</strong>
      </div>

      <a
        href={creative.ctaUrl}
        className="font-jetbrains uppercase no-underline"
        style={{
          color: '#FFF',
          fontSize: 11,
          letterSpacing: '0.1em',
          fontWeight: 600,
          padding: '8px 14px',
          border: '1px solid rgba(255,255,255,0.5)',
        }}
      >
        {creative.ctaText}
      </a>

      <button
        onClick={dismiss}
        aria-label={locale === 'pt-BR' ? 'Fechar' : 'Close'}
        className="cursor-pointer border-none bg-transparent p-1 leading-none"
        style={{
          color: '#FFF',
          fontSize: 18,
          opacity: 0.85,
        }}
      >
        ×
      </button>
    </div>
  )
}
