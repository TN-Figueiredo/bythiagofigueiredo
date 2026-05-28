'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import NextImage from 'next/image'
import { Image, Type, FileText, Layers, Lightbulb, ChevronUp, ChevronDown } from 'lucide-react'
import { StepIdeias } from './step-ideias'
import { createAbTest, uploadVariant, startAbTest, pullPipelineThumbnails, createTextVariant, updateAbTestType } from '../actions'
import { VARIANT_LABELS } from '@/lib/youtube/ab-types'
import type { TestType } from '@/lib/youtube/ab-types'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'

interface WizardVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  sourcePipelineId?: string | null
}

interface Config {
  max_duration_days: number
  confidence_threshold: number
  auto_apply_winner: boolean
  burn_in_days: number
}

interface PrefillData {
  testType?: TestType
  suggestedDescription?: string
  fromOptimizationCycle?: string
}

interface Props {
  video: WizardVideo
  siteId: string
  onClose: () => void
  onCreated: (testId: string) => void
  prefill?: PrefillData
  existingDraftId?: string
}

const DURATION_OPTIONS = [7, 14, 21, 28] as const
const MAX_FILE_SIZE = 2 * 1024 * 1024

interface SlotFile {
  file: File
  previewUrl: string
}

interface TextVariant {
  title: string
  description: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STEP_LABELS = ['Tipo', 'Ideias', 'Variantes', 'Config', 'Revisar'] as const

const TYPE_OPTIONS: Array<{
  type: TestType
  label: string
  description: string
  icon: typeof Image
  badge?: string
}> = [
  { type: 'thumbnail', label: 'Thumbnail', description: 'Testar diferentes miniaturas', icon: Image },
  { type: 'title', label: 'Título', description: 'Testar variações de título', icon: Type },
  { type: 'description', label: 'Descrição', description: 'Testar descrições + links rastreados', icon: FileText },
  { type: 'combo', label: 'Combo', description: 'Thumb + título + descrição como pacote', icon: Layers, badge: 'COMBO' },
]

export function AbCreateWizard({ video, siteId, onClose, onCreated, prefill, existingDraftId }: Props) {
  const [step, setStep] = useState(prefill?.testType || existingDraftId ? 2 : 1)
  const [testType, setTestType] = useState<TestType>(prefill?.testType ?? 'thumbnail')
  const [slots, setSlots] = useState<(SlotFile | null)[]>([null, null, null])
  const [slotError, setSlotError] = useState<string | null>(null)
  const [textVariants, setTextVariants] = useState<TextVariant[]>([
    { title: '', description: '' },
    { title: '', description: '' },
    { title: '', description: '' },
  ])
  const [config, setConfig] = useState<Config>({
    max_duration_days: 14,
    confidence_threshold: 0.95,
    auto_apply_winner: true,
    burn_in_days: 2,
  })
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isPipelinePending, startPipelineTransition] = useTransition()
  const [isTypeSelectPending, startTypeSelectTransition] = useTransition()

  const [ideiasFocus, setIdeiasFocus] = useState('')
  const [slotNotes, setSlotNotes] = useState<[string, string, string]>(['', '', ''])
  const [briefingCopied, setBriefingCopied] = useState(false)
  const [briefingData, setBriefingData] = useState<AbBriefingData | null>(null)
  const [draftTestId, setDraftTestId] = useState<string | null>(existingDraftId ?? null)
  const [coworkVariantLabels, setCoworkVariantLabels] = useState<Set<string>>(new Set())

  const storageKey = `ab-brainstorm-${video.id}`
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastNotifiedLabelsRef = useRef('')

  const handleBriefingDataChange = useCallback((data: AbBriefingData | null) => {
    setBriefingData(data)
  }, [])

  const handleVariantsReceived = useCallback((variants: Array<{
    label: string
    title_text: string | null
    description_text: string | null
    metadata: Record<string, unknown> | null
  }>) => {
    const labelToIndex = Object.fromEntries(VARIANT_LABELS.map((l, i) => [l, i])) as Record<string, number>
    const labels = new Set(variants.map(v => v.label).filter(l => l in labelToIndex))
    setTextVariants(prev => {
      const next = [...prev]
      for (const v of variants) {
        const idx = labelToIndex[v.label]
        if (idx !== undefined) {
          next[idx] = {
            title: v.title_text ?? '',
            description: v.description_text ?? '',
          }
        }
      }
      return next
    })
    setCoworkVariantLabels(prev => {
      if (prev.size === labels.size && [...labels].every(l => prev.has(l))) return prev
      return labels
    })
  }, [])

  const handleBriefingCopied = useCallback(() => setBriefingCopied(true), [])

  const handleSlotNoteChange = useCallback((index: number, value: string) => {
    setSlotNotes(prev => {
      const next = [...prev] as [string, string, string]
      next[index] = value
      return next
    })
  }, [])

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as { focus?: string; slotNotes?: [string, string, string] }
        if (parsed.focus) setIdeiasFocus(parsed.focus)
        if (parsed.slotNotes) setSlotNotes(parsed.slotNotes)
      }
    } catch { /* ignore corrupt data */ }
  }, [storageKey])

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ focus: ideiasFocus, slotNotes }))
      } catch { /* storage full — ignore */ }
    }, 500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [ideiasFocus, slotNotes, storageKey])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const slotsRef = useRef(slots)
  slotsRef.current = slots

  useEffect(() => {
    return () => {
      for (const slot of slotsRef.current) {
        if (slot) URL.revokeObjectURL(slot.previewUrl)
      }
    }
  }, [])

  const variants = slots.filter((s): s is SlotFile => s !== null)
  const hasImageVariant = variants.length > 0
  const hasTextVariant = textVariants.some(tv => tv.title.trim() || tv.description.trim())

  const hasVariantForType = (() => {
    switch (testType) {
      case 'thumbnail': return hasImageVariant
      case 'title': return textVariants.some(tv => tv.title.trim().length > 0)
      case 'description': return textVariants.some(tv => tv.description.trim().length > 0)
      case 'combo': return hasImageVariant || hasTextVariant
    }
  })()

  function handleFileChange(slotIndex: number, file: File | null) {
    setSlotError(null)
    if (!file) {
      setSlots(prev => {
        const next = [...prev]
        if (next[slotIndex]) URL.revokeObjectURL(next[slotIndex]!.previewUrl)
        next[slotIndex] = null
        return next
      })
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setSlotError('Arquivo deve ser JPEG, PNG ou WebP')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setSlotError('Arquivo deve ter no máximo 2 MB')
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setSlots(prev => {
      const next = [...prev]
      if (next[slotIndex]) URL.revokeObjectURL(next[slotIndex]!.previewUrl)
      next[slotIndex] = { file, previewUrl }
      return next
    })
  }

  function handlePipelinePull() {
    if (!video.sourcePipelineId) return
    startPipelineTransition(async () => {
      let testId = draftTestId

      if (!testId) {
        const result = await createAbTest({
          site_id: siteId,
          youtube_video_id: video.id,
          name: `Test: ${video.title}`,
          test_type: testType,
          config,
        })
        if (!result.ok || !result.id) {
          setSlotError(result.error ?? 'Falha ao criar teste para pull do pipeline')
          return
        }
        testId = result.id
      }

      const pullResult = await pullPipelineThumbnails(testId, video.sourcePipelineId!)
      if (!pullResult.ok) {
        setSlotError(pullResult.error ?? 'Falha ao puxar thumbnails do pipeline')
      } else {
        onCreated(testId)
      }
    })
  }

  function handleSubmit(isLaunch: boolean) {
    setSubmitError(null)
    startTransition(async () => {
      let testId = draftTestId

      if (!testId) {
        const result = await createAbTest({
          site_id: siteId,
          youtube_video_id: video.id,
          name: `Test: ${video.title}`,
          test_type: testType,
          config,
        })
        if (!result.ok || !result.id) {
          setSubmitError(result.error ?? 'Falha ao criar teste')
          return
        }
        testId = result.id
      }

      // Upload image variants (for thumbnail and combo types)
      // Skip if Cowork already populated all variant slots
      if ((testType === 'thumbnail' || testType === 'combo') && coworkVariantLabels.size === 0) {
        for (const slot of variants) {
          const fd = new FormData()
          fd.append('file', slot.file)
          const uploadResult = await uploadVariant(testId, fd)
          if (!uploadResult.ok) {
            setSubmitError(uploadResult.error ?? 'Falha ao enviar variante')
            return
          }
        }
      }

      // Create text variants (for title, description, and combo types)
      // Skip variants already created by Cowork via API
      if (testType === 'title' || testType === 'description' || testType === 'combo') {
        const textSlotsToSave = textVariants
          .map((tv, i) => ({ ...tv, label: VARIANT_LABELS[i] ?? '' }))
          .filter(tv => {
            if (coworkVariantLabels.has(tv.label)) return false
            if (testType === 'title') return tv.title.trim().length > 0
            if (testType === 'description') return tv.description.trim().length > 0
            return tv.title.trim().length > 0 || tv.description.trim().length > 0
          })

        for (const tv of textSlotsToSave) {
          const textResult = await createTextVariant({
            test_id: testId,
            title_text: tv.title.trim() || undefined,
            description_text: tv.description.trim() || undefined,
          })
          if (!textResult.ok) {
            setSubmitError(textResult.error ?? 'Falha ao criar variante de texto')
            return
          }
        }
      }

      if (isLaunch) {
        const startResult = await startAbTest(testId)
        if (!startResult.ok) {
          setSubmitError(startResult.error ?? 'Falha ao iniciar teste')
          return
        }
      }
      try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
      onCreated(testId)
    })
  }

  function handleTypeSelect(type: TestType) {
    setTestType(type)

    startTypeSelectTransition(async () => {
      if (draftTestId) {
        const res = await updateAbTestType(draftTestId, type)
        if (!res.ok) {
          setSubmitError(res.error ?? 'Falha ao atualizar tipo do teste')
          return
        }
        setStep(2)
        return
      }

      setSubmitError(null)

      const result = await createAbTest({
        site_id: siteId,
        youtube_video_id: video.id,
        name: `Test: ${video.title}`,
        test_type: type,
        config,
      })

      if (result.ok && result.id) {
        setDraftTestId(result.id)
        setStep(2)
      } else if (result.error?.includes('already exists')) {
        setSubmitError('Já existe um rascunho para este vídeo. Feche e reabra para continuar.')
      } else {
        setSubmitError(result.error ?? 'Falha ao criar rascunho')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Novo Teste A/B"
        className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] max-w-[640px] w-full max-h-[90vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cms-border shrink-0">
          <div>
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

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-5 py-4 border-b border-cms-border shrink-0">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1
            const isCompleted = step > stepNum
            const isActive = step === stepNum
            return (
              <div key={label} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div
                    aria-label={`Passo ${stepNum}: ${label}${isCompleted ? ' (concluído)' : isActive ? ' (atual)' : ''}`}
                    className={[
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors',
                      isCompleted
                        ? 'bg-green-600 text-white'
                        : isActive
                          ? 'bg-cms-accent text-white'
                          : 'bg-cms-surface-hover text-cms-text-muted',
                      stepNum === 2 && briefingCopied && !isCompleted && !isActive
                        ? 'ring-2 ring-green-500/50'
                        : '',
                    ].join(' ')}
                  >
                    {isCompleted ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : stepNum}
                  </div>
                  <span className={`hidden sm:inline text-xs ${isActive ? 'text-cms-text font-medium' : 'text-cms-text-muted'}`}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`h-px w-4 sm:w-8 mx-1.5 sm:mx-3 ${step > stepNum ? 'bg-green-600' : 'bg-cms-border'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div key={step} className="flex-1 overflow-y-auto px-5 py-4" style={{ animation: 'fadeIn 150ms ease-out' }}>
          {step === 1 && (
            <div className="relative">
              <Step0TypeSelect onSelect={handleTypeSelect} />
              {isTypeSelectPending && (
                <div className="absolute inset-0 flex items-center justify-center bg-cms-surface/80 rounded-[var(--cms-radius)]">
                  <p className="text-xs text-cms-text-dim animate-pulse">Criando rascunho…</p>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <StepIdeias
              testType={testType}
              video={video}
              focus={ideiasFocus}
              onFocusChange={setIdeiasFocus}
              slotNotes={slotNotes}
              onSlotNoteChange={handleSlotNoteChange}
              briefingCopied={briefingCopied}
              onBriefingCopied={handleBriefingCopied}
              briefingData={briefingData}
              onBriefingDataChange={handleBriefingDataChange}
              draftTestId={draftTestId}
              onVariantsReceived={handleVariantsReceived}
              lastNotifiedLabelsRef={lastNotifiedLabelsRef}
            />
          )}
          {step === 3 && (
            <Step1Variants
              testType={testType}
              video={video}
              slots={slots}
              slotError={slotError}
              textVariants={textVariants}
              onFileChange={handleFileChange}
              onTextChange={(i, field, value) => {
                setTextVariants(prev => {
                  const next = [...prev]
                  const current = next[i] ?? { title: '', description: '' }
                  next[i] = { ...current, [field]: value }
                  return next
                })
              }}
              onPipelinePull={handlePipelinePull}
              isPipelinePending={isPipelinePending}
              slotNotes={slotNotes}
            />
          )}
          {step === 4 && (
            <Step2Configure config={config} onChange={setConfig} />
          )}
          {step === 5 && (
            <Step3Review
              video={video}
              testType={testType}
              slots={slots}
              textVariants={textVariants}
              config={config}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-cms-border shrink-0">
          <div>
            {step === 2 && (
              <span className="text-[10px] text-cms-text-dim">Pode pular se já sabe o que testar</span>
            )}
            {submitError && (
              <p role="alert" className="text-xs text-red-400">{submitError}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={isPending}
                className="border border-cms-border text-cms-text rounded-[var(--cms-radius)] px-4 py-2 text-sm hover:bg-cms-surface-hover transition-colors disabled:opacity-40"
              >
                Voltar
              </button>
            )}
            {step >= 2 && step < 5 && (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 3 && !hasVariantForType}
                className="bg-cms-accent text-white rounded-[var(--cms-radius)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próximo
              </button>
            )}
            {step === 5 && (
              <>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isPending}
                  className="border border-cms-border text-cms-text rounded-[var(--cms-radius)] px-4 py-2 text-sm hover:bg-cms-surface-hover transition-colors disabled:opacity-40"
                >
                  {isPending ? 'Salvando…' : 'Salvar Rascunho'}
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={isPending}
                  className="bg-cms-accent text-white rounded-[var(--cms-radius)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {isPending ? 'Lançando…' : 'Lançar Teste'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 0 — Type Selection
// ---------------------------------------------------------------------------

function Step0TypeSelect({ onSelect }: { onSelect: (type: TestType) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-cms-text-muted">
        Escolha o tipo de teste A/B que deseja criar.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {TYPE_OPTIONS.map(opt => {
          const Icon = opt.icon
          return (
            <button
              key={opt.type}
              onClick={() => onSelect(opt.type)}
              className="relative rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4 flex flex-col items-center gap-2 hover:border-cms-accent hover:bg-cms-surface-hover transition-colors text-center group"
            >
              {opt.badge && (
                <span className="absolute top-2 right-2 text-[9px] font-bold tracking-wide bg-cms-accent text-white px-1.5 py-0.5 rounded">
                  {opt.badge}
                </span>
              )}
              <Icon className="w-6 h-6 text-cms-text-muted group-hover:text-cms-accent transition-colors" />
              <span className="text-xs font-semibold text-cms-text">{opt.label}</span>
              <span className="text-[10px] text-cms-text-dim leading-tight">{opt.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Variants (contextual based on testType)
// ---------------------------------------------------------------------------

interface Step1Props {
  testType: TestType
  video: WizardVideo
  slots: (SlotFile | null)[]
  slotError: string | null
  textVariants: TextVariant[]
  onFileChange: (index: number, file: File | null) => void
  onTextChange: (index: number, field: 'title' | 'description', value: string) => void
  onPipelinePull: () => void
  isPipelinePending: boolean
  slotNotes: [string, string, string]
}

function Step1Variants({ testType, video, slots, slotError, textVariants, onFileChange, onTextChange, onPipelinePull, isPipelinePending, slotNotes }: Step1Props) {
  return (
    <div className="space-y-4">
      {/* Brainstorm reference panel */}
      {slotNotes.some(n => n.trim()) && (
        <BrainstormReferencePanel slotNotes={slotNotes} />
      )}

      {/* Thumbnail upload section — shown for thumbnail and combo */}
      {(testType === 'thumbnail' || testType === 'combo') && (
        <ThumbnailUploadSection
          video={video}
          slots={slots}
          slotError={slotError}
          onFileChange={onFileChange}
          onPipelinePull={onPipelinePull}
          isPipelinePending={isPipelinePending}
          slotNotes={slotNotes}
        />
      )}

      {/* Title editor — shown for title and combo */}
      {(testType === 'title' || testType === 'combo') && (
        <TitleEditorSection
          textVariants={textVariants}
          onTextChange={onTextChange}
          slotNotes={slotNotes}
        />
      )}

      {/* Description editor — shown for description and combo */}
      {(testType === 'description' || testType === 'combo') && (
        <DescriptionEditorSection
          textVariants={textVariants}
          onTextChange={onTextChange}
          slotNotes={slotNotes}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Brainstorm Reference Panel
// ---------------------------------------------------------------------------

function BrainstormReferencePanel({ slotNotes }: { slotNotes: [string, string, string] }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="rounded-[var(--cms-radius)] border border-indigo-500/20 bg-indigo-500/5 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-xs font-medium text-indigo-300 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" />
          Suas ideias do brainstorm
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {VARIANT_LABELS.map((label, i) => (
            <div key={label} className="flex items-start gap-2">
              <span className="text-[10px] font-semibold text-indigo-400 mt-0.5 w-3 shrink-0">{label}:</span>
              <span className="text-[10px] text-cms-text-dim leading-relaxed">
                {(slotNotes[i] ?? '').trim() || '(sem anotação)'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thumbnail Upload Section
// ---------------------------------------------------------------------------

function ThumbnailUploadSection({
  video, slots, slotError, onFileChange, onPipelinePull, isPipelinePending, slotNotes,
}: {
  video: WizardVideo
  slots: (SlotFile | null)[]
  slotError: string | null
  onFileChange: (index: number, file: File | null) => void
  onPipelinePull: () => void
  isPipelinePending: boolean
  slotNotes?: [string, string, string]
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-cms-text-muted">
        Upload de até 3 variantes de thumbnail. Slot A é travado com a thumbnail atual.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* Slot A — locked original */}
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cms-text">A — Original</span>
            <span className="text-[10px] rounded px-1.5 py-0.5 bg-cms-surface text-cms-text-muted">Travado</span>
          </div>
          <div className="w-full aspect-video rounded overflow-hidden bg-cms-surface flex items-center justify-center">
            {video.thumbnailUrl ? (
              <NextImage
                src={video.thumbnailUrl}
                alt="Original thumbnail"
                width={240}
                height={135}
                className="object-cover w-full h-full"
              />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-dim" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            )}
          </div>
        </div>

        {/* Slots B, C, D */}
        {[0, 1, 2].map(i => (
          <div key={i} className="space-y-1">
            {slotNotes?.[i]?.trim() && (
              <p className="text-[10px] text-indigo-300 flex items-start gap-1">
                <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                {slotNotes[i]}
              </p>
            )}
            <VariantSlot
              label={String.fromCharCode(66 + i)}
              slot={slots[i] ?? null}
              onChange={file => onFileChange(i, file)}
            />
          </div>
        ))}
      </div>

      {slotError && (
        <p role="alert" className="text-xs text-red-400">{slotError}</p>
      )}

      {video.sourcePipelineId && (
        <button
          onClick={onPipelinePull}
          disabled={isPipelinePending}
          className="flex items-center gap-1.5 text-xs text-cms-accent hover:underline disabled:opacity-40 transition-opacity"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
          {isPipelinePending ? 'Puxando do Pipeline…' : 'Do Pipeline'}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Title Editor Section
// ---------------------------------------------------------------------------

function TitleEditorSection({
  textVariants,
  onTextChange,
  slotNotes,
}: {
  textVariants: TextVariant[]
  onTextChange: (index: number, field: 'title' | 'description', value: string) => void
  slotNotes?: [string, string, string]
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-cms-text">Variações de Título</h3>
        <p className="text-[10px] text-cms-text-dim mt-0.5">Até 3 variações. Máx. 100 caracteres.</p>
      </div>

      {/* Original (locked) */}
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-cms-text">A — Original</span>
          <span className="text-[10px] rounded px-1.5 py-0.5 bg-cms-surface text-cms-text-muted">Travado</span>
        </div>
        <p className="text-xs text-cms-text-dim italic truncate">Título atual do vídeo (capturado ao criar)</p>
      </div>

      {/* Editable slots */}
      {[0, 1, 2].map(i => {
        const value = textVariants[i]?.title ?? ''
        const charCount = value.length
        const isOverLimit = charCount > 100
        return (
          <div key={i} className="rounded-[var(--cms-radius)] border border-dashed border-cms-border bg-cms-surface p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cms-text">{String.fromCharCode(66 + i)}</span>
              <span className={`text-[10px] ${isOverLimit ? 'text-red-400 font-semibold' : 'text-cms-text-dim'}`}>
                {charCount}/100
              </span>
            </div>
            {slotNotes?.[i]?.trim() && (
              <p className="text-[10px] text-indigo-300 flex items-start gap-1">
                <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                {slotNotes[i]}
              </p>
            )}
            <input
              type="text"
              value={value}
              onChange={e => onTextChange(i, 'title', e.target.value)}
              maxLength={100}
              placeholder="Digite variação de título..."
              className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
            />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Description Editor Section
// ---------------------------------------------------------------------------

function DescriptionEditorSection({
  textVariants,
  onTextChange,
  slotNotes,
}: {
  textVariants: TextVariant[]
  onTextChange: (index: number, field: 'title' | 'description', value: string) => void
  slotNotes?: [string, string, string]
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-cms-text">Variações de Descrição</h3>
        <p className="text-[10px] text-cms-text-dim mt-0.5">
          Use <code className="bg-cms-surface-hover px-1 rounded text-cms-accent">{'{{link:nome}}'}</code> para inserir links rastreados automaticamente.
        </p>
      </div>

      {/* Original (locked) */}
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-cms-text">A — Original</span>
          <span className="text-[10px] rounded px-1.5 py-0.5 bg-cms-surface text-cms-text-muted">Travado</span>
        </div>
        <p className="text-xs text-cms-text-dim italic">Descrição atual do vídeo (capturada ao criar)</p>
      </div>

      {/* Editable slots */}
      {[0, 1, 2].map(i => {
        const value = textVariants[i]?.description ?? ''
        return (
          <div key={i} className="rounded-[var(--cms-radius)] border border-dashed border-cms-border bg-cms-surface p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cms-text">{String.fromCharCode(66 + i)}</span>
            </div>
            {slotNotes?.[i]?.trim() && (
              <p className="text-[10px] text-indigo-300 flex items-start gap-1">
                <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                {slotNotes[i]}
              </p>
            )}
            <textarea
              value={value}
              onChange={e => onTextChange(i, 'description', e.target.value)}
              rows={4}
              placeholder="Digite variação de descrição..."
              className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent resize-none"
            />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Variant Slot (thumbnail image)
// ---------------------------------------------------------------------------

interface VariantSlotProps {
  label: string
  slot: SlotFile | null
  onChange: (file: File | null) => void
}

function VariantSlot({ label, slot, onChange }: VariantSlotProps) {
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    onChange(file)
    e.target.value = ''
  }

  return (
    <div className="rounded-[var(--cms-radius)] border border-dashed border-cms-border bg-cms-surface p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-cms-text">{label}</span>
        {slot && (
          <button
            onClick={() => onChange(null)}
            className="text-cms-text-dim hover:text-red-400 transition-colors"
            aria-label="Remover variante"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {slot ? (
        <div className="space-y-1.5">
          <div className="w-full aspect-video rounded overflow-hidden bg-cms-surface-hover">
            <NextImage
              src={slot.previewUrl}
              alt="Variant thumbnail"
              width={240}
              height={135}
              className="object-cover w-full h-full"
            />
          </div>
          <p className="text-[10px] text-cms-text-dim truncate">{slot.file.name} · {formatBytes(slot.file.size)}</p>
        </div>
      ) : (
        <label className="flex-1 flex flex-col items-center justify-center cursor-pointer aspect-video rounded border border-dashed border-cms-border hover:border-cms-accent hover:bg-cms-surface-hover transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-dim mb-1" aria-hidden="true">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
          <span className="text-[10px] text-cms-text-dim">Click to browse</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            className="sr-only"
          />
        </label>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Configure
// ---------------------------------------------------------------------------

interface Step2Props {
  config: Config
  onChange: (config: Config) => void
}

function Step2Configure({ config, onChange }: Step2Props) {
  function update<K extends keyof Config>(key: K, value: Config[K]) {
    onChange({ ...config, [key]: value })
  }

  const thresholdPercent = Math.round(config.confidence_threshold * 100)

  return (
    <div className="space-y-5">
      {/* Duration */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-cms-text">Max Duration</label>
        <select
          value={config.max_duration_days}
          onChange={e => update('max_duration_days', Number(e.target.value))}
          className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text focus:outline-none focus:ring-2 focus:ring-cms-accent"
        >
          {DURATION_OPTIONS.map(d => (
            <option key={d} value={d}>{d} days</option>
          ))}
        </select>
      </div>

      {/* Confidence threshold */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-cms-text">Confidence Threshold</label>
          <span className="text-xs text-cms-accent font-semibold">{thresholdPercent}%</span>
        </div>
        <input
          type="range"
          min={80}
          max={99}
          step={1}
          value={thresholdPercent}
          onChange={e => update('confidence_threshold', Number(e.target.value) / 100)}
          className="w-full accent-[var(--cms-accent)]"
        />
        <div className="flex justify-between text-[10px] text-cms-text-dim">
          <span>80%</span>
          <span>99%</span>
        </div>
      </div>

      {/* Auto-apply winner */}
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-xs font-medium text-cms-text">Auto-apply Winner</p>
          <p className="text-[10px] text-cms-text-dim mt-0.5">Automatically set the winning thumbnail when significance is reached</p>
        </div>
        <button
          role="switch"
          aria-checked={config.auto_apply_winner}
          onClick={() => update('auto_apply_winner', !config.auto_apply_winner)}
          className={[
            'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cms-accent focus:ring-offset-1',
            config.auto_apply_winner ? 'bg-cms-accent' : 'bg-cms-surface-hover',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5',
              config.auto_apply_winner ? 'translate-x-4' : 'translate-x-0.5',
            ].join(' ')}
          />
        </button>
      </div>

      {/* Burn-in period */}
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-xs font-medium text-cms-text">Burn-in Period (2 days)</p>
          <p className="text-[10px] text-cms-text-dim mt-0.5">Wait 2 days after starting before collecting data</p>
        </div>
        <button
          role="switch"
          aria-checked={config.burn_in_days > 0}
          onClick={() => update('burn_in_days', config.burn_in_days > 0 ? 0 : 2)}
          className={[
            'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cms-accent focus:ring-offset-1',
            config.burn_in_days > 0 ? 'bg-cms-accent' : 'bg-cms-surface-hover',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5',
              config.burn_in_days > 0 ? 'translate-x-4' : 'translate-x-0.5',
            ].join(' ')}
          />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Review
// ---------------------------------------------------------------------------

interface Step3Props {
  video: WizardVideo
  testType: TestType
  slots: (SlotFile | null)[]
  textVariants: TextVariant[]
  config: Config
}

function Step3Review({ video, testType, slots, textVariants, config }: Step3Props) {
  const showThumbnails = testType === 'thumbnail' || testType === 'combo'
  const showTitles = testType === 'title' || testType === 'combo'
  const showDescriptions = testType === 'description' || testType === 'combo'

  const allThumbnails = showThumbnails
    ? [
        { label: 'A — Original', src: video.thumbnailUrl, isOriginal: true },
        ...slots
          .map((s, i) => ({ label: String.fromCharCode(66 + i), src: s?.previewUrl ?? null, isOriginal: false }))
          .filter(s => s.src !== null),
      ]
    : []

  const typeLabel = TYPE_OPTIONS.find(o => o.type === testType)?.label ?? testType

  return (
    <div className="space-y-5">
      {/* Test type badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-cms-text-muted">Tipo:</span>
        <span className="text-xs font-semibold text-cms-accent">{typeLabel}</span>
      </div>

      {/* Thumbnails */}
      {showThumbnails && allThumbnails.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-cms-text mb-3">Thumbnails</h3>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {allThumbnails.map(t => (
              <div key={t.label} className="shrink-0 w-32 space-y-1">
                <div className="w-32 h-[72px] rounded overflow-hidden bg-cms-surface-hover">
                  {t.src ? (
                    <NextImage
                      src={t.src}
                      alt={t.label}
                      width={128}
                      height={72}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-dim" aria-hidden="true">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-cms-text-dim text-center">{t.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Titles */}
      {showTitles && (
        <div>
          <h3 className="text-xs font-semibold text-cms-text mb-2">Títulos</h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover">
              <span className="text-[10px] font-semibold text-cms-text-muted shrink-0">A</span>
              <span className="text-xs text-cms-text-dim italic">Original</span>
            </div>
            {textVariants.map((tv, i) => tv.title.trim() ? (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--cms-radius)] border border-cms-border">
                <span className="text-[10px] font-semibold text-cms-text-muted shrink-0">{String.fromCharCode(66 + i)}</span>
                <span className="text-xs text-cms-text truncate">{tv.title}</span>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* Descriptions */}
      {showDescriptions && (
        <div>
          <h3 className="text-xs font-semibold text-cms-text mb-2">Descrições</h3>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 px-3 py-1.5 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover">
              <span className="text-[10px] font-semibold text-cms-text-muted shrink-0 mt-0.5">A</span>
              <span className="text-xs text-cms-text-dim italic">Original</span>
            </div>
            {textVariants.map((tv, i) => tv.description.trim() ? (
              <div key={i} className="flex items-start gap-2 px-3 py-1.5 rounded-[var(--cms-radius)] border border-cms-border">
                <span className="text-[10px] font-semibold text-cms-text-muted shrink-0 mt-0.5">{String.fromCharCode(66 + i)}</span>
                <span className="text-xs text-cms-text line-clamp-3">{tv.description}</span>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* Config summary */}
      <div>
        <h3 className="text-xs font-semibold text-cms-text mb-2">Configuration</h3>
        <div className="rounded-[var(--cms-radius)] border border-cms-border divide-y divide-cms-border">
          {[
            { label: 'Max Duration', value: `${config.max_duration_days} days` },
            { label: 'Confidence Threshold', value: `${Math.round(config.confidence_threshold * 100)}%` },
            { label: 'Auto-apply Winner', value: config.auto_apply_winner ? 'Yes' : 'No' },
            { label: 'Burn-in Period', value: config.burn_in_days > 0 ? `${config.burn_in_days} days` : 'Disabled' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-cms-text-muted">{row.label}</span>
              <span className="text-xs font-medium text-cms-text">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
