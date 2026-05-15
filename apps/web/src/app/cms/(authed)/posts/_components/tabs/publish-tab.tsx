'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { usePostEditor } from '../post-editor-context'
import { SectionBar } from '../section-bar'
import { schedulePost, publishPost, savePostPublishSettings } from '../../actions'
import type { SectionStatus, PostTab } from '@/lib/posts/types'

export function PublishTab() {
  const router = useRouter()
  const { state, dispatch } = usePostEditor()
  const { post, activeLocale } = state
  const tx = post.translations.find(t => t.locale === activeLocale) ?? post.translations[0]

  const [scheduleDate, setScheduleDate] = useState(() => {
    if (!post.scheduledAt) return ''
    return new Date(post.scheduledAt).toISOString().slice(0, 10)
  })
  const [scheduleTime, setScheduleTime] = useState(() => {
    if (!post.scheduledAt) return '09:00'
    return new Date(post.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  })
  const [timezone] = useState('America/Sao_Paulo')
  const [includeNewsletter, setIncludeNewsletter] = useState(post.includeInNewsletter)
  const [isSaving, setIsSaving] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const handleSchedule = useCallback(async () => {
    if (!scheduleDate) { toast.error('Selecione uma data'); return }
    setIsScheduling(true)
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
    const result = await schedulePost(post.id, scheduledAt, timezone)
    setIsScheduling(false)
    if (result.ok) {
      toast.success('Post agendado!')
      dispatch({ type: 'SAVE_TAB', tab: 'publish' })
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }, [post.id, scheduleDate, scheduleTime, timezone, dispatch, router])

  const handlePublish = useCallback(async () => {
    if (!confirm('Publicar imediatamente? O post ficará visível no /blog e os posts sociais serão disparados.')) return
    setIsPublishing(true)
    const result = await publishPost(post.id)
    setIsPublishing(false)
    if (result.ok) {
      toast.success('Post publicado!')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }, [post.id, router])

  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true)
    const result = await savePostPublishSettings(post.id, { includeInNewsletter: includeNewsletter })
    setIsSaving(false)
    if (result.ok) {
      dispatch({ type: 'SAVE_TAB', tab: 'publish' })
      toast.success('Configurações salvas')
    } else {
      toast.error(result.error)
    }
  }, [post.id, includeNewsletter, dispatch])

  useEffect(() => {
    const handler = () => { if (state.dirty.publish) void handleSaveSettings() }
    document.addEventListener('posts:save-tab', handler)
    return () => document.removeEventListener('posts:save-tab', handler)
  }, [handleSaveSettings, state.dirty.publish])

  const socialConfig = post.socialConfig
  const configuredPlatforms = socialConfig?.enabled ? socialConfig.platforms.length : 0
  const hasMultiLang = post.translations.length > 1
  const sectionStatus: SectionStatus = post.scheduledAt ? 'done' : scheduleDate ? 'warn' : 'empty'

  const reviewItems: Array<{ label: string; value: string; ok: boolean; tab?: PostTab }> = [
    { label: 'Conteúdo', value: tx?.title ? `rev.${post.translations.length}` : 'Vazio', ok: !!(tx?.title && tx?.contentMdx), tab: 'content' },
    { label: 'Imagens', value: post.coverImageUrl ? '1 img' : 'Sem capa', ok: !!post.coverImageUrl, tab: 'images' },
    { label: 'SEO', value: tx?.metaTitle ? 'Configurado' : 'Pendente', ok: !!(tx?.metaTitle && tx?.metaDescription), tab: 'seo' },
    { label: 'Social', value: configuredPlatforms > 0 ? `${configuredPlatforms} de 4` : 'Não configurado', ok: configuredPlatforms > 0, tab: 'social' },
    { label: 'Data', value: scheduleDate ? `${scheduleDate} ${scheduleTime}` : 'Não definida', ok: !!scheduleDate },
    { label: 'Newsletter', value: includeNewsletter ? 'Incluído' : 'Não incluído', ok: true },
  ]

  return (
    <div className="flex flex-col gap-4">
      <SectionBar label="Publicação" status={sectionStatus} isDirty={state.dirty.publish} isSaving={isSaving} onSave={handleSaveSettings} />

      {/* Schedule Hero */}
      <div className="rounded-xl p-5" style={{ background: 'var(--gem-surface)', border: '1px solid var(--gem-border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-lg">📅</span>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--gem-text)' }}>Agendamento</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--gem-dim)' }}>Data</label>
            <input
              type="date"
              value={scheduleDate}
              onChange={e => { setScheduleDate(e.target.value); dispatch({ type: 'SET_DIRTY', tab: 'publish', dirty: true }) }}
              className="w-full bg-transparent rounded border px-2 py-1.5 text-xs focus:border-[var(--gem-accent)] focus:outline-none"
              style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-text)' }}
            />
          </div>
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--gem-dim)' }}>Horário</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={e => { setScheduleTime(e.target.value); dispatch({ type: 'SET_DIRTY', tab: 'publish', dirty: true }) }}
              className="w-full bg-transparent rounded border px-2 py-1.5 text-xs focus:border-[var(--gem-accent)] focus:outline-none"
              style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-text)' }}
            />
          </div>
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--gem-dim)' }}>Fuso</label>
            <div className="text-[10px] px-2 py-2 rounded border" style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}>
              BRT (UTC−3)
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSchedule}
            disabled={isScheduling || !scheduleDate}
            className="flex-1 text-xs py-2 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--gem-accent), #6366f1)', color: 'white' }}
          >
            {isScheduling ? 'Agendando...' : scheduleDate ? `Agendar para ${scheduleDate} às ${scheduleTime}` : 'Selecione uma data'}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="text-xs px-4 py-2 rounded-lg border font-medium transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
            style={{ borderColor: 'var(--gem-done)', color: 'var(--gem-done)' }}
          >
            {isPublishing ? 'Publicando...' : 'Publicar agora'}
          </button>
        </div>
      </div>

      {/* Multi-Lang Timeline */}
      {hasMultiLang && scheduleDate && (
        <div className="rounded-lg border p-4" style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--gem-dim)' }}>Timeline Multi-Idioma</h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>PT</span>
              <p className="text-[10px] mt-1" style={{ color: 'var(--gem-muted)' }}>{scheduleTime}</p>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-8 h-px" style={{ background: 'var(--gem-border)' }} />
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>+30 min</span>
              <div className="w-8 h-px" style={{ background: 'var(--gem-border)' }} />
            </div>
            <div className="flex-1 text-center">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>EN</span>
              <p className="text-[10px] mt-1" style={{ color: 'var(--gem-muted)' }}>
                {(() => {
                  const parts = scheduleTime.split(':').map(Number)
                  const d = new Date(2000, 0, 1, parts[0] ?? 9, (parts[1] ?? 0) + 30)
                  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                })()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Distribuição */}
      <div className="rounded-lg border p-4" style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--gem-dim)' }}>Distribuição</h4>
        <div className="space-y-2">
          {configuredPlatforms > 0 && socialConfig?.platforms.map(p => (
            <div key={p} className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--gem-muted)' }}>{p}</span>
              <button type="button" onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'social' })} className="text-[10px] hover:underline" style={{ color: 'var(--gem-accent)' }}>Editar</button>
            </div>
          ))}
          <div className="border-t pt-2 mt-2" style={{ borderColor: 'var(--gem-border)' }}>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>Incluir na próxima newsletter</span>
              <input
                type="checkbox"
                checked={includeNewsletter}
                onChange={e => { setIncludeNewsletter(e.target.checked); dispatch({ type: 'SET_DIRTY', tab: 'publish', dirty: true }) }}
                className="rounded border-slate-600 w-3.5 h-3.5 accent-emerald-500"
              />
            </label>
            <p className="text-[9px] mt-1" style={{ color: 'var(--gem-dim)' }}>Vários posts podem ser incluídos na mesma edição quinzenal</p>
          </div>
        </div>
      </div>

      {/* Pre-Publish Review */}
      <div className="rounded-lg border p-4" style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--gem-dim)' }}>Revisão Pré-Publicação</h4>
        <div className="grid grid-cols-3 gap-2">
          {reviewItems.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => item.tab && dispatch({ type: 'SET_ACTIVE_TAB', tab: item.tab })}
              className="rounded-lg border p-2.5 text-left transition-colors hover:border-[var(--gem-accent)]"
              style={{
                borderColor: 'var(--gem-border)',
                borderLeft: `3px solid ${item.ok ? 'var(--gem-done)' : 'var(--gem-warn)'}`,
                cursor: item.tab ? 'pointer' : 'default',
              }}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.ok ? 'var(--gem-done)' : 'var(--gem-warn)' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--gem-text)' }}>{item.label}</span>
              </span>
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--gem-dim)' }}>{item.value}</p>
            </button>
          ))}
        </div>
      </div>

      {/* URL & Visibilidade */}
      <div className="rounded-lg border p-4" style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--gem-dim)' }}>URL & Visibilidade</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] rounded px-2 py-1.5" style={{ background: 'var(--gem-well)' }}>
            <span className="px-1 py-0.5 rounded text-[8px] font-bold" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>Preview</span>
            <span style={{ color: 'var(--gem-dim)' }}>bythiagofigueiredo.com/blog/{tx?.slug ?? '...'}</span>
          </div>
          <p className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>O post só existe publicamente após a publicação.</p>
        </div>
      </div>
    </div>
  )
}
