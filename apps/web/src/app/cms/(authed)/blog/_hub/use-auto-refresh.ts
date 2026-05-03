'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function useAutoRefresh(intervalMs = 60000) {
  const router = useRouter()
  const lastRefresh = useRef(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return
      router.refresh()
      lastRefresh.current = Date.now()
    }, intervalMs)
    return () => clearInterval(timer)
  }, [router, intervalMs])

  return {
    lastRefresh,
    refreshNow: () => { router.refresh(); lastRefresh.current = Date.now() },
  }
}
