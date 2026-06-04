import { describe, it, expect } from 'vitest'
import {
  getChannelMaturity,
  getMaturityCapabilities,
  type ChannelMaturityInfo,
} from '@/lib/youtube/channel-maturity'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date()
const HOURS_AGO = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000)

function makeInfo(
  snapshotCount: number,
  videoCount: number,
  lastSyncedAt: string | null = null,
): ChannelMaturityInfo {
  return getChannelMaturity({
    snapshotCount,
    videoCount,
    addedAt: HOURS_AGO(48).toISOString(),
    lastSyncedAt,
  })
}

const SYNCED_AT = HOURS_AGO(1).toISOString()

// ---------------------------------------------------------------------------
// getChannelMaturity — stage derivation
// ---------------------------------------------------------------------------

describe('getChannelMaturity — stage', () => {
  it('0 snapshots → just_added', () => {
    const info = makeInfo(0, 0)
    expect(info.stage).toBe('just_added')
  })

  it('1 snapshot → seedling', () => {
    const info = makeInfo(1, 10)
    expect(info.stage).toBe('seedling')
  })

  it('2 snapshots → sprouting', () => {
    expect(makeInfo(2, 10).stage).toBe('sprouting')
  })

  it('6 snapshots → sprouting (upper boundary)', () => {
    expect(makeInfo(6, 10).stage).toBe('sprouting')
  })

  it('7 snapshots → growing (lower boundary)', () => {
    expect(makeInfo(7, 10).stage).toBe('growing')
  })

  it('29 snapshots → growing (upper boundary)', () => {
    expect(makeInfo(29, 10).stage).toBe('growing')
  })

  it('30 snapshots → mature (lower boundary)', () => {
    expect(makeInfo(30, 10).stage).toBe('mature')
  })

  it('100 snapshots → mature', () => {
    expect(makeInfo(100, 10).stage).toBe('mature')
  })
})

// ---------------------------------------------------------------------------
// getChannelMaturity — derived fields
// ---------------------------------------------------------------------------

describe('getChannelMaturity — derived fields', () => {
  it('firstSyncDone is false when lastSyncedAt is null', () => {
    expect(makeInfo(0, 0, null).firstSyncDone).toBe(false)
  })

  it('firstSyncDone is true when lastSyncedAt is set', () => {
    expect(makeInfo(0, 0, SYNCED_AT).firstSyncDone).toBe(true)
  })

  it('hoursSinceAdded is approximately 48', () => {
    const info = makeInfo(0, 0)
    expect(info.hoursSinceAdded).toBeGreaterThan(47.9)
    expect(info.hoursSinceAdded).toBeLessThan(48.1)
  })

  it('accepts Date objects for addedAt and lastSyncedAt', () => {
    const info = getChannelMaturity({
      snapshotCount: 1,
      videoCount: 5,
      addedAt: HOURS_AGO(24),
      lastSyncedAt: HOURS_AGO(1),
    })
    expect(info.stage).toBe('seedling')
    expect(info.firstSyncDone).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getMaturityCapabilities — just_added (no sync)
// ---------------------------------------------------------------------------

describe('getMaturityCapabilities — just_added, no sync', () => {
  const caps = getMaturityCapabilities(makeInfo(0, 0, null))

  it('hides subscribers', () => expect(caps.showSubscribers).toBe(false))
  it('hides video shelf', () => expect(caps.showVideoShelf).toBe(false))
  it('hides engagement', () => expect(caps.showEngagement).toBe(false))
  it('hides growth delta', () => expect(caps.showGrowthDelta).toBe(false))
  it('hides sparkline', () => expect(caps.showSparkline).toBe(false))
  it('hides vs-you', () => expect(caps.showVsYou).toBe(false))
  it('hides growth score', () => expect(caps.showGrowthScore).toBe(false))
  it('confidence is none', () => expect(caps.growthScoreConfidence).toBe('none'))
  it('statusMessage mentions syncing', () => expect(caps.statusMessage).toContain('Sincronizando'))
  it('statusHint mentions first sync', () => {
    expect(caps.statusHint).not.toBeNull()
    expect(caps.statusHint).toContain('primeira sincronização')
  })
})

// ---------------------------------------------------------------------------
// getMaturityCapabilities — just_added (sync done)
// ---------------------------------------------------------------------------

describe('getMaturityCapabilities — just_added, sync done, 0 videos', () => {
  const caps = getMaturityCapabilities(makeInfo(0, 0, SYNCED_AT))

  it('shows subscribers', () => expect(caps.showSubscribers).toBe(true))
  it('hides video shelf (no videos)', () => expect(caps.showVideoShelf).toBe(false))
  it('hides engagement (no videos)', () => expect(caps.showEngagement).toBe(false))
  it('hides growth delta', () => expect(caps.showGrowthDelta).toBe(false))
  it('hides sparkline', () => expect(caps.showSparkline).toBe(false))
  it('hides growth score', () => expect(caps.showGrowthScore).toBe(false))
  it('confidence is none', () => expect(caps.growthScoreConfidence).toBe('none'))
  it('statusMessage mentions canal adicionado', () => {
    expect(caps.statusMessage).toContain('Canal adicionado')
  })
  it('statusHint mentions tomorrow/second sync', () => {
    expect(caps.statusHint).not.toBeNull()
    expect(caps.statusHint).toContain('amanhã')
  })
})

describe('getMaturityCapabilities — just_added, sync done, 5 videos', () => {
  const caps = getMaturityCapabilities(makeInfo(0, 5, SYNCED_AT))

  it('shows video shelf', () => expect(caps.showVideoShelf).toBe(true))
  it('shows engagement (5 >= 3)', () => expect(caps.showEngagement).toBe(true))
})

describe('getMaturityCapabilities — just_added, sync done, 2 videos', () => {
  const caps = getMaturityCapabilities(makeInfo(0, 2, SYNCED_AT))

  it('shows video shelf', () => expect(caps.showVideoShelf).toBe(true))
  it('hides engagement (2 < 3)', () => expect(caps.showEngagement).toBe(false))
})

// ---------------------------------------------------------------------------
// getMaturityCapabilities — seedling
// ---------------------------------------------------------------------------

describe('getMaturityCapabilities — seedling, 0 videos', () => {
  const caps = getMaturityCapabilities(makeInfo(1, 0, SYNCED_AT))

  it('shows subscribers', () => expect(caps.showSubscribers).toBe(true))
  it('hides video shelf', () => expect(caps.showVideoShelf).toBe(false))
  it('hides engagement', () => expect(caps.showEngagement).toBe(false))
  it('hides growth delta', () => expect(caps.showGrowthDelta).toBe(false))
  it('hides sparkline', () => expect(caps.showSparkline).toBe(false))
  it('hides growth score', () => expect(caps.showGrowthScore).toBe(false))
  it('confidence is none', () => expect(caps.growthScoreConfidence).toBe('none'))
  it('statusMessage mentions 1 dia de dados', () => {
    expect(caps.statusMessage).toContain('1 dia de dados')
  })
  it('statusHint mentions 2 days', () => {
    expect(caps.statusHint).not.toBeNull()
    expect(caps.statusHint).toContain('2 dias')
  })
})

describe('getMaturityCapabilities — seedling, 5 videos', () => {
  const caps = getMaturityCapabilities(makeInfo(1, 5, SYNCED_AT))

  it('shows video shelf', () => expect(caps.showVideoShelf).toBe(true))
  it('shows engagement (5 >= 3)', () => expect(caps.showEngagement).toBe(true))
})

// ---------------------------------------------------------------------------
// getMaturityCapabilities — sprouting (2–6 snapshots)
// ---------------------------------------------------------------------------

describe('getMaturityCapabilities — sprouting', () => {
  it('2 snapshots: showGrowthDelta = true', () => {
    expect(getMaturityCapabilities(makeInfo(2, 5, SYNCED_AT)).showGrowthDelta).toBe(true)
  })

  it('4 snapshots: showSparkline = false', () => {
    expect(getMaturityCapabilities(makeInfo(4, 5, SYNCED_AT)).showSparkline).toBe(false)
  })

  it('6 snapshots: showGrowthScore = true', () => {
    expect(getMaturityCapabilities(makeInfo(6, 5, SYNCED_AT)).showGrowthScore).toBe(true)
  })

  it('confidence is low', () => {
    expect(getMaturityCapabilities(makeInfo(3, 5, SYNCED_AT)).growthScoreConfidence).toBe('low')
  })

  it('statusMessage contains snapshot count and tendências', () => {
    const caps = getMaturityCapabilities(makeInfo(4, 5, SYNCED_AT))
    expect(caps.statusMessage).toContain('4')
    expect(caps.statusMessage).toContain('tendências')
  })

  it('statusHint mentions 7+ dias', () => {
    const caps = getMaturityCapabilities(makeInfo(2, 5, SYNCED_AT))
    expect(caps.statusHint).not.toBeNull()
    expect(caps.statusHint).toContain('7+')
  })
})

// ---------------------------------------------------------------------------
// getMaturityCapabilities — growing (7–29 snapshots)
// ---------------------------------------------------------------------------

describe('getMaturityCapabilities — growing', () => {
  it('7 snapshots: showSparkline = true', () => {
    expect(getMaturityCapabilities(makeInfo(7, 5, SYNCED_AT)).showSparkline).toBe(true)
  })

  it('7 snapshots: showGrowthDelta = true', () => {
    expect(getMaturityCapabilities(makeInfo(7, 5, SYNCED_AT)).showGrowthDelta).toBe(true)
  })

  it('confidence is medium', () => {
    expect(getMaturityCapabilities(makeInfo(10, 5, SYNCED_AT)).growthScoreConfidence).toBe('medium')
  })

  it('< 14 snapshots: statusHint mentions 30+ dias', () => {
    const caps = getMaturityCapabilities(makeInfo(7, 5, SYNCED_AT))
    expect(caps.statusHint).not.toBeNull()
    expect(caps.statusHint).toContain('30+')
  })

  it('14 snapshots exactly: statusHint is null', () => {
    const caps = getMaturityCapabilities(makeInfo(14, 5, SYNCED_AT))
    expect(caps.statusHint).toBeNull()
  })

  it('29 snapshots: statusHint is null', () => {
    const caps = getMaturityCapabilities(makeInfo(29, 5, SYNCED_AT)).statusHint
    expect(caps).toBeNull()
  })

  it('statusMessage contains snapshot count', () => {
    const caps = getMaturityCapabilities(makeInfo(20, 5, SYNCED_AT))
    expect(caps.statusMessage).toContain('20')
  })
})

// ---------------------------------------------------------------------------
// getMaturityCapabilities — mature (30+ snapshots)
// ---------------------------------------------------------------------------

describe('getMaturityCapabilities — mature', () => {
  it('30 snapshots: all growth fields shown', () => {
    const caps = getMaturityCapabilities(makeInfo(30, 5, SYNCED_AT))
    expect(caps.showSubscribers).toBe(true)
    expect(caps.showGrowthDelta).toBe(true)
    expect(caps.showSparkline).toBe(true)
    expect(caps.showGrowthScore).toBe(true)
  })

  it('confidence is high', () => {
    expect(getMaturityCapabilities(makeInfo(30, 5, SYNCED_AT)).growthScoreConfidence).toBe('high')
  })

  it('100 snapshots: statusMessage is empty string', () => {
    expect(getMaturityCapabilities(makeInfo(100, 5, SYNCED_AT)).statusMessage).toBe('')
  })

  it('statusHint is null', () => {
    expect(getMaturityCapabilities(makeInfo(30, 5, SYNCED_AT)).statusHint).toBeNull()
  })

  it('hides video shelf when 0 videos', () => {
    expect(getMaturityCapabilities(makeInfo(30, 0, SYNCED_AT)).showVideoShelf).toBe(false)
  })

  it('shows video shelf when videos present', () => {
    expect(getMaturityCapabilities(makeInfo(30, 10, SYNCED_AT)).showVideoShelf).toBe(true)
  })

  it('hides engagement when < 3 videos', () => {
    expect(getMaturityCapabilities(makeInfo(30, 2, SYNCED_AT)).showEngagement).toBe(false)
  })

  it('shows engagement when >= 3 videos', () => {
    expect(getMaturityCapabilities(makeInfo(30, 3, SYNCED_AT)).showEngagement).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// showVsYou follows videoCount >= 3 rule (same as showEngagement)
// ---------------------------------------------------------------------------

describe('showVsYou — requires >= 3 videos and at least first sync', () => {
  it('false when no sync done', () => {
    expect(getMaturityCapabilities(makeInfo(0, 5, null)).showVsYou).toBe(false)
  })

  it('false when < 3 videos', () => {
    expect(getMaturityCapabilities(makeInfo(1, 2, SYNCED_AT)).showVsYou).toBe(false)
  })

  it('true when synced with >= 3 videos (seedling)', () => {
    expect(getMaturityCapabilities(makeInfo(1, 5, SYNCED_AT)).showVsYou).toBe(true)
  })

  it('true when synced with >= 3 videos (mature)', () => {
    expect(getMaturityCapabilities(makeInfo(50, 5, SYNCED_AT)).showVsYou).toBe(true)
  })
})
