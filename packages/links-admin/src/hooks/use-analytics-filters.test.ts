import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalyticsFilters } from './use-analytics-filters'

describe('useAnalyticsFilters', () => {
  it('initializes with default date range (last 7 days)', () => {
    const { result } = renderHook(() => useAnalyticsFilters())
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
    expect(result.current.dateRange.from.toDateString()).toBe(sevenDaysAgo.toDateString())
    expect(result.current.dateRange.to.toDateString()).toBe(now.toDateString())
  })

  it('initializes with no source type filter', () => {
    const { result } = renderHook(() => useAnalyticsFilters())
    expect(result.current.sourceType).toBeNull()
  })

  it('initializes with no device filter', () => {
    const { result } = renderHook(() => useAnalyticsFilters())
    expect(result.current.deviceType).toBeNull()
  })

  it('setDateRange updates the date range', () => {
    const { result } = renderHook(() => useAnalyticsFilters())
    const from = new Date('2026-04-01')
    const to = new Date('2026-04-30')
    act(() => {
      result.current.setDateRange({ from, to })
    })
    expect(result.current.dateRange.from.toISOString()).toBe(from.toISOString())
    expect(result.current.dateRange.to.toISOString()).toBe(to.toISOString())
  })

  it('setSourceType filters by source', () => {
    const { result } = renderHook(() => useAnalyticsFilters())
    act(() => {
      result.current.setSourceType('newsletter')
    })
    expect(result.current.sourceType).toBe('newsletter')
  })

  it('setSourceType accepts null to clear filter', () => {
    const { result } = renderHook(() => useAnalyticsFilters())
    act(() => {
      result.current.setSourceType('campaign')
    })
    act(() => {
      result.current.setSourceType(null)
    })
    expect(result.current.sourceType).toBeNull()
  })

  it('setDeviceType updates device filter', () => {
    const { result } = renderHook(() => useAnalyticsFilters())
    act(() => {
      result.current.setDeviceType('mobile')
    })
    expect(result.current.deviceType).toBe('mobile')
  })

  it('resetFilters clears all filters back to defaults', () => {
    const { result } = renderHook(() => useAnalyticsFilters())
    act(() => {
      result.current.setSourceType('blog')
      result.current.setDeviceType('desktop')
      result.current.setDateRange({
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      })
    })
    act(() => {
      result.current.resetFilters()
    })
    expect(result.current.sourceType).toBeNull()
    expect(result.current.deviceType).toBeNull()
    const now = new Date()
    expect(result.current.dateRange.to.toDateString()).toBe(now.toDateString())
  })

  it('setPreset updates date range for 30d', () => {
    const { result } = renderHook(() => useAnalyticsFilters())
    act(() => {
      result.current.setPreset('30d')
    })
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
    expect(result.current.dateRange.from.toDateString()).toBe(thirtyDaysAgo.toDateString())
  })

  it('setPreset updates date range for 90d', () => {
    const { result } = renderHook(() => useAnalyticsFilters())
    act(() => {
      result.current.setPreset('90d')
    })
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000)
    expect(result.current.dateRange.from.toDateString()).toBe(ninetyDaysAgo.toDateString())
  })
})
