'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function ResetPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  // C4: gate form on PASSWORD_RECOVERY event; default false until confirmed
  const [canReset, setCanReset] = useState(false)

  // C4: subscribe to auth state change and require PASSWORD_RECOVERY event
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCanReset(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return 'Senha deve ter pelo menos 8 caracteres.'
    if (!/[A-Za-z]/.test(pw)) return 'Senha muito fraca. Use ao menos 8 caracteres com letras e números.'
    if (!/\d/.test(pw)) return 'Senha muito fraca. Use ao menos 8 caracteres com letras e números.'
    return null
  }

  function mapSupabaseError(msg: string): string {
    if (/should be different/i.test(msg)) return 'A nova senha deve ser diferente da atual.'
    if (/weak password/i.test(msg)) return 'Senha muito fraca. Use ao menos 8 caracteres com letras e números.'
    return 'Não foi possível redefinir a senha. Tente novamente.'
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!canReset) return
    if (password !== confirm) { setError('Senhas não coincidem.'); return }
    const validationError = validatePassword(password)
    if (validationError) { setError(validationError); return }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error: e1 } = await supabase.auth.updateUser({ password })
    if (e1) { setError(mapSupabaseError(e1.message)); return }
    // I25: force full page reload so SSR picks up the new session cookie
    window.location.href = '/cms'
  }

  // C4: if there's a session but it isn't a recovery session, block the form
  if (!canReset) {
    return (
      <main>
        <h1>Nova senha</h1>
        <p>Use o link enviado por email para redefinir sua senha.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Nova senha</h1>
      <form onSubmit={onSubmit}>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Nova senha" />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Confirme" />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Atualizar senha</button>
      </form>
    </main>
  )
}
