'use client'

// Sprint 5a Track D — D4: Data-export trigger.
// POSTs /api/lgpd/request-export (synchronous — spec Section 2 v2) and
// renders the signed download URL when ready. Also handles 429 rate
// limits (server enforces 1/30d) with human-readable error.

import { useState } from 'react'

export interface AccountExportButtonProps {
  enabled?: boolean
}

type State =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ready'; url: string; id?: string }
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
      const body = (await r.json().catch(() => ({}))) as { id?: string; downloadUrl?: string }
      if (!body.downloadUrl) {
        setState({
          kind: 'error',
          message: 'Exportação criada, mas o link ainda não está disponível. Verifique seu email.',
        })
        return
      }
      setState({ kind: 'ready', url: body.downloadUrl, id: body.id })
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
      {state.kind === 'ready' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--text-secondary)]">
            Pronto! Seu arquivo estará disponível por 7 dias. Também enviamos o link para seu email.
          </p>
          <a
            href={state.url}
            className="inline-flex w-fit items-center rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20"
            rel="noopener"
          >
            Baixar exportação
          </a>
          {state.id && (
            <p className="text-xs text-[var(--text-tertiary)]">
              Código: <code>{state.id}</code>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
