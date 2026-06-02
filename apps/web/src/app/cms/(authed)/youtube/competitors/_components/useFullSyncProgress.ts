'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSyncStatus } from '../actions'

interface SyncProgress {
  progress: number
  total: number | null
  percent: number
  status: string
  error: string | null
}

export function useFullSyncProgress(channelId: string, isActive: boolean): SyncProgress {
  const router = useRouter()
  const [state, setState] = useState<SyncProgress>({
    progress: 0,
    total: null,
    percent: 0,
    status: 'idle',
    error: null,
  })

  const poll = useCallback(async () => {
    const s = await getSyncStatus(channelId)
    const percent = s.youtubeVideoCount && s.youtubeVideoCount > 0
      ? Math.min(100, Math.round((s.progress / s.youtubeVideoCount) * 100))
      : 0
    setState({
      progress: s.progress,
      total: s.youtubeVideoCount,
      percent,
      status: s.status,
      error: s.error,
    })
    return s.status
  }, [channelId])

  useEffect(() => {
    if (!isActive) return

    const id = setInterval(async () => {
      const status = await poll()
      if (status !== 'syncing') {
        clearInterval(id)
        router.refresh()
      }
    }, 3000)

    // Initial poll
    poll()

    return () => clearInterval(id)
  }, [isActive, poll, router])

  return state
}
