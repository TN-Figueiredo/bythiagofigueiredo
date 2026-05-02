'use client'

import { useState, useEffect, useCallback } from 'react'

interface MobileStickyCTAProps {
  formId: string
  phase: 'idle' | 'loading' | 'pending' | 'confirmed' | 'error'
  label: string
  accentColor: string
  accentTextColor: string
}

export function MobileStickyCTA({
  formId,
  phase,
  label,
  accentColor,
  accentTextColor,
}: MobileStickyCTAProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const formEl = document.getElementById(formId)
    if (!formEl) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) setVisible(!entry.isIntersecting && phase === 'idle')
      },
      { threshold: 0 },
    )
    observer.observe(formEl)
    return () => observer.disconnect()
  }, [formId, phase])

  const scrollToForm = useCallback(() => {
    const formEl = document.getElementById(formId)
    formEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const emailInput = formEl?.querySelector('input[type="email"]') as HTMLInputElement | null
    setTimeout(() => emailInput?.focus(), 500)
  }, [formId])

  if (phase !== 'idle') return null

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
