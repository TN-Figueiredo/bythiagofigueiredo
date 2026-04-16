import type { ReactNode } from 'react'

export const metadata = {
  title: 'consumer-smoke',
  description: 'Tarball smoke test fixture',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
