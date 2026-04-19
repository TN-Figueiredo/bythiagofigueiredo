import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { NewslettersHub } from '../../newsletters/components/NewslettersHub'

export const metadata: Metadata = {
  title: 'Newsletters — by Thiago Figueiredo',
  description: 'Quatro newsletters, um email — escolhe o que cabe na sua frequência.',
  alternates: {
    canonical: 'https://bythiagofigueiredo.com/pt-BR/newsletters',
    languages: { en: 'https://bythiagofigueiredo.com/newsletters' },
  },
}

export default async function NewslettersPagePtBR() {
  const cookieStore = await cookies()
  const currentTheme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  return <NewslettersHub locale="pt-BR" currentTheme={currentTheme} />
}
