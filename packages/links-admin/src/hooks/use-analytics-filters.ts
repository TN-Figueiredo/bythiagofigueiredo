'use client'
import { useState, useCallback } from 'react'
import type { DateRange } from '../types'

type SourceType = 'manual' | 'campaign' | 'newsletter' | 'blog' | 'social' | 'print' | null
type DeviceType = 'mobile' | 'desktop' | 'tablet' | null
type Preset = '7d' | '30d' | '90d'

function getDefaultRange(): DateRange {
  const to = new Date()
  const from = new Date(to.getTime() - 7 * 86400000)
  return { from, to }
}

export function useAnalyticsFilters() {
  const [dateRange, setDateRangeState] = useState<DateRange>(getDefaultRange)
  const [sourceType, setSourceTypeState] = useState<SourceType>(null)
  const [deviceType, setDeviceTypeState] = useState<DeviceType>(null)

  const setDateRange = useCallback((range: DateRange) => {
    setDateRangeState(range)
  }, [])

  const setSourceType = useCallback((type: SourceType) => {
    setSourceTypeState(type)
  }, [])

  const setDeviceType = useCallback((type: DeviceType) => {
    setDeviceTypeState(type)
  }, [])

  const setPreset = useCallback((preset: Preset) => {
    const to = new Date()
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
    const from = new Date(to.getTime() - days * 86400000)
    setDateRangeState({ from, to })
  }, [])

  const resetFilters = useCallback(() => {
    setDateRangeState(getDefaultRange())
    setSourceTypeState(null)
    setDeviceTypeState(null)
  }, [])

  return {
    dateRange,
    sourceType,
    deviceType,
    setDateRange,
    setSourceType,
    setDeviceType,
    setPreset,
    resetFilters,
  }
}
