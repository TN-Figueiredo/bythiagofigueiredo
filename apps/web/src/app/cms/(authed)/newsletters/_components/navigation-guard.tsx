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
      e.returnValue = message
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, message])

  return null
}
