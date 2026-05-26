'use client'

import { useState, useEffect } from 'react'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium"
      style={{
        background: 'color-mix(in srgb, var(--gem-warn) 10%, transparent)',
        color: 'var(--gem-warn)',
        border: '1px solid color-mix(in srgb, var(--gem-warn) 20%, transparent)',
      }}
    >
      Sem conexao — dados podem estar desatualizados
    </div>
  )
}
