'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Lightbulb, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchAbBriefingData } from '../actions'
import useSWR from 'swr'
import { buildAbBriefingPrompt, buildAbWritePrompt } from '@/lib/youtube/prompt-builders-ab'
import { estimateChars } from '@/lib/youtube/prompt-sanitize'
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
  onVariantsReceived?: (variants: Array<{
    label: string
    title_text: string | null
    description_text: string | null
    metadata: Record<string, unknown> | null
  }>) => void
}

const SLOT_LABELS = ['B', 'C', 'D'] as const

const EXAMPLE_CHIPS: Record<TestType, string[]> = {
  thumbnail: ['Testar close-up vs paisagem', 'Cores quentes vs frias', 'Com vs sem texto overlay'],
  title: ['Testar hook de curiosidade', 'Comparar comprimentos curto vs longo', 'Números no início'],
  description: ['CTA no topo vs no meio', 'Testar com hashtags', 'Links acima do fold'],
  combo: ['Thumb minimalista + título dramático', 'Thumb colorida + título curto', 'Sinergia visual-textual'],
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
  onVariantsReceived,
}: StepIdeiasProps) {
  const [loading, setLoading] = useState(briefingData === null)
  const [error, setError] = useState<string | null>(null)
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pollingTimedOut, setPollingTimedOut] = useState(false)
  const [showEscalation, setShowEscalation] = useState(false)
  const [directionsExpanded, setDirectionsExpanded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchingRef = useRef(false)

  // SWR fetcher
  const variantsFetcher = async (url: string) => {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Variants fetch failed: ${r.status}`)
    const d = await r.json()
    return d.data ?? []
  }

  // Polls until timeout
  const { data: externalVariants, error: swrError } = useSWR(
    draftTestId && !pollingTimedOut
      ? `/api/pipeline/youtube/ab-tests/${draftTestId}/variants`
      : null,
    variantsFetcher,
    { refreshInterval: 5_000, revalidateOnFocus: true, dedupingInterval: 4_900 },
  )

  const nonOriginalVariants = useMemo(() => {
    return (externalVariants ?? []).filter(
      (v: { is_original: boolean }) => !v.is_original,
    ) as Array<{
      label: string
      title_text: string | null
      description_text: string | null
      metadata: VariantMetadata
      is_original: boolean
    }>
  }, [externalVariants])

  const variantCount = nonOriginalVariants.length
  const allVariantsReceived = variantCount >= 3

  // Stop polling once all 3 variants arrive
  useEffect(() => {
    if (allVariantsReceived) setPollingTimedOut(true)
  }, [allVariantsReceived])

  // 120s polling timeout
  useEffect(() => {
    if (!briefingCopied || pollingTimedOut) return
    const timeout = setTimeout(() => setPollingTimedOut(true), 120_000)
    return () => clearTimeout(timeout)
  }, [briefingCopied, pollingTimedOut])

  // 60s escalation message
  useEffect(() => {
    if (!briefingCopied || variantCount > 0) return
    const timer = setTimeout(() => setShowEscalation(true), 60_000)
    return () => clearTimeout(timer)
  }, [briefingCopied, variantCount])

  type StepState = 'pre-copy' | 'waiting' | 'partial' | 'complete'

  const stepState: StepState = useMemo(() => {
    if (allVariantsReceived) return 'complete'
    if (variantCount > 0) return 'partial'
    if (briefingCopied) return 'waiting'
    return 'pre-copy'
  }, [allVariantsReceived, variantCount, briefingCopied])

  // Notify parent when variants arrive
  useEffect(() => {
    if (!nonOriginalVariants.length || !onVariantsReceived) return
    onVariantsReceived(nonOriginalVariants.map(v => ({
      label: v.label,
      title_text: v.title_text,
      description_text: v.description_text,
      metadata: v.metadata as Record<string, unknown> | null,
    })))
  }, [nonOriginalVariants, onVariantsReceived])

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
          slotNotes,
        })
      : buildAbBriefingPrompt({ testType, data: briefingData, focus: focus || undefined })
  }, [briefingData, draftTestId, testType, focus, slotNotes])

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

  return (
    <div className="space-y-4">
      {/* Compact header */}
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${TYPE_GRADIENT[testType]} flex items-center justify-center shrink-0`}>
          <Lightbulb className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#e5e7eb]">Monte sua hipótese</h3>
          <p className="text-[10px] text-[#6b7280] mt-0.5" role="status" aria-live="polite">
            {stepState === 'complete'
              ? 'Variantes recebidas! Revise e avance.'
              : stepState === 'partial'
                ? `${variantCount}/3 variantes recebidas — aguardando restante...`
                : stepState === 'waiting'
                  ? 'Prompt copiado! Discuta com o Cowork.'
                  : 'Gere ideias com IA antes de criar as variantes'}
          </p>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3" aria-busy="true">
          <div className="rounded-lg border border-[#2a2d3a] bg-[#1a1d27] p-3 animate-pulse space-y-2">
            <div className="h-3 bg-[#1a1d27]/80 rounded w-32" />
            <div className="h-14 bg-[#1a1d27]/80 rounded" />
          </div>
          <div className="rounded-lg border border-[#2a2d3a] bg-[#1a1d27] p-3 animate-pulse space-y-2">
            <div className="h-4 bg-[#1a1d27]/80 rounded w-20" />
            <div className="h-24 bg-[#1a1d27]/80 rounded" />
            <div className="h-8 bg-[#1a1d27]/80 rounded w-32 ml-auto" />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={doFetch}
            className="text-xs text-red-300 underline mt-1"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Ready state */}
      {briefingData && !loading && (
        <>
          {/* No-data warning */}
          {videoHasNoData && (
            <div role="status" className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-xs text-amber-300">Sem dados de performance — prompt gerado com contexto do canal apenas.</p>
            </div>
          )}

          {/* Hypothesis section */}
          <div className="space-y-2">
            <label htmlFor="ab-focus" className="text-xs font-medium text-[#e5e7eb]">
              Hipótese <span className="text-[#6b7280] font-normal">(opcional)</span>
            </label>
            <textarea
              id="ab-focus"
              ref={textareaRef}
              value={focus}
              onChange={e => onFocusChange(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ex: Focar em cores quentes e expressões faciais"
              className="w-full rounded-lg border border-[#2a2d3a] bg-[#1a1d27] px-3 py-2 text-sm text-[#e5e7eb] placeholder:text-[#4b5563] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_CHIPS[testType]
                .filter(chip => !focus.includes(chip))
                .map(chip => (
                  <button
                    key={chip}
                    onClick={() => onFocusChange(focus ? `${focus}. ${chip}` : chip)}
                    className="text-[10px] rounded-full border border-[#2a2d3a] px-2 py-0.5 text-[#6b7280] hover:border-indigo-500 hover:text-indigo-400 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
            </div>
          </div>

          {/* Collapsible per-variant directions */}
          <div className="rounded-lg border border-[#2a2d3a] bg-[#1a1d27] overflow-hidden">
            <button
              type="button"
              onClick={() => setDirectionsExpanded(!directionsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
            >
              <span className="text-xs font-medium text-[#d1d5db]">Guiar cada variação</span>
              {directionsExpanded
                ? <ChevronUp className="w-3.5 h-3.5 text-[#6b7280]" />
                : <ChevronDown className="w-3.5 h-3.5 text-[#6b7280]" />}
            </button>
            {directionsExpanded && (
              <div className="px-3 pb-3 space-y-2 border-t border-[#2a2d3a]">
                {SLOT_LABELS.map((label, i) => (
                  <div key={label} className="flex items-start gap-2 pt-2">
                    <span className="text-xs font-semibold text-indigo-400 mt-1.5 w-4 shrink-0">{label}</span>
                    <input
                      type="text"
                      value={slotNotes[i]}
                      onChange={e => onSlotNoteChange(i, e.target.value)}
                      placeholder={`Direção para variação ${label}...`}
                      className="flex-1 rounded border border-[#2a2d3a] bg-[#0f1117] px-2.5 py-1.5 text-sm text-[#e5e7eb] placeholder:text-[#4b5563] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prompt card */}
          <div className="rounded-lg border border-[#2a2d3a] bg-[#1a1d27] p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold tracking-wide bg-gradient-to-r ${TYPE_GRADIENT[testType]} text-white px-1.5 py-0.5 rounded uppercase`}>
                Prompt pronto
              </span>
              <span className="text-[10px] text-[#6b7280]">
                {charCount.toLocaleString('pt-BR')} caracteres
              </span>
            </div>

            <PromptPreview maxHeight={promptExpanded ? '24rem' : '9rem'}>
              {prompt}
            </PromptPreview>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="flex items-center gap-1 text-[10px] text-[#6b7280] hover:text-[#d1d5db] transition-colors"
              >
                {promptExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {promptExpanded ? 'Recolher' : 'Ver prompt completo'}
              </button>

              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  copied
                    ? 'bg-green-600 text-white'
                    : briefingCopied
                      ? 'border border-[#2a2d3a] text-[#d1d5db] hover:border-indigo-500'
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

          {/* Combo warning */}
          {testType === 'combo' && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-[10px] text-amber-400">
                Teste combo gera variações de thumb + título juntas. Avalie a sinergia entre os dois elementos.
              </p>
            </div>
          )}

          {/* Variant grid — 4 progressive states */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-medium text-[#e5e7eb]">Variantes</h4>
              {variantCount > 0 && (
                <span className="text-[10px] text-green-500 font-medium">
                  {variantCount}/3 recebida{variantCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* pre-copy: empty placeholder */}
            {stepState === 'pre-copy' && (
              <div className="rounded-lg border border-dashed border-[#2a2d3a] bg-transparent p-6 text-center">
                <p className="text-xs text-[#4b5563]">Copie o prompt acima e cole no Cowork para gerar variantes.</p>
              </div>
            )}

            {/* waiting: 3 skeleton cards */}
            {stepState === 'waiting' && (
              <div className="grid gap-2">
                {SLOT_LABELS.map(label => (
                  <div
                    key={label}
                    className="rounded-lg border border-[#2a2d3a] bg-[#1a1d27] p-3 animate-pulse"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-4 w-16 bg-[#2a2d3a] rounded" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-3 bg-[#2a2d3a] rounded w-3/4" />
                      <div className="h-3 bg-[#2a2d3a] rounded w-1/2" />
                    </div>
                  </div>
                ))}
                {swrError && (
                  <p className="text-[10px] text-red-400 text-center">Falha ao verificar variantes — tentando novamente...</p>
                )}
                {showEscalation && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-center">
                    <p className="text-[10px] text-amber-400">
                      Ainda aguardando... Verifique se o prompt foi colado corretamente no Cowork.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* partial / complete: variant cards grid */}
            {(stepState === 'partial' || stepState === 'complete') && (
              <div className="grid gap-2">
                {/* Original variant (A) — gray */}
                <div className="rounded-lg border border-[#2a2d3a] bg-[#1a1d27] p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold tracking-wide bg-[#2a2d3a] text-[#6b7280] px-1.5 py-0.5 rounded uppercase">
                      Opção A
                    </span>
                    <span className="text-[10px] text-[#6b7280]">Original</span>
                  </div>
                  <p className="text-xs text-[#d1d5db] mt-1.5">{video.title}</p>
                </div>

                {/* Variant cards B, C, D */}
                {nonOriginalVariants.map((v, idx) => (
                  <div
                    key={v.label}
                    className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-1.5"
                    style={{ animation: 'fadeIn 300ms ease-out' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold tracking-wide bg-gradient-to-r ${TYPE_GRADIENT[testType]} text-white px-1.5 py-0.5 rounded uppercase`}>
                        Variação {v.label}
                      </span>
                    </div>

                    {testType === 'combo' ? (
                      /* Combo variant: two columns */
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <span className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wide">Thumb direção</span>
                          {v.metadata?.creative_direction && (
                            <p className="text-[10px] text-[#d1d5db] mt-0.5">{v.metadata.creative_direction}</p>
                          )}
                          {v.metadata?.visual_description && (
                            <p className="text-[10px] text-[#6b7280] mt-0.5">{v.metadata.visual_description}</p>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-semibold text-amber-400 uppercase tracking-wide">Título</span>
                            {v.title_text && (
                              <span className="text-[9px] text-[#6b7280]">{estimateChars(v.title_text)} chars</span>
                            )}
                          </div>
                          {v.title_text && (
                            <p className="text-[10px] text-[#d1d5db] mt-0.5">{v.title_text}</p>
                          )}
                        </div>
                        {v.metadata?.rationale && (
                          <p className="col-span-2 text-[10px] text-[#6b7280] italic border-t border-[#2a2d3a] pt-1.5">{v.metadata.rationale}</p>
                        )}
                      </div>
                    ) : (
                      /* Standard variant card */
                      <>
                        {v.title_text && (
                          <p className="text-xs text-[#e5e7eb]">{v.title_text}</p>
                        )}
                        {v.description_text && (
                          <p className="text-[10px] text-[#6b7280] line-clamp-2">{v.description_text}</p>
                        )}
                        {v.metadata?.rationale && (
                          <p className="text-[10px] text-[#6b7280] italic">{v.metadata.rationale}</p>
                        )}
                        {v.metadata?.creative_direction && (
                          <p className="text-[10px] text-indigo-400">{v.metadata.creative_direction}</p>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {/* Remaining skeleton slots for partial state */}
                {stepState === 'partial' && Array.from({ length: 3 - variantCount }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="rounded-lg border border-[#2a2d3a] bg-[#1a1d27] p-3 animate-pulse"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-4 w-16 bg-[#2a2d3a] rounded" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-3 bg-[#2a2d3a] rounded w-3/4" />
                      <div className="h-3 bg-[#2a2d3a] rounded w-1/2" />
                    </div>
                  </div>
                ))}

                {/* Escalation message */}
                {showEscalation && stepState === 'partial' && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-center">
                    <p className="text-[10px] text-amber-400">
                      Ainda aguardando... Verifique se o prompt foi colado corretamente no Cowork.
                    </p>
                  </div>
                )}

                {/* Handoff microcopy for combo */}
                {stepState === 'complete' && testType === 'combo' && (
                  <p className="text-[10px] text-[#6b7280] text-center pt-1">
                    Monte as variantes combinando thumb + título na próxima etapa.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
