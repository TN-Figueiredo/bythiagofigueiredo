'use client'

import { useState, useEffect, useCallback } from 'react'

interface MobileStickyCTAProps {
  formId: string
  label: string
  accentColor: string
  accentTextColor: string
}

export function MobileStickyCTA({
  formId,
  label,
  accentColor,
  accentTextColor,
}: MobileStickyCTAProps) {
  const [visible, setVisible] = useState(false)
  const [formPhase, setFormPhase] = useState<string>('idle')

  useEffect(() => {
    const formEl = document.getElementById(formId)
    if (!formEl) return

    setFormPhase(formEl.getAttribute('data-phase') ?? 'idle')

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'data-phase') {
          setFormPhase(formEl.getAttribute('data-phase') ?? 'idle')
        }
      }
    })
    mo.observe(formEl, { attributes: true, attributeFilter: ['data-phase'] })

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) setVisible(!entry.isIntersecting)
      },
      { threshold: 0 },
    )
    io.observe(formEl)

    return () => {
      mo.disconnect()
      io.disconnect()
    }
  }, [formId])

  if (formPhase !== 'idle') return null

  const scrollToForm = () => {
    const formEl = document.getElementById(formId)
    formEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const emailInput = formEl?.querySelector('input[type="email"]') as HTMLInputElement | null
    setTimeout(() => emailInput?.focus(), 500)
  }

  return (
    <div
      className="nl-mobile-cta nl-sticky-cta"
      data-visible={String(visible)}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '12px 18px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(transparent, var(--pb-bg) 40%)',
      }}
    >
      <button
        onClick={scrollToForm}
        style={{
          width: '100%',
          padding: '14px 0',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
          background: accentColor,
          color: accentTextColor,
          fontFamily: 'var(--font-jetbrains-var), monospace',
        }}
      >
        ↑ {label}
      </button>
    </div>
  )
}
