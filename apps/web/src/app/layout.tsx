import type { Metadata } from 'next'
import { Inter, Fraunces, JetBrains_Mono, Caveat } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { ThemeScript } from '@/components/ui/theme-toggle'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces-var',
  display: 'swap',
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-var',
  display: 'swap',
})
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat-var',
  display: 'swap',
})

// metadataBase drives resolution of relative URLs in alternates / openGraph /
// twitter images. Without it, Next emits a console warning and relative hrefs
// (e.g. blog hreflang alternates) don't expand to absolute. Falls back to the
// prod host so local dev without NEXT_PUBLIC_APP_URL still builds.
const metadataBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const theme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  return (
    <html
      lang="pt-BR"
      className={`${theme === 'dark' ? 'dark' : ''} ${inter.variable} ${fraunces.variable} ${jetbrains.variable} ${caveat.variable}`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  )
}
