'use client'

import { useState, useEffect, useRef } from 'react'
import { gemMix } from '@/lib/pipeline/gem-design'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)
  const wasOffline = useRef(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    if (!navigator.onLine) wasOffline.current = true
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => {
      wasOffline.current = true
      setIsOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {!isOnline ? (
        <div
          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium"
          style={{
            background: gemMix('--gem-warn', 10),
            color: 'var(--gem-warn)',
            border: `1px solid ${gemMix('--gem-warn', 20)}`,
          }}
        >
          Sem conexão — dados podem estar desatualizados
        </div>
      ) : wasOffline.current ? (
        <span className="sr-only">Conexão restaurada</span>
      ) : null}
    </div>
  )
}
