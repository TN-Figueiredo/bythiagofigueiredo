'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error: e1 } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/signin/reset`,
    })
    if (e1) { setError(e1.message); return }
    setSent(true)
  }

  if (sent) return <main><p>Verifique seu email pra redefinir a senha.</p></main>

  return (
    <main>
      <h1>Esqueci minha senha</h1>
      <form onSubmit={onSubmit}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Enviar link</button>
      </form>
    </main>
  )
}
