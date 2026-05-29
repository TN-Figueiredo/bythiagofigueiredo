'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import type { KeyedMutator } from 'swr'

export interface UseCoworkSyncOptions<T> {
  key: string | null
  fetcher: (key: string) => Promise<T>
  refreshInterval?: number
  dedupingInterval?: number
  pollTimeout?: number
  fallbackData?: T
}

export type CoworkSyncState = 'idle' | 'polling' | 'received' | 'timeout'

export interface UseCoworkSyncReturn<T> {
  data: T | undefined
  syncState: CoworkSyncState
  mutate: KeyedMutator<T>
  retryPolling: () => void
}

const DEFAULT_REFRESH_INTERVAL = 5_000
const DEFAULT_DEDUPING_INTERVAL = 4_900
const DEFAULT_POLL_TIMEOUT = 120_000
const TIMEOUT_CHECK_INTERVAL = 1_000

export function useCoworkSync<T>(options: UseCoworkSyncOptions<T>): UseCoworkSyncReturn<T> {
  const {
    key,
    fetcher,
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    dedupingInterval = DEFAULT_DEDUPING_INTERVAL,
    pollTimeout = DEFAULT_POLL_TIMEOUT,
    fallbackData,
  } = options

  const [timedOut, setTimedOut] = useState(false)
  const pollingStartRef = useRef<number | null>(null)
  const prevKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key
      if (key !== null) {
        pollingStartRef.current = Date.now()
        setTimedOut(false)
      } else {
        pollingStartRef.current = null
        setTimedOut(false)
      }
    }
  }, [key])

  const effectiveKey = key !== null && !timedOut ? key : null

  const { data, mutate } = useSWR<T>(effectiveKey, fetcher, {
    refreshInterval,
    dedupingInterval,
    revalidateOnFocus: true,
    fallbackData,
  })

  useEffect(() => {
    if (key === null || timedOut) return

    const interval = setInterval(() => {
      if (pollingStartRef.current === null) return
      if (Date.now() - pollingStartRef.current >= pollTimeout) {
        setTimedOut(true)
      }
    }, TIMEOUT_CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [key, timedOut, pollTimeout])

  const retryPolling = useCallback(() => {
    pollingStartRef.current = Date.now()
    setTimedOut(false)
  }, [])

  let syncState: CoworkSyncState
  if (key === null) {
    syncState = 'idle'
  } else if (timedOut) {
    syncState = 'timeout'
  } else if (data !== undefined) {
    syncState = 'received'
  } else {
    syncState = 'polling'
  }

  return { data, syncState, mutate, retryPolling }
}
