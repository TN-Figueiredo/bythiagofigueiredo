'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

// Next 16 regression guard (found 2026-09-06 via authenticated e2e):
// `next/link` imported from a Server Component now resolves to the
// react-server build — a plain function, NOT a client reference — so passing
// it as `linkComponent={Link}` to the client-side <CmsAdminProvider> throws
// "Functions cannot be passed directly to Client Components" and /cms 500s.
// Wrapping it in a 'use client' module makes it a serializable client
// reference again while keeping soft navigation (the provider's fallback is a
// plain <a>, which would force full document loads on every CMS link).
export default function CmsLink(props: {
  href: string
  children: ReactNode
  className?: string
  target?: string
  rel?: string
  title?: string
  style?: CSSProperties
}) {
  return <Link {...props} />
}
