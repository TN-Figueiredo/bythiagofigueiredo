'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export interface AudioFilterState {
  q: string | null
  type: 'music' | 'sfx' | null
  status: 'downloaded' | 'pending' | 'retired' | null
  category: string | null
  energy_min: number | null
  energy_max: number | null
  bpm_min: number | null
  bpm_max: number | null
  dur: string | null
  key: string | null
  mode: 'major' | 'minor' | null
  mood: string[] | null
  instruments: string[] | null
  sort: string
}

const DEFAULTS: AudioFilterState = {
  q: null, type: null, status: null, category: null,
  energy_min: null, energy_max: null, bpm_min: null, bpm_max: null,
  dur: null, key: null, mode: null, mood: null, instruments: null, sort: 'newest',
}

export function serializeFilters(partial: Partial<AudioFilterState>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(partial)) {
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    if (k === 'sort' && v === 'newest') continue
    params.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  return params
}

export function deserializeFilters(params: URLSearchParams): AudioFilterState {
  const numOrNull = (key: string) => {
    const v = params.get(key)
    return v ? parseInt(v, 10) : null
  }
  const csvOrNull = (key: string) => {
    const v = params.get(key)
    return v ? v.split(',').filter(Boolean) : null
  }
  return {
    q: params.get('q') || null,
    type: (params.get('type') as AudioFilterState['type']) || null,
    status: (params.get('status') as AudioFilterState['status']) || null,
    category: params.get('category') || null,
    energy_min: numOrNull('energy_min'),
    energy_max: numOrNull('energy_max'),
    bpm_min: numOrNull('bpm_min'),
    bpm_max: numOrNull('bpm_max'),
    dur: params.get('dur') || null,
    key: params.get('key') || null,
    mode: (params.get('mode') as AudioFilterState['mode']) || null,
    mood: csvOrNull('mood'),
    instruments: csvOrNull('instruments'),
    sort: params.get('sort') || 'newest',
  }
}

function replaceUrl(params: URLSearchParams): void {
  if (typeof window === 'undefined') return
  const qs = params.toString()
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  window.history.replaceState(null, '', url)
}

export function useAudioFilters() {
  const searchParams = useSearchParams()
  const [filters, setFiltersLocal] = useState<AudioFilterState>(() => deserializeFilters(searchParams))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const setFilters = useCallback((updater: Partial<AudioFilterState> | ((prev: AudioFilterState) => AudioFilterState)) => {
    setFiltersLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        replaceUrl(serializeFilters(next))
      }, 300)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setFiltersLocal(DEFAULTS)
    clearTimeout(debounceRef.current)
    replaceUrl(new URLSearchParams())
  }, [])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'sort') return v !== 'newest'
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
  }).length

  return { filters, setFilters, clearAll, activeCount }
}
