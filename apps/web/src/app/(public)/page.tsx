import type { Metadata } from 'next'
import { PinboardHome } from './components/PinboardHome'

export const metadata: Metadata = {
  title: 'Thiago Figueiredo — Creator & Builder',
  description: 'Writing, videos, and experiments from the edge of the keyboard.',
  alternates: {
    canonical: 'https://bythiagofigueiredo.com',
    languages: { 'pt-BR': 'https://bythiagofigueiredo.com/pt-BR' },
  },
}

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function HomePage({ searchParams }: HomeProps) {
  const sp = await searchParams
  const showInsufficientAccess = sp.error === 'insufficient_access'
  return (
    <>
      {showInsufficientAccess && (
        <div
          role="alert"
          aria-live="polite"
          data-testid="insufficient-access-banner"
          style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '12px 16px',
            borderBottom: '1px solid #f59e0b',
            textAlign: 'center',
          }}
        >
          Você não tem acesso a essa área.
        </div>
      )}
      <PinboardHome locale="en" />
    </>
  )
}
