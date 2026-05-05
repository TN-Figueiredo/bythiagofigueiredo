import { describe, it, expect } from 'vitest'

describe('Dashboard pin state', () => {
  function getPinState(pinnedUntil: string | null): 'active' | 'expiring' | 'none' {
    if (!pinnedUntil) return 'none'
    const until = new Date(pinnedUntil)
    const now = new Date()
    if (until <= now) return 'none'
    const daysLeft = Math.ceil((until.getTime() - now.getTime()) / 86_400_000)
    if (daysLeft <= 2) return 'expiring'
    return 'active'
  }

  it('returns "none" when no pin', () => {
    expect(getPinState(null)).toBe('none')
  })

  it('returns "none" when pin is expired', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    expect(getPinState(yesterday)).toBe('none')
  })

  it('returns "active" when >2 days left', () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    expect(getPinState(future)).toBe('active')
  })

  it('returns "expiring" when ≤2 days left', () => {
    const soon = new Date(Date.now() + 1.5 * 86_400_000).toISOString()
    expect(getPinState(soon)).toBe('expiring')
  })

  it('returns "expiring" when exactly 2 days left', () => {
    const twoDays = new Date(Date.now() + 2 * 86_400_000).toISOString()
    expect(getPinState(twoDays)).toBe('expiring')
  })
})

describe('Dashboard formatCount', () => {
  function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  it('formats numbers below 1000 as-is', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
  })

  it('formats thousands with K suffix', () => {
    expect(formatCount(1000)).toBe('1.0K')
    expect(formatCount(15_200)).toBe('15.2K')
  })

  it('formats millions with M suffix', () => {
    expect(formatCount(1_000_000)).toBe('1.0M')
    expect(formatCount(2_500_000)).toBe('2.5M')
  })
})

describe('Dashboard timeAgo', () => {
  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  it('formats minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(timeAgo(fiveMinAgo)).toBe('5m ago')
  })

  it('formats hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()
    expect(timeAgo(twoHoursAgo)).toBe('2h ago')
  })

  it('formats days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    expect(timeAgo(threeDaysAgo)).toBe('3d ago')
  })
})
