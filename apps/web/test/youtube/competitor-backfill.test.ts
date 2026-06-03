import { describe, it, expect } from 'vitest'

/**
 * Tests for the competitor sync backfill logic.
 *
 * The backfill fix in competitor-sync.ts adds a `needsBackfill` flag
 * that suppresses the `hitKnownVideo` early-exit when the channel has
 * fewer synced videos than its videoLimit.
 *
 * Since the full syncCompetitorChannel function has heavy transitive deps
 * (Supabase, YouTube API, crypto, notifications) that don't resolve in
 * the test runner, we test the decision logic as pure functions here.
 */

// Extracted logic from competitor-sync.ts lines 48-54
function computeMaxIncrementalPages(videoLimit: number): number {
  return Math.max(1, Math.ceil(videoLimit / 50))
}

function computeNeedsBackfill(syncedCount: number, videoLimit: number): boolean {
  return syncedCount < videoLimit
}

// Extracted logic from competitor-sync.ts line 275 (the break condition)
function shouldBreakIncremental(
  needsBackfill: boolean,
  hitKnownVideo: boolean,
  pageCount: number,
  maxIncrementalPages: number,
): boolean {
  return (!needsBackfill && hitKnownVideo) || pageCount >= maxIncrementalPages
}

describe('competitor sync backfill decision logic', () => {
  describe('computeMaxIncrementalPages', () => {
    it('videoLimit=50 → 1 page', () => {
      expect(computeMaxIncrementalPages(50)).toBe(1)
    })

    it('videoLimit=100 → 2 pages', () => {
      expect(computeMaxIncrementalPages(100)).toBe(2)
    })

    it('videoLimit=200 → 4 pages', () => {
      expect(computeMaxIncrementalPages(200)).toBe(4)
    })

    it('videoLimit=1 → minimum 1 page', () => {
      expect(computeMaxIncrementalPages(1)).toBe(1)
    })
  })

  describe('computeNeedsBackfill', () => {
    it('syncedCount < videoLimit → needs backfill', () => {
      expect(computeNeedsBackfill(50, 200)).toBe(true)
    })

    it('syncedCount >= videoLimit → no backfill', () => {
      expect(computeNeedsBackfill(50, 50)).toBe(false)
    })

    it('syncedCount > videoLimit → no backfill', () => {
      expect(computeNeedsBackfill(100, 50)).toBe(false)
    })

    it('syncedCount=0 → always needs backfill', () => {
      expect(computeNeedsBackfill(0, 50)).toBe(true)
    })
  })

  describe('shouldBreakIncremental (the fix)', () => {
    it('no backfill + hitKnownVideo → BREAK (normal incremental)', () => {
      expect(shouldBreakIncremental(false, true, 1, 4)).toBe(true)
    })

    it('needsBackfill + hitKnownVideo → CONTINUE (backfill suppresses early exit)', () => {
      // THIS is the core fix — when backfill is needed, hitKnownVideo is ignored
      expect(shouldBreakIncremental(true, true, 1, 4)).toBe(false)
    })

    it('needsBackfill + hitKnownVideo + page cap reached → BREAK (cap always respected)', () => {
      expect(shouldBreakIncremental(true, true, 4, 4)).toBe(true)
    })

    it('no backfill + no hitKnownVideo + under cap → CONTINUE', () => {
      expect(shouldBreakIncremental(false, false, 1, 4)).toBe(false)
    })

    it('page cap always triggers break regardless of backfill', () => {
      expect(shouldBreakIncremental(true, false, 4, 4)).toBe(true)
      expect(shouldBreakIncremental(false, false, 4, 4)).toBe(true)
    })
  })

  describe('end-to-end scenario: limit change 50→200', () => {
    it('channel with 50 synced videos and limit=50: stops at first known', () => {
      const needsBackfill = computeNeedsBackfill(50, 50)
      expect(needsBackfill).toBe(false)

      // Page 1 hits known videos
      expect(shouldBreakIncremental(needsBackfill, true, 1, 1)).toBe(true)
    })

    it('same channel after limit raised to 200: continues past known videos', () => {
      const needsBackfill = computeNeedsBackfill(50, 200)
      expect(needsBackfill).toBe(true)

      const maxPages = computeMaxIncrementalPages(200)
      expect(maxPages).toBe(4)

      // Page 1 hits known videos — but backfill suppresses early exit
      expect(shouldBreakIncremental(needsBackfill, true, 1, maxPages)).toBe(false)
      // Page 2 — still under cap, still backfilling
      expect(shouldBreakIncremental(needsBackfill, true, 2, maxPages)).toBe(false)
      // Page 3 — still under cap
      expect(shouldBreakIncremental(needsBackfill, true, 3, maxPages)).toBe(false)
      // Page 4 — hits cap → stops
      expect(shouldBreakIncremental(needsBackfill, true, 4, maxPages)).toBe(true)
    })

    it('after backfill completes (200 synced), normal incremental resumes', () => {
      const needsBackfill = computeNeedsBackfill(200, 200)
      expect(needsBackfill).toBe(false)

      // First known video triggers break again
      expect(shouldBreakIncremental(needsBackfill, true, 1, 4)).toBe(true)
    })
  })
})
