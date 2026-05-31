'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface PollResult {
  views: number
  likes: number
  polledAt: string
  delta?: { views: number; likes: number }
}

export function usePollStats(testId: string, enabled = true) {
  const [data, setData] = useState<PollResult | null>(null)
  const [loading, setLoading] = useState(false)
  const prevRef = useRef<{ views: number; likes: number } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await fetch(`/api/youtube/poll-stats?testId=${testId}`)
      if (!res.ok) return
      const json = await res.json()
      if (json.skipped) return

      const prev = prevRef.current
      const delta = prev
        ? { views: json.views - prev.views, likes: json.likes - prev.likes }
        : undefined

      prevRef.current = { views: json.views, likes: json.likes }
      setData({ views: json.views, likes: json.likes, polledAt: json.polledAt, delta })
    } catch {
      // Silent fail — next poll will retry
    } finally {
      setLoading(false)
    }
  }, [testId, enabled])

  useEffect(() => {
    if (!enabled) return

    poll()
    intervalRef.current = setInterval(poll, 60_000)

    const onVisibility = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      if (!document.hidden) {
        poll()
        intervalRef.current = setInterval(poll, 60_000)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [poll, enabled])

  return { data, loading }
}
