import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeScript } from '@/components/ui/theme-toggle'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Thiago Figueiredo — Creator & Builder',
  description:
    'Hub de Thiago Figueiredo. YouTube, blog, newsletter e projetos. Build in public, learn out loud.',
  openGraph: {
    title: 'Thiago Figueiredo — Creator & Builder',
    description:
      'Hub de Thiago Figueiredo. YouTube, blog, newsletter e projetos.',
    type: 'website',
    locale: 'pt_BR',
    url: 'https://bythiagofigueiredo.com',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  )
}
