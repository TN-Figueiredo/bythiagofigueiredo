'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SafeConnection } from '@/lib/social/actions'
import { createSocialPost, generateAICaption } from '@/lib/social/actions'
import { DEST_IDS, DESTINATIONS, type DestId } from '@/lib/social/destinations'
import { useComposer, type AISuggestion } from './use-composer'
import { useComposerPersistence } from './use-composer-persistence'
import { DestCard } from './dest-card'
import { CaptionEditor } from './caption-editor'
import { AICaptionBlock } from './ai-caption-block'
import { TranslateButton } from './translate-button'
import { LivePreview } from './live-preview'
import { CanvasEmbed } from './canvas-embed'
import { CMSPicker } from './cms-picker'
import { SchedulePanel } from './schedule-panel'
import { socialToast } from '../../_components/shared/social-toast'

const SCHED_LABELS = { now: 'Agora', schedule: 'Agendar', queue: 'Fila' } as const
const PUBLISH_LABELS = { now: 'Publicar', schedule: 'Agendar', queue: 'Adicionar a fila' } as const

interface ComposerShellV2Props {
  connections: SafeConnection[]
  initialMode: 'cms' | 'blank'
  draftId?: string
  siteId: string
}

export function ComposerShellV2({ connections, initialMode, draftId, siteId }: ComposerShellV2Props) {
  const router = useRouter()
  const composer = useComposer(initialMode)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [bestTimes, setBestTimes] = useState<Record<string, string[]>>({})

  const { clearPersistence } = useComposerPersistence({
    state: {
      mode: composer.mode,
      lang: composer.lang,
      destsOn: composer.destsOn,
      focused: composer.focused,
      captions: composer.captions,
      poll: composer.poll,
      sched: composer.sched,
      schedDate: composer.schedDate,
      schedTime: composer.schedTime,
      publishing: composer.publishing,
      cmsPicked: composer.cmsPicked,
      aiData: composer.aiData,
      aiLoading: composer.aiLoading,
      design: composer.design,
    },
    draftId,
    onRestore: (saved) => {
      if (saved.mode) composer.setMode(saved.mode)
      if (saved.lang) composer.setLang(saved.lang)
      if (saved.focused) composer.focusDest(saved.focused)
      if (saved.sched) composer.setSched(saved.sched)
      if (saved.schedDate) composer.setSchedDate(saved.schedDate)
      if (saved.schedTime) composer.setSchedTime(saved.schedTime)
    },
  })

  const handleGenerateCaption = useCallback(async (
    destId: DestId, lang: 'pt' | 'en', source?: { title: string; excerpt: string | null; url?: string }
  ): Promise<AISuggestion | null> => {
    const result = await generateAICaption(destId, lang, source)
    if (result.ok) return result.data
    return null
  }, [])

  const handleApplyVariation = useCallback((text: string) => {
    composer.setCaption(composer.focused, composer.lang, text)
  }, [composer.setCaption, composer.focused, composer.lang])

  const handleApplyHashtags = useCallback((tags: string[]) => {
    const current = composer.getCaption(composer.focused, composer.lang)
    const hashtagStr = tags.map(t => `#${t}`).join(' ')
    composer.setCaption(composer.focused, composer.lang, `${current}\n\n${hashtagStr}`)
  }, [composer.getCaption, composer.setCaption, composer.focused, composer.lang])

  const handleApplyBestTime = useCallback((time: string) => {
    composer.setSched('schedule')
    composer.setSchedTime(time)
  }, [composer.setSched, composer.setSchedTime])

  const handleTranslated = useCallback((text: string, lang: 'pt' | 'en') => {
    composer.setCaption(composer.focused, lang, text)
    composer.setLang(lang)
  }, [composer.setCaption, composer.focused, composer.setLang])

  const handlePublish = useCallback(async () => {
    if (composer.activeDests.length === 0) return
    composer.setPublishing(true)

    const content: Record<string, unknown> = {
      title: composer.getCaption(composer.focused, composer.lang),
      description: composer.getCaption(composer.focused, composer.lang),
    }

    if (composer.cmsPicked) {
      content.source_content_id = composer.cmsPicked.id
      content.title = composer.cmsPicked.title
    }

    const platforms = [...new Set(
      composer.activeDests.map(id => DESTINATIONS[id].provider)
    )]

    const result = await createSocialPost({
      type: 'text',
      content,
      platforms,
      scheduledAt: composer.sched === 'schedule' && composer.schedDate && composer.schedTime
        ? new Date(`${composer.schedDate}T${composer.schedTime}:00`).toISOString()
        : undefined,
    })

    composer.setPublishing(false)

    if (result.ok) {
      clearPersistence()
      socialToast(composer.sched === 'schedule' ? 'post_scheduled' : 'post_published')
      router.push('/cms/social')
    } else {
      socialToast('publish_failed', 'Erro ao publicar')
    }
  }, [composer.activeDests, composer.setPublishing, composer.getCaption, composer.focused, composer.lang, composer.cmsPicked, composer.sched, composer.schedDate, composer.schedTime, clearPersistence, router])

  const focusedDest = DESTINATIONS[composer.focused]
  const currentCaption = composer.getCaption(composer.focused, composer.lang)
  const accountName = connections.find(c => c.provider === focusedDest.provider)?.account_name ?? '@conta'

  return (
    <div className="mt-6">
      {/* Mode selector */}
      <div className="mb-6 flex gap-1 rounded-lg bg-cms-surface p-1 w-fit" role="radiogroup" aria-label="Modo de criacao">
        <button
          role="radio"
          aria-checked={composer.mode === 'cms'}
          onClick={() => composer.setMode('cms')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            composer.mode === 'cms' ? 'bg-cms-bg text-cms-text shadow-sm' : 'text-cms-text-muted'
          }`}
        >
          Do CMS
        </button>
        <button
          role="radio"
          aria-checked={composer.mode === 'blank'}
          onClick={() => composer.setMode('blank')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            composer.mode === 'blank' ? 'bg-cms-bg text-cms-text shadow-sm' : 'text-cms-text-muted'
          }`}
        >
          Em branco
        </button>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Build column */}
        <div className="space-y-6">
          {/* CMS Picker (only in CMS mode) */}
          {composer.mode === 'cms' && (
            <CMSPicker siteId={siteId} onSelect={composer.setCmsPicked} />
          )}

          {/* Destination cards */}
          <div>
            <p className="mb-2 text-xs font-medium text-cms-text-dim">Destinos</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="listbox" aria-label="Destinos">
              {DEST_IDS.map(id => (
                <DestCard
                  key={id}
                  destId={id}
                  isOn={composer.destsOn[id]}
                  isFocused={composer.focused === id}
                  onToggle={composer.toggleDest}
                  onFocus={composer.focusDest}
                />
              ))}
            </div>
          </div>

          {/* Destination-specific header */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: focusedDest.tint }} />
            <p className="text-sm font-medium text-cms-text">
              {focusedDest.label} {focusedDest.sublabel}
            </p>
            <span className="text-xs text-cms-text-dim">{focusedDest.ratio}</span>
          </div>

          {/* Canvas embed (for visual destinations) */}
          {composer.focused !== 'yt_community' && (
            <CanvasEmbed thumbnailUrl={null} onOpenEditor={() => setCanvasOpen(true)} />
          )}

          {/* Caption editor */}
          <CaptionEditor
            destId={composer.focused}
            value={currentCaption}
            onChange={(val) => composer.setCaption(composer.focused, composer.lang, val)}
            onAddPoll={composer.focused === 'yt_community' ? () => composer.setPoll({ options: ['', ''], durationHours: 24 }) : undefined}
          />

          {/* Language + AI row */}
          <div className="flex items-center gap-3">
            <TranslateButton
              text={currentCaption}
              currentLang={composer.lang}
              onTranslated={handleTranslated}
            />
            <AICaptionBlock
              destId={composer.focused}
              lang={composer.lang}
              source={composer.cmsPicked ? { title: composer.cmsPicked.title, excerpt: composer.cmsPicked.excerpt } : undefined}
              onApplyVariation={handleApplyVariation}
              onApplyHashtags={handleApplyHashtags}
              onApplyBestTime={handleApplyBestTime}
              onGenerateCaption={handleGenerateCaption}
            />
          </div>
        </div>

        {/* Right: Preview column */}
        <div className="hidden lg:block">
          <LivePreview
            destId={composer.focused}
            caption={currentCaption}
            imageUrl={null}
            accountName={accountName}
          />
        </div>
      </div>

      {/* Schedule panel (expands when schedule mode is selected) */}
      {composer.sched === 'schedule' && (
        <div className="mt-6">
          <SchedulePanel
            selectedDate={composer.schedDate}
            selectedTime={composer.schedTime}
            onSelectDate={composer.setSchedDate}
            onSelectTime={composer.setSchedTime}
            bestTimes={bestTimes}
          />
        </div>
      )}

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-10 mt-6 -mx-6 border-t border-cms-border bg-cms-bg/95 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between" role="toolbar" aria-label="Acoes do post">
          {/* Schedule mode selector */}
          <div className="flex gap-1 rounded-lg bg-cms-surface p-1" role="radiogroup" aria-label="Modo de agendamento">
            {(['now', 'schedule', 'queue'] as const).map(mode => (
              <button
                key={mode}
                role="radio"
                aria-checked={composer.sched === mode}
                onClick={() => composer.setSched(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  composer.sched === mode ? 'bg-cms-bg text-cms-text shadow-sm' : 'text-cms-text-muted'
                }`}
              >
                {SCHED_LABELS[mode]}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                socialToast('draft_saved')
                clearPersistence()
              }}
              className="rounded-lg border border-cms-border px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface transition-colors"
            >
              Salvar rascunho
            </button>
            <button
              onClick={handlePublish}
              disabled={composer.publishing || composer.activeDests.length === 0}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                composer.sched === 'now' ? 'bg-green-600 hover:bg-green-700' : 'bg-cms-accent hover:bg-cms-accent-hover'
              }`}
            >
              {composer.publishing ? 'Publicando...' : PUBLISH_LABELS[composer.sched]}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
