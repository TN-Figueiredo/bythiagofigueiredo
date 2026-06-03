import { describe, it, expect } from 'vitest'
import { fmtC } from '../../src/lib/youtube/format'

/* ──────────────────────────────────────────────────────────
   Pure-function extraction of the label logic from
   channel-card.tsx — allows unit-testing without React.
   ────────────────────────────────────────────────────────── */

type SyncStatus = 'idle' | 'syncing' | 'error'

interface LabelInput {
  videoCount: number
  youtubeVideoCount: number | null
  syncStatus: SyncStatus
  fullSyncCompletedAt: string | null
  recentVideosLength: number
  videoLimit: number
}

/**
 * Header meta label (lines 177-182 in channel-card.tsx).
 * Displayed next to subscriber count in the card head.
 */
function headerLabel(input: LabelInput): string {
  const { videoCount, youtubeVideoCount, syncStatus } = input
  if (syncStatus === 'syncing') return 'sincronizando...'
  if (youtubeVideoCount && videoCount >= youtubeVideoCount)
    return `${fmtC(videoCount)} vídeos (completo)`
  if (youtubeVideoCount)
    return `${fmtC(videoCount)} de ~${fmtC(youtubeVideoCount)} vídeos`
  return `${fmtC(videoCount)} vídeos`
}

/**
 * Footer label (lines 364-368 in channel-card.tsx).
 * Displayed in the sync-time row at the bottom of the card.
 */
function footerLabel(input: LabelInput): string {
  const { videoCount, youtubeVideoCount } = input
  if (youtubeVideoCount && videoCount >= youtubeVideoCount)
    return `${fmtC(videoCount)} vídeos (completo)`
  if (youtubeVideoCount)
    return `${fmtC(videoCount)} de ~${fmtC(youtubeVideoCount)}`
  return `${fmtC(videoCount)} vídeos`
}

/**
 * Shelf header parenthetical (lines 424-425 in channel-card.tsx).
 * Displayed as "Vídeos (X recentes)" or "Vídeos (histórico)" etc.
 */
function shelfHeaderParenthetical(input: LabelInput): string {
  const { fullSyncCompletedAt, recentVideosLength, videoCount, videoLimit, youtubeVideoCount } = input
  const isLimitReached = videoCount >= videoLimit
  const hasAllYouTube = !!(youtubeVideoCount && videoCount >= youtubeVideoCount)
  const isComplete = hasAllYouTube || !!fullSyncCompletedAt || isLimitReached
  if (fullSyncCompletedAt) return 'histórico'
  return `${recentVideosLength} ${isComplete ? 'completo' : 'recentes'}`
}

/**
 * Video limit toggle logic (line 376 in channel-card.tsx).
 * Returns the next limit value after clicking the toggle.
 */
function nextVideoLimit(current: number): number {
  return current >= 200 ? 50 : 200
}

/* ══════════════════════════════════════════════════════════
   Tests
   ══════════════════════════════════════════════════════════ */

const base: LabelInput = {
  videoCount: 0,
  youtubeVideoCount: null,
  syncStatus: 'idle',
  fullSyncCompletedAt: null,
  recentVideosLength: 3,
  videoLimit: 50,
}

function make(overrides: Partial<LabelInput> = {}): LabelInput {
  return { ...base, ...overrides }
}

describe('channel-card label derivation', () => {

  /* ── 1. "X de ~Y vídeos" — partial sync ── */

  describe('header: "X de ~Y vídeos" when youtubeVideoCount available and videoCount < youtubeVideoCount', () => {
    it('shows partial count against total', () => {
      const input = make({ videoCount: 42, youtubeVideoCount: 200 })
      expect(headerLabel(input)).toBe('42 de ~200 vídeos')
    })

    it('formats large numbers with fmtC', () => {
      const input = make({ videoCount: 350, youtubeVideoCount: 1500 })
      expect(headerLabel(input)).toBe('350 de ~1,5 mil vídeos')
    })

    it('shows partial even when very close to total', () => {
      const input = make({ videoCount: 199, youtubeVideoCount: 200 })
      expect(headerLabel(input)).toBe('199 de ~200 vídeos')
    })
  })

  /* ── 2. "X vídeos (completo)" — truly complete ── */

  describe('header: "X vídeos (completo)" when videoCount >= youtubeVideoCount', () => {
    it('shows completo when exactly equal', () => {
      const input = make({ videoCount: 200, youtubeVideoCount: 200 })
      expect(headerLabel(input)).toBe('200 vídeos (completo)')
    })

    it('shows completo when videoCount exceeds youtubeVideoCount', () => {
      // can happen if new videos added between syncs
      const input = make({ videoCount: 210, youtubeVideoCount: 200 })
      expect(headerLabel(input)).toBe('210 vídeos (completo)')
    })

    it('formats large complete counts', () => {
      const input = make({ videoCount: 1500, youtubeVideoCount: 1500 })
      expect(headerLabel(input)).toBe('1,5 mil vídeos (completo)')
    })
  })

  /* ── 3. "X vídeos" — youtubeVideoCount is null ── */

  describe('header: "X vídeos" when youtubeVideoCount is null', () => {
    it('shows plain count without tilde or completo', () => {
      const input = make({ videoCount: 50, youtubeVideoCount: null })
      expect(headerLabel(input)).toBe('50 vídeos')
    })

    it('works with zero videos', () => {
      const input = make({ videoCount: 0, youtubeVideoCount: null })
      expect(headerLabel(input)).toBe('0 vídeos')
    })

    it('formats large numbers', () => {
      const input = make({ videoCount: 3200, youtubeVideoCount: null })
      expect(headerLabel(input)).toBe('3,2 mil vídeos')
    })
  })

  /* ── 4. "sincronizando..." — during active sync ── */

  describe('header: "sincronizando..." when syncStatus is syncing', () => {
    it('shows syncing message regardless of video counts', () => {
      const input = make({ syncStatus: 'syncing', videoCount: 50, youtubeVideoCount: 200 })
      expect(headerLabel(input)).toBe('sincronizando...')
    })

    it('shows syncing even when youtubeVideoCount is null', () => {
      const input = make({ syncStatus: 'syncing', videoCount: 0, youtubeVideoCount: null })
      expect(headerLabel(input)).toBe('sincronizando...')
    })

    it('takes priority over completo', () => {
      const input = make({ syncStatus: 'syncing', videoCount: 200, youtubeVideoCount: 200 })
      expect(headerLabel(input)).toBe('sincronizando...')
    })
  })

  /* ── 5. Video limit toggle cycles 50→200→50 ── */

  describe('video limit toggle cycles 50→200→50 (not 50→100→200→50)', () => {
    it('50 → 200', () => {
      expect(nextVideoLimit(50)).toBe(200)
    })

    it('200 → 50', () => {
      expect(nextVideoLimit(200)).toBe(50)
    })

    it('any value < 200 → 200', () => {
      expect(nextVideoLimit(100)).toBe(200)
      expect(nextVideoLimit(1)).toBe(200)
    })

    it('any value >= 200 → 50 (clamp down)', () => {
      expect(nextVideoLimit(250)).toBe(50)
      expect(nextVideoLimit(999)).toBe(50)
    })

    it('full cycle: 50 → 200 → 50 → 200', () => {
      let v = 50
      v = nextVideoLimit(v); expect(v).toBe(200)
      v = nextVideoLimit(v); expect(v).toBe(50)
      v = nextVideoLimit(v); expect(v).toBe(200)
    })

    it('never lands on 100', () => {
      const seen = new Set<number>()
      let v = 50
      for (let i = 0; i < 10; i++) {
        seen.add(v)
        v = nextVideoLimit(v)
      }
      expect(seen).not.toContain(100)
      expect(seen).toEqual(new Set([50, 200]))
    })
  })

  /* ── 6. Numbers formatted with fmtC ── */

  describe('fmtC formatting in labels', () => {
    it('1000 → "1 mil"', () => {
      expect(fmtC(1000)).toBe('1 mil')
    })

    it('1500 → "1,5 mil"', () => {
      expect(fmtC(1500)).toBe('1,5 mil')
    })

    it('2800000 → "2,8 mi"', () => {
      expect(fmtC(2_800_000)).toBe('2,8 mi')
    })

    it('42 → "42" (small number, no abbreviation)', () => {
      expect(fmtC(42)).toBe('42')
    })

    it('label uses abbreviated form for large videoCount', () => {
      const input = make({ videoCount: 2500, youtubeVideoCount: null })
      expect(headerLabel(input)).toBe('2,5 mil vídeos')
    })

    it('label uses abbreviated form for large youtubeVideoCount', () => {
      const input = make({ videoCount: 100, youtubeVideoCount: 5000 })
      expect(headerLabel(input)).toBe('100 de ~5 mil vídeos')
    })
  })

  /* ── 7. Shelf header uses content-based parenthetical, not "X de ~Y" ── */

  describe('shelf header parenthetical', () => {
    it('shows "histórico" when fullSyncCompletedAt is set', () => {
      const input = make({ fullSyncCompletedAt: '2026-01-01T00:00:00Z', recentVideosLength: 3 })
      expect(shelfHeaderParenthetical(input)).toBe('histórico')
    })

    it('shows "N recentes" when not complete', () => {
      const input = make({
        videoCount: 30,
        youtubeVideoCount: 200,
        recentVideosLength: 3,
        videoLimit: 50,
      })
      expect(shelfHeaderParenthetical(input)).toBe('3 recentes')
    })

    it('shows "N completo" when limit reached', () => {
      const input = make({
        videoCount: 50,
        youtubeVideoCount: 200,
        recentVideosLength: 3,
        videoLimit: 50,
      })
      expect(shelfHeaderParenthetical(input)).toBe('3 completo')
    })

    it('shows "N completo" when all YouTube videos fetched', () => {
      const input = make({
        videoCount: 200,
        youtubeVideoCount: 200,
        recentVideosLength: 3,
        videoLimit: 50,
      })
      expect(shelfHeaderParenthetical(input)).toBe('3 completo')
    })

    it('does NOT use "X de ~Y" format (that is header/footer only)', () => {
      const input = make({
        videoCount: 30,
        youtubeVideoCount: 200,
        recentVideosLength: 3,
        videoLimit: 50,
      })
      const result = shelfHeaderParenthetical(input)
      expect(result).not.toContain('de ~')
      expect(result).not.toContain('vídeos')
    })
  })

  /* ── 8. Footer label consistency — footer matches header format ── */

  describe('footer label consistency with header', () => {
    it('partial sync: footer uses "X de ~Y" like header (minus "vídeos" suffix)', () => {
      const input = make({ videoCount: 42, youtubeVideoCount: 200 })
      const header = headerLabel(input)
      const footer = footerLabel(input)
      // Header: "42 de ~200 vídeos", Footer: "42 de ~200"
      expect(header).toContain('42 de ~200')
      expect(footer).toContain('42 de ~200')
    })

    it('complete: both show "(completo)"', () => {
      const input = make({ videoCount: 200, youtubeVideoCount: 200 })
      expect(headerLabel(input)).toContain('(completo)')
      expect(footerLabel(input)).toContain('(completo)')
    })

    it('no youtube count: both show plain "X vídeos"', () => {
      const input = make({ videoCount: 50, youtubeVideoCount: null })
      expect(headerLabel(input)).toBe('50 vídeos')
      expect(footerLabel(input)).toBe('50 vídeos')
    })

    it('footer omits "vídeos" suffix in partial mode (header includes it)', () => {
      const input = make({ videoCount: 80, youtubeVideoCount: 300 })
      expect(headerLabel(input)).toBe('80 de ~300 vídeos')
      expect(footerLabel(input)).toBe('80 de ~300')
    })

    it('footer never shows "sincronizando..." (that is header-only)', () => {
      const input = make({ syncStatus: 'syncing', videoCount: 50, youtubeVideoCount: 200 })
      // Footer ignores syncStatus — it always shows the count-based label
      expect(footerLabel(input)).not.toContain('sincronizando')
    })
  })
})
