'use client'

// Sprint 5a Track D — D7: Status card for LGPD requests.
// Renders the current state of a deletion/export/revocation request.
// Optional `poll` prop hits /api/lgpd/request-status/[id] every 5s to
// reflect background-job progress without a page refresh.

import { useEffect, useState } from 'react'

export type LgpdRequestType = 'account_deletion' | 'data_export' | 'consent_revocation'
export type LgpdRequestStatusValue =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed'

export interface LgpdRequestView {
  id: string
  type: LgpdRequestType
  status: LgpdRequestStatusValue
  phase?: 1 | 2 | 3
  scheduledPurgeAt?: string | null
  completedAt?: string | null
  exportDownloadUrl?: string | null
  exportExpiresAt?: string | null
}

export interface LgpdRequestStatusProps {
  request: LgpdRequestView
  poll?: boolean
  pollIntervalMs?: number
}

const TYPE_LABEL: Record<LgpdRequestType, string> = {
  account_deletion: 'Exclusão de conta',
  data_export: 'Exportação de dados',
  consent_revocation: 'Revogação de consentimento',
}

export function LgpdRequestStatus({
  request,
  poll = false,
  pollIntervalMs = 5000,
}: LgpdRequestStatusProps) {
  const [current, setCurrent] = useState<LgpdRequestView>(request)

  useEffect(() => {
    setCurrent(request)
  }, [request])

  useEffect(() => {
    if (!poll) return
    let cancelled = false
    async function tick() {
      try {
        const r = await fetch(`/api/lgpd/request-status/${current.id}`)
        if (!r.ok) return
        const body = (await r.json()) as Partial<LgpdRequestView>
        if (!cancelled) setCurrent((prev) => ({ ...prev, ...body }))
      } catch {
        // Network errors during polling are silent — next tick retries.
      }
    }
    void tick()
    const id = setInterval(tick, pollIntervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [poll, pollIntervalMs, current.id])

  return (
    <div
      data-testid="lgpd-request-status"
      className="flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{TYPE_LABEL[current.type]}</span>
        <span
          className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs uppercase tracking-wide"
          data-status={current.status}
        >
          {current.status}
        </span>
      </div>
      <div className="text-xs text-[var(--text-secondary)]">
        Código: <code>{current.id}</code>
      </div>
      {current.type === 'account_deletion' && current.phase !== undefined && (
        <div className="text-xs text-[var(--text-secondary)]">Fase {current.phase} de 3</div>
      )}
      {current.scheduledPurgeAt && (
        <div className="text-xs text-[var(--text-secondary)]">
          Exclusão definitiva em: {current.scheduledPurgeAt.slice(0, 10)}
        </div>
      )}
      {current.completedAt && (
        <div className="text-xs text-[var(--text-secondary)]">
          Concluído em: {current.completedAt.slice(0, 10)}
        </div>
      )}
      {current.exportDownloadUrl && (
        <a
          href={current.exportDownloadUrl}
          className="w-fit text-xs text-[var(--accent)] underline underline-offset-2"
          rel="noopener"
        >
          Baixar exportação
          {current.exportExpiresAt && ` (expira ${current.exportExpiresAt.slice(0, 10)})`}
        </a>
      )}
    </div>
  )
}
