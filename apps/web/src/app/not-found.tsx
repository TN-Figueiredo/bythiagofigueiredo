import { headers } from 'next/headers'
import Link from 'next/link'

export default async function NotFound() {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const isPt = locale === 'pt-BR'

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '80px 28px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16 }}>404</h1>
      <p style={{ fontSize: 18, marginBottom: 32, color: 'var(--pb-muted)' }}>
        {isPt ? 'Página não encontrada.' : 'Page not found.'}
      </p>
      <Link
        href={isPt ? '/pt' : '/'}
        style={{ color: 'var(--pb-accent)', textDecoration: 'underline' }}
      >
        {isPt ? '← Voltar ao início' : '← Back to home'}
      </Link>
    </main>
  )
}
