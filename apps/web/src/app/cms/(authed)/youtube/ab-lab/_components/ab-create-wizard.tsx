'use client'

import { useReducer, useEffect, useTransition, useCallback, useRef } from 'react'
import { Play } from 'lucide-react'
import { StepTipo } from './step-tipo'
import { StepVariantes } from './step-variantes'
import type { VariantData } from './step-variantes'
import { StepConfig } from './step-config'
import { StepRevisar } from './step-revisar'
import { initWizardConfig, wizardConfigToAbConfig } from '@/lib/youtube/ab-wizard-adapter'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import {
  createAbTest,
  uploadVariant,
  startAbTest,
  createTextVariant,
  updateAbTestType,
} from '../actions'
import type { TestType, DisplayLabel, AbTestSiteSettings } from '@/lib/youtube/ab-types'

/* ------------------------------------------------------------------ */
/*  Wizard video — same shape the dashboard already uses              */
/* ------------------------------------------------------------------ */

export interface WizardVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  sourcePipelineId?: string | null
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface PrefillData {
  testType?: TestType
  suggestedDescription?: string
  fromOptimizationCycle?: string
}

interface Props {
  video: WizardVideo
  siteId: string
  settings: AbTestSiteSettings
  onClose: () => void
  onCreated: (testId: string) => void
  prefill?: PrefillData
  existingDraftId?: string
}

/* ------------------------------------------------------------------ */
/*  State + Reducer                                                    */
/* ------------------------------------------------------------------ */

interface WizardState {
  step: number // 0=tipo, 1=ideias(placeholder), 2=variantes, 3=config, 4=revisar
  type: TestType | null
  variants: VariantData[]
  config: WizardConfig
  videoId: string
  videoTitle: string
  originalThumbUrl: string | null
  draftTestId: string | null
  isLaunching: boolean
  error: string | null
}

type WizardAction =
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

const NEXT_LABELS: DisplayLabel[] = ['B', 'C', 'D']

function makeOriginalVariant(videoTitle: string): VariantData {
  return { label: 'A', isOriginal: true, thumbUrl: null, titleText: videoTitle, descriptionText: '' }
}

function makeEmptyVariant(label: DisplayLabel): VariantData {
  return { label, isOriginal: false, thumbUrl: null, titleText: '', descriptionText: '' }
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
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

    default:
      return state
  }
}

/* ------------------------------------------------------------------ */
/*  Step rail config                                                   */
/* ------------------------------------------------------------------ */

const STEP_LABELS = ['Tipo', 'Ideias', 'Variantes', 'Config', 'Revisar'] as const

/** Steps visible in the rail — step 1 (Ideias) is a placeholder, not navigable */
const VISIBLE_STEPS = STEP_LABELS
  .map((label, i) => ({ label, stepIndex: i }))
  .filter((_, i) => i !== 1)

function stepIsValid(step: number, state: WizardState): boolean {
  switch (step) {
    case 0: return state.type !== null
    case 1: return true // placeholder — always valid
    case 2: return state.variants.some(v => !v.isOriginal && (v.titleText.trim() || v.descriptionText.trim() || v.thumbUrl))
    case 3: return true // has defaults
    case 4: return true
    default: return false
  }
}

/* ------------------------------------------------------------------ */
/*  AbCreateWizard                                                     */
/* ------------------------------------------------------------------ */

export function AbCreateWizard({ video, siteId, settings, onClose, onCreated, prefill, existingDraftId }: Props) {
  const initialStep = prefill?.testType || existingDraftId ? 2 : 0

  const [state, dispatch] = useReducer(wizardReducer, {
    step: initialStep,
    type: prefill?.testType ?? null,
    variants: prefill?.testType
      ? [makeOriginalVariant(video.title), makeEmptyVariant('B')]
      : [makeOriginalVariant(video.title)],
    config: initWizardConfig(settings),
    videoId: video.id,
    videoTitle: video.title,
    originalThumbUrl: video.thumbnailUrl,
    draftTestId: existingDraftId ?? null,
    isLaunching: false,
    error: null,
  })

  const [isPending, startTransition] = useTransition()
  const dialogRef = useRef<HTMLDivElement>(null)

  // --- Escape key ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // --- Focus trap ---
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    el.addEventListener('keydown', trap)
    first?.focus()
    return () => el.removeEventListener('keydown', trap)
  }, [state.step])

  // --- Type selection handler (creates draft) ---
  const handleTypeSelect = useCallback((testType: TestType) => {
    dispatch({ type: 'SET_TYPE', testType })
    startTransition(async () => {
      if (state.draftTestId) {
        const res = await updateAbTestType(state.draftTestId, testType)
        if (!res.ok) {
          dispatch({ type: 'SET_ERROR', error: res.error ?? 'Failed to update test type' })
          return
        }
        dispatch({ type: 'SET_STEP', step: 2 })
        return
      }

      const result = await createAbTest({
        site_id: siteId,
        youtube_video_id: video.id,
        name: `Test: ${video.title}`,
        test_type: testType,
        config: wizardConfigToAbConfig(state.config),
      })

      if (result.ok && result.id) {
        dispatch({ type: 'SET_DRAFT_ID', id: result.id })
        dispatch({ type: 'SET_STEP', step: 2 })
      } else if (result.error?.includes('already exists')) {
        dispatch({ type: 'SET_ERROR', error: 'A draft already exists for this video. Close and reopen to continue.' })
      } else {
        dispatch({ type: 'SET_ERROR', error: result.error ?? 'Failed to create draft' })
      }
    })
  }, [state.draftTestId, state.config, siteId, video.id, video.title])

  // --- Launch / save handler ---
  const handleSubmit = useCallback((isLaunch: boolean) => {
    dispatch({ type: 'SET_ERROR', error: null })
    dispatch({ type: 'SET_LAUNCHING', isLaunching: true })

    startTransition(async () => {
      let testId = state.draftTestId

      // 1. Create test if no draft exists
      if (!testId) {
        const result = await createAbTest({
          site_id: siteId,
          youtube_video_id: video.id,
          name: `Test: ${video.title}`,
          test_type: state.type!,
          config: wizardConfigToAbConfig(state.config),
        })
        if (!result.ok || !result.id) {
          dispatch({ type: 'SET_ERROR', error: result.error ?? 'Failed to create test' })
          dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
          return
        }
        testId = result.id
      }

      // 2. Upload image variants (thumbnail/combo)
      if (state.type === 'thumbnail' || state.type === 'combo') {
        for (const v of state.variants) {
          if (v.isOriginal || !v.thumbUrl) continue
          // Only upload if it's a blob URL (user-provided file)
          if (v.thumbUrl.startsWith('blob:')) {
            const blob = await fetch(v.thumbUrl).then(r => r.blob())
            const fd = new FormData()
            fd.append('file', blob, `variant-${v.label}.jpg`)
            const uploadResult = await uploadVariant(testId, fd)
            if (!uploadResult.ok) {
              dispatch({ type: 'SET_ERROR', error: uploadResult.error ?? 'Failed to upload variant' })
              dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
              return
            }
          }
        }
      }

      // 3. Create text variants (title/description/combo)
      if (state.type === 'title' || state.type === 'description' || state.type === 'combo') {
        const textVariants = state.variants
          .filter(v => !v.isOriginal && !v.isCoworkGenerated)
          .filter(v => {
            if (state.type === 'title') return v.titleText.trim().length > 0
            if (state.type === 'description') return v.descriptionText.trim().length > 0
            return v.titleText.trim().length > 0 || v.descriptionText.trim().length > 0
          })

        for (const tv of textVariants) {
          const textResult = await createTextVariant({
            test_id: testId,
            title_text: tv.titleText.trim() || undefined,
            description_text: tv.descriptionText.trim() || undefined,
          })
          if (!textResult.ok) {
            dispatch({ type: 'SET_ERROR', error: textResult.error ?? 'Failed to create text variant' })
            dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
            return
          }
        }
      }

      // 4. Optionally launch
      if (isLaunch) {
        const startResult = await startAbTest(testId)
        if (!startResult.ok) {
          dispatch({ type: 'SET_ERROR', error: startResult.error ?? 'Failed to start test' })
          dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
          return
        }
      }

      dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
      onCreated(testId)
    })
  }, [state.draftTestId, state.type, state.variants, state.config, siteId, video.id, video.title, onCreated])

  // --- Step navigation helpers ---
  const canAdvance = stepIsValid(state.step, state)
  const goBack = () => {
    const prev = state.step === 2 ? 0 : state.step - 1 // skip step 1 (ideias placeholder)
    dispatch({ type: 'SET_STEP', step: Math.max(0, prev) })
  }
  const goNext = () => {
    const next = state.step === 0 ? 2 : state.step + 1 // skip step 1 (ideias placeholder)
    dispatch({ type: 'SET_STEP', step: Math.min(4, next) })
  }

  // --- Render current step ---
  function renderStep() {
    switch (state.step) {
      case 0:
        return (
          <StepTipo
            selected={state.type}
            onSelect={handleTypeSelect}
          />
        )
      case 1:
        // Ideias placeholder — Cowork integration deferred
        return (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-cms-text-dim">AI brainstorming — coming soon</p>
          </div>
        )
      case 2:
        return (
          <StepVariantes
            type={state.type!}
            variants={state.variants}
            originalThumbUrl={state.originalThumbUrl}
            onUpdateVariant={(i, d) => dispatch({ type: 'UPDATE_VARIANT', index: i, data: d })}
            onAddVariant={() => dispatch({ type: 'ADD_VARIANT' })}
            onRemoveVariant={i => dispatch({ type: 'REMOVE_VARIANT', index: i })}
          />
        )
      case 3:
        return (
          <StepConfig
            config={state.config}
            onChange={(k, v) => dispatch({ type: 'UPDATE_CONFIG', key: k, value: v })}
          />
        )
      case 4:
        return (
          <StepRevisar
            type={state.type!}
            variants={state.variants.map(v => ({
              label: v.label,
              thumbUrl: v.thumbUrl,
              title: v.titleText || 'Untitled',
              isOriginal: v.isOriginal,
            }))}
            config={state.config}
            videoTitle={state.videoTitle}
          />
        )
      default:
        return <div className="py-12 text-center text-cms-text-dim">Step {state.step}</div>
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      style={{ backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Novo Teste A/B"
        className="bg-cms-surface border border-cms-border rounded-lg max-w-[720px] w-full max-h-[90vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cms-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-cms-text">Novo Teste A/B</h2>
            <p className="text-xs text-cms-text-dim truncate max-w-[400px]">{video.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-cms-text-muted hover:text-cms-text transition-colors p-1 -mr-1 rounded"
            aria-label="Fechar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Step rail */}
        <StepRail currentStep={state.step} onStepClick={s => dispatch({ type: 'SET_STEP', step: s })} />

        {/* Body */}
        <div key={state.step} className="flex-1 overflow-y-auto px-5 py-4" style={{ animation: 'fadeIn 150ms ease-out' }}>
          {isPending && state.step === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-cms-surface/80 rounded-lg z-10">
              <p className="text-xs text-cms-text-dim animate-pulse">Creating draft...</p>
            </div>
          )}
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-cms-border shrink-0">
          <div>
            {state.error && (
              <p role="alert" className="text-xs text-red-400 max-w-[300px]">{state.error}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {state.step > 0 && (
              <button
                onClick={goBack}
                disabled={isPending || state.isLaunching}
                className="border border-cms-border text-cms-text rounded-lg px-4 py-2 text-sm hover:bg-cms-surface-hover transition-colors disabled:opacity-40"
              >
                Back
              </button>
            )}
            {state.step > 0 && state.step < 4 && (
              <button
                onClick={goNext}
                disabled={!canAdvance || isPending}
                className="bg-cms-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            )}
            {state.step === 4 && (
              <>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isPending || state.isLaunching}
                  className="border border-cms-border text-cms-text rounded-lg px-4 py-2 text-sm hover:bg-cms-surface-hover transition-colors disabled:opacity-40"
                >
                  {isPending ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={isPending || state.isLaunching}
                  className="bg-cms-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  {isPending ? 'Launching...' : 'Launch Test'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step rail (sub-component)                                          */
/* ------------------------------------------------------------------ */

function StepRail({ currentStep, onStepClick }: { currentStep: number; onStepClick: (step: number) => void }) {
  return (
    <div className="flex items-center gap-0 px-5 py-4 border-b border-cms-border shrink-0">
      {VISIBLE_STEPS.map(({ label, stepIndex }, visualIdx) => {
        const isCompleted = currentStep > stepIndex
        const isActive = currentStep === stepIndex
        const isFuture = currentStep < stepIndex
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isFuture}
                onClick={() => !isFuture && onStepClick(stepIndex)}
                aria-label={`Step ${visualIdx + 1}: ${label}${isCompleted ? ' (complete)' : isActive ? ' (current)' : ''}`}
                className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors',
                  isCompleted
                    ? 'bg-green-600 text-white cursor-pointer hover:bg-green-500'
                    : isActive
                      ? 'bg-cms-accent text-white'
                      : 'bg-cms-surface-hover text-cms-text-muted cursor-default',
                ].join(' ')}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : visualIdx + 1}
              </button>
              <span className={`hidden sm:inline text-xs ${isActive ? 'text-cms-text font-medium' : 'text-cms-text-muted'}`}>
                {label}
              </span>
            </div>
            {visualIdx < VISIBLE_STEPS.length - 1 && (
              <div className={`h-px w-4 sm:w-8 mx-1.5 sm:mx-3 ${isCompleted ? 'bg-green-600' : 'bg-cms-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
