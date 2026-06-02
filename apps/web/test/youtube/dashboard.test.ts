import { describe, it, expect } from 'vitest'
import { getPinState, formatCount, timeAgo, daysLeft, bustCache } from '@/app/cms/(authed)/youtube/dashboard-connected'
import type { PinnedVideo } from '@/app/cms/(authed)/youtube/dashboard-connected'

function makePinned(pinnedUntil: string): PinnedVideo {
  return { id: '1', title: 'Test', thumbnailUrl: null, viewCount: 0, likeCount: 0, pinnedUntil }
}

describe('getPinState', () => {
  it('returns "none" when no pin', () => {
    expect(getPinState(null)).toBe('none')
  })

  it('returns "expired" when pin is in the past', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    expect(getPinState(makePinned(yesterday))).toBe('expired')
  })

  it('returns "active" when >2 days left', () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    expect(getPinState(makePinned(future))).toBe('active')
  })

  it('returns "expiring" when ≤2 days left', () => {
    const soon = new Date(Date.now() + 1.5 * 86_400_000).toISOString()
    expect(getPinState(makePinned(soon))).toBe('expiring')
  })

  it('returns "expiring" when exactly 2 days left', () => {
    const twoDays = new Date(Date.now() + 2 * 86_400_000).toISOString()
    expect(getPinState(makePinned(twoDays))).toBe('expiring')
  })

  it('returns "expired" when pinnedUntil is exactly now', () => {
    const now = new Date().toISOString()
    expect(getPinState(makePinned(now))).toBe('expired')
  })
})

describe('formatCount', () => {
  it('formats numbers below 1000 as-is', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
  })

  it('formats thousands with K suffix (pt-BR comma)', () => {
    expect(formatCount(1000)).toBe('1,0K')
    expect(formatCount(15_200)).toBe('15,2K')
  })

  it('formats millions with M suffix (pt-BR comma)', () => {
    expect(formatCount(1_000_000)).toBe('1,0M')
    expect(formatCount(2_500_000)).toBe('2,5M')
  })
})

describe('timeAgo', () => {
  it('formats minutes (pt-BR)', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(timeAgo(fiveMinAgo)).toBe('5m atrás')
  })

  it('formats hours (pt-BR)', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()
    expect(timeAgo(twoHoursAgo)).toBe('2h atrás')
  })

  it('formats days (pt-BR)', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    expect(timeAgo(threeDaysAgo)).toBe('3d atrás')
  })
})

describe('daysLeft', () => {
  it('returns positive days for future dates', () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    expect(daysLeft(future)).toBe(5)
  })

  it('returns 0 or negative for past dates', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString()
    expect(daysLeft(past)).toBeLessThanOrEqual(0)
  })
})

describe('bustCache', () => {
  it('returns null when url is null', () => {
    expect(bustCache(null, '2026-05-30T12:00:00Z')).toBeNull()
  })

  it('returns url unchanged when syncedAt is null', () => {
    expect(bustCache('https://yt3.ggpht.com/avatar', null)).toBe('https://yt3.ggpht.com/avatar')
  })

  it('appends _v query param with syncedAt value', () => {
    const result = bustCache('https://yt3.ggpht.com/avatar', '2026-05-30T12:00:00Z')
    expect(result).toBe('https://yt3.ggpht.com/avatar?_v=2026-05-30T12%3A00%3A00Z')
  })

  it('uses & separator when url already contains query params', () => {
    const result = bustCache('https://yt3.ggpht.com/avatar?s=120', '2026-05-30T12:00:00Z')
    expect(result).toBe('https://yt3.ggpht.com/avatar?s=120&_v=2026-05-30T12%3A00%3A00Z')
  })
})
