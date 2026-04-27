'use client'

import { useEffect } from 'react'

interface NavigationGuardProps {
  hasUnsavedChanges: boolean
  message?: string
}

export function NavigationGuard({
  hasUnsavedChanges,
  message = 'You have unsaved changes. Are you sure you want to leave?',
}: NavigationGuardProps) {
  useEffect(() => {
    if (!hasUnsavedChanges) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }

    // Intercept Next.js client-side navigation (pushState/replaceState)
    const originalPushState = window.history.pushState.bind(window.history)
    const originalReplaceState = window.history.replaceState.bind(window.history)

    function guardedPushState(data: unknown, unused: string, url?: string | URL | null) {
      if (window.confirm(message)) {
        return originalPushState(data, unused, url)
      }
    }

    function guardedReplaceState(data: unknown, unused: string, url?: string | URL | null) {
      if (window.confirm(message)) {
        return originalReplaceState(data, unused, url)
      }
    }

    window.history.pushState = guardedPushState as typeof window.history.pushState
    window.history.replaceState = guardedReplaceState as typeof window.history.replaceState
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
    }
  }, [hasUnsavedChanges, message])

  return null
}
