'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface YtPortalProps {
  children: ReactNode
}

/**
 * SSR-safe portal wrapper for YouTube CMS modals and drawers.
 * Renders children into the [data-cms-section="youtube"] container
 * so CSS scoped to that attribute (e.g. .seg-pill, .ic-btn, .btn)
 * still applies inside portalled modals/drawers.
 * Falls back to document.body if the container is not found.
 */
export function YtPortal({ children }: YtPortalProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const target =
      document.querySelector<HTMLElement>('[data-cms-section="youtube"]') ??
      document.body
    setContainer(target)
  }, [])

  if (!container) return null

  return createPortal(children, container)
}
