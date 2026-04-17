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
