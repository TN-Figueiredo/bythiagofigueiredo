'use client'

import { useState, useEffect, useTransition } from 'react'
import Image from 'next/image'
import { createAbTest, uploadVariant, startAbTest, pullPipelineThumbnails } from '../actions'

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

interface Props {
  video: WizardVideo
  siteId: string
  onClose: () => void
  onCreated: (testId: string) => void
}

const DURATION_OPTIONS = [7, 14, 21, 28] as const
const MAX_FILE_SIZE = 2 * 1024 * 1024

interface SlotFile {
  file: File
  previewUrl: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STEP_LABELS = ['Upload', 'Configure', 'Review'] as const

export function AbCreateWizard({ video, siteId, onClose, onCreated }: Props) {
  const [step, setStep] = useState(1)
  const [slots, setSlots] = useState<(SlotFile | null)[]>([null, null, null])
  const [slotError, setSlotError] = useState<string | null>(null)
  const [config, setConfig] = useState<Config>({
    max_duration_days: 14,
    confidence_threshold: 0.95,
    auto_apply_winner: true,
    burn_in_days: 2,
  })
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isPipelinePending, startPipelineTransition] = useTransition()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    return () => {
      for (const slot of slots) {
        if (slot) URL.revokeObjectURL(slot.previewUrl)
      }
    }
  }, [slots])

  const variants = slots.filter((s): s is SlotFile => s !== null)
  const hasVariant = variants.length > 0

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
      setSlotError('File must be JPEG, PNG, or WebP')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setSlotError('File must be 2 MB or smaller')
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
      const result = await createAbTest({
        site_id: siteId,
        youtube_video_id: video.id,
        name: `Test: ${video.title}`,
        config,
      })
      if (!result.ok || !result.id) {
        setSlotError(result.error ?? 'Failed to create test for pipeline pull')
        return
      }
      const pullResult = await pullPipelineThumbnails(result.id, video.sourcePipelineId!)
      if (!pullResult.ok) {
        setSlotError(pullResult.error ?? 'Failed to pull pipeline thumbnails')
      } else {
        onCreated(result.id)
      }
    })
  }

  function handleSubmit(isLaunch: boolean) {
    setSubmitError(null)
    startTransition(async () => {
      const result = await createAbTest({
        site_id: siteId,
        youtube_video_id: video.id,
        name: `Test: ${video.title}`,
        config,
      })
      if (!result.ok || !result.id) {
        setSubmitError(result.error ?? 'Failed to create test')
        return
      }
      const testId = result.id
      for (const slot of variants) {
        const fd = new FormData()
        fd.append('file', slot.file)
        const uploadResult = await uploadVariant(testId, fd)
        if (!uploadResult.ok) {
          setSubmitError(uploadResult.error ?? 'Failed to upload variant')
          return
        }
      }
      if (isLaunch) {
        const startResult = await startAbTest(testId)
        if (!startResult.ok) {
          setSubmitError(startResult.error ?? 'Failed to start test')
          return
        }
      }
      onCreated(testId)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] max-w-[640px] w-full max-h-[90vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cms-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-cms-text">New A/B Test</h2>
            <p className="text-xs text-cms-text-dim truncate max-w-[400px]">{video.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-cms-text-muted hover:text-cms-text transition-colors p-1 -mr-1 rounded"
            aria-label="Close"
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
                    className={[
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                      isCompleted
                        ? 'bg-green-600 text-white'
                        : isActive
                          ? 'bg-cms-accent text-white'
                          : 'bg-cms-surface-hover text-cms-text-muted',
                    ].join(' ')}
                  >
                    {isCompleted ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : stepNum}
                  </div>
                  <span className={`text-xs ${isActive ? 'text-cms-text font-medium' : 'text-cms-text-muted'}`}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`h-px w-8 mx-3 ${step > stepNum ? 'bg-green-600' : 'bg-cms-border'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <Step1Upload
              video={video}
              slots={slots}
              slotError={slotError}
              onFileChange={handleFileChange}
              onPipelinePull={handlePipelinePull}
              isPipelinePending={isPipelinePending}
            />
          )}
          {step === 2 && (
            <Step2Configure config={config} onChange={setConfig} />
          )}
          {step === 3 && (
            <Step3Review
              video={video}
              slots={slots}
              config={config}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-cms-border shrink-0">
          <div>
            {submitError && (
              <p className="text-xs text-red-400">{submitError}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={isPending}
                className="border border-cms-border text-cms-text rounded-[var(--cms-radius)] px-4 py-2 text-sm hover:bg-cms-surface-hover transition-colors disabled:opacity-40"
              >
                Back
              </button>
            )}
            {step < 3 && (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && !hasVariant}
                className="bg-cms-accent text-white rounded-[var(--cms-radius)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            )}
            {step === 3 && (
              <>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isPending}
                  className="border border-cms-border text-cms-text rounded-[var(--cms-radius)] px-4 py-2 text-sm hover:bg-cms-surface-hover transition-colors disabled:opacity-40"
                >
                  {isPending ? 'Saving…' : 'Save as Draft'}
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={isPending}
                  className="bg-cms-accent text-white rounded-[var(--cms-radius)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {isPending ? 'Launching…' : 'Launch Test'}
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
// Step 1 — Upload
// ---------------------------------------------------------------------------

interface Step1Props {
  video: WizardVideo
  slots: (SlotFile | null)[]
  slotError: string | null
  onFileChange: (index: number, file: File | null) => void
  onPipelinePull: () => void
  isPipelinePending: boolean
}

function Step1Upload({ video, slots, slotError, onFileChange, onPipelinePull, isPipelinePending }: Step1Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-cms-text-muted">
        Upload up to 3 thumbnail variants. Slot A is locked to the current thumbnail.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* Slot A — locked original */}
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface-hover p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cms-text">A — Original</span>
            <span className="text-[10px] rounded px-1.5 py-0.5 bg-cms-surface text-cms-text-muted">Locked</span>
          </div>
          <div className="w-full aspect-video rounded overflow-hidden bg-cms-surface flex items-center justify-center">
            {video.thumbnailUrl ? (
              <Image
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
          <VariantSlot
            key={i}
            label={String.fromCharCode(66 + i)}
            slot={slots[i] ?? null}
            onChange={file => onFileChange(i, file)}
          />
        ))}
      </div>

      {slotError && (
        <p className="text-xs text-red-400">{slotError}</p>
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
          {isPipelinePending ? 'Pulling from Pipeline…' : 'From Pipeline'}
        </button>
      )}
    </div>
  )
}

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
            aria-label="Remove variant"
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
            <Image
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
  slots: (SlotFile | null)[]
  config: Config
}

function Step3Review({ video, slots, config }: Step3Props) {
  const allThumbnails = [
    { label: 'A — Original', src: video.thumbnailUrl, isOriginal: true },
    ...slots
      .map((s, i) => ({ label: String.fromCharCode(66 + i), src: s?.previewUrl ?? null, isOriginal: false }))
      .filter(s => s.src !== null),
  ]

  return (
    <div className="space-y-5">
      {/* Thumbnails */}
      <div>
        <h3 className="text-xs font-semibold text-cms-text mb-3">Variants</h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {allThumbnails.map(t => (
            <div key={t.label} className="shrink-0 w-32 space-y-1">
              <div className="w-32 h-[72px] rounded overflow-hidden bg-cms-surface-hover">
                {t.src ? (
                  <Image
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
