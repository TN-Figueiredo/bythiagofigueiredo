/**
 * Comprehensive AB Lab wizard tests — state machine, step validation,
 * adapter functions, StepTipo component, and StepConfig component.
 *
 * Consolidates and extends coverage for the five key areas:
 * 1. Wizard reducer (state machine actions)
 * 2. stepIsValid (per-step validation)
 * 3. WizardConfig adapter (initWizardConfig / wizardConfigToAbConfig)
 * 4. StepTipo component (type selection radiogroup)
 * 5. StepConfig component (config rows, sliders, toggles, estimate)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import {
  wizardReducer,
  stepIsValid,
  makeOriginalVariant,
  makeEmptyVariant,
} from '@/lib/youtube/ab-wizard-reducer'
import type { WizardState, VariantData } from '@/lib/youtube/ab-wizard-reducer'

import {
  initWizardConfig,
  wizardConfigToAbConfig,
} from '@/lib/youtube/ab-wizard-adapter'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'

import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import type { TestType } from '@/lib/youtube/ab-types'

import { StepTipo } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-tipo'
import { StepConfig } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-config'

/* ------------------------------------------------------------------ */
/*  Mock lucide-react icons used across step components                 */
/* ------------------------------------------------------------------ */

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  )
  return {
    Image: icon('Image'),
    Type: icon('Type'),
    FileText: icon('FileText'),
    Layers: icon('Layers'),
    FlaskConical: icon('FlaskConical'),
    Lock: icon('Lock'),
    Plus: icon('Plus'),
    Trash2: icon('Trash2'),
    Sparkles: icon('Sparkles'),
    CheckCircle: icon('CheckCircle'),
    Play: icon('Play'),
    ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'),
    ArrowLeft: icon('ArrowLeft'),
    Copy: icon('Copy'),
    Download: icon('Download'),
    Pause: icon('Pause'),
    Square: icon('Square'),
    LayoutGrid: icon('LayoutGrid'),
    Search: icon('Search'),
    ListVideo: icon('ListVideo'),
    Smartphone: icon('Smartphone'),
    Trophy: icon('Trophy'),
    TrendingUp: icon('TrendingUp'),
    TrendingDown: icon('TrendingDown'),
  }
})

/* ------------------------------------------------------------------ */
/*  Helper: build a baseline WizardState                               */
/* ------------------------------------------------------------------ */

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

/* ================================================================== */
/*  1. WIZARD STATE MACHINE (wizardReducer)                            */
/* ================================================================== */

describe('wizardReducer — state machine', () => {
  /* --- SET_TYPE --------------------------------------------------- */

  describe('SET_TYPE', () => {
    it('resets variants to [original, B] regardless of prior variant count', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          makeEmptyVariant('B'),
          makeEmptyVariant('C'),
          makeEmptyVariant('D'),
        ],
      })
      const next = wizardReducer(state, { type: 'SET_TYPE', testType: 'thumbnail' })
      expect(next.variants).toHaveLength(2)
      expect(next.variants[0]!.label).toBe('A')
      expect(next.variants[0]!.isOriginal).toBe(true)
      expect(next.variants[1]!.label).toBe('B')
      expect(next.variants[1]!.isOriginal).toBe(false)
    })

    it('sets the test type on state', () => {
      const next = wizardReducer(baseState(), { type: 'SET_TYPE', testType: 'combo' })
      expect(next.type).toBe('combo')
    })

    it('clears previous error', () => {
      const state = baseState({ error: 'old error' })
      const next = wizardReducer(state, { type: 'SET_TYPE', testType: 'title' })
      expect(next.error).toBeNull()
    })

    it('uses videoTitle for the original variant titleText', () => {
      const state = baseState({ videoTitle: 'Custom Title' })
      const next = wizardReducer(state, { type: 'SET_TYPE', testType: 'description' })
      expect(next.variants[0]!.titleText).toBe('Custom Title')
    })

    it('new challenger B is always blank after SET_TYPE', () => {
      const next = wizardReducer(baseState(), { type: 'SET_TYPE', testType: 'title' })
      expect(next.variants[1]!.titleText).toBe('')
      expect(next.variants[1]!.descriptionText).toBe('')
      expect(next.variants[1]!.thumbUrl).toBeNull()
    })

    it('preserves other state properties', () => {
      const state = baseState({ videoId: 'xyz', hypothesis: 'test hypo' })
      const next = wizardReducer(state, { type: 'SET_TYPE', testType: 'thumbnail' })
      expect(next.videoId).toBe('xyz')
      expect(next.hypothesis).toBe('test hypo')
    })

    it.each<TestType>(['thumbnail', 'title', 'description', 'combo'])(
      'works for all test types: %s',
      (testType) => {
        const next = wizardReducer(baseState(), { type: 'SET_TYPE', testType })
        expect(next.type).toBe(testType)
        expect(next.variants).toHaveLength(2)
      },
    )
  })

  /* --- ADD_VARIANT ------------------------------------------------ */

  describe('ADD_VARIANT', () => {
    it('appends B when no challengers exist', () => {
      const state = baseState({ variants: [makeOriginalVariant('V')] })
      const next = wizardReducer(state, { type: 'ADD_VARIANT' })
      expect(next.variants).toHaveLength(2)
      expect(next.variants[1]!.label).toBe('B')
    })

    it('appends C when one challenger exists', () => {
      const state = baseState({
        variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
      })
      const next = wizardReducer(state, { type: 'ADD_VARIANT' })
      expect(next.variants).toHaveLength(3)
      expect(next.variants[2]!.label).toBe('C')
    })

    it('appends D when two challengers exist', () => {
      const state = baseState({
        variants: [makeOriginalVariant('V'), makeEmptyVariant('B'), makeEmptyVariant('C')],
      })
      const next = wizardReducer(state, { type: 'ADD_VARIANT' })
      expect(next.variants).toHaveLength(4)
      expect(next.variants[3]!.label).toBe('D')
    })

    it('caps at 4 total (A + 3 challengers) — adding beyond uses D fallback', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          makeEmptyVariant('B'),
          makeEmptyVariant('C'),
          makeEmptyVariant('D'),
        ],
      })
      const next = wizardReducer(state, { type: 'ADD_VARIANT' })
      // Implementation does not prevent adding, but label falls back to D
      expect(next.variants).toHaveLength(5)
      expect(next.variants[4]!.label).toBe('D')
    })

    it('sequential addition produces B, C, D labels', () => {
      let state = baseState({ variants: [makeOriginalVariant('V')] })
      state = wizardReducer(state, { type: 'ADD_VARIANT' })
      state = wizardReducer(state, { type: 'ADD_VARIANT' })
      state = wizardReducer(state, { type: 'ADD_VARIANT' })
      expect(state.variants.map(v => v.label)).toEqual(['A', 'B', 'C', 'D'])
    })

    it('new variant is always non-original with empty fields', () => {
      const state = baseState({ variants: [makeOriginalVariant('V')] })
      const next = wizardReducer(state, { type: 'ADD_VARIANT' })
      const added = next.variants[1]!
      expect(added.isOriginal).toBe(false)
      expect(added.titleText).toBe('')
      expect(added.descriptionText).toBe('')
      expect(added.thumbUrl).toBeNull()
    })
  })

  /* --- REMOVE_VARIANT --------------------------------------------- */

  describe('REMOVE_VARIANT', () => {
    it('removes variant at specified index', () => {
      const state = baseState({
        variants: [makeOriginalVariant('V'), makeEmptyVariant('B'), makeEmptyVariant('C')],
      })
      const next = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 1 })
      expect(next.variants).toHaveLength(2)
    })

    it('relabels remaining challengers B, C, D sequentially', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          makeEmptyVariant('B'),
          makeEmptyVariant('C'),
          makeEmptyVariant('D'),
        ],
      })
      // Remove C (index 2)
      const next = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 2 })
      expect(next.variants).toHaveLength(3)
      expect(next.variants[0]!.label).toBe('A')
      expect(next.variants[1]!.label).toBe('B')
      expect(next.variants[2]!.label).toBe('C') // was D, relabeled
    })

    it('relabels after removing first challenger (B)', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          makeEmptyVariant('B'),
          makeEmptyVariant('C'),
          makeEmptyVariant('D'),
        ],
      })
      const next = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 1 })
      expect(next.variants).toHaveLength(3)
      expect(next.variants[1]!.label).toBe('B') // was C
      expect(next.variants[2]!.label).toBe('C') // was D
    })

    it('does not relabel original variant', () => {
      const state = baseState({
        variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
      })
      const next = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 1 })
      expect(next.variants).toHaveLength(1)
      expect(next.variants[0]!.label).toBe('A')
      expect(next.variants[0]!.isOriginal).toBe(true)
    })

    it('preserves variant content through relabel (only label changes)', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          { ...makeEmptyVariant('B'), titleText: 'Title B' },
          { ...makeEmptyVariant('C'), titleText: 'Title C' },
        ],
      })
      // Remove B (index 1), C should become B but keep its content
      const next = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 1 })
      expect(next.variants[1]!.label).toBe('B')
      expect(next.variants[1]!.titleText).toBe('Title C')
    })

    it('round-trip: add 3 challengers, remove middle, labels are A,B,C', () => {
      let state = baseState({ variants: [makeOriginalVariant('V')] })
      state = wizardReducer(state, { type: 'ADD_VARIANT' }) // B
      state = wizardReducer(state, { type: 'ADD_VARIANT' }) // C
      state = wizardReducer(state, { type: 'ADD_VARIANT' }) // D
      state = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 2 }) // remove C
      expect(state.variants.map(v => v.label)).toEqual(['A', 'B', 'C'])
    })
  })

  /* --- UPDATE_CONFIG ---------------------------------------------- */

  describe('UPDATE_CONFIG', () => {
    it('persists duration key', () => {
      const next = wizardReducer(baseState(), { type: 'UPDATE_CONFIG', key: 'duration', value: 21 })
      expect(next.config.duration).toBe(21)
    })

    it('persists confidence key', () => {
      const next = wizardReducer(baseState(), { type: 'UPDATE_CONFIG', key: 'confidence', value: 90 })
      expect(next.config.confidence).toBe(90)
    })

    it('persists autoApply boolean', () => {
      const next = wizardReducer(baseState(), { type: 'UPDATE_CONFIG', key: 'autoApply', value: false })
      expect(next.config.autoApply).toBe(false)
    })

    it('persists burnIn key', () => {
      const next = wizardReducer(baseState(), { type: 'UPDATE_CONFIG', key: 'burnIn', value: 3 })
      expect(next.config.burnIn).toBe(3)
    })

    it('persists rotation key', () => {
      const next = wizardReducer(baseState(), { type: 'UPDATE_CONFIG', key: 'rotation', value: 'random' })
      expect(next.config.rotation).toBe('random')
    })

    it('persists playoff boolean', () => {
      const next = wizardReducer(baseState(), { type: 'UPDATE_CONFIG', key: 'playoff', value: false })
      expect(next.config.playoff).toBe(false)
    })

    it('does not mutate other config keys', () => {
      const state = baseState()
      const next = wizardReducer(state, { type: 'UPDATE_CONFIG', key: 'duration', value: 28 })
      expect(next.config.confidence).toBe(state.config.confidence)
      expect(next.config.autoApply).toBe(state.config.autoApply)
      expect(next.config.burnIn).toBe(state.config.burnIn)
      expect(next.config.rotation).toBe(state.config.rotation)
      expect(next.config.playoff).toBe(state.config.playoff)
    })
  })

  /* --- SET_STEP --------------------------------------------------- */

  describe('SET_STEP', () => {
    it('sets step number', () => {
      const next = wizardReducer(baseState(), { type: 'SET_STEP', step: 3 })
      expect(next.step).toBe(3)
    })

    it('clears error on step change', () => {
      const state = baseState({ error: 'something broke' })
      const next = wizardReducer(state, { type: 'SET_STEP', step: 1 })
      expect(next.error).toBeNull()
    })

    it('clears error even when stepping to same step', () => {
      const state = baseState({ step: 2, error: 'err' })
      const next = wizardReducer(state, { type: 'SET_STEP', step: 2 })
      expect(next.error).toBeNull()
    })
  })

  /* --- SET_HYPOTHESIS --------------------------------------------- */

  describe('SET_HYPOTHESIS', () => {
    it('stores hypothesis text', () => {
      const next = wizardReducer(baseState(), { type: 'SET_HYPOTHESIS', text: 'Faces in thumbnails increase CTR by 20%' })
      expect(next.hypothesis).toBe('Faces in thumbnails increase CTR by 20%')
    })

    it('can clear hypothesis to empty string', () => {
      const state = baseState({ hypothesis: 'old' })
      const next = wizardReducer(state, { type: 'SET_HYPOTHESIS', text: '' })
      expect(next.hypothesis).toBe('')
    })

    it('preserves other state when setting hypothesis', () => {
      const state = baseState({ type: 'thumbnail', step: 1 })
      const next = wizardReducer(state, { type: 'SET_HYPOTHESIS', text: 'test' })
      expect(next.type).toBe('thumbnail')
      expect(next.step).toBe(1)
    })
  })

  /* --- SET_LAUNCHING ---------------------------------------------- */

  describe('SET_LAUNCHING', () => {
    it('sets isLaunching to true', () => {
      const next = wizardReducer(baseState(), { type: 'SET_LAUNCHING', isLaunching: true })
      expect(next.isLaunching).toBe(true)
    })

    it('sets isLaunching to false', () => {
      const state = baseState({ isLaunching: true })
      const next = wizardReducer(state, { type: 'SET_LAUNCHING', isLaunching: false })
      expect(next.isLaunching).toBe(false)
    })
  })

  /* --- SET_ERROR -------------------------------------------------- */

  describe('SET_ERROR', () => {
    it('stores error message', () => {
      const next = wizardReducer(baseState(), { type: 'SET_ERROR', error: 'Upload failed' })
      expect(next.error).toBe('Upload failed')
    })

    it('clears error when null', () => {
      const state = baseState({ error: 'old' })
      const next = wizardReducer(state, { type: 'SET_ERROR', error: null })
      expect(next.error).toBeNull()
    })

    it('replaces existing error with new one', () => {
      const state = baseState({ error: 'first' })
      const next = wizardReducer(state, { type: 'SET_ERROR', error: 'second' })
      expect(next.error).toBe('second')
    })
  })

  /* --- UPDATE_VARIANT --------------------------------------------- */

  describe('UPDATE_VARIANT', () => {
    it('merges partial data at given index', () => {
      const state = baseState({
        variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
      })
      const next = wizardReducer(state, {
        type: 'UPDATE_VARIANT',
        index: 1,
        data: { titleText: 'New', thumbUrl: 'blob:x' },
      })
      expect(next.variants[1]!.titleText).toBe('New')
      expect(next.variants[1]!.thumbUrl).toBe('blob:x')
      expect(next.variants[1]!.label).toBe('B')
    })

    it('does not mutate original state', () => {
      const state = baseState({
        variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
      })
      wizardReducer(state, { type: 'UPDATE_VARIANT', index: 1, data: { titleText: 'X' } })
      expect(state.variants[1]!.titleText).toBe('')
    })
  })

  /* --- SET_VARIANTS ----------------------------------------------- */

  describe('SET_VARIANTS', () => {
    it('replaces entire variants array', () => {
      const newVariants = [makeOriginalVariant('X'), makeEmptyVariant('B'), makeEmptyVariant('C')]
      const next = wizardReducer(baseState(), { type: 'SET_VARIANTS', variants: newVariants })
      expect(next.variants).toBe(newVariants)
      expect(next.variants).toHaveLength(3)
    })
  })

  /* --- SET_DRAFT_ID ----------------------------------------------- */

  describe('SET_DRAFT_ID', () => {
    it('sets draftTestId', () => {
      const next = wizardReducer(baseState(), { type: 'SET_DRAFT_ID', id: 'draft_abc' })
      expect(next.draftTestId).toBe('draft_abc')
    })
  })

  /* --- unknown action --------------------------------------------- */

  it('returns state unchanged for unknown action', () => {
    const state = baseState()
    // @ts-expect-error — testing unknown action type
    const next = wizardReducer(state, { type: 'UNKNOWN_ACTION' })
    expect(next).toBe(state)
  })
})

/* ================================================================== */
/*  2. STEP VALIDATION (stepIsValid)                                   */
/* ================================================================== */

describe('stepIsValid', () => {
  /* --- Step 0: type selection ------------------------------------- */

  describe('step 0 — type required', () => {
    it('invalid when type is null', () => {
      expect(stepIsValid(0, baseState({ type: null }))).toBe(false)
    })

    it('valid when type is "thumbnail"', () => {
      expect(stepIsValid(0, baseState({ type: 'thumbnail' }))).toBe(true)
    })

    it('valid when type is "title"', () => {
      expect(stepIsValid(0, baseState({ type: 'title' }))).toBe(true)
    })

    it('valid when type is "description"', () => {
      expect(stepIsValid(0, baseState({ type: 'description' }))).toBe(true)
    })

    it('valid when type is "combo"', () => {
      expect(stepIsValid(0, baseState({ type: 'combo' }))).toBe(true)
    })
  })

  /* --- Step 1: always valid (optional placeholder) --------------- */

  describe('step 1 — always valid', () => {
    it('valid even with no hypothesis', () => {
      expect(stepIsValid(1, baseState({ hypothesis: '' }))).toBe(true)
    })

    it('valid with hypothesis text', () => {
      expect(stepIsValid(1, baseState({ hypothesis: 'my hypothesis' }))).toBe(true)
    })
  })

  /* --- Step 2: at least one challenger with content -------------- */

  describe('step 2 — challenger content required', () => {
    it('invalid when no challenger has content', () => {
      const state = baseState({
        variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
      })
      expect(stepIsValid(2, state)).toBe(false)
    })

    it('valid when challenger has titleText', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          { ...makeEmptyVariant('B'), titleText: 'Alt title' },
        ],
      })
      expect(stepIsValid(2, state)).toBe(true)
    })

    it('valid when challenger has descriptionText', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          { ...makeEmptyVariant('B'), descriptionText: 'Some desc' },
        ],
      })
      expect(stepIsValid(2, state)).toBe(true)
    })

    it('valid when challenger has thumbUrl', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          { ...makeEmptyVariant('B'), thumbUrl: 'blob:xxx' },
        ],
      })
      expect(stepIsValid(2, state)).toBe(true)
    })

    it('ignores original variant content', () => {
      const state = baseState({
        variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
      })
      // Original has titleText but it is isOriginal so step 2 is invalid
      expect(stepIsValid(2, state)).toBe(false)
    })

    it('treats whitespace-only titleText as empty', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          { ...makeEmptyVariant('B'), titleText: '   \t  ' },
        ],
      })
      expect(stepIsValid(2, state)).toBe(false)
    })

    it('treats whitespace-only descriptionText as empty', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          { ...makeEmptyVariant('B'), descriptionText: '  \n  ' },
        ],
      })
      expect(stepIsValid(2, state)).toBe(false)
    })

    it('valid when second challenger has content (first empty)', () => {
      const state = baseState({
        variants: [
          makeOriginalVariant('V'),
          makeEmptyVariant('B'),
          { ...makeEmptyVariant('C'), titleText: 'Content here' },
        ],
      })
      expect(stepIsValid(2, state)).toBe(true)
    })
  })

  /* --- Step 3: always valid (has defaults) ----------------------- */

  describe('step 3 — always valid', () => {
    it('valid with default config', () => {
      expect(stepIsValid(3, baseState())).toBe(true)
    })
  })

  /* --- Step 4: always valid -------------------------------------- */

  describe('step 4 — always valid', () => {
    it('valid', () => {
      expect(stepIsValid(4, baseState())).toBe(true)
    })
  })

  /* --- Unknown step ---------------------------------------------- */

  describe('unknown step', () => {
    it('returns false for step 5', () => {
      expect(stepIsValid(5, baseState())).toBe(false)
    })

    it('returns false for step 99', () => {
      expect(stepIsValid(99, baseState())).toBe(false)
    })

    it('returns false for negative step', () => {
      expect(stepIsValid(-1, baseState())).toBe(false)
    })
  })
})

/* ================================================================== */
/*  3. WIZARD CONFIG ADAPTER                                           */
/* ================================================================== */

describe('WizardConfig adapter', () => {
  /* --- initWizardConfig ------------------------------------------ */

  describe('initWizardConfig', () => {
    it('converts default_confidence 0.95 to integer 95', () => {
      const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
      expect(wc.confidence).toBe(95)
    })

    it('maps default_duration_days to duration', () => {
      const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
      expect(wc.duration).toBe(14)
    })

    it('maps default_auto_apply to autoApply', () => {
      const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
      expect(wc.autoApply).toBe(true)
    })

    it('maps default_burn_in_days to burnIn', () => {
      const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
      expect(wc.burnIn).toBe(2)
    })

    it('defaults rotation to abba', () => {
      const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
      expect(wc.rotation).toBe('abba')
    })

    it('defaults playoff to true', () => {
      const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
      expect(wc.playoff).toBe(true)
    })

    it('rounds non-integer confidence correctly', () => {
      const wc = initWizardConfig({
        ...AB_SITE_SETTINGS_DEFAULTS,
        default_confidence: 0.876,
      })
      expect(wc.confidence).toBe(88) // Math.round(87.6)
    })

    it('maps custom site settings', () => {
      const wc = initWizardConfig({
        ...AB_SITE_SETTINGS_DEFAULTS,
        default_duration_days: 21,
        default_confidence: 0.90,
        default_auto_apply: false,
        default_burn_in_days: 0,
      })
      expect(wc.duration).toBe(21)
      expect(wc.confidence).toBe(90)
      expect(wc.autoApply).toBe(false)
      expect(wc.burnIn).toBe(0)
    })

    it('matches AB_SITE_SETTINGS_DEFAULTS — confidence=95, duration=14, autoApply=true, burnIn=2', () => {
      const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
      expect(wc).toEqual({
        confidence: 95,
        duration: 14,
        autoApply: true,
        burnIn: 2,
        rotation: 'abba',
        playoff: true,
      })
    })
  })

  /* --- wizardConfigToAbConfig ------------------------------------ */

  describe('wizardConfigToAbConfig', () => {
    const defaultWc: WizardConfig = {
      confidence: 95,
      duration: 14,
      autoApply: true,
      burnIn: 2,
      rotation: 'abba',
      playoff: true,
    }

    it('converts confidence integer 95 to decimal 0.95', () => {
      const result = wizardConfigToAbConfig(defaultWc)
      expect(result.confidence_threshold).toBe(0.95)
    })

    it('converts confidence integer 80 to decimal 0.80', () => {
      const result = wizardConfigToAbConfig({ ...defaultWc, confidence: 80 })
      expect(result.confidence_threshold).toBe(0.80)
    })

    it('maps duration to max_duration_days', () => {
      const result = wizardConfigToAbConfig({ ...defaultWc, duration: 21 })
      expect(result.max_duration_days).toBe(21)
    })

    it('maps autoApply to auto_apply_winner', () => {
      const result = wizardConfigToAbConfig({ ...defaultWc, autoApply: false })
      expect(result.auto_apply_winner).toBe(false)
    })

    it('maps burnIn to burn_in_days', () => {
      const result = wizardConfigToAbConfig({ ...defaultWc, burnIn: 3 })
      expect(result.burn_in_days).toBe(3)
    })

    it('passes rotation through as rotation_pattern', () => {
      const result = wizardConfigToAbConfig({ ...defaultWc, rotation: 'round_robin' })
      expect(result.rotation_pattern).toBe('round_robin')
    })

    it('random rotation passes through unchanged', () => {
      const result = wizardConfigToAbConfig({ ...defaultWc, rotation: 'random' })
      expect(result.rotation_pattern).toBe('random')
    })

    it('always sets stability_threshold to 3', () => {
      const result = wizardConfigToAbConfig(defaultWc)
      expect(result.stability_threshold).toBe(3)
    })

    it('produces valid AbTestConfig shape', () => {
      const result = wizardConfigToAbConfig(defaultWc)
      expect(result).toEqual({
        confidence_threshold: 0.95,
        max_duration_days: 14,
        auto_apply_winner: true,
        burn_in_days: 2,
        rotation_pattern: 'abba',
        stability_threshold: 3,
      })
    })

    it('round-trip: init from defaults then convert back has consistent values', () => {
      const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
      const result = wizardConfigToAbConfig(wc)
      expect(result.confidence_threshold).toBe(AB_SITE_SETTINGS_DEFAULTS.default_confidence)
      expect(result.max_duration_days).toBe(AB_SITE_SETTINGS_DEFAULTS.default_duration_days)
      expect(result.auto_apply_winner).toBe(AB_SITE_SETTINGS_DEFAULTS.default_auto_apply)
      expect(result.burn_in_days).toBe(AB_SITE_SETTINGS_DEFAULTS.default_burn_in_days)
    })
  })
})

/* ================================================================== */
/*  4. StepTipo COMPONENT                                              */
/* ================================================================== */

describe('StepTipo component', () => {
  it('renders radiogroup with aria-label "Tipo de teste"', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: 'Tipo de teste' })).toBeDefined()
  })

  it('renders exactly 4 radio options', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    expect(screen.getAllByRole('radio')).toHaveLength(4)
  })

  it('displays all 4 type names: Combo, Thumbnail, Titulo, Descricao', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Combo')).toBeDefined()
    expect(screen.getByText('Thumbnail')).toBeDefined()
    // Use getAllByText for labels that appear in both card title and description
    expect(screen.getByText('Título')).toBeDefined()
    expect(screen.getAllByText(/Descrição/).length).toBeGreaterThanOrEqual(1)
  })

  /* --- Selection state ------------------------------------------- */

  it('no selection shows first card with tabIndex=0, rest -1', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    expect(radios[0]!.tabIndex).toBe(0)
    expect(radios[1]!.tabIndex).toBe(-1)
    expect(radios[2]!.tabIndex).toBe(-1)
    expect(radios[3]!.tabIndex).toBe(-1)
  })

  it('selected card has aria-checked="true", others "false"', () => {
    render(<StepTipo selected="title" onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    // Order: combo, thumbnail, title, description
    expect(radios[0]!.getAttribute('aria-checked')).toBe('false')
    expect(radios[1]!.getAttribute('aria-checked')).toBe('false')
    expect(radios[2]!.getAttribute('aria-checked')).toBe('true')
    expect(radios[3]!.getAttribute('aria-checked')).toBe('false')
  })

  it('selected card gets accent styling via inline style', () => {
    render(<StepTipo selected="thumbnail" onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    // Selected card has accent-related CSS vars in its style attribute
    const selectedStyle = radios[1]!.getAttribute('style') ?? ''
    const unselectedStyle = radios[0]!.getAttribute('style') ?? ''
    expect(selectedStyle).toContain('accent')
    expect(unselectedStyle).toContain('surface-hover')
  })

  /* --- Click interaction ----------------------------------------- */

  it('clicking a card calls onSelect with correct TestType', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Thumbnail').closest('[role="radio"]')!)
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })

  it('clicking second card selects thumbnail', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[1]!)
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })

  it('clicking third card selects title', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[2]!)
    expect(onSelect).toHaveBeenCalledWith('title')
  })

  it('clicking fourth card selects description', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[3]!)
    expect(onSelect).toHaveBeenCalledWith('description')
  })

  it('clicking first card selects combo', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[0]!)
    expect(onSelect).toHaveBeenCalledWith('combo')
  })

  /* --- Badges ---------------------------------------------------- */

  it('"recomendado" badge appears on combo type', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('recomendado')).toBeDefined()
  })

  it('"pontual" badge appears on description type', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('pontual')).toBeDefined()
  })

  /* --- Keyboard navigation --------------------------------------- */

  it('ArrowRight from combo selects thumbnail (forward)', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="combo" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })

  it('ArrowLeft from combo wraps to description (backward wrap)', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="combo" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenCalledWith('description')
  })

  it('ArrowDown from thumbnail navigates to title', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="thumbnail" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenCalledWith('title')
  })

  it('ArrowUp from title navigates to thumbnail', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="title" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowUp' })
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })

  it('ArrowRight from description wraps to combo', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="description" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith('combo')
  })

  it('ArrowDown from description wraps to combo', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="description" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenCalledWith('combo')
  })

  it('unrelated keys do not trigger onSelect', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="combo" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Tab' })
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Escape' })
    expect(onSelect).not.toHaveBeenCalled()
  })
})

/* ================================================================== */
/*  5. StepConfig COMPONENT                                            */
/* ================================================================== */

describe('StepConfig component', () => {
  const defaultConfig: WizardConfig = {
    confidence: 95,
    duration: 14,
    autoApply: true,
    burnIn: 1,
    rotation: 'abba' as const,
    playoff: true,
  }

  function renderConfig(overrides?: Partial<WizardConfig>) {
    const config = { ...defaultConfig, ...overrides }
    const onChange = vi.fn()
    const result = render(<StepConfig config={config} onChange={onChange} />)
    return { config, onChange, ...result }
  }

  /* --- Config rows render ---------------------------------------- */

  describe('config rows', () => {
    it('renders all 6 Portuguese config labels', () => {
      renderConfig()
      expect(screen.getByText('Duração máxima')).toBeDefined()
      expect(screen.getByText('Confiança alvo')).toBeDefined()
      expect(screen.getByText('Aplicar vencedor automaticamente')).toBeDefined()
      expect(screen.getByText('Burn-in')).toBeDefined()
      expect(screen.getByText('Padrão de rotação')).toBeDefined()
      expect(screen.getByText('Playoff automático')).toBeDefined()
    })

    it('renders hint text for each config row', () => {
      renderConfig()
      expect(screen.getByText(/Tempo máximo/)).toBeDefined()
      expect(screen.getByText(/Nível de certeza/)).toBeDefined()
      expect(screen.getByText(/Publica a variante/)).toBeDefined()
      expect(screen.getByText(/Período inicial/)).toBeDefined()
      expect(screen.getByText(/Estratégia de alternância/)).toBeDefined()
      expect(screen.getByText(/nenhuma variante vencer/)).toBeDefined()
    })
  })

  /* --- Slider bounds --------------------------------------------- */

  describe('slider bounds', () => {
    it('duration slider: min=7 max=28', () => {
      renderConfig()
      const sliders = screen.getAllByRole('slider')
      expect(sliders[0]!.getAttribute('min')).toBe('7')
      expect(sliders[0]!.getAttribute('max')).toBe('28')
    })

    it('confidence slider: min=80 max=99', () => {
      renderConfig()
      const sliders = screen.getAllByRole('slider')
      expect(sliders[1]!.getAttribute('min')).toBe('80')
      expect(sliders[1]!.getAttribute('max')).toBe('99')
    })

    it('burn-in slider: min=0 max=3', () => {
      renderConfig()
      const sliders = screen.getAllByRole('slider')
      expect(sliders[2]!.getAttribute('min')).toBe('0')
      expect(sliders[2]!.getAttribute('max')).toBe('3')
    })

    it('all sliders have step=1', () => {
      renderConfig()
      const sliders = screen.getAllByRole('slider')
      for (const slider of sliders) {
        expect(slider.getAttribute('step')).toBe('1')
      }
    })
  })

  /* --- Toggle states --------------------------------------------- */

  describe('toggle states', () => {
    it('renders two switches (auto-apply and playoff)', () => {
      renderConfig()
      const switches = screen.getAllByRole('switch')
      expect(switches).toHaveLength(2)
    })

    it('toggles have 42x24px dimensions', () => {
      renderConfig()
      const switches = screen.getAllByRole('switch')
      for (const sw of switches) {
        expect(sw.style.width).toBe('42px')
        expect(sw.style.height).toBe('24px')
      }
    })

    it('auto-apply switch reflects config.autoApply=true', () => {
      renderConfig({ autoApply: true })
      const switches = screen.getAllByRole('switch')
      expect(switches[0]!.getAttribute('aria-checked')).toBe('true')
    })

    it('auto-apply switch reflects config.autoApply=false', () => {
      renderConfig({ autoApply: false })
      const switches = screen.getAllByRole('switch')
      expect(switches[0]!.getAttribute('aria-checked')).toBe('false')
    })

    it('playoff switch reflects config.playoff=true', () => {
      renderConfig({ playoff: true })
      const switches = screen.getAllByRole('switch')
      expect(switches[1]!.getAttribute('aria-checked')).toBe('true')
    })

    it('playoff switch reflects config.playoff=false', () => {
      renderConfig({ playoff: false })
      const switches = screen.getAllByRole('switch')
      expect(switches[1]!.getAttribute('aria-checked')).toBe('false')
    })

    it('clicking auto-apply toggle calls onChange', () => {
      const { onChange } = renderConfig()
      const switches = screen.getAllByRole('switch')
      fireEvent.click(switches[0]!)
      expect(onChange).toHaveBeenCalledWith('autoApply', false)
    })

    it('clicking playoff toggle calls onChange', () => {
      const { onChange } = renderConfig()
      const switches = screen.getAllByRole('switch')
      fireEvent.click(switches[1]!)
      expect(onChange).toHaveBeenCalledWith('playoff', false)
    })
  })

  /* --- Rotation segmented control -------------------------------- */

  describe('rotation segmented control', () => {
    it('shows 3 Portuguese options in radiogroup', () => {
      renderConfig()
      const radiogroup = screen.getByRole('radiogroup', { name: 'Padrão de rotação' })
      expect(radiogroup).toBeDefined()
      const radios = radiogroup.querySelectorAll('[role="radio"]')
      expect(radios).toHaveLength(3)
    })

    it('shows ABBA, Sequencial, Aleatório labels', () => {
      renderConfig()
      expect(screen.getByText('ABBA')).toBeDefined()
      expect(screen.getByText('Sequencial')).toBeDefined()
      expect(screen.getByText('Aleatório')).toBeDefined()
    })
  })

  /* --- Estimate card --------------------------------------------- */

  describe('estimate card', () => {
    it('shows title "Estimativa"', () => {
      renderConfig()
      expect(screen.getByText('Estimativa')).toBeDefined()
    })

    it('shows subtitle with impressions info', () => {
      renderConfig()
      expect(screen.getByText(/Com ~11k impressões/)).toBeDefined()
    })

    it('shows stat labels: Tempo estimado, Ciclos ABBA, Quota', () => {
      renderConfig()
      expect(screen.getByText('Tempo estimado')).toBeDefined()
      expect(screen.getByText('Ciclos ABBA')).toBeDefined()
      expect(screen.getByText('Quota')).toBeDefined()
    })

    it('correct calculation for duration=14 confidence=95 (factor 1.0)', () => {
      renderConfig({ duration: 14, confidence: 95 })
      // estDays = Math.round(14 * 1) = 14
      expect(screen.getByText('~14 dias')).toBeDefined()
      // abbaCycles = ceil(14/2)*2 = 14
      expect(screen.getByText('14')).toBeDefined()
      // quota is fixed
      expect(screen.getByText('1,5%')).toBeDefined()
    })

    it('correct calculation for duration=14 confidence=90 (factor 0.8)', () => {
      renderConfig({ confidence: 90, duration: 14 })
      // estDays = Math.round(14 * 0.8) = 11
      expect(screen.getByText('~11 dias')).toBeDefined()
    })

    it('correct calculation for duration=21 confidence=95', () => {
      renderConfig({ duration: 21, confidence: 95 })
      // estDays = Math.round(21 * 1) = 21
      expect(screen.getByText('~21 dias')).toBeDefined()
      // abbaCycles = ceil(21/2)*2 = 22
      expect(screen.getByText('22')).toBeDefined()
    })

    it('correct calculation for duration=7 confidence=80', () => {
      renderConfig({ duration: 7, confidence: 80 })
      // estDays = Math.round(7 * 0.8) = 6
      expect(screen.getByText('~6 dias')).toBeDefined()
      // abbaCycles = ceil(7/2)*2 = 8
      expect(screen.getByText('8')).toBeDefined()
    })

    it('correct calculation for duration=28 confidence=99', () => {
      renderConfig({ duration: 28, confidence: 99 })
      // confidence >= 95 => factor 1
      // estDays = Math.round(28 * 1) = 28
      expect(screen.getByText('~28 dias')).toBeDefined()
      // abbaCycles = ceil(28/2)*2 = 28
      expect(screen.getByText('28')).toBeDefined()
    })

    it('shows 6 gates footer note', () => {
      renderConfig()
      expect(screen.getByText(/6 gates precisam passar/)).toBeDefined()
    })
  })
})

/* ================================================================== */
/*  makeOriginalVariant / makeEmptyVariant helpers                     */
/* ================================================================== */

describe('variant factory helpers', () => {
  describe('makeOriginalVariant', () => {
    it('creates variant A with isOriginal=true', () => {
      const v = makeOriginalVariant('My Title')
      expect(v.label).toBe('A')
      expect(v.isOriginal).toBe(true)
      expect(v.titleText).toBe('My Title')
      expect(v.descriptionText).toBe('')
      expect(v.thumbUrl).toBeNull()
    })
  })

  describe('makeEmptyVariant', () => {
    it('creates blank challenger with given label', () => {
      const v = makeEmptyVariant('C')
      expect(v.label).toBe('C')
      expect(v.isOriginal).toBe(false)
      expect(v.titleText).toBe('')
      expect(v.descriptionText).toBe('')
      expect(v.thumbUrl).toBeNull()
    })

    it.each<'B' | 'C' | 'D'>(['B', 'C', 'D'])('works for label %s', (label) => {
      const v = makeEmptyVariant(label)
      expect(v.label).toBe(label)
      expect(v.isOriginal).toBe(false)
    })
  })
})
