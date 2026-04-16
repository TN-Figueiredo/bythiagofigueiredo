'use client'

// Sprint 5a Track D — D5: Per-category consent revocation panel.
// Renders the server-provided list of active consents; the user can
// revoke analytics/marketing individually. Functional consent is a
// contract requirement and cannot be revoked while the account exists
// (LGPD Art. 9 legitimate interest + Art. 7 V — contract execution).

import { useState } from 'react'

export type ConsentCategory = 'functional' | 'analytics' | 'marketing'

export interface ConsentRecord {
  id: string
  category: ConsentCategory
  granted: boolean
  grantedAt: string
  withdrawnAt?: string | null
  version: number
}

const CATEGORY_LABEL: Record<ConsentCategory, string> = {
  functional: 'Funcionais',
  analytics: 'Analytics',
  marketing: 'Marketing',
}

const CATEGORY_HELP: Record<ConsentCategory, string> = {
  functional: 'Necessário para o site funcionar — não pode ser revogado.',
  analytics: 'Medição de uso agregada, sem identificação pessoal.',
  marketing: 'Personalização de conteúdo e campanhas.',
}

export interface ConsentRevocationPanelProps {
  consents: ConsentRecord[]
}

export function ConsentRevocationPanel({ consents }: ConsentRevocationPanelProps) {
  const [rows, setRows] = useState<ConsentRecord[]>(consents)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)]">
        Nenhum consentimento registrado até o momento.
      </p>
    )
  }

  async function revoke(row: ConsentRecord) {
    setBusyId(row.id)
    setError(null)
    try {
      const r = await fetch('/api/consents/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_id: row.id, category: row.category }),
      })
      if (!r.ok) {
        setError('Não foi possível revogar agora. Tente novamente em instantes.')
        return
      }
      const withdrawnAt = new Date().toISOString()
      setRows((prev) =>
        prev.map((c) => (c.id === row.id ? { ...c, granted: false, withdrawnAt } : c)),
      )
    } catch {
      setError('Não foi possível revogar agora. Tente novamente em instantes.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const isFunctional = row.category === 'functional'
          const active = row.granted && !row.withdrawnAt
          return (
            <li
              key={row.id}
              className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-[var(--text)]">
                  {CATEGORY_LABEL[row.category]}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {CATEGORY_HELP[row.category]}
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {active ? `Ativo desde ${row.grantedAt}` : `Revogado em ${row.withdrawnAt ?? '—'}`}
                  {' · '}v{row.version}
                </span>
              </div>
              {!isFunctional && active && (
                <button
                  type="button"
                  onClick={() => revoke(row)}
                  disabled={busyId === row.id}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg-subtle)] disabled:opacity-50"
                  aria-label={`Revogar ${CATEGORY_LABEL[row.category]}`}
                >
                  {busyId === row.id ? 'Revogando…' : `Revogar ${CATEGORY_LABEL[row.category]}`}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
