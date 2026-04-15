'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function ResetPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Senhas não coincidem'); return }
    if (password.length < 8) { setError('Senha deve ter pelo menos 8 caracteres'); return }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error: e1 } = await supabase.auth.updateUser({ password })
    if (e1) { setError(e1.message); return }
    router.push('/cms')
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
