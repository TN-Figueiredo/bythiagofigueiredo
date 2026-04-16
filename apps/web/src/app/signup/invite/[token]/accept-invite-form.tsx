'use client'

import { useState, useTransition } from 'react'
import { acceptInviteWithPassword } from './actions'

interface Props {
  token: string
  email: string
}

/**
 * Client component for the password-creation step of the invite flow.
 *
 * Renders a two-field form (password + confirm). Submits to the
 * `acceptInviteWithPassword` server action which, on success, performs a
 * cross-domain redirect to the target site's `/cms/login` (org invites go
 * to the master ring; site invites go to the site's primary_domain).
 *
 * Local validation only:
 *  - both passwords must match
 *  - minimum 8 characters
 *
 * Real auth errors (email_already_registered, signup_failed, rpc_failed)
 * come back via `?error=<code>` on the server redirect and are rendered
 * by the parent Server Component.
 */
export function AcceptInviteForm({ token, email }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLocalError(null)
    if (password.length < 8) {
      setLocalError('Senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setLocalError('As senhas não conferem.')
      return
    }
    startTransition(() => {
      void acceptInviteWithPassword(token, password)
    })
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <input type="hidden" name="email" value={email} readOnly />

      <div>
        <label htmlFor="invite-password" className="block text-sm font-medium mb-1">
          Senha
        </label>
        <input
          id="invite-password"
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="invite-confirm" className="block text-sm font-medium mb-1">
          Confirmar senha
        </label>
        <input
          id="invite-confirm"
          type="password"
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Digite a senha novamente"
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      {localError && (
        <div role="alert" className="text-sm text-red-600">
          {localError}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Processando…' : 'Criar conta e aceitar convite'}
      </button>
    </form>
  )
}
