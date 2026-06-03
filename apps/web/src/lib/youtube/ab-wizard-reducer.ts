/**
 * Pure reducer + helpers for AbCreateWizard.
 *
 * Extracted into its own file so tests can import these functions without
 * pulling in server-action / React / UI dependencies from ab-create-wizard.tsx.
 */

import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'

/**
 * Duplicated from step-variantes.tsx to avoid importing from the (authed) route
 * tree, which pulls in server-action / UI dependencies in test environments.
 * The canonical type lives in step-variantes.tsx — keep in sync.
 */
export interface VariantData {
  label: DisplayLabel
  isOriginal: boolean
  thumbUrl: string | null
  titleText: string
  descriptionText: string
  isCoworkGenerated?: boolean
}

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface WizardState {
  step: number // 0=tipo, 1=ideias, 2=variantes, 3=config, 4=revisar
  type: TestType | null
  variants: VariantData[]
  config: WizardConfig
  videoId: string
  videoTitle: string
  originalThumbUrl: string | null
  draftTestId: string | null
  isLaunching: boolean
  error: string | null
  hypothesis: string
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

export type WizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_TYPE'; testType: TestType }
  | { type: 'SET_VARIANTS'; variants: VariantData[] }
  | { type: 'UPDATE_VARIANT'; index: number; data: Partial<VariantData> }
  | { type: 'ADD_VARIANT' }
  | { type: 'REMOVE_VARIANT'; index: number }
  | { type: 'UPDATE_CONFIG'; key: keyof WizardConfig; value: WizardConfig[keyof WizardConfig] }
  | { type: 'SET_DRAFT_ID'; id: string }
  | { type: 'SET_LAUNCHING'; isLaunching: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_HYPOTHESIS'; text: string }

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const NEXT_LABELS: DisplayLabel[] = ['B', 'C', 'D']

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function makeOriginalVariant(videoTitle: string): VariantData {
  return { label: 'A', isOriginal: true, thumbUrl: null, titleText: videoTitle, descriptionText: '' }
}

export function makeEmptyVariant(label: DisplayLabel): VariantData {
  return { label, isOriginal: false, thumbUrl: null, titleText: '', descriptionText: '' }
}

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, error: null }

    case 'SET_TYPE':
      return {
        ...state,
        type: action.testType,
        // Reset variants to original + one blank challenger
        variants: [
          makeOriginalVariant(state.videoTitle),
          makeEmptyVariant('B'),
        ],
        error: null,
      }

    case 'SET_VARIANTS':
      return { ...state, variants: action.variants }

    case 'UPDATE_VARIANT': {
      const variants = [...state.variants]
      variants[action.index] = { ...variants[action.index]!, ...action.data }
      return { ...state, variants }
    }

    case 'ADD_VARIANT': {
      const challengerCount = state.variants.filter(v => !v.isOriginal).length
      const nextLabel = NEXT_LABELS[challengerCount] ?? 'D'
      return {
        ...state,
        variants: [...state.variants, makeEmptyVariant(nextLabel)],
      }
    }

    case 'REMOVE_VARIANT': {
      const remaining = state.variants.filter((_, i) => i !== action.index)
      let labelIdx = 0
      const relabeled = remaining.map(v => {
        if (v.isOriginal) return v
        return { ...v, label: NEXT_LABELS[labelIdx++] ?? ('D' as DisplayLabel) }
      })
      return { ...state, variants: relabeled }
    }

    case 'UPDATE_CONFIG':
      return { ...state, config: { ...state.config, [action.key]: action.value } }

    case 'SET_DRAFT_ID':
      return { ...state, draftTestId: action.id }

    case 'SET_LAUNCHING':
      return { ...state, isLaunching: action.isLaunching }

    case 'SET_ERROR':
      return { ...state, error: action.error }

    case 'SET_HYPOTHESIS':
      return { ...state, hypothesis: action.text }

    default:
      return state
  }
}

/* ------------------------------------------------------------------ */
/*  Step validation                                                    */
/* ------------------------------------------------------------------ */

export function stepIsValid(step: number, state: WizardState): boolean {
  switch (step) {
    case 0: return state.type !== null
    case 1: return true // always valid — step is optional
    case 2: return state.variants.some(v => !v.isOriginal && (v.titleText.trim() || v.descriptionText.trim() || v.thumbUrl))
    case 3: return true // has defaults
    case 4: return true
    default: return false
  }
}
