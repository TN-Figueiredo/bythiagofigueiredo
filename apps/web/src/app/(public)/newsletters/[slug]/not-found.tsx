import Link from 'next/link'
import { headers } from 'next/headers'
import { getActiveTypesForNotFound } from '@/lib/newsletter/queries'
import { resolveSiteByHost } from '@/lib/seo/host'

import enStrings from '@/locales/en.json'
import ptBrStrings from '@/locales/pt-BR.json'

export default async function NewsletterNotFound() {
  const h = await headers()
  const host = (h.get('host') ?? '').split(':')[0] ?? ''
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
  const site = await resolveSiteByHost(host)
  const types = site ? await getActiveTypesForNotFound(site.id) : []

  const dict = (locale === 'pt-BR' ? ptBrStrings : enStrings) as unknown as Record<string, string>
  const t = (key: string) => dict[key] ?? key

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
        {t('newsletter.landing.notFoundExclamation')}
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
        {t('newsletter.landing.notFoundTitle')}
      </h1>

      <p
        style={{
          fontSize: 17,
          color: 'var(--pb-muted)',
          marginBottom: 32,
          maxWidth: 480,
        }}
      >
        {t('newsletter.landing.notFoundBody')}
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
          {types.map((nl) => (
            <Link
              key={nl.slug}
              href={`/newsletters/${nl.slug}`}
              style={{
                display: 'block',
                padding: '16px 20px',
                borderLeft: `4px solid ${nl.color}`,
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
                {nl.name}
              </div>
              {nl.tagline && (
                <div style={{ fontSize: 13, color: 'var(--pb-muted)' }}>{nl.tagline}</div>
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
          {t('newsletter.landing.goHome')}
        </Link>
      )}
    </div>
  )
}
