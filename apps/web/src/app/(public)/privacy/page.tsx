import { cookies, headers } from 'next/headers'
import { LegalShell } from '@/components/legal/legal-shell'
import type { Metadata } from 'next'

function negotiateLocale(acceptLang: string | null, cookieLocale: string | null) {
  if (cookieLocale && ['pt-BR', 'en'].includes(cookieLocale)) return cookieLocale as 'pt-BR' | 'en'
  if (!acceptLang) return 'pt-BR' as const
  const lang = acceptLang.split(',')[0]?.split('-')[0]?.toLowerCase()
  return lang === 'en' ? ('en' as const) : ('pt-BR' as const)
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Política de Privacidade | bythiagofigueiredo',
    description: 'LGPD-compliant — dados coletados, direitos do titular, cookies.',
    alternates: { canonical: '/privacy' },
    robots: { index: true, follow: true },
  }
}

export default async function PrivacyPage() {
  const locale = negotiateLocale(
    (await headers()).get('accept-language'),
    (await cookies()).get('preferred_locale')?.value ?? null
  )
  const { default: MDXContent } =
    locale === 'en'
      ? await import('@/content/legal/privacy.en.mdx')
      : await import('@/content/legal/privacy.pt-BR.mdx')
  return (
    <LegalShell locale={locale} lastUpdated="2026-04-16">
      <MDXContent />
    </LegalShell>
  )
}
