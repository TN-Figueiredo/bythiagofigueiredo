'use client'
import { useEffect, useState } from 'react'
import { PASSWORD_CHANGED_NOTICE } from './strings'

/** Aviso passageiro depois de trocar a senha (`?senha=alterada`). Logan A6. Some sozinho. */
export function PasswordChangedNotice() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('senha') !== 'alterada') return
    url.searchParams.delete('senha')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 6000)
    return () => clearTimeout(t)
  }, [])
  if (!visible) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        padding: '12px 16px',
        borderRadius: 8,
        background: 'var(--theme-cms-surface)',
        color: 'var(--theme-cms-text)',
        border: '1px solid var(--auth-field-border)',
      }}
    >
      {PASSWORD_CHANGED_NOTICE}
    </div>
  )
}
