import type { Metadata } from 'next'
import { Inter, Fraunces, JetBrains_Mono, Caveat, Source_Serif_4 } from 'next/font/google'
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
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif-var',
  display: 'swap',
  style: ['normal', 'italic'],
  weight: ['300', '400', '500', '600'],
})

// metadataBase drives resolution of relative URLs in alternates / openGraph /
// twitter images. Without it, Next emits a console warning and relative hrefs
// (e.g. blog hreflang alternates) don't expand to absolute. Falls back to the
// prod host so local dev without NEXT_PUBLIC_APP_URL still builds.
//
// Per-site metadata (title, description, openGraph, twitter, etc.) is resolved
// in `app/(public)/layout.tsx` via `generateRootMetadata(getSiteSeoConfig(...))`
// so that multi-tenant builds pick up the correct site by host. This root
// layout is shell-only: HTML structure, font, ThemeScript, and the safe
// metadataBase fallback for routes that run outside the `(public)` group
// (e.g. `/cms`, `/account`) before their own layouts resolve metadata.
const metadataBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
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
      className={`${theme === 'dark' ? 'dark' : ''} ${inter.variable} ${fraunces.variable} ${jetbrains.variable} ${caveat.variable} ${sourceSerif.variable}`}
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
