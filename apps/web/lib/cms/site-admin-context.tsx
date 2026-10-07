'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Cortesia de tela para o degrau "administrar o site": o layout do /cms (server
 * component) pergunta `requireSiteAdminScope` uma vez e entrega o booleano aqui.
 * O SERVIDOR é a verdade — toda action restrita confere de novo. O padrão é
 * `false` (sem provider, o controle restrito não aparece).
 */
const SiteAdminContext = createContext<boolean>(false)

export function SiteAdminProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <SiteAdminContext value={value}>{children}</SiteAdminContext>
}

export function useCanAdminSite(): boolean {
  return useContext(SiteAdminContext)
}

export function siteAdminOnlyText(action: string): string {
  return `Só quem administra o site pode ${action}.`
}

/**
 * O motivo VISÍVEL no lugar de um controle que a editora não tem (não é
 * `title`: fica escrito na tela). Cores literais de propósito — `color-mix`
 * some no Opera.
 */
export function AdminOnlyNote({ action, className }: { action: string; className?: string }) {
  return (
    <span
      role="note"
      data-testid="admin-only-note"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 6,
        border: '1px dashed rgba(148, 163, 184, 0.55)',
        fontSize: 11,
        lineHeight: 1.35,
        opacity: 0.9,
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      {siteAdminOnlyText(action)}
    </span>
  )
}
