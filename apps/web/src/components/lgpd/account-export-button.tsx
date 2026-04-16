'use client'

// Sprint 5a Track D — D4: Data-export trigger.
// POSTs /api/lgpd/request-export (async — the route queues the export and
// emails the signed URL when ready). UI acknowledges receipt; it never
// renders a direct download link because the signed URL is only delivered
// via email (spec Section 2 v2 + post-audit contract alignment).

import { useState } from 'react'

export interface AccountExportButtonProps {
  enabled?: boolean
}

type State =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'requested'; requestId: string; expiresAt: string }
  | { kind: 'error'; message: string }

export function AccountExportButton({ enabled = true }: AccountExportButtonProps) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  if (!enabled) {
    return (
      <div
        role="status"
        className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]"
      >
        A exportação de dados está temporariamente desabilitada. Entre em contato por{' '}
        <a className="underline" href="mailto:privacidade@bythiagofigueiredo.com">
          privacidade@bythiagofigueiredo.com
        </a>.
      </div>
    )
  }

  async function handleClick() {
    setState({ kind: 'pending' })
    try {
      const r = await fetch('/api/lgpd/request-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (r.status === 429) {
        setState({
          kind: 'error',
          message:
            'Você já exportou seus dados recentemente. O limite é uma exportação a cada 30 dias — tente novamente depois.',
        })
        return
      }
      if (!r.ok) {
        setState({
          kind: 'error',
          message: 'Não foi possível gerar sua exportação agora. Tente novamente em instantes.',
        })
        return
      }
      const body = (await r.json().catch(() => ({}))) as {
        requestId?: string
        expiresAt?: string
      }
      if (!body.requestId) {
        setState({
          kind: 'error',
          message:
            'Exportação iniciada, mas não recebemos o código da solicitação. Verifique seu email.',
        })
        return
      }
      setState({
        kind: 'requested',
        requestId: body.requestId,
        expiresAt: body.expiresAt ?? '',
      })
    } catch {
      setState({
        kind: 'error',
        message: 'Não foi possível gerar sua exportação agora. Tente novamente em instantes.',
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {state.kind === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300"
        >
          {state.message}
        </p>
      )}
      <div>
        <button
          type="button"
          onClick={handleClick}
          disabled={state.kind === 'pending'}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
        >
          {state.kind === 'pending' ? 'Gerando…' : 'Exportar meus dados'}
        </button>
      </div>
      {state.kind === 'requested' && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-3 text-sm text-[var(--text)]"
        >
          <p>
            Exportação iniciada. Você receberá um email com o link de download em alguns
            minutos. ID da solicitação: <code>{state.requestId}</code>
          </p>
          {state.expiresAt && (
            <p className="text-xs text-[var(--text-tertiary)]">
              O link expira em {new Date(state.expiresAt).toLocaleString('pt-BR')}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
