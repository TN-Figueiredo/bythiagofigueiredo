'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export interface BRollFilterState {
  q: string | null
  source_type: 'pessoal' | 'generico' | null
  status: 'ready' | 'pending' | null
  category: string | null
  resolution: '4k' | '1080p' | '720p' | null
  duration: '<5s' | '5-15s' | '>15s' | null
  codec: 'h265' | 'h264' | null
  fps: '24' | '30' | '60' | null
  tags: string[] | null
  sort: string
}

const DEFAULTS: BRollFilterState = {
  q: null, source_type: null, status: null, category: null,
  resolution: null, duration: null, codec: null, fps: null,
  tags: null, sort: 'newest',
}

export function serializeFilters(partial: Partial<BRollFilterState>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(partial)) {
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    if (k === 'sort' && v === 'newest') continue
    params.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  return params
}

export function deserializeFilters(params: URLSearchParams): BRollFilterState {
  const csvOrNull = (key: string) => {
    const v = params.get(key)
    return v ? v.split(',').filter(Boolean) : null
  }
  return {
    q: params.get('q') || null,
    source_type: (params.get('source_type') as BRollFilterState['source_type']) || null,
    status: (params.get('status') as BRollFilterState['status']) || null,
    category: params.get('category') || null,
    resolution: (params.get('resolution') as BRollFilterState['resolution']) || null,
    duration: (params.get('duration') as BRollFilterState['duration']) || null,
    codec: (params.get('codec') as BRollFilterState['codec']) || null,
    fps: (params.get('fps') as BRollFilterState['fps']) || null,
    tags: csvOrNull('tags'),
    sort: params.get('sort') || 'newest',
  }
}

export function useBRollFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [filters, setFiltersLocal] = useState<BRollFilterState>(() => deserializeFilters(searchParams))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const setFilters = useCallback((updater: Partial<BRollFilterState> | ((prev: BRollFilterState) => BRollFilterState)) => {
    setFiltersLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const params = serializeFilters(next)
        const qs = params.toString()
        router.replace(qs ? `?${qs}` : '?', { scroll: false })
      }, 300)
      return next
    })
  }, [router])

  const clearAll = useCallback(() => {
    setFiltersLocal(DEFAULTS)
    router.replace('?', { scroll: false })
  }, [router])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'sort') return v !== 'newest'
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
  }).length

  return { filters, setFilters, clearAll, activeCount }
}
