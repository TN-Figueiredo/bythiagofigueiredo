import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { NewslettersHub } from './components/NewslettersHub'

export const metadata: Metadata = {
  title: 'Newsletters — by Thiago Figueiredo',
  description: 'Four newsletters, one email — pick what fits your frequency.',
  alternates: {
    canonical: 'https://bythiagofigueiredo.com/newsletters',
    languages: { 'pt-BR': 'https://bythiagofigueiredo.com/pt-BR/newsletters' },
  },
}

export default async function NewslettersPage() {
  const cookieStore = await cookies()
  const currentTheme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  return <NewslettersHub locale="en" currentTheme={currentTheme} />
}
