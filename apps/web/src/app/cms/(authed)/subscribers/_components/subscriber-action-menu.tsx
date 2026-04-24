'use client'

import { useState, useEffect, useRef } from 'react'
import type { SubscriberRow } from './subscriber-table'

export function ActionMenu({
  row,
  disabled,
}: {
  row: SubscriberRow
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (disabled) {
    return (
      <span
        className="text-xs px-2 py-1 rounded cursor-not-allowed"
        style={{ color: 'var(--cms-text-dim)' }}
        title="PII anonimizado por LGPD"
      >
        ⋯
      </span>
    )
  }

  const items: { label: string; danger?: boolean; action: string }[] = []
  if (row.status === 'confirmed') {
    items.push(
      { label: 'Ver detalhes', action: 'view' },
      { label: 'Histórico de engajamento', action: 'history' },
      { label: 'Reenviar boas-vindas', action: 'resend_welcome' },
      { label: 'Copiar email', action: 'copy' },
      { label: 'Cancelar assinatura', action: 'unsubscribe', danger: true },
    )
  } else if (row.status === 'pending') {
    items.push(
      { label: 'Ver detalhes', action: 'view' },
      { label: 'Reenviar confirmação', action: 'resend_confirm' },
      { label: 'Copiar email', action: 'copy' },
      { label: 'Remover expirado', action: 'delete', danger: true },
    )
  } else if (row.status === 'bounced') {
    items.push(
      { label: 'Ver detalhes', action: 'view' },
      { label: 'Detalhes do bounce', action: 'bounce_details' },
      { label: 'Tentar reativar', action: 'retry' },
      { label: 'Remover', action: 'delete', danger: true },
    )
  } else {
    items.push({ label: 'Ver detalhes', action: 'view' })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-2 py-1 rounded transition-colors"
        style={{ color: 'var(--cms-text-dim)' }}
        aria-label="Ações"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-lg border shadow-lg z-10 py-1 min-w-[180px]"
          role="menu"
          style={{ background: 'var(--cms-surface)', borderColor: 'var(--cms-border)' }}
        >
          {items.map((item) => (
            <button
              type="button"
              key={item.action}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                if (item.action === 'copy') {
                  navigator.clipboard.writeText(row.email).catch(() => {})
                }
              }}
              className={`w-full text-left text-xs px-3 py-1.5 transition-colors hover:bg-cms-surface-hover ${item.danger ? 'text-cms-red' : 'text-cms-text'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
