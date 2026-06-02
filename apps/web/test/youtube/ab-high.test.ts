/**
 * HIGH priority tests for AB Lab utilities, rotation patterns, color
 * mappings, mock views type safety, and wizard adapter.
 */
import { describe, it, expect } from 'vitest'
import {
  formatPercent,
  formatCompact,
  toDisplayLabel,
  variantColor,
  VARIANT_COLORS,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-constants'
import { getVariantForCycle } from '@/lib/youtube/ab-rotation'
import {
  wizardReducer,
  stepIsValid,
  makeOriginalVariant,
  makeEmptyVariant,
} from '@/lib/youtube/ab-wizard-reducer'
import type { WizardState } from '@/lib/youtube/ab-wizard-reducer'
import { wizardConfigToAbConfig, initWizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import type { DisplayLabel } from '@/lib/youtube/ab-types'
import {
  MOCK_WINNER,
  MOCK_PLAYOFF,
  MOCK_ACTIVE,
  MOCK_WINNER_MINIMAL,
  MOCK_PLAYOFF_MINIMAL,
  MOCK_ACTIVE_MINIMAL,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/mock-views'

/* ================================================================== */
/*  1. formatPercent and formatCompact edge cases                      */
/* ================================================================== */

describe('formatPercent — edge cases', () => {
  it('formats 0 correctly (pt-BR comma)', () => {
    expect(formatPercent(0)).toBe('0,0%')
  })

  it('formats negative numbers', () => {
    expect(formatPercent(-5.67)).toBe('-5,7%')
  })

  it('formats very large numbers', () => {
    expect(formatPercent(99999.99)).toBe('100000,0%')
  })

  it('formats very small positive numbers', () => {
    expect(formatPercent(0.001)).toBe('0,0%')
  })

  it('formats with 0 decimals', () => {
    expect(formatPercent(12.56, 0)).toBe('13%')
  })

  it('formats with 3 decimals', () => {
    expect(formatPercent(12.5678, 3)).toBe('12,568%')
  })

  it('returns dash for null', () => {
    expect(formatPercent(null)).toBe('—')
  })

  it('returns dash for undefined', () => {
    expect(formatPercent(undefined)).toBe('—')
  })

  it('returns dash for NaN', () => {
    expect(formatPercent(NaN)).toBe('—')
  })

  it('handles -0', () => {
    expect(formatPercent(-0)).toBe('0,0%')
  })
})

describe('formatCompact — edge cases', () => {
  it('formats 0', () => {
    expect(formatCompact(0)).toBe('0')
  })

  it('formats negative numbers under 1k', () => {
    expect(formatCompact(-500)).toBe('-500')
  })

  it('formats negative thousands (pt-BR comma)', () => {
    expect(formatCompact(-1500)).toBe('-1,5k')
  })

  it('formats very large numbers (billions, pt-BR comma)', () => {
    expect(formatCompact(2_500_000_000)).toBe('2,5B')
  })

  it('returns dash for null', () => {
    expect(formatCompact(null)).toBe('—')
  })

  it('returns dash for undefined', () => {
    expect(formatCompact(undefined)).toBe('—')
  })

  it('returns dash for NaN', () => {
    expect(formatCompact(NaN)).toBe('—')
  })

  it('returns dash for Infinity', () => {
    expect(formatCompact(Infinity)).toBe('—')
  })

  it('returns dash for -Infinity', () => {
    expect(formatCompact(-Infinity)).toBe('—')
  })

  it('formats exact boundary 1000 to 1,0k (pt-BR comma)', () => {
    expect(formatCompact(1000)).toBe('1,0k')
  })

  it('formats exact boundary 1_000_000 to 1,0M (pt-BR comma)', () => {
    expect(formatCompact(1_000_000)).toBe('1,0M')
  })

  it('formats exact boundary 1_000_000_000 to 1,0B (pt-BR comma)', () => {
    expect(formatCompact(1_000_000_000)).toBe('1,0B')
  })

  it('formats 999 as raw number', () => {
    expect(formatCompact(999)).toBe('999')
  })

  it('formats 1 as raw number', () => {
    expect(formatCompact(1)).toBe('1')
  })
})

/* ================================================================== */
/*  2. ABBA rotation pattern correctness for 2/3/4 variants           */
/* ================================================================== */

describe('ABBA rotation — 28 cycles', () => {
  describe('2 variants over 28 cycles', () => {
    it('each variant gets exactly 14 exposures', () => {
      const counts = [0, 0]
      for (let i = 0; i < 28; i++) {
        counts[getVariantForCycle(2, i)]!++
      }
      expect(counts[0]).toBe(14)
      expect(counts[1]).toBe(14)
    })

    it('follows strict ABBA repeating pattern', () => {
      const pattern: number[] = []
      for (let i = 0; i < 28; i++) {
        pattern.push(getVariantForCycle(2, i))
      }
      // Block size = 4: [0,1,1,0] repeated 7 times
      for (let block = 0; block < 7; block++) {
        const base = block * 4
        expect(pattern[base]).toBe(0)
        expect(pattern[base + 1]).toBe(1)
        expect(pattern[base + 2]).toBe(1)
        expect(pattern[base + 3]).toBe(0)
      }
    })
  })

  describe('3 variants over 30 cycles (5 full blocks)', () => {
    it('each variant gets exactly 10 exposures', () => {
      const counts = [0, 0, 0]
      // 30 cycles = 5 blocks of 6
      for (let i = 0; i < 30; i++) {
        counts[getVariantForCycle(3, i)]!++
      }
      expect(counts[0]).toBe(10)
      expect(counts[1]).toBe(10)
      expect(counts[2]).toBe(10)
    })

    it('follows [0,1,2,2,1,0] block pattern', () => {
      const expectedBlock = [0, 1, 2, 2, 1, 0]
      for (let block = 0; block < 5; block++) {
        for (let j = 0; j < 6; j++) {
          expect(getVariantForCycle(3, block * 6 + j)).toBe(expectedBlock[j])
        }
      }
    })
  })

  describe('4 variants over 32 cycles (4 full blocks)', () => {
    it('each variant gets exactly 8 exposures', () => {
      const counts = [0, 0, 0, 0]
      // 32 cycles = 4 blocks of 8
      for (let i = 0; i < 32; i++) {
        counts[getVariantForCycle(4, i)]!++
      }
      expect(counts[0]).toBe(8)
      expect(counts[1]).toBe(8)
      expect(counts[2]).toBe(8)
      expect(counts[3]).toBe(8)
    })

    it('follows [0,1,2,3,3,2,1,0] block pattern', () => {
      const expectedBlock = [0, 1, 2, 3, 3, 2, 1, 0]
      for (let block = 0; block < 4; block++) {
        for (let j = 0; j < 8; j++) {
          expect(getVariantForCycle(4, block * 8 + j)).toBe(expectedBlock[j])
        }
      }
    })
  })

  describe('day-of-week balance (key ABBA property)', () => {
    it('2 variants: each variant sees every day of week equally over 28 days', () => {
      // 28 days = 4 full weeks. Track which days each variant gets
      const daysByVariant: number[][] = [[], []]
      for (let i = 0; i < 28; i++) {
        const variant = getVariantForCycle(2, i)
        daysByVariant[variant]!.push(i % 7)
      }
      // Each variant should see each day exactly 2 times (14 exposures / 7 days)
      for (const days of daysByVariant) {
        const dayCounts = new Array(7).fill(0)
        for (const d of days) dayCounts[d]++
        expect(dayCounts.every((c: number) => c === 2)).toBe(true)
      }
    })
  })
})

/* ================================================================== */
/*  3. Variant color mapping consistency                               */
/* ================================================================== */

describe('Variant color mapping consistency', () => {
  it('VARIANT_COLORS has exactly A, B, C, D', () => {
    expect(Object.keys(VARIANT_COLORS)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('each color is a valid hex string', () => {
    for (const color of Object.values(VARIANT_COLORS)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('all colors are unique', () => {
    const colors = Object.values(VARIANT_COLORS)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('toDisplayLabel and variantColor are consistent', () => {
    const cases: Array<{ dbLabel: string; isOriginal?: boolean; expectedDisplay: DisplayLabel }> = [
      { dbLabel: 'original', expectedDisplay: 'A' },
      { dbLabel: 'B', expectedDisplay: 'B' },
      { dbLabel: 'C', expectedDisplay: 'C' },
      { dbLabel: 'D', expectedDisplay: 'D' },
      { dbLabel: 'anything', isOriginal: true, expectedDisplay: 'A' },
    ]
    for (const { dbLabel, isOriginal, expectedDisplay } of cases) {
      const display = toDisplayLabel(dbLabel, isOriginal)
      expect(display).toBe(expectedDisplay)
      expect(variantColor(dbLabel, isOriginal)).toBe(VARIANT_COLORS[expectedDisplay])
    }
  })

  it('variantColor always returns a valid VARIANT_COLORS value', () => {
    const allColors = new Set(Object.values(VARIANT_COLORS))
    const testLabels = ['original', 'B', 'C', 'D', 'X', '', 'unknown']
    for (const label of testLabels) {
      expect(allColors.has(variantColor(label))).toBe(true)
    }
  })
})

/* ================================================================== */
/*  4. Mock views type safety — all required fields present            */
/* ================================================================== */

describe('Mock views type safety', () => {
  describe('MOCK_WINNER', () => {
    it('has status completed and outcome winner', () => {
      expect(MOCK_WINNER.status).toBe('completed')
      expect(MOCK_WINNER.outcome).toBe('winner')
    })
    it('has winnerLabel and winnerColor', () => {
      expect(MOCK_WINNER.winnerLabel).toBeDefined()
      expect(MOCK_WINNER.winnerColor).toBeTruthy()
    })
    it('has resultMeta with all numeric fields', () => {
      expect(typeof MOCK_WINNER.resultMeta.ctrBefore).toBe('number')
      expect(typeof MOCK_WINNER.resultMeta.ctrAfter).toBe('number')
      expect(typeof MOCK_WINNER.resultMeta.totalImpressions).toBe('number')
      expect(typeof MOCK_WINNER.resultMeta.abbaCycles).toBe('number')
      expect(typeof MOCK_WINNER.resultMeta.monthlyExtraClicks).toBe('number')
    })
    it('has non-empty variants array', () => {
      expect(MOCK_WINNER.variants.length).toBeGreaterThan(0)
    })
    it('each variant has all FullChartVariant fields', () => {
      for (const v of MOCK_WINNER.variants) {
        expect(v).toHaveProperty('label')
        expect(v).toHaveProperty('color')
        expect(v).toHaveProperty('ctr')
        expect(v).toHaveProperty('impressions')
        expect(v).toHaveProperty('clicks')
        expect(v).toHaveProperty('pBest')
        expect(v).toHaveProperty('pTop2')
      }
    })
    it('has monitor with sparkline and checkpoints', () => {
      expect(MOCK_WINNER.monitor).toBeDefined()
      expect(MOCK_WINNER.monitor!.sparkline.length).toBeGreaterThan(0)
      expect(MOCK_WINNER.monitor!.checkpoints.length).toBeGreaterThan(0)
    })
    it('has gates array', () => {
      expect(MOCK_WINNER.gates.length).toBeGreaterThan(0)
    })
  })

  describe('MOCK_PLAYOFF', () => {
    it('has status completed and outcome playoff', () => {
      expect(MOCK_PLAYOFF.status).toBe('completed')
      expect(MOCK_PLAYOFF.outcome).toBe('playoff')
    })
    it('has playoffTestId and finalists', () => {
      expect(MOCK_PLAYOFF.playoffTestId).toBeTruthy()
      expect(MOCK_PLAYOFF.finalists.length).toBeGreaterThan(0)
    })
    it('finalists have label, color, ctr', () => {
      for (const f of MOCK_PLAYOFF.finalists) {
        expect(f).toHaveProperty('label')
        expect(f).toHaveProperty('color')
        expect(typeof f.ctr).toBe('number')
      }
    })
    it('has reason string', () => {
      expect(typeof MOCK_PLAYOFF.reason).toBe('string')
      expect(MOCK_PLAYOFF.reason.length).toBeGreaterThan(0)
    })
  })

  describe('MOCK_ACTIVE', () => {
    it('has status active', () => {
      expect(MOCK_ACTIVE.status).toBe('active')
    })
    it('has confirmedData with confidence, leader, leaderColor, lift', () => {
      expect(MOCK_ACTIVE.confirmedData).toBeDefined()
      expect(typeof MOCK_ACTIVE.confirmedData.confidence).toBe('number')
      expect(MOCK_ACTIVE.confirmedData.leader).toBeDefined()
      expect(MOCK_ACTIVE.confirmedData.leaderColor).toBeTruthy()
      expect(typeof MOCK_ACTIVE.confirmedData.lift).toBe('number')
    })
    it('has liveData defined', () => {
      expect(MOCK_ACTIVE.liveData).toBeDefined()
      expect(typeof MOCK_ACTIVE.liveData!.confidence).toBe('number')
    })
    it('does not have outcome property', () => {
      expect(MOCK_ACTIVE.outcome).toBeUndefined()
    })
  })

  describe('MOCK_WINNER_MINIMAL', () => {
    it('has required fields even with minimal data', () => {
      expect(MOCK_WINNER_MINIMAL.variants.length).toBe(2)
      expect(MOCK_WINNER_MINIMAL.resultMeta).toBeDefined()
      expect(MOCK_WINNER_MINIMAL.winnerLabel).toBeDefined()
    })
    it('learning can be undefined', () => {
      expect(MOCK_WINNER_MINIMAL.learning).toBeUndefined()
    })
    it('monitor can be undefined', () => {
      expect(MOCK_WINNER_MINIMAL.monitor).toBeUndefined()
    })
  })

  describe('MOCK_ACTIVE_MINIMAL', () => {
    it('has minimal confirmedData', () => {
      expect(MOCK_ACTIVE_MINIMAL.confirmedData.confidence).toBe(18)
      expect(MOCK_ACTIVE_MINIMAL.confirmedData.leader).toBe('B')
    })
    it('liveData is undefined', () => {
      expect(MOCK_ACTIVE_MINIMAL.liveData).toBeUndefined()
    })
  })

  describe('MOCK_PLAYOFF_MINIMAL', () => {
    it('has finalists array', () => {
      expect(MOCK_PLAYOFF_MINIMAL.finalists.length).toBeGreaterThan(0)
    })
    it('can have empty reason', () => {
      expect(MOCK_PLAYOFF_MINIMAL.reason).toBe('')
    })
  })

  describe('all mocks have base view fields', () => {
    const allMocks = [
      MOCK_WINNER, MOCK_PLAYOFF, MOCK_ACTIVE,
      MOCK_WINNER_MINIMAL, MOCK_PLAYOFF_MINIMAL, MOCK_ACTIVE_MINIMAL,
    ]
    for (const mock of allMocks) {
      it(`${mock.id} has id, videoTitle, flag, variants, gates, cycles`, () => {
        expect(mock.id).toBeTruthy()
        expect(mock.videoTitle).toBeTruthy()
        expect(['thumbnail', 'title', 'description', 'combo']).toContain(mock.flag)
        expect(Array.isArray(mock.variants)).toBe(true)
        expect(Array.isArray(mock.gates)).toBe(true)
        expect(mock.cycles).toHaveProperty('total')
        expect(mock.cycles).toHaveProperty('done')
      })
    }
  })
})

/* ================================================================== */
/*  5. StepRail validation (stepIsValid for each step 0-4)             */
/* ================================================================== */

describe('stepIsValid — comprehensive step coverage', () => {
  function baseState(overrides: Partial<WizardState> = {}): WizardState {
    return {
      step: 0,
      type: null,
      variants: [makeOriginalVariant('My Video')],
      config: initWizardConfig(AB_SITE_SETTINGS_DEFAULTS),
      videoId: 'vid_123',
      videoTitle: 'My Video',
      originalThumbUrl: 'https://img.youtube.com/thumb.jpg',
      draftTestId: null,
      isLaunching: false,
      error: null,
      hypothesis: '',
      ...overrides,
    }
  }

  describe('step 0 (tipo)', () => {
    it('invalid when type is null', () => {
      expect(stepIsValid(0, baseState({ type: null }))).toBe(false)
    })
    it('valid for thumbnail type', () => {
      expect(stepIsValid(0, baseState({ type: 'thumbnail' }))).toBe(true)
    })
    it('valid for title type', () => {
      expect(stepIsValid(0, baseState({ type: 'title' }))).toBe(true)
    })
    it('valid for description type', () => {
      expect(stepIsValid(0, baseState({ type: 'description' }))).toBe(true)
    })
    it('valid for combo type', () => {
      expect(stepIsValid(0, baseState({ type: 'combo' }))).toBe(true)
    })
  })

  describe('step 1 (ideias)', () => {
    it('always valid regardless of state', () => {
      expect(stepIsValid(1, baseState())).toBe(true)
      expect(stepIsValid(1, baseState({ type: null }))).toBe(true)
      expect(stepIsValid(1, baseState({ variants: [] }))).toBe(true)
    })
  })

  describe('step 2 (variantes)', () => {
    it('invalid when only original variant exists', () => {
      expect(stepIsValid(2, baseState({
        variants: [makeOriginalVariant('V')],
      }))).toBe(false)
    })

    it('invalid when challenger has no content', () => {
      expect(stepIsValid(2, baseState({
        variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
      }))).toBe(false)
    })

    it('valid when challenger has thumbUrl', () => {
      expect(stepIsValid(2, baseState({
        variants: [
          makeOriginalVariant('V'),
          { ...makeEmptyVariant('B'), thumbUrl: 'blob:xx' },
        ],
      }))).toBe(true)
    })

    it('valid when any one of multiple challengers has content', () => {
      expect(stepIsValid(2, baseState({
        variants: [
          makeOriginalVariant('V'),
          makeEmptyVariant('B'),
          { ...makeEmptyVariant('C'), titleText: 'Alt title' },
        ],
      }))).toBe(true)
    })
  })

  describe('step 3 (config)', () => {
    it('always valid (has defaults)', () => {
      expect(stepIsValid(3, baseState())).toBe(true)
    })
  })

  describe('step 4 (revisar)', () => {
    it('always valid', () => {
      expect(stepIsValid(4, baseState())).toBe(true)
    })
  })

  describe('invalid step numbers', () => {
    it('step -1 returns false', () => {
      expect(stepIsValid(-1, baseState())).toBe(false)
    })
    it('step 5 returns false', () => {
      expect(stepIsValid(5, baseState())).toBe(false)
    })
    it('step 99 returns false', () => {
      expect(stepIsValid(99, baseState())).toBe(false)
    })
  })
})

/* ================================================================== */
/*  6. Wizard reducer handles all action types                         */
/* ================================================================== */

describe('wizardReducer — all action types', () => {
  function baseState(overrides: Partial<WizardState> = {}): WizardState {
    return {
      step: 0,
      type: null,
      variants: [makeOriginalVariant('My Video'), makeEmptyVariant('B')],
      config: initWizardConfig(AB_SITE_SETTINGS_DEFAULTS),
      videoId: 'vid_123',
      videoTitle: 'My Video',
      originalThumbUrl: 'https://img.youtube.com/thumb.jpg',
      draftTestId: null,
      isLaunching: false,
      error: null,
      hypothesis: '',
      ...overrides,
    }
  }

  it('SET_STEP updates step and clears error', () => {
    const state = baseState({ error: 'old error' })
    const next = wizardReducer(state, { type: 'SET_STEP', step: 2 })
    expect(next.step).toBe(2)
    expect(next.error).toBeNull()
  })

  it('SET_TYPE resets variants and clears error', () => {
    const state = baseState({
      variants: [makeOriginalVariant('V'), makeEmptyVariant('B'), makeEmptyVariant('C')],
      error: 'err',
    })
    const next = wizardReducer(state, { type: 'SET_TYPE', testType: 'title' })
    expect(next.type).toBe('title')
    expect(next.variants).toHaveLength(2)
    expect(next.error).toBeNull()
  })

  it('SET_VARIANTS replaces the entire array', () => {
    const state = baseState()
    const newV = [makeOriginalVariant('X')]
    const next = wizardReducer(state, { type: 'SET_VARIANTS', variants: newV })
    expect(next.variants).toBe(newV)
  })

  it('UPDATE_VARIANT merges data at index without mutation', () => {
    const state = baseState()
    const next = wizardReducer(state, { type: 'UPDATE_VARIANT', index: 1, data: { titleText: 'New' } })
    expect(next.variants[1]!.titleText).toBe('New')
    expect(state.variants[1]!.titleText).toBe('') // original unchanged
  })

  it('ADD_VARIANT appends with correct sequential label', () => {
    const state = baseState()
    const next = wizardReducer(state, { type: 'ADD_VARIANT' })
    expect(next.variants).toHaveLength(3)
    expect(next.variants[2]!.label).toBe('C')
  })

  it('REMOVE_VARIANT removes and relabels', () => {
    const state = baseState({
      variants: [makeOriginalVariant('V'), makeEmptyVariant('B'), makeEmptyVariant('C')],
    })
    const next = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 1 })
    expect(next.variants).toHaveLength(2)
    expect(next.variants[1]!.label).toBe('B') // was C, relabeled
  })

  it('UPDATE_CONFIG updates single key', () => {
    const state = baseState()
    const next = wizardReducer(state, { type: 'UPDATE_CONFIG', key: 'confidence', value: 90 })
    expect(next.config.confidence).toBe(90)
    expect(next.config.duration).toBe(state.config.duration) // unchanged
  })

  it('SET_DRAFT_ID sets the draft ID', () => {
    const next = wizardReducer(baseState(), { type: 'SET_DRAFT_ID', id: 'draft-abc' })
    expect(next.draftTestId).toBe('draft-abc')
  })

  it('SET_LAUNCHING toggles isLaunching', () => {
    const next = wizardReducer(baseState(), { type: 'SET_LAUNCHING', isLaunching: true })
    expect(next.isLaunching).toBe(true)
  })

  it('SET_ERROR sets and clears error', () => {
    const s1 = wizardReducer(baseState(), { type: 'SET_ERROR', error: 'Upload failed' })
    expect(s1.error).toBe('Upload failed')
    const s2 = wizardReducer(s1, { type: 'SET_ERROR', error: null })
    expect(s2.error).toBeNull()
  })

  it('SET_HYPOTHESIS sets hypothesis text', () => {
    const next = wizardReducer(baseState(), { type: 'SET_HYPOTHESIS', text: 'Close-up faces increase CTR' })
    expect(next.hypothesis).toBe('Close-up faces increase CTR')
  })

  it('unknown action returns state unchanged', () => {
    const state = baseState()
    // @ts-expect-error — intentional unknown action
    const next = wizardReducer(state, { type: 'BANANA' })
    expect(next).toBe(state)
  })
})

/* ================================================================== */
/*  7. Config adapter — wizard config to AB config conversion          */
/* ================================================================== */

describe('wizardConfigToAbConfig — full coverage', () => {
  const baseConfig: WizardConfig = {
    confidence: 95,
    duration: 14,
    autoApply: true,
    burnIn: 2,
    rotation: 'abba',
    playoff: true,
  }

  it('converts confidence integer to decimal', () => {
    const result = wizardConfigToAbConfig(baseConfig)
    expect(result.confidence_threshold).toBe(0.95)
  })

  it('converts 80 confidence to 0.80', () => {
    const result = wizardConfigToAbConfig({ ...baseConfig, confidence: 80 })
    expect(result.confidence_threshold).toBe(0.80)
  })

  it('converts 99 confidence to 0.99', () => {
    const result = wizardConfigToAbConfig({ ...baseConfig, confidence: 99 })
    expect(result.confidence_threshold).toBe(0.99)
  })

  it('maps duration to max_duration_days', () => {
    const result = wizardConfigToAbConfig({ ...baseConfig, duration: 28 })
    expect(result.max_duration_days).toBe(28)
  })

  it('maps autoApply to auto_apply_winner', () => {
    const result = wizardConfigToAbConfig({ ...baseConfig, autoApply: false })
    expect(result.auto_apply_winner).toBe(false)
  })

  it('maps burnIn to burn_in_days', () => {
    const result = wizardConfigToAbConfig({ ...baseConfig, burnIn: 0 })
    expect(result.burn_in_days).toBe(0)
  })

  it('maps rotation pattern through', () => {
    expect(wizardConfigToAbConfig({ ...baseConfig, rotation: 'abba' }).rotation_pattern).toBe('abba')
    expect(wizardConfigToAbConfig({ ...baseConfig, rotation: 'round_robin' }).rotation_pattern).toBe('round_robin')
    expect(wizardConfigToAbConfig({ ...baseConfig, rotation: 'random' }).rotation_pattern).toBe('random')
  })

  it('always sets stability_threshold to 3', () => {
    const result = wizardConfigToAbConfig(baseConfig)
    expect(result.stability_threshold).toBe(3)
  })

  it('result is a valid Partial<AbTestConfig>', () => {
    const result = wizardConfigToAbConfig(baseConfig)
    expect(Object.keys(result)).toEqual(expect.arrayContaining([
      'confidence_threshold',
      'max_duration_days',
      'auto_apply_winner',
      'burn_in_days',
      'rotation_pattern',
      'stability_threshold',
    ]))
  })
})

describe('initWizardConfig — from site settings', () => {
  it('converts default settings correctly', () => {
    const cfg = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
    expect(cfg.confidence).toBe(95)
    expect(cfg.duration).toBe(14)
    expect(cfg.autoApply).toBe(true)
    expect(cfg.burnIn).toBe(2)
    expect(cfg.rotation).toBe('abba')
    expect(cfg.playoff).toBe(true)
  })

  it('handles custom site settings', () => {
    const custom = {
      ...AB_SITE_SETTINGS_DEFAULTS,
      default_confidence: 0.90,
      default_duration_days: 21,
      default_auto_apply: false,
      default_burn_in_days: 0,
    }
    const cfg = initWizardConfig(custom)
    expect(cfg.confidence).toBe(90)
    expect(cfg.duration).toBe(21)
    expect(cfg.autoApply).toBe(false)
    expect(cfg.burnIn).toBe(0)
  })

  it('roundtrip: initWizardConfig -> wizardConfigToAbConfig preserves values', () => {
    const cfg = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
    const abConfig = wizardConfigToAbConfig(cfg)
    expect(abConfig.confidence_threshold).toBe(AB_SITE_SETTINGS_DEFAULTS.default_confidence)
    expect(abConfig.max_duration_days).toBe(AB_SITE_SETTINGS_DEFAULTS.default_duration_days)
    expect(abConfig.auto_apply_winner).toBe(AB_SITE_SETTINGS_DEFAULTS.default_auto_apply)
    expect(abConfig.burn_in_days).toBe(AB_SITE_SETTINGS_DEFAULTS.default_burn_in_days)
  })
})
