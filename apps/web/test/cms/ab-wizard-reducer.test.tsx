import { describe, it, expect } from 'vitest'
import {
  wizardReducer,
  stepIsValid,
  makeOriginalVariant,
  makeEmptyVariant,
} from '@/lib/youtube/ab-wizard-reducer'
import type { WizardState } from '@/lib/youtube/ab-wizard-reducer'
import { initWizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'

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
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  makeOriginalVariant / makeEmptyVariant                             */
/* ------------------------------------------------------------------ */

describe('makeOriginalVariant', () => {
  it('creates variant A with isOriginal true and the video title', () => {
    const v = makeOriginalVariant('Hello World')
    expect(v).toEqual({
      label: 'A',
      isOriginal: true,
      thumbUrl: null,
      titleText: 'Hello World',
      descriptionText: '',
    })
  })
})

describe('makeEmptyVariant', () => {
  it('creates a blank challenger with given label', () => {
    const v = makeEmptyVariant('C')
    expect(v).toEqual({
      label: 'C',
      isOriginal: false,
      thumbUrl: null,
      titleText: '',
      descriptionText: '',
    })
  })
})

/* ------------------------------------------------------------------ */
/*  wizardReducer                                                      */
/* ------------------------------------------------------------------ */

describe('wizardReducer', () => {
  /* --- SET_STEP --------------------------------------------------- */

  it('SET_STEP sets step and clears error', () => {
    const state = baseState({ step: 0, error: 'something broke' })
    const next = wizardReducer(state, { type: 'SET_STEP', step: 3 })
    expect(next.step).toBe(3)
    expect(next.error).toBeNull()
  })

  /* --- SET_TYPE --------------------------------------------------- */

  it('SET_TYPE sets type and resets variants to [original, emptyB]', () => {
    const state = baseState()
    const next = wizardReducer(state, { type: 'SET_TYPE', testType: 'thumbnail' })
    expect(next.type).toBe('thumbnail')
    expect(next.variants).toHaveLength(2)
    expect(next.variants[0]!.label).toBe('A')
    expect(next.variants[0]!.isOriginal).toBe(true)
    expect(next.variants[1]!.label).toBe('B')
    expect(next.variants[1]!.isOriginal).toBe(false)
  })

  it('SET_TYPE clears previous error', () => {
    const state = baseState({ error: 'old error' })
    const next = wizardReducer(state, { type: 'SET_TYPE', testType: 'title' })
    expect(next.error).toBeNull()
  })

  it('SET_TYPE uses videoTitle for the original variant', () => {
    const state = baseState({ videoTitle: 'Custom Title' })
    const next = wizardReducer(state, { type: 'SET_TYPE', testType: 'combo' })
    expect(next.variants[0]!.titleText).toBe('Custom Title')
  })

  /* --- SET_VARIANTS ----------------------------------------------- */

  it('SET_VARIANTS replaces entire variants array', () => {
    const state = baseState()
    const newVariants = [makeOriginalVariant('X'), makeEmptyVariant('B'), makeEmptyVariant('C')]
    const next = wizardReducer(state, { type: 'SET_VARIANTS', variants: newVariants })
    expect(next.variants).toHaveLength(3)
    expect(next.variants).toBe(newVariants)
  })

  /* --- UPDATE_VARIANT --------------------------------------------- */

  it('UPDATE_VARIANT merges partial data at given index', () => {
    const state = baseState({
      variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
    })
    const next = wizardReducer(state, {
      type: 'UPDATE_VARIANT',
      index: 1,
      data: { titleText: 'New Title', thumbUrl: 'blob:thumb' },
    })
    expect(next.variants[1]!.titleText).toBe('New Title')
    expect(next.variants[1]!.thumbUrl).toBe('blob:thumb')
    expect(next.variants[1]!.label).toBe('B') // unchanged
  })

  it('UPDATE_VARIANT does not mutate the original state', () => {
    const state = baseState({
      variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
    })
    wizardReducer(state, { type: 'UPDATE_VARIANT', index: 1, data: { titleText: 'X' } })
    expect(state.variants[1]!.titleText).toBe('')
  })

  /* --- ADD_VARIANT ------------------------------------------------ */

  it('ADD_VARIANT appends B when no challengers exist', () => {
    const state = baseState({ variants: [makeOriginalVariant('V')] })
    const next = wizardReducer(state, { type: 'ADD_VARIANT' })
    expect(next.variants).toHaveLength(2)
    expect(next.variants[1]!.label).toBe('B')
    expect(next.variants[1]!.isOriginal).toBe(false)
  })

  it('ADD_VARIANT appends C when one challenger exists', () => {
    const state = baseState({
      variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
    })
    const next = wizardReducer(state, { type: 'ADD_VARIANT' })
    expect(next.variants).toHaveLength(3)
    expect(next.variants[2]!.label).toBe('C')
  })

  it('ADD_VARIANT appends D when two challengers exist', () => {
    const state = baseState({
      variants: [makeOriginalVariant('V'), makeEmptyVariant('B'), makeEmptyVariant('C')],
    })
    const next = wizardReducer(state, { type: 'ADD_VARIANT' })
    expect(next.variants).toHaveLength(4)
    expect(next.variants[3]!.label).toBe('D')
  })

  it('ADD_VARIANT caps at label D when 3 challengers already exist', () => {
    const state = baseState({
      variants: [
        makeOriginalVariant('V'),
        makeEmptyVariant('B'),
        makeEmptyVariant('C'),
        makeEmptyVariant('D'),
      ],
    })
    // Adding a 4th challenger — label falls back to 'D' (NEXT_LABELS[3] is undefined → fallback)
    const next = wizardReducer(state, { type: 'ADD_VARIANT' })
    expect(next.variants).toHaveLength(5)
    expect(next.variants[4]!.label).toBe('D')
  })

  /* --- REMOVE_VARIANT --------------------------------------------- */

  it('REMOVE_VARIANT removes variant at index', () => {
    const state = baseState({
      variants: [makeOriginalVariant('V'), makeEmptyVariant('B'), makeEmptyVariant('C')],
    })
    const next = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 1 })
    expect(next.variants).toHaveLength(2)
  })

  it('REMOVE_VARIANT relabels remaining challengers sequentially', () => {
    const state = baseState({
      variants: [
        makeOriginalVariant('V'),
        makeEmptyVariant('B'),
        makeEmptyVariant('C'),
        makeEmptyVariant('D'),
      ],
    })
    // Remove middle challenger (index 2 = C)
    const next = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 2 })
    expect(next.variants).toHaveLength(3)
    expect(next.variants[0]!.label).toBe('A') // original untouched
    expect(next.variants[1]!.label).toBe('B')
    expect(next.variants[2]!.label).toBe('C') // was D, relabeled to C
  })

  it('REMOVE_VARIANT does not relabel the original', () => {
    const state = baseState({
      variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
    })
    const next = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 1 })
    expect(next.variants).toHaveLength(1)
    expect(next.variants[0]!.label).toBe('A')
    expect(next.variants[0]!.isOriginal).toBe(true)
  })

  it('REMOVE_VARIANT relabels B,D → B,C after removing middle', () => {
    // Three challengers B, C, D — remove B (index 1)
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

  /* --- UPDATE_CONFIG ---------------------------------------------- */

  it('UPDATE_CONFIG updates a single config key', () => {
    const state = baseState()
    const next = wizardReducer(state, { type: 'UPDATE_CONFIG', key: 'duration', value: 21 })
    expect(next.config.duration).toBe(21)
    // Other keys unchanged
    expect(next.config.confidence).toBe(state.config.confidence)
  })

  it('UPDATE_CONFIG updates boolean config key', () => {
    const state = baseState()
    const next = wizardReducer(state, { type: 'UPDATE_CONFIG', key: 'autoApply', value: false })
    expect(next.config.autoApply).toBe(false)
  })

  /* --- SET_DRAFT_ID ----------------------------------------------- */

  it('SET_DRAFT_ID sets draftTestId', () => {
    const state = baseState()
    const next = wizardReducer(state, { type: 'SET_DRAFT_ID', id: 'draft_abc' })
    expect(next.draftTestId).toBe('draft_abc')
  })

  /* --- SET_LAUNCHING ---------------------------------------------- */

  it('SET_LAUNCHING sets isLaunching true', () => {
    const state = baseState()
    const next = wizardReducer(state, { type: 'SET_LAUNCHING', isLaunching: true })
    expect(next.isLaunching).toBe(true)
  })

  it('SET_LAUNCHING sets isLaunching false', () => {
    const state = baseState({ isLaunching: true })
    const next = wizardReducer(state, { type: 'SET_LAUNCHING', isLaunching: false })
    expect(next.isLaunching).toBe(false)
  })

  /* --- SET_ERROR -------------------------------------------------- */

  it('SET_ERROR sets error message', () => {
    const state = baseState()
    const next = wizardReducer(state, { type: 'SET_ERROR', error: 'Upload failed' })
    expect(next.error).toBe('Upload failed')
  })

  it('SET_ERROR clears error when null', () => {
    const state = baseState({ error: 'old' })
    const next = wizardReducer(state, { type: 'SET_ERROR', error: null })
    expect(next.error).toBeNull()
  })

  /* --- default / unknown action ----------------------------------- */

  it('returns state unchanged for unknown action', () => {
    const state = baseState()
    // @ts-expect-error — testing unknown action type
    const next = wizardReducer(state, { type: 'UNKNOWN_ACTION' })
    expect(next).toBe(state)
  })
})

/* ------------------------------------------------------------------ */
/*  stepIsValid                                                        */
/* ------------------------------------------------------------------ */

describe('stepIsValid', () => {
  it('step 0 is invalid when type is null', () => {
    expect(stepIsValid(0, baseState({ type: null }))).toBe(false)
  })

  it('step 0 is valid when type is set', () => {
    expect(stepIsValid(0, baseState({ type: 'thumbnail' }))).toBe(true)
  })

  it('step 1 is always valid (placeholder)', () => {
    expect(stepIsValid(1, baseState())).toBe(true)
  })

  it('step 2 is invalid when no challenger has content', () => {
    const state = baseState({
      variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
    })
    expect(stepIsValid(2, state)).toBe(false)
  })

  it('step 2 is valid when a challenger has titleText', () => {
    const state = baseState({
      variants: [
        makeOriginalVariant('V'),
        { ...makeEmptyVariant('B'), titleText: 'Alt title' },
      ],
    })
    expect(stepIsValid(2, state)).toBe(true)
  })

  it('step 2 is valid when a challenger has descriptionText', () => {
    const state = baseState({
      variants: [
        makeOriginalVariant('V'),
        { ...makeEmptyVariant('B'), descriptionText: 'Some desc' },
      ],
    })
    expect(stepIsValid(2, state)).toBe(true)
  })

  it('step 2 is valid when a challenger has thumbUrl', () => {
    const state = baseState({
      variants: [
        makeOriginalVariant('V'),
        { ...makeEmptyVariant('B'), thumbUrl: 'blob:xxx' },
      ],
    })
    expect(stepIsValid(2, state)).toBe(true)
  })

  it('step 2 ignores original variant content (only challengers count)', () => {
    const state = baseState({
      variants: [makeOriginalVariant('V'), makeEmptyVariant('B')],
    })
    // Original has titleText='V' but it's isOriginal, so step 2 should be invalid
    expect(stepIsValid(2, state)).toBe(false)
  })

  it('step 2 treats whitespace-only titleText as empty', () => {
    const state = baseState({
      variants: [
        makeOriginalVariant('V'),
        { ...makeEmptyVariant('B'), titleText: '   ' },
      ],
    })
    expect(stepIsValid(2, state)).toBe(false)
  })

  it('step 3 is always valid (has defaults)', () => {
    expect(stepIsValid(3, baseState())).toBe(true)
  })

  it('step 4 is always valid', () => {
    expect(stepIsValid(4, baseState())).toBe(true)
  })

  it('unknown step returns false', () => {
    expect(stepIsValid(99, baseState())).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  Label assignment round-trip                                        */
/* ------------------------------------------------------------------ */

describe('label assignment (NEXT_LABELS)', () => {
  it('adding 3 challengers produces B, C, D labels', () => {
    let state = baseState({ variants: [makeOriginalVariant('V')] })
    state = wizardReducer(state, { type: 'ADD_VARIANT' }) // B
    state = wizardReducer(state, { type: 'ADD_VARIANT' }) // C
    state = wizardReducer(state, { type: 'ADD_VARIANT' }) // D
    expect(state.variants.map(v => v.label)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('removing middle challenger and relabeling gives B, C (not B, D)', () => {
    let state = baseState({ variants: [makeOriginalVariant('V')] })
    state = wizardReducer(state, { type: 'ADD_VARIANT' }) // B
    state = wizardReducer(state, { type: 'ADD_VARIANT' }) // C
    state = wizardReducer(state, { type: 'ADD_VARIANT' }) // D
    // Remove C (index 2)
    state = wizardReducer(state, { type: 'REMOVE_VARIANT', index: 2 })
    expect(state.variants.map(v => v.label)).toEqual(['A', 'B', 'C'])
  })
})
