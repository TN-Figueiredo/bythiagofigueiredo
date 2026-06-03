'use client'

import { useState, useReducer, useEffect, useTransition, useCallback, useRef } from 'react'
import { Play, X, ArrowRight } from 'lucide-react'
import { StepTipo } from './step-tipo'
import { StepIdeias } from './step-ideias'
import { StepVariantes } from './step-variantes'
import type { VariantData } from './step-variantes'
import { StepConfig } from './step-config'
import { StepRevisar } from './step-revisar'
import { LibraryPickerDialog } from './library-picker-dialog'
import { initWizardConfig, wizardConfigToAbConfig } from '@/lib/youtube/ab-wizard-adapter'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import {
  createAbTest,
  uploadVariant,
  startAbTest,
  createTextVariant,
  updateAbTestType,
  cleanupDraftVariants,
  fetchAbBriefingData,
  fetchLibraryEntries,
} from '../actions'
import { buildAbBriefingPrompt } from '@/lib/youtube/prompt-builders-ab'
import type { TestType, DisplayLabel, AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { YtPortal } from '../../_components/yt-portal'

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

interface DraftVariant {
  label: string
  isOriginal: boolean
  thumbUrl: string | null
  titleText: string
  descriptionText: string
}

interface PrefillData {
  testType?: TestType
  suggestedDescription?: string
  fromOptimizationCycle?: string
  draftVariants?: DraftVariant[]
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
  | { type: 'SET_HYPOTHESIS'; text: string }

const NEXT_LABELS: DisplayLabel[] = ['B', 'C', 'D']

function draftStorageKey(videoId: string): string {
  return `ab-wizard-draft-${videoId}`
}

interface PersistedDraft {
  step: number
  type: TestType | null
  variants: Array<Omit<VariantData, 'thumbFile'> & { thumbFile?: null }>
  config: WizardConfig
  hypothesis: string
  savedAt: number
}

function saveDraft(videoId: string, state: WizardState): void {
  try {
    const draft: PersistedDraft = {
      step: state.step,
      type: state.type,
      variants: state.variants.map(v => ({
        ...v,
        thumbFile: null,
        thumbUrl: v.thumbDataUrl ?? (v.thumbUrl?.startsWith('blob:') ? null : v.thumbUrl),
      })),
      config: state.config,
      hypothesis: state.hypothesis,
      savedAt: Date.now(),
    }
    localStorage.setItem(draftStorageKey(videoId), JSON.stringify(draft))
  } catch { /* quota exceeded — ignore */ }
}

function loadDraft(videoId: string): PersistedDraft | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(videoId))
    if (!raw) return null
    const draft = JSON.parse(raw) as PersistedDraft
    if (Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(draftStorageKey(videoId))
      return null
    }
    return draft
  } catch { return null }
}

function clearDraft(videoId: string): void {
  try { localStorage.removeItem(draftStorageKey(videoId)) } catch { /* ignore */ }
}

function makeOriginalVariant(videoTitle: string, thumbUrl?: string | null): VariantData {
  return { label: 'A', isOriginal: true, thumbUrl: thumbUrl ?? null, titleText: videoTitle, descriptionText: '' }
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
          makeOriginalVariant(state.videoTitle, state.originalThumbUrl),
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
/*  Step rail config                                                   */
/* ------------------------------------------------------------------ */

const STEP_LABELS = ['Tipo', 'Ideias', 'Variantes', 'Config', 'Revisar'] as const

const VISIBLE_STEPS = STEP_LABELS
  .map((label, i) => ({ label, stepIndex: i }))

function stepIsValid(step: number, state: WizardState): boolean {
  switch (step) {
    case 0: return state.type !== null
    case 1: return true // always valid — step is optional
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
  const continuingDraft = Boolean(existingDraftId && prefill?.draftVariants && prefill.draftVariants.length > 1)

  // When continuing a DB draft, ignore stale localStorage
  if (continuingDraft) clearDraft(video.id)
  const saved = continuingDraft ? null : loadDraft(video.id)

  const defaultVariants = prefill?.testType
    ? [makeOriginalVariant(video.title, video.thumbnailUrl), makeEmptyVariant('B')]
    : [makeOriginalVariant(video.title, video.thumbnailUrl)]

  const dbVariants = prefill?.draftVariants?.map(v => ({
    label: v.label as DisplayLabel,
    isOriginal: v.isOriginal,
    thumbUrl: v.thumbUrl ?? (v.isOriginal ? video.thumbnailUrl : null),
    thumbFile: null as File | null,
    thumbDataUrl: null as string | null,
    titleText: v.titleText,
    descriptionText: v.descriptionText,
  })) as VariantData[] | undefined

  const restoredVariants = saved?.variants?.map(v => ({
    ...v,
    thumbUrl: v.thumbUrl ?? v.thumbDataUrl ?? (v.isOriginal ? video.thumbnailUrl : null),
    thumbFile: null,
  })) as VariantData[] | undefined

  const [state, rawDispatch] = useReducer(wizardReducer, {
    step: continuingDraft ? 4 : (saved?.step ?? (prefill?.testType || existingDraftId ? 2 : 0)),
    type: prefill?.testType ?? saved?.type ?? null,
    variants: continuingDraft ? (dbVariants ?? defaultVariants) : (restoredVariants ?? dbVariants ?? defaultVariants),
    config: saved?.config ?? initWizardConfig(settings),
    videoId: video.id,
    videoTitle: video.title,
    originalThumbUrl: video.thumbnailUrl,
    draftTestId: existingDraftId ?? null,
    isLaunching: false,
    error: null,
    hypothesis: saved?.hypothesis ?? '',
  })

  const draftCleared = useRef(false)
  const dispatch = useCallback((action: WizardAction) => { rawDispatch(action) }, [])

  useEffect(() => {
    if (!state.isLaunching && !draftCleared.current) saveDraft(video.id, state)
  }, [video.id, state])

  const [isPending, startTransition] = useTransition()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [libraryPickerFor, setLibraryPickerFor] = useState<number | null>(null)
  const [libraryEntries, setLibraryEntries] = useState<Awaited<ReturnType<typeof fetchLibraryEntries>> | null>(null)

  // --- Escape key ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !state.isLaunching) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, state.isLaunching])

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
        dispatch({ type: 'SET_STEP', step: 1 })
        return
      }

      const result = await createAbTest({
        site_id: siteId,
        youtube_video_id: video.id,
        name: video.title,
        test_type: testType,
        config: wizardConfigToAbConfig(state.config),
      })

      if (result.ok && result.id) {
        dispatch({ type: 'SET_DRAFT_ID', id: result.id })
        dispatch({ type: 'SET_STEP', step: 1 })
      } else if (result.error?.includes('already exists')) {
        dispatch({ type: 'SET_ERROR', error: 'A draft already exists for this video. Close and reopen to continue.' })
      } else {
        dispatch({ type: 'SET_ERROR', error: result.error ?? 'Failed to create draft' })
      }
    })
  }, [state.draftTestId, state.config, siteId, video.id, video.title])

  // --- Cowork briefing handler ---
  const handleCoworkClick = useCallback(async () => {
    if (!state.type) throw new Error('Selecione o tipo de teste antes de usar o Cowork')
    const result = await fetchAbBriefingData(video.id, state.draftTestId ?? '')
    if (!result.ok) throw new Error(result.error)
    const prompt = buildAbBriefingPrompt({
      testType: state.type,
      data: result.data,
      focus: state.hypothesis.trim() || undefined,
    })
    await navigator.clipboard.writeText(prompt)
  }, [video.id, state.type, state.draftTestId, state.hypothesis])

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
          name: video.title,
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

      dispatch({ type: 'SET_DRAFT_ID', id: testId })

      // 2. Upload image variants (thumbnail/combo)
      if (state.type === 'thumbnail' || state.type === 'combo') {
        const variantsWithNewData = state.variants.filter(v =>
          !v.isOriginal && (v.thumbFile || v.thumbUrl?.startsWith('data:')),
        )

        if (variantsWithNewData.length > 0) {
          const cleanupRes = await cleanupDraftVariants(testId)
          if (!cleanupRes.ok) {
            dispatch({ type: 'SET_ERROR', error: cleanupRes.error ?? 'Failed to clean up draft' })
            dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
            return
          }

          for (const v of variantsWithNewData) {
            let file: File | Blob | null = v.thumbFile ?? null
            if (!file && v.thumbUrl?.startsWith('data:')) {
              const [header, b64] = v.thumbUrl.split(',')
              const mime = header?.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
              const bytes = atob(b64 ?? '')
              const arr = new Uint8Array(bytes.length)
              for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
              file = new Blob([arr], { type: mime })
            }
            if (!file) continue
            const fd = new FormData()
            fd.append('file', file, `variant-${v.label}.jpg`)
            if (v.titleText?.trim()) fd.append('title_text', v.titleText.trim())
            if (v.descriptionText?.trim()) fd.append('description_text', v.descriptionText.trim())
            const uploadResult = await uploadVariant(testId, fd)
            if (!uploadResult.ok) {
              dispatch({ type: 'SET_ERROR', error: uploadResult.error ?? 'Failed to upload variant' })
              dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
              return
            }
          }
        }
      }

      // 4. Create text-only variants (title/description — NOT combo, which was handled in step 3)
      if (state.type === 'title' || state.type === 'description') {
        const textVariants = state.variants
          .filter(v => !v.isOriginal && !v.isCoworkGenerated)
          .filter(v => {
            if (state.type === 'title') return v.titleText.trim().length > 0
            return v.descriptionText.trim().length > 0
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

      draftCleared.current = true
      clearDraft(video.id)
      if (isLaunch) {
        // Keep isLaunching=true so the wizard stays in "Ativando..." state
        // until navigation completes — avoids flashing back to the dashboard.
        onCreated(testId)
      } else {
        dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
        onClose()
      }
    })
  }, [state.draftTestId, state.type, state.variants, state.config, siteId, video.id, video.title, onCreated, onClose])

  // --- Step navigation helpers ---
  const canAdvance = stepIsValid(state.step, state)
  const goBack = () => {
    dispatch({ type: 'SET_STEP', step: Math.max(0, state.step - 1) })
  }
  const goNext = () => {
    dispatch({ type: 'SET_STEP', step: Math.min(4, state.step + 1) })
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
        return (
          <StepIdeias
            hypothesis={state.hypothesis}
            onHypothesisChange={text => dispatch({ type: 'SET_HYPOTHESIS', text })}
            onCoworkClick={handleCoworkClick}
          />
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
            onPickFromLibrary={async (variantIndex) => {
              if (!libraryEntries) {
                const entries = await fetchLibraryEntries()
                setLibraryEntries(entries)
              }
              setLibraryPickerFor(variantIndex)
            }}
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
    <YtPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      style={{ backdropFilter: 'blur(6px)' }}
      onClick={state.isLaunching ? undefined : onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Novo Teste A/B"
        className="flex flex-col mx-4 animate-ab-fade-up"
        style={{
          width: 'min(900px, 100%)',
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--cms-surface)',
          border: '1px solid var(--cms-border, #332D25)',
          borderRadius: 18,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-[16px] py-[20px] px-[24px] shrink-0" style={{ borderBottom: '1px solid var(--cms-border, #332D25)' }}>
          <div>
            <h2 className="text-[18px] font-bold text-cms-text m-0">Novo teste A/B</h2>
            <div className="text-[12.5px] text-cms-text-dim mt-[3px] max-w-[580px] whitespace-nowrap overflow-hidden text-ellipsis">{video.title}</div>
          </div>
          <button onClick={onClose} disabled={state.isLaunching} className="text-cms-text-dim p-[4px] shrink-0 disabled:opacity-40" style={{ background: 'transparent', border: 'none' }} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Step rail */}
        <StepRail currentStep={state.step} onStepClick={s => dispatch({ type: 'SET_STEP', step: s })} />

        {/* Body */}
        <div key={state.step} className="flex-1 overflow-y-auto p-[24px]" style={{ animation: 'fadeIn 150ms ease-out' }}>
          {isPending && state.step === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-cms-surface/80 rounded-lg z-10">
              <p className="text-xs text-cms-text-dim animate-pulse">Criando rascunho...</p>
            </div>
          )}
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between py-[16px] px-[24px] shrink-0" style={{ borderTop: '1px solid var(--cms-border, #332D25)', background: 'var(--cms-bg-side)' }}>
          <span className="text-[11.5px] text-cms-text-dim">
            {state.error ? (
              <span className="text-red-400">{state.error}</span>
            ) : state.step === 1 ? (
              'A IA é opcional — pode pular'
            ) : (
              `Passo ${state.step + 1} de 5`
            )}
          </span>
          <div className="flex items-center gap-[10px]">
            {state.step === 0 ? (
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim"
                style={{ border: '1px solid var(--cms-border, #332D25)' }}
              >
                Cancelar
              </button>
            ) : (
              <button
                onClick={goBack}
                disabled={isPending || state.isLaunching}
                className="inline-flex items-center justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim disabled:opacity-40"
                style={{ border: '1px solid var(--cms-border, #332D25)' }}
              >
                Voltar
              </button>
            )}
            {state.step === 1 && (
              <button
                onClick={goNext}
                className="inline-flex items-center gap-[7px] justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] bg-cms-accent"
                style={{ border: '1px solid var(--cms-accent)', color: 'rgb(26,18,12)' }}
              >
                Pular
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            {state.step !== 1 && state.step < 4 && (
              <button
                onClick={goNext}
                disabled={!canAdvance || isPending}
                className="inline-flex items-center gap-[7px] justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] bg-cms-accent disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ border: '1px solid var(--cms-accent)', color: 'rgb(26,18,12)' }}
              >
                Próximo
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            {state.step === 4 && (
              <>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isPending || state.isLaunching}
                  className="inline-flex items-center justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim disabled:opacity-40"
                  style={{ border: '1px solid var(--cms-border, #332D25)' }}
                >
                  {isPending ? 'Salvando...' : 'Salvar rascunho'}
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={isPending || state.isLaunching}
                  className="inline-flex items-center gap-[7px] justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] bg-cms-accent disabled:opacity-40"
                  style={{ border: '1px solid var(--cms-accent)', color: 'rgb(26,18,12)' }}
                >
                  <Play size={14} aria-hidden="true" />
                  {isPending ? 'Ativando...' : 'Ativar teste'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {libraryPickerFor !== null && libraryEntries && (
        <LibraryPickerDialog
          entries={libraryEntries}
          onSelect={(blobUrl, liftAtWin) => {
            dispatch({
              type: 'UPDATE_VARIANT',
              index: libraryPickerFor,
              data: { thumbUrl: blobUrl, briefing: liftAtWin ? `Da Biblioteca: +${liftAtWin}% lift` : undefined },
            })
            setLibraryPickerFor(null)
          }}
          onClose={() => setLibraryPickerFor(null)}
        />
      )}
    </div>
    </YtPortal>
  )
}

/* ------------------------------------------------------------------ */
/*  Step rail (sub-component)                                          */
/* ------------------------------------------------------------------ */

function StepRail({ currentStep, onStepClick }: { currentStep: number; onStepClick: (step: number) => void }) {
  return (
    <div className="flex items-center py-[16px] px-[24px] shrink-0" style={{ borderBottom: '1px solid var(--cms-border, #332D25)' }}>
      {VISIBLE_STEPS.map(({ label, stepIndex }, visualIdx) => {
        const isCompleted = currentStep > stepIndex
        const isActive = currentStep === stepIndex
        const isFuture = currentStep < stepIndex
        return (
          <div key={label} className="contents">
            <div
              className="flex items-center gap-[9px]"
              style={{ cursor: isFuture ? 'default' : 'pointer' }}
              onClick={() => !isFuture && onStepClick(stepIndex)}
              {...(!isFuture ? { role: 'button' as const, tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStepClick(stepIndex) } } } : {})}
            >
              <span
                className="flex items-center justify-center rounded-full font-mono text-[12px] font-bold shrink-0"
                style={{
                  width: 26, height: 26,
                  background: isActive ? 'var(--cms-accent)' : isCompleted ? 'var(--cms-green)' : 'var(--cms-surface-3, var(--cms-surface-hover))',
                  color: isActive || isCompleted ? 'rgb(21,18,13)' : 'var(--cms-text-dim)',
                }}
              >
                {isCompleted ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                ) : visualIdx + 1}
              </span>
              <span className="text-[13px]" style={{ fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--cms-text)' : 'var(--cms-text-dim)' }}>
                {label}
              </span>
            </div>
            {visualIdx < VISIBLE_STEPS.length - 1 && (
              <div className="flex-1 h-px mx-[12px]" style={{ background: 'var(--cms-border, #332D25)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
