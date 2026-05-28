'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import NextImage from 'next/image'
import { Lightbulb, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchAbBriefingData } from '../actions'
import useSWR from 'swr'
import { buildAbBriefingPrompt, buildAbWritePrompt } from '@/lib/youtube/prompt-builders-ab'
import { estimateChars } from '@/lib/youtube/prompt-sanitize'
import { DataFreshnessBadge } from '../../videos/_components/data-freshness-badge'
import { PromptPreview } from '@/components/prompt-preview'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'
import type { TestType, VariantMetadata } from '@/lib/youtube/ab-types'

interface WizardVideo {
  id: string
  title: string
  thumbnailUrl: string | null
}

interface StepIdeiasProps {
  testType: TestType
  video: WizardVideo
  focus: string
  onFocusChange: (value: string) => void
  slotNotes: [string, string, string]
  onSlotNoteChange: (index: number, value: string) => void
  briefingCopied: boolean
  onBriefingCopied: () => void
  briefingData: AbBriefingData | null
  onBriefingDataChange: (data: AbBriefingData | null) => void
  draftTestId?: string | null
}

const SLOT_LABELS = ['B', 'C', 'D'] as const

const EXAMPLE_CHIPS: Record<TestType, string[]> = {
  thumbnail: ['Testar close-up vs paisagem', 'Cores quentes vs frias', 'Com vs sem texto overlay'],
  title: ['Testar hook de curiosidade', 'Comparar comprimentos curto vs longo', 'Números no início'],
  description: ['CTA no topo vs no meio', 'Testar com hashtags', 'Links acima do fold'],
  combo: ['Thumb minimalista + título dramático', 'Thumb colorida + título curto', 'Sinergia visual-textual'],
}

const TIPS: Record<TestType, string[]> = {
  thumbnail: [
    'Cole a thumbnail atual no chat para análise visual',
    'Peça variações que mantêm a identidade do canal',
    'Considere como a thumbnail aparece em telas pequenas (mobile)',
  ],
  title: [
    'Títulos entre 50-60 caracteres tendem a performar melhor',
    'Teste hooks emocionais vs informativos',
    'Power words: "segredo", "erro", "verdade", "definitivo"',
  ],
  description: [
    'As 3 primeiras linhas são as únicas visíveis antes do "mostrar mais"',
    'Inclua o CTA principal acima do fold',
    'Use {{link:nome}} para links rastreados automaticamente',
  ],
  combo: [
    'Thumbnail e título devem se complementar, não repetir informação',
    'Teste sinergias: thumb curiosa + título explicativo',
    'Cole a thumbnail no chat para análise visual combinada',
  ],
}

const TYPE_GRADIENT: Record<TestType, string> = {
  thumbnail: 'from-indigo-500 to-purple-600',
  title: 'from-amber-500 to-orange-600',
  description: 'from-emerald-500 to-teal-600',
  combo: 'from-pink-500 to-purple-600',
}

export function StepIdeias({
  testType,
  video,
  focus,
  onFocusChange,
  slotNotes,
  onSlotNoteChange,
  briefingCopied,
  onBriefingCopied,
  briefingData,
  onBriefingDataChange,
  draftTestId,
}: StepIdeiasProps) {
  const [loading, setLoading] = useState(briefingData === null)
  const [error, setError] = useState<string | null>(null)
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [variantsReceived, setVariantsReceived] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchingRef = useRef(false)

  const variantsFetcher = async (url: string) => {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Variants fetch failed: ${r.status}`)
    const d = await r.json()
    return d.data ?? []
  }

  const { data: externalVariants, error: swrError } = useSWR(
    draftTestId && !variantsReceived ? `/api/pipeline/youtube/ab-tests/${draftTestId}/variants` : null,
    variantsFetcher,
    { refreshInterval: 5_000, revalidateOnFocus: true, dedupingInterval: 4_900 },
  )

  const nonOriginalVariants = (externalVariants ?? []).filter(
    (v: { is_original: boolean }) => !v.is_original,
  )

  useEffect(() => {
    if (nonOriginalVariants.length > 0) setVariantsReceived(true)
  }, [nonOriginalVariants.length])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const doFetch = useCallback(() => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    setError(null)

    fetchAbBriefingData(video.id).then(result => {
      if (result.ok) {
        onBriefingDataChange(result.data)
      } else {
        setError(result.error)
      }
    }).catch(() => {
      setError('Falha ao carregar dados do vídeo')
    }).finally(() => {
      setLoading(false)
      fetchingRef.current = false
    })
  }, [video.id, onBriefingDataChange])

  useEffect(() => {
    if (briefingData) return
    doFetch()
  }, [briefingData, doFetch])

  useEffect(() => {
    if (!loading) textareaRef.current?.focus()
  }, [loading])

  const prompt = useMemo(() => {
    if (!briefingData) return ''
    return draftTestId
      ? buildAbWritePrompt({
          testType,
          data: { ...briefingData, testId: draftTestId },
          focus: focus || undefined,
          baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
        })
      : buildAbBriefingPrompt({ testType, data: briefingData, focus: focus || undefined })
  }, [briefingData, draftTestId, testType, focus])

  const charCount = useMemo(() => estimateChars(prompt), [prompt])

  const handleCopy = useCallback(async () => {
    if (!prompt) return
    if (/pk_[a-zA-Z0-9]{20,}/.test(prompt)) {
      toast.error('Pipeline key detectada no prompt — remova antes de copiar.')
      return
    }
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      onBriefingCopied()
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
      toast.success('Prompt copiado!')
    } catch {
      toast.error('Falha ao copiar')
    }
  }, [prompt, onBriefingCopied])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleCopy()
    }
  }, [handleCopy])

  const videoHasNoData = briefingData &&
    briefingData.video.ctr === null &&
    briefingData.video.score === null

  const completedTests = briefingData?.testHistory ?? []
  const avgLift = completedTests.length > 0
    ? completedTests.reduce((sum, t) => sum + (t.ctr_lift_percent ?? 0), 0) / completedTests.length
    : 0

  return (
    <div className="space-y-4">
      {/* Icon + title */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${TYPE_GRADIENT[testType]} flex items-center justify-center`}>
          <Lightbulb className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-cms-text">Brainstorm com IA</h3>
          <p className="text-xs text-cms-text-dim mt-0.5" role="status" aria-live="polite">
            {briefingCopied
              ? 'Prompt copiado! Discuta com o Cowork e anote por slot.'
              : 'Gere ideias com IA antes de criar as variantes'}
          </p>
        </div>
      </div>

      {/* Cross-test insights bar */}
      {completedTests.length > 0 && (
        <div className="rounded-[var(--cms-radius)] bg-indigo-500/10 border border-indigo-500/20 px-3 py-2">
          <p className="text-xs text-indigo-300">
            Em {completedTests.length} teste{completedTests.length > 1 ? 's' : ''} anterior{completedTests.length > 1 ? 'es' : ''},
            {avgLift > 0 ? ` lift médio de +${avgLift.toFixed(1)}% CTR` : ' dados de lift insuficientes'}
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3" aria-busy="true">
          {/* Matches asset preview card */}
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-3 animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="h-3 bg-cms-surface-hover rounded w-16" />
              <div className="h-4 bg-cms-surface-hover rounded w-12" />
            </div>
            <div className="flex gap-3 items-center">
              <div className="w-24 h-[54px] rounded bg-cms-surface-hover shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-cms-surface-hover rounded w-3/4" />
                <div className="h-2.5 bg-cms-surface-hover rounded w-1/2" />
              </div>
            </div>
          </div>
          {/* Matches instructions textarea area */}
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-3 animate-pulse space-y-2">
            <div className="h-3 bg-cms-surface-hover rounded w-32" />
            <div className="h-14 bg-cms-surface-hover rounded" />
          </div>
          {/* Matches prompt card */}
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-3 animate-pulse space-y-2">
            <div className="h-4 bg-cms-surface-hover rounded w-20" />
            <div className="h-24 bg-cms-surface-hover rounded" />
            <div className="h-8 bg-cms-surface-hover rounded w-32 ml-auto" />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div role="alert" className="rounded-[var(--cms-radius)] border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={doFetch}
            className="text-xs text-red-300 underline mt-1"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Ready state — asset preview + prompt + notes */}
      {briefingData && !loading && (
        <>
          {/* No-data warning */}
          {videoHasNoData && (
            <div role="status" className="rounded-[var(--cms-radius)] bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-xs text-amber-300">Sem dados de performance — prompt gerado com contexto do canal apenas.</p>
            </div>
          )}

          {/* Asset preview */}
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-cms-text-muted uppercase tracking-wider">Vídeo atual</span>
              <DataFreshnessBadge snapshotAgeHours={briefingData.snapshotAgeHours} />
            </div>
            <div className="flex gap-3 items-center">
              <div className="w-24 h-[54px] rounded overflow-hidden bg-cms-surface-hover shrink-0">
                {video.thumbnailUrl ? (
                  <NextImage
                    src={video.thumbnailUrl}
                    alt="Thumbnail atual"
                    width={96}
                    height={54}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-cms-text-dim text-[10px]">
                    Sem thumb
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-cms-text font-medium truncate">{video.title}</p>
                <div className="flex gap-3 mt-1">
                  {briefingData.video.ctr !== null && (
                    <span className="text-[10px] text-cms-text-dim">CTR: {briefingData.video.ctr.toFixed(1)}%</span>
                  )}
                  {briefingData.video.grade && (
                    <span className="text-[10px] text-cms-text-dim">Grade: {briefingData.video.grade}</span>
                  )}
                  <span className="text-[10px] text-cms-text-dim">{estimateChars(video.title)} chars</span>
                </div>
              </div>
            </div>
          </div>

          {/* Custom instructions textarea */}
          <div className="space-y-2">
            <label htmlFor="ab-focus" className="text-xs font-medium text-cms-text">
              Instruções adicionais <span className="text-cms-text-dim font-normal">(opcional)</span>
            </label>
            <textarea
              id="ab-focus"
              ref={textareaRef}
              value={focus}
              onChange={e => onFocusChange(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ex: Focar em cores quentes e expressões faciais"
              className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent focus:ring-offset-1 resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_CHIPS[testType].map(chip => (
                <button
                  key={chip}
                  onClick={() => onFocusChange(focus ? `${focus}. ${chip}` : chip)}
                  className="text-[10px] rounded-full border border-cms-border px-2 py-0.5 text-cms-text-muted hover:border-cms-accent hover:text-cms-accent transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt card */}
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold tracking-wide bg-gradient-to-r ${TYPE_GRADIENT[testType]} text-white px-1.5 py-0.5 rounded uppercase`}>
                Prompt pronto
              </span>
              <span className="text-[10px] text-cms-text-dim">
                {charCount.toLocaleString('pt-BR')} caracteres
              </span>
            </div>

            <PromptPreview maxHeight={promptExpanded ? '24rem' : '9rem'}>
              {prompt}
            </PromptPreview>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="flex items-center gap-1 text-[10px] text-cms-text-muted hover:text-cms-text transition-colors"
              >
                {promptExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {promptExpanded ? 'Recolher' : 'Ver prompt completo'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 rounded-[var(--cms-radius)] px-3 py-1.5 text-xs font-medium transition-all ${
                    copied
                      ? 'bg-green-600 text-white'
                      : `bg-gradient-to-r ${TYPE_GRADIENT[testType]} text-white hover:opacity-90`
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied
                    ? 'Copiado!'
                    : briefingCopied
                      ? 'Copiar novamente'
                      : `Copiar Prompt (${typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter)`}
                </button>
              </div>
            </div>
          </div>

          {/* Per-slot notes */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-cms-text">Anote suas ideias por slot</h4>
            {SLOT_LABELS.map((label, i) => (
              <div key={label} className="flex items-start gap-2">
                <span className="text-xs font-semibold text-cms-accent mt-2 w-4 shrink-0">{label}</span>
                <input
                  type="text"
                  value={slotNotes[i]}
                  onChange={e => onSlotNoteChange(i, e.target.value)}
                  placeholder={`Ideia para variante ${label}...`}
                  className="flex-1 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent focus:ring-offset-1"
                />
              </div>
            ))}
          </div>

          {/* External variant cards */}
          {nonOriginalVariants.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-cms-text">
                Variantes do Cowork
                <span className="ml-1.5 text-[10px] text-green-400 font-normal">
                  {nonOriginalVariants.length} recebida{nonOriginalVariants.length > 1 ? 's' : ''}
                </span>
              </h4>
              {nonOriginalVariants.map((v: { label: string; title_text: string | null; description_text: string | null; metadata: VariantMetadata }) => (
                <div
                  key={v.label}
                  className="rounded-[var(--cms-radius)] border border-green-500/20 bg-green-500/5 p-3 space-y-1"
                  style={{ animation: 'fadeIn 300ms ease-out' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-green-400">Variante {v.label}</span>
                  </div>
                  {v.title_text && (
                    <p className="text-xs text-cms-text">{v.title_text}</p>
                  )}
                  {v.description_text && (
                    <p className="text-[10px] text-cms-text-dim line-clamp-2">{v.description_text}</p>
                  )}
                  {v.metadata?.rationale && (
                    <p className="text-[10px] text-cms-text-muted italic">{v.metadata.rationale}</p>
                  )}
                  {v.metadata?.creative_direction && (
                    <p className="text-[10px] text-indigo-300">{v.metadata.creative_direction}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Waiting indicator when no variants yet */}
          {draftTestId && nonOriginalVariants.length === 0 && !loading && (
            <div className="rounded-[var(--cms-radius)] border border-dashed border-cms-border bg-transparent p-3 text-center">
              {swrError ? (
                <>
                  <p className="text-xs text-red-400">Falha ao verificar variantes</p>
                  <p className="text-[10px] text-cms-text-muted mt-1">Tentando novamente automaticamente...</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-cms-text-dim">Aguardando variantes do Cowork...</p>
                  <p className="text-[10px] text-cms-text-muted mt-1">Copie o prompt e cole no Cowork. As variantes aparecerão aqui automaticamente.</p>
                </>
              )}
            </div>
          )}

          {/* Tips */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold text-cms-text-muted uppercase tracking-wider">Dicas</h4>
            {TIPS[testType].map(tip => (
              <div key={tip} className="flex items-start gap-2">
                <span className="text-cms-accent text-xs mt-0.5">•</span>
                <span className="text-[10px] text-cms-text-dim leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
