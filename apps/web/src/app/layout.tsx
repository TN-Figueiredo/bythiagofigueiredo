import type { Metadata } from 'next'
import './globals.css'

// TODO: [APP_NAME] Update app name and description
export const metadata: Metadata = {
  title: 'App Name',
  description: 'App description',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
