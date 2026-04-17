'use client'

// Sprint 5a Track D — D3: 3-step account-deletion wizard.
//  Step 1: password re-auth via /api/auth/verify-password
//  Step 2: review impact (what gets anonymized / deleted / reassigned)
//  Step 3: confirmation email sent screen
//
// API contract (provided by Track C):
//  POST /api/auth/verify-password { password } → 200 { ok:true } | 401 { error }
//  POST /api/lgpd/request-deletion {} → 201 { id } | 4xx { error }

import { useState } from 'react'

type Step = 1 | 2 | 3

export interface AccountDeleteWizardProps {
  userEmail: string
  /** Feature-flag gate. Falsy → render "temporarily disabled" stub. */
  enabled?: boolean
}

export function AccountDeleteWizard({ userEmail, enabled = true }: AccountDeleteWizardProps) {
  const [step, setStep] = useState<Step>(1)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)

  if (!enabled) {
    return (
      <div
        role="status"
        className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]"
      >
        A exclusão de conta está temporariamente desabilitada. Volte em breve ou entre em contato
        pelo email <a className="underline" href="mailto:privacidade@bythiagofigueiredo.com">privacidade@bythiagofigueiredo.com</a>.
      </div>
    )
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const r = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!r.ok) {
        setError('Senha inválida ou credenciais rejeitadas. Tente novamente.')
        return
      }
      setStep(2)
    } catch {
      setError('Não foi possível verificar agora. Tente novamente em instantes.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRequest() {
    setError(null)
    setLoading(true)
    try {
      const r = await fetch('/api/lgpd/request-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string; blockers?: string[] }
        if (body.blockers && body.blockers.length > 0) {
          setError(`A exclusão está bloqueada: ${body.blockers.join(', ')}. Ajuste antes de tentar novamente.`)
        } else {
          setError('Não foi possível abrir a solicitação agora. Tente novamente em instantes.')
        }
        return
      }
      const body = (await r.json().catch(() => ({}))) as { requestId?: string }
      if (body.requestId) setRequestId(body.requestId)
      setStep(3)
    } catch {
      setError('Não foi possível abrir a solicitação agora. Tente novamente em instantes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ol aria-label="Progresso" className="flex gap-2 text-xs text-[var(--text-secondary)]">
        <li aria-current={step === 1 ? 'step' : undefined}>1. Identidade</li>
        <li aria-current={step === 2 ? 'step' : undefined}>2. Revisão</li>
        <li aria-current={step === 3 ? 'step' : undefined}>3. Confirmação</li>
      </ol>

      {error && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {step === 1 && (
        <form onSubmit={handleVerify} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Confirmar identidade</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Para sua segurança, re-autentique com sua senha antes de solicitar a exclusão.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span>Senha</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium hover:bg-[var(--bg-subtle)] disabled:opacity-50"
            >
              {loading ? 'Verificando…' : 'Verificar senha'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Revisar impacto</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Ao confirmar, você receberá um email em <strong>{userEmail}</strong>. Após confirmar o
            link, sua conta entra no processo de exclusão:
          </p>
          <ul className="list-disc pl-6 text-sm text-[var(--text-secondary)]">
            <li>Login é bloqueado imediatamente (Fase 1).</li>
            <li>Período de 15 dias de graça — você pode cancelar.</li>
            <li>Dados pessoais são anonimizados, conteúdo é reatribuído ao admin master.</li>
            <li>No 15º dia, a conta é removida (Fase 3).</li>
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--bg-subtle)]"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleRequest}
              disabled={loading}
              className="rounded-md border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
            >
              {loading ? 'Enviando…' : 'Solicitar exclusão'}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Verifique seu email</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Enviamos um link de confirmação para <strong>{userEmail}</strong>. Clique nele dentro de
            24 horas para iniciar a exclusão. Se você não reconhece esta ação, ignore o email — nada
            será feito sem sua confirmação.
          </p>
          {requestId && (
            <p className="text-xs text-[var(--text-tertiary)]">
              Código da solicitação: <code>{requestId}</code>
            </p>
          )}
        </section>
      )}
    </div>
  )
}
