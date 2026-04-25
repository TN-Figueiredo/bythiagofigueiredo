import { cookies, headers } from 'next/headers'
import type { Metadata } from 'next'
import { NewslettersHub } from './components/NewslettersHub'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const isPt = locale === 'pt-BR'
  return {
    title: 'Newsletters — by Thiago Figueiredo',
    description: isPt
      ? 'Quatro newsletters, um email — escolhe o que cabe na sua frequência.'
      : 'Four newsletters, one email — pick what fits your frequency.',
    alternates: {
      canonical: isPt
        ? 'https://bythiagofigueiredo.com/pt/newsletters'
        : 'https://bythiagofigueiredo.com/newsletters',
      languages: {
        en: 'https://bythiagofigueiredo.com/newsletters',
        pt: 'https://bythiagofigueiredo.com/pt/newsletters',
      },
    },
  }
}

export default async function NewslettersPage() {
  const cookieStore = await cookies()
  const currentTheme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
  return <NewslettersHub locale={locale} currentTheme={currentTheme} />
}
