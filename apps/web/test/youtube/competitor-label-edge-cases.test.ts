/**
 * Edge-case tests for the "X de ~Y" video count label format
 * used in competitor channel cards + drawer.
 *
 * The label appears in 3 contexts:
 *   1. Card header meta  (syncStatus aware, shows "sincronizando...")
 *   2. Card footer        (mirrors header logic minus sync state)
 *   3. Drawer header meta (slightly different: no "(completo)" variant)
 *
 * We extract the derivation logic into pure functions here and verify
 * every edge case without rendering any React components.
 */

import { describe, it, expect } from 'vitest'
import { fmtC } from '../../src/lib/youtube/format'

/* ── Label derivation — mirrors channel-card.tsx inline IIFE (lines 177-182) ── */

interface VideoCountLabelInput {
  syncStatus: 'idle' | 'syncing' | 'error'
  videoCount: number
  youtubeVideoCount: number | null
}

/**
 * Card header meta label — the primary label shown next to subscriber count.
 * Extracted verbatim from channel-card.tsx lines 177-182.
 */
function cardHeaderLabel(input: VideoCountLabelInput): string {
  const { syncStatus, videoCount, youtubeVideoCount } = input

  if (syncStatus === 'syncing') return 'sincronizando...'
  if (youtubeVideoCount && videoCount >= youtubeVideoCount)
    return `${fmtC(videoCount)} vídeos (completo)`
  if (youtubeVideoCount)
    return `${fmtC(videoCount)} de ~${fmtC(youtubeVideoCount)} vídeos`
  return `${fmtC(videoCount)} vídeos`
}

/**
 * Card footer label — shown alongside sync timestamp in the card footer.
 * Extracted from channel-card.tsx lines 364-368.
 * Note: footer omits "vídeos" suffix in the partial "X de ~Y" case.
 */
function cardFooterLabel(input: Omit<VideoCountLabelInput, 'syncStatus'>): string {
  const { videoCount, youtubeVideoCount } = input

  if (youtubeVideoCount && videoCount >= youtubeVideoCount)
    return `${fmtC(videoCount)} vídeos (completo)`
  if (youtubeVideoCount)
    return `${fmtC(videoCount)} de ~${fmtC(youtubeVideoCount)}`
  return `${fmtC(videoCount)} vídeos`
}

/**
 * Drawer header meta label — shown in the channel drawer header.
 * Extracted from channel-drawer.tsx lines 165-167.
 * Note: drawer uses strict less-than (no "(completo)" variant).
 */
function drawerHeaderLabel(input: Omit<VideoCountLabelInput, 'syncStatus'>): string {
  const { videoCount, youtubeVideoCount } = input

  if (youtubeVideoCount && videoCount < youtubeVideoCount)
    return `${fmtC(videoCount)} de ~${fmtC(youtubeVideoCount)} vídeos`
  return `${fmtC(videoCount)} vídeos`
}

/* ══════════════════════════════════════════════════════════════
   Tests
   ══════════════════════════════════════════════════════════════ */

describe('Competitor video count label — edge cases', () => {
  /* ── 1. Zero videos synced, YouTube reports 312 ── */
  describe('0 videos synced, youtubeVideoCount=312', () => {
    const input = { syncStatus: 'idle' as const, videoCount: 0, youtubeVideoCount: 312 }

    it('card header shows "0 de ~312 vídeos"', () => {
      expect(cardHeaderLabel(input)).toBe('0 de ~312 vídeos')
    })

    it('card footer shows "0 de ~312"', () => {
      expect(cardFooterLabel(input)).toBe('0 de ~312')
    })

    it('drawer header shows "0 de ~312 vídeos"', () => {
      expect(drawerHeaderLabel(input)).toBe('0 de ~312 vídeos')
    })
  })

  /* ── 2. Exact match — truly all videos fetched ── */
  describe('50 videos synced, youtubeVideoCount=50 (truly complete)', () => {
    const input = { syncStatus: 'idle' as const, videoCount: 50, youtubeVideoCount: 50 }

    it('card header shows "50 vídeos (completo)"', () => {
      expect(cardHeaderLabel(input)).toBe('50 vídeos (completo)')
    })

    it('card footer shows "50 vídeos (completo)"', () => {
      expect(cardFooterLabel(input)).toBe('50 vídeos (completo)')
    })

    it('drawer header shows "50 vídeos" (no completo variant in drawer)', () => {
      expect(drawerHeaderLabel(input)).toBe('50 vídeos')
    })
  })

  /* ── 3. More synced than YouTube reports (unlisted removal) ── */
  describe('200 videos synced, youtubeVideoCount=150 (more synced than reported)', () => {
    const input = { syncStatus: 'idle' as const, videoCount: 200, youtubeVideoCount: 150 }

    it('card header shows "200 vídeos (completo)"', () => {
      expect(cardHeaderLabel(input)).toBe('200 vídeos (completo)')
    })

    it('card footer shows "200 vídeos (completo)"', () => {
      expect(cardFooterLabel(input)).toBe('200 vídeos (completo)')
    })

    it('drawer header shows "200 vídeos" (drawer treats videoCount >= youtubeVideoCount as plain)', () => {
      expect(drawerHeaderLabel(input)).toBe('200 vídeos')
    })
  })

  /* ── 4. YouTube reports 0 but we have videos ── */
  describe('50 videos synced, youtubeVideoCount=0 (YouTube reports 0)', () => {
    const input = { syncStatus: 'idle' as const, videoCount: 50, youtubeVideoCount: 0 }

    it('card header shows "50 vídeos" (youtubeVideoCount=0 is falsy)', () => {
      // youtubeVideoCount=0 is falsy in JS, so the `if (youtubeVideoCount)` branches
      // are skipped entirely — falls through to the plain "N vídeos" format
      expect(cardHeaderLabel(input)).toBe('50 vídeos')
    })

    it('card footer shows "50 vídeos"', () => {
      expect(cardFooterLabel(input)).toBe('50 vídeos')
    })

    it('drawer header shows "50 vídeos"', () => {
      expect(drawerHeaderLabel(input)).toBe('50 vídeos')
    })
  })

  /* ── 5. youtubeVideoCount is null ── */
  describe('50 videos synced, youtubeVideoCount=null (no YouTube count available)', () => {
    const input = { syncStatus: 'idle' as const, videoCount: 50, youtubeVideoCount: null }

    it('card header shows "50 vídeos" (no "de ~Y")', () => {
      expect(cardHeaderLabel(input)).toBe('50 vídeos')
    })

    it('card footer shows "50 vídeos"', () => {
      expect(cardFooterLabel(input)).toBe('50 vídeos')
    })

    it('drawer header shows "50 vídeos"', () => {
      expect(drawerHeaderLabel(input)).toBe('50 vídeos')
    })
  })

  /* ── 6. Very large numbers — compact formatting ── */
  describe('200 videos synced, youtubeVideoCount=10000 (large numbers)', () => {
    const input = { syncStatus: 'idle' as const, videoCount: 200, youtubeVideoCount: 10_000 }

    it('card header shows "200 de ~10 mil vídeos"', () => {
      expect(cardHeaderLabel(input)).toBe('200 de ~10 mil vídeos')
    })

    it('card footer shows "200 de ~10 mil"', () => {
      expect(cardFooterLabel(input)).toBe('200 de ~10 mil')
    })

    it('drawer header shows "200 de ~10 mil vídeos"', () => {
      expect(drawerHeaderLabel(input)).toBe('200 de ~10 mil vídeos')
    })
  })

  /* ── 7. Syncing state always shows "sincronizando..." ── */
  describe('syncing state — always shows "sincronizando..." regardless of counts', () => {
    it('shows "sincronizando..." even with 0 videos and high youtubeVideoCount', () => {
      expect(cardHeaderLabel({
        syncStatus: 'syncing',
        videoCount: 0,
        youtubeVideoCount: 500,
      })).toBe('sincronizando...')
    })

    it('shows "sincronizando..." even when complete (videoCount >= youtubeVideoCount)', () => {
      expect(cardHeaderLabel({
        syncStatus: 'syncing',
        videoCount: 200,
        youtubeVideoCount: 150,
      })).toBe('sincronizando...')
    })

    it('shows "sincronizando..." with null youtubeVideoCount', () => {
      expect(cardHeaderLabel({
        syncStatus: 'syncing',
        videoCount: 50,
        youtubeVideoCount: null,
      })).toBe('sincronizando...')
    })

    it('shows "sincronizando..." even with large counts', () => {
      expect(cardHeaderLabel({
        syncStatus: 'syncing',
        videoCount: 5000,
        youtubeVideoCount: 10_000,
      })).toBe('sincronizando...')
    })
  })

  /* ── 8. Footer label matches header label (when not syncing) ── */
  describe('footer label consistency with header label', () => {
    const scenarios: Array<{
      name: string
      videoCount: number
      youtubeVideoCount: number | null
    }> = [
      { name: 'partial sync', videoCount: 30, youtubeVideoCount: 312 },
      { name: 'complete sync', videoCount: 50, youtubeVideoCount: 50 },
      { name: 'over-sync', videoCount: 200, youtubeVideoCount: 150 },
      { name: 'null youtube count', videoCount: 50, youtubeVideoCount: null },
      { name: 'zero youtube count', videoCount: 50, youtubeVideoCount: 0 },
      { name: 'large numbers', videoCount: 200, youtubeVideoCount: 10_000 },
    ]

    for (const s of scenarios) {
      it(`${s.name}: both header and footer use same format basis`, () => {
        const header = cardHeaderLabel({
          syncStatus: 'idle',
          videoCount: s.videoCount,
          youtubeVideoCount: s.youtubeVideoCount,
        })
        const footer = cardFooterLabel({
          videoCount: s.videoCount,
          youtubeVideoCount: s.youtubeVideoCount,
        })

        // Both should agree on whether it's "completo", "de ~Y", or plain.
        // The only difference is footer omits "vídeos" suffix in partial case.
        if (header.includes('(completo)')) {
          expect(footer).toContain('(completo)')
        }
        if (header.includes('de ~')) {
          expect(footer).toContain('de ~')
        }
        if (!header.includes('de ~') && !header.includes('(completo)')) {
          expect(footer).not.toContain('de ~')
          expect(footer).not.toContain('(completo)')
        }
      })
    }
  })
})

/* ── Supplementary: fmtC formatting correctness for label values ── */

describe('fmtC formatting used in labels', () => {
  it('formats 0', () => {
    expect(fmtC(0)).toBe('0')
  })

  it('formats 50', () => {
    expect(fmtC(50)).toBe('50')
  })

  it('formats 200', () => {
    expect(fmtC(200)).toBe('200')
  })

  it('formats 312', () => {
    expect(fmtC(312)).toBe('312')
  })

  it('formats 1500 as "1,5 mil"', () => {
    expect(fmtC(1500)).toBe('1,5 mil')
  })

  it('formats 10000 as "10 mil"', () => {
    expect(fmtC(10_000)).toBe('10 mil')
  })

  it('formats 2800000 as "2,8 mi"', () => {
    expect(fmtC(2_800_000)).toBe('2,8 mi')
  })
})
