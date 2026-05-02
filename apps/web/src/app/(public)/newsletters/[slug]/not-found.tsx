import Link from 'next/link'
import { headers } from 'next/headers'
import { getActiveTypesForNotFound } from '@/lib/newsletter/queries'
import { resolveSiteByHost } from '@/lib/seo/host'

export default async function NewsletterNotFound() {
  const h = await headers()
  const host = (h.get('host') ?? '').split(':')[0] ?? ''
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
  const site = await resolveSiteByHost(host)
  const types = site ? await getActiveTypesForNotFound(site.id) : []

  const isPt = locale === 'pt-BR'

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 28px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-caveat-var), cursive',
          fontSize: 56,
          color: 'var(--pb-accent)',
          transform: 'rotate(-3deg)',
          marginBottom: 16,
        }}
      >
        {isPt ? 'epa.' : 'huh.'}
      </p>

      <h1
        style={{
          fontFamily: 'var(--font-fraunces-var), serif',
          fontSize: 44,
          fontWeight: 500,
          color: 'var(--pb-ink)',
          marginBottom: 12,
        }}
      >
        {isPt ? 'Essa newsletter não existe.' : "That newsletter doesn't exist."}
      </h1>

      <p
        style={{
          fontSize: 17,
          color: 'var(--pb-muted)',
          marginBottom: 32,
          maxWidth: 480,
        }}
      >
        {isPt
          ? 'Talvez o link tenha quebrado. Aqui estão as que existem agora:'
          : 'Maybe the link broke. Here are the ones that exist now:'}
      </p>

      {types.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            width: '100%',
            maxWidth: 600,
            marginBottom: 32,
          }}
        >
          {types.map((t) => (
            <Link
              key={t.slug}
              href={`/newsletters/${t.slug}`}
              style={{
                display: 'block',
                padding: '16px 20px',
                borderLeft: `4px solid ${t.color}`,
                background: 'var(--pb-paper)',
                borderRadius: 6,
                textDecoration: 'none',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-fraunces-var), serif',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--pb-ink)',
                  marginBottom: 4,
                }}
              >
                {t.name}
              </div>
              {t.tagline && (
                <div style={{ fontSize: 13, color: 'var(--pb-muted)' }}>{t.tagline}</div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-jetbrains-var), monospace',
            fontSize: 14,
            color: 'var(--nl-accent, var(--pb-accent))',
            textDecoration: 'underline',
          }}
        >
          {isPt ? 'Ir pra home' : 'Go to homepage'}
        </Link>
      )}
    </div>
  )
}
