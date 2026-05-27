'use client'

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useFocusTrap } from '@/lib/hooks/use-focus-trap'
import { buildYoutubePrompt } from '@/lib/youtube/prompt-builders'
import { estimateChars } from '@/lib/youtube/prompt-sanitize'
import { EXAMPLE_PROMPTS, STALENESS_THRESHOLDS, buildVideoInfo } from '@/lib/youtube/prompt-types'
import type { ContextPreset, ContentCalendarData, ChannelHealthData, VideoOptimizerData, PromptVideoInfo } from '@/lib/youtube/prompt-types'
import { PromptPreview } from '@/components/prompt-preview'
import { DataFreshnessBadge } from '../videos/_components/data-freshness-badge'
import { fetchContentCalendarData, fetchChannelHealthData, fetchVideoOptimizerData } from '../_actions/youtube-prompt-actions'
import { usePromptCopy } from '../_hooks/use-prompt-copy'
import type { VideoRow } from '../videos/videos-connected'

const PRESET_INFO: { id: ContextPreset; name: string; desc: string; charEstimate: string }[] = [
  { id: 'content-calendar', name: 'Content Calendar', desc: 'Tópicos, timing, nichos', charEstimate: '~3k chars' },
  { id: 'channel-health', name: 'Channel Health', desc: 'Diagnóstico completo do canal', charEstimate: '~4.5k chars' },
  { id: 'video-optimizer', name: 'Video Optimizer', desc: 'Otimização por vídeo', charEstimate: '~3.2k chars' },
]

const PLACEHOLDER: Record<ContextPreset, string> = {
  'content-calendar': 'O que quer planejar? Ex: Qual nicho explorar no próximo vídeo?',
  'channel-health': 'O que quer diagnosticar? Ex: O que está segurando o crescimento?',
  'video-optimizer': 'O que quer otimizar? Ex: Por que a retenção está baixa?',
}

interface YouTubeCoworkPromptModalProps {
  isOpen: boolean
  onClose: () => void
  videos?: VideoRow[]
  channelName?: string
  scoredVideoCount?: number
}

export function YouTubeCoworkPromptModal({ isOpen, onClose, videos = [], channelName = '', scoredVideoCount = 0 }: YouTubeCoworkPromptModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const handleTrapKeyDown = useFocusTrap(dialogRef, { autoFocus: false })

  const [preset, setPreset] = useState<ContextPreset>('content-calendar')
  const [instructions, setInstructions] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<VideoRow | null>(null)
  const [showContext, setShowContext] = useState(false)
  const [resolvedChannelName, setResolvedChannelName] = useState(channelName)

  const [ccData, setCcData] = useState<ContentCalendarData | null>(null)
  const [chData, setChData] = useState<ChannelHealthData | null>(null)
  const [voData, setVoData] = useState<VideoOptimizerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (preset === 'content-calendar' && ccData) { setLoading(false); return }
    if (preset === 'channel-health' && chData) { setLoading(false); return }
    if (preset === 'video-optimizer' && selectedVideo && voData) { setLoading(false); return }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setFetchError(null)

    const loadData = async () => {
      try {
        if (preset === 'content-calendar') {
          const r = await fetchContentCalendarData()
          if (!controller.signal.aborted && r.ok) {
            setCcData(r.data)
            if (!channelName) setResolvedChannelName(r.data.channel.name)
          }
          else if (!controller.signal.aborted && !r.ok) setFetchError(r.error)
        } else if (preset === 'channel-health') {
          const r = await fetchChannelHealthData()
          if (!controller.signal.aborted && r.ok) {
            setChData(r.data)
            if (!channelName) setResolvedChannelName(r.data.channel.name)
          }
          else if (!controller.signal.aborted && !r.ok) setFetchError(r.error)
        } else if (preset === 'video-optimizer' && selectedVideo) {
          const r = await fetchVideoOptimizerData(selectedVideo.id)
          if (!controller.signal.aborted && r.ok) {
            setVoData(r.data)
            if (!channelName) setResolvedChannelName(r.data.channel.name)
          }
          else if (!controller.signal.aborted && !r.ok) setFetchError(r.error)
        }
      } catch {
        if (!controller.signal.aborted) setFetchError('Erro ao buscar dados')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    loadData()
    return () => controller.abort()
  }, [isOpen, preset, selectedVideo?.id])

  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null
    } else {
      triggerRef.current?.focus()
      triggerRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) textareaRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  const currentData = preset === 'content-calendar' ? ccData
    : preset === 'channel-health' ? chData
    : voData

  const videoInfo: PromptVideoInfo | undefined = useMemo(() =>
    selectedVideo ? buildVideoInfo(selectedVideo) : undefined,
    [selectedVideo]
  )

  const prompt = useMemo(() => {
    if (!instructions.trim()) return ''
    if (!currentData) return ''
    if (preset === 'video-optimizer') {
      if (!voData || !videoInfo) return ''
      return buildYoutubePrompt({ preset: 'video-optimizer', data: voData, video: videoInfo, instructions: instructions.trim() })
    }
    if (preset === 'channel-health' && chData) {
      return buildYoutubePrompt({ preset: 'channel-health', data: chData, instructions: instructions.trim() })
    }
    if (preset === 'content-calendar' && ccData) {
      return buildYoutubePrompt({ preset: 'content-calendar', data: ccData, instructions: instructions.trim() })
    }
    return ''
  }, [instructions, preset, ccData, chData, voData, videoInfo])

  const charCount = estimateChars(prompt)
  const snapshotAge = currentData?.snapshotAgeHours ?? 0

  const { copied, setCopied, copy } = usePromptCopy({ preset, charCount, snapshotAgeHours: snapshotAge })

  const handleCopy = useCallback(() => {
    void copy(prompt)
  }, [copy, prompt])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    handleTrapKeyDown(e)
    if (e.key === 'Escape') onClose()
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleCopy()
  }, [handleTrapKeyDown, onClose, handleCopy])

  const handlePresetChange = useCallback((p: ContextPreset) => {
    setPreset(p)
    setCopied(false)
  }, [setCopied])

  const handleRadioKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    const presets = PRESET_INFO.map(p => p.id)
    let nextIndex: number | null = null

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % presets.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + presets.length) % presets.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = presets.length - 1
        break
      default:
        return
    }

    e.preventDefault()
    handlePresetChange(presets[nextIndex]!)
    // Focus the newly selected radio button
    const container = (e.target as HTMLElement).parentElement
    const buttons = container?.querySelectorAll<HTMLElement>('[role="radio"]')
    buttons?.[nextIndex]?.focus()
  }, [handlePresetChange])

  const handleExampleClick = useCallback((text: string) => {
    setInstructions(text)
    setCopied(false)
    textareaRef.current?.focus()
  }, [setCopied])

  if (!isOpen) return null

  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
  const shortcutLabel = isMac ? '⌘⏎' : 'Ctrl+Enter'

  const openInClaudeDisabled = charCount > 8000 || /pk_[a-zA-Z0-9]{20,}/.test(prompt)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="YouTube Cowork Prompt"
        className="w-full max-w-2xl rounded-xl border border-cms-border bg-cms-surface shadow-2xl"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between border-b border-cms-border px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-cms-text">YouTube Cowork Prompt</h2>
            <p className="text-xs text-cms-text-muted">{resolvedChannelName || channelName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-cms-text-muted hover:text-cms-text" aria-label="Fechar"><span aria-hidden="true">✕</span></button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          <div role="radiogroup" aria-label="Contexto do prompt" className="grid grid-cols-3 gap-2">
            {PRESET_INFO.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={preset === p.id}
                tabIndex={preset === p.id ? 0 : -1}
                onClick={() => handlePresetChange(p.id)}
                onKeyDown={(e) => handleRadioKeyDown(e, i)}
                className={`rounded-lg border p-3 text-left text-xs transition-colors ${
                  preset === p.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                    : 'border-cms-border bg-cms-surface hover:border-cms-border/80 text-cms-text-muted'
                }`}
              >
                <div className="font-medium text-cms-text">{p.name}</div>
                <div className="mt-0.5">{p.desc}</div>
                <div className="mt-1 text-[10px] opacity-60">{p.charEstimate}</div>
              </button>
            ))}
          </div>

          {preset === 'channel-health' && scoredVideoCount < 10 && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-400">
              Dados insuficientes para diagnóstico completo ({scoredVideoCount} vídeos com score) — considere usar Content Calendar.
            </div>
          )}

          {preset === 'video-optimizer' && (
            <div>
              <label className="mb-1 block text-xs text-cms-text-muted">Selecionar vídeo</label>
              <select
                value={selectedVideo?.id ?? ''}
                onChange={e => {
                  const v = videos.find(v => v.id === e.target.value) ?? null
                  setSelectedVideo(v)
                }}
                className="w-full rounded-md border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text"
                aria-label="Selecionar vídeo para otimização"
              >
                <option value="">Escolha um vídeo…</option>
                {videos.slice(0, 50).map(v => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <textarea
              ref={textareaRef}
              value={instructions}
              onChange={e => { setInstructions(e.target.value); setCopied(false) }}
              maxLength={2000}
              rows={4}
              placeholder={PLACEHOLDER[preset]}
              aria-label="Instruções para o AI"
              className="w-full resize-none rounded-md border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-muted focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-cms-text-muted">
              Contexto do canal será incluído automaticamente abaixo.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS[preset].map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleExampleClick(ex)}
                className="rounded-full border border-indigo-500/30 px-2 py-0.5 text-xs text-indigo-400 transition-colors hover:bg-indigo-500/10"
              >
                {ex}
              </button>
            ))}
          </div>

          {preset === 'video-optimizer' && selectedVideo?.thumbnailUrl && (
            <div className="rounded-md border-l-2 border-amber-500 bg-amber-500/5 p-2 text-xs text-amber-300">
              Para análise de thumbnail: cole a imagem no chat antes do prompt.
            </div>
          )}

          {snapshotAge > STALENESS_THRESHOLDS.warn && (
            <DataFreshnessBadge snapshotAgeHours={snapshotAge} />
          )}

          {loading && <div role="status" aria-live="polite" className="text-center text-xs text-cms-text-muted">Carregando dados do canal…</div>}
          {fetchError && <div role="alert" aria-live="assertive" className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">{fetchError}</div>}

          {prompt && (
            <div>
              <div className="mb-1 text-xs text-cms-text-muted">
                {instructions.trim() && <span>Suas instruções</span>}
              </div>
              <PromptPreview maxHeight="6rem">{instructions.trim()}</PromptPreview>

              <button
                type="button"
                onClick={() => setShowContext(!showContext)}
                aria-expanded={showContext}
                className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
              >
                {showContext ? '▾' : '▸'} Contexto ({charCount.toLocaleString('pt-BR')} caracteres)
              </button>

              {showContext && (
                <PromptPreview maxHeight="12rem" className="mt-1">
                  {prompt.split('<context>')[1]?.split('</context>')[0] ?? ''}
                </PromptPreview>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-cms-border px-5 py-3">
          <div className="text-xs text-cms-text-muted">
            {charCount > 6000 && <span aria-live="polite">{charCount.toLocaleString('pt-BR')} chars</span>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-cms-text-muted hover:text-cms-text">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!prompt || openInClaudeDisabled}
              onClick={() => {
                const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
                window.open(url, '_blank')
              }}
              className="rounded border border-cms-border px-3 py-1.5 text-sm text-cms-text-muted hover:bg-cms-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              title={openInClaudeDisabled ? 'Prompt aparecerá no histórico do navegador' : undefined}
            >
              Abrir no Claude
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!prompt}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? 'Copiado!' : `Copiar Prompt (${shortcutLabel})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
