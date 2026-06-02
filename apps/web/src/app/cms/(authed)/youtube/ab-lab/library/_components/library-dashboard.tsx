'use client'

import { useState, useRef, useTransition } from 'react'
import { Upload, Tag, Trash2, Pencil, X, Check, Search } from 'lucide-react'
import { toast } from 'sonner'
import { uploadToLibrary, updateLibraryTags, deleteFromLibrary } from '../actions'
import { Longevity } from '../../_components/longevity'
import { LongevityLegend } from '../../_components/longevity-legend'
import { LibEmpty } from '../../_components/lib-empty'
import { AbCreateWizard } from '../../_components/ab-create-wizard'
import type { WizardVideo } from '../../_components/ab-create-wizard'
import { VideoPickerDialog } from '../../_components/video-picker-dialog'
import type { EligibleVideo } from '../../_components/video-picker-dialog'
import type { AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { useRouter } from 'next/navigation'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LongevityCheckpoint {
  checkpoint_days: number
  status: string
  change_percent: number | null
  checked_at: string
}

interface LibraryEntry {
  id: string
  source_type: string
  blob_url: string
  title: string | null
  tags: string[]
  video_title: string | null
  ctr_at_win: number | null
  lift_at_win: number | null
  created_at: string
  thumbnail_longevity: LongevityCheckpoint[]
}

/* ------------------------------------------------------------------ */
/*  Longevity helper — count filled dots from checkpoint data          */
/* ------------------------------------------------------------------ */

function longevityDotCount(checkpoints: LongevityCheckpoint[]): number {
  if (!checkpoints.length) return 0
  const sorted = [...checkpoints].sort((a, b) => a.checkpoint_days - b.checkpoint_days)
  let filled = 0
  for (const cp of sorted) {
    if (cp.status === 'growing' || cp.status === 'stable') {
      filled++
    } else {
      break
    }
  }
  return Math.min(4, Math.max(filled, checkpoints.length > 0 ? 1 : 0))
}

/* ------------------------------------------------------------------ */
/*  Inline Tag Editor                                                  */
/* ------------------------------------------------------------------ */

function InlineTagEditor({ entryId, currentTags }: { entryId: string; currentTags: string[] }) {
  const [editing, setEditing] = useState(false)
  const [tags, setTags] = useState(currentTags)
  const [input, setInput] = useState('')
  const [saving, startTransition] = useTransition()

  const addTag = () => {
    const t = input.trim().toLowerCase()
    if (t && !tags.includes(t) && tags.length < 20) {
      setTags([...tags, t])
    }
    setInput('')
  }

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag))

  const save = () => {
    startTransition(async () => {
      await updateLibraryTags(entryId, tags)
      setEditing(false)
    })
  }

  const cancel = () => {
    setTags(currentTags)
    setInput('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {currentTags.map(tag => (
          <span key={tag} className="lib-tags rounded px-1.5 py-0.5 text-[9px]" style={{ background: 'var(--cms-surface)', color: 'var(--cms-text-muted)' }}>{tag}</span>
        ))}
        <button onClick={() => setEditing(true)} className="rounded p-0.5" style={{ color: 'var(--cms-text-dim)' }} title="Editar tags">
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 flex-wrap">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px]" style={{ background: 'var(--cms-surface-hover)', color: 'var(--cms-text)' }}>
            {tag}
            <button onClick={() => removeTag(tag)} style={{ color: 'var(--cms-text-dim)' }}><X className="h-2.5 w-2.5" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder="Nova tag..."
          className="flex-1 min-w-0 rounded border px-1.5 py-0.5 text-[10px]"
          style={{ borderColor: 'var(--cms-border)', background: 'var(--cms-bg)', color: 'var(--cms-text)' }}
        />
        <button onClick={save} disabled={saving} className="rounded p-1 text-white disabled:opacity-50" style={{ background: '#16a34a' }}>
          <Check className="h-3 w-3" />
        </button>
        <button onClick={cancel} className="rounded p-1" style={{ background: 'var(--cms-surface-hover)', color: 'var(--cms-text-muted)' }}>
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface LibraryDashboardProps {
  entries: LibraryEntry[]
  /** Wizard prerequisites — both optional; when missing, wizard tab is disabled */
  wizardSettings?: AbTestSiteSettings
  wizardEligibleVideos?: EligibleVideo[]
  siteId?: string
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function LibraryDashboard({
  entries,
  wizardSettings,
  wizardEligibleVideos,
  siteId,
}: LibraryDashboardProps) {
  const router = useRouter()
  const [activeView, setActiveView] = useState<'library' | 'wizard'>('library')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Wizard state
  const [selectedVideo, setSelectedVideo] = useState<WizardVideo | null>(null)
  const [showVideoPicker, setShowVideoPicker] = useState(false)

  const allTags = [...new Set(entries.flatMap(e => e.tags))]

  const filtered = entries.filter(e => {
    if (filter && !e.tags.includes(filter)) return false
    if (search) {
      const q = search.toLowerCase()
      const matchesTitle = e.title?.toLowerCase().includes(q)
      const matchesVideoTitle = e.video_title?.toLowerCase().includes(q)
      const matchesTags = e.tags.some(t => t.includes(q))
      if (!matchesTitle && !matchesVideoTitle && !matchesTags) return false
    }
    return true
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('title', file.name.replace(/\.[^.]+$/, ''))
    const result = await uploadToLibrary(fd)
    if (!result.ok) {
      setUploadError(result.error ?? 'Upload failed')
      toast.error(result.error ?? 'Upload failed')
    } else {
      toast.success('Thumbnail adicionada a biblioteca')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remover esta thumbnail da biblioteca?')) return
    const result = await deleteFromLibrary(id)
    if (result.ok) {
      toast.success('Thumbnail removida')
    } else {
      toast.error(result.error ?? 'Erro ao remover')
    }
  }

  const triggerUpload = () => fileRef.current?.click()

  const canWizard = !!wizardSettings && !!wizardEligibleVideos && !!siteId

  // If wizard is active and a video is selected, show the wizard
  if (activeView === 'wizard' && selectedVideo && canWizard) {
    return (
      <div className="fade-in" key="wizard-active">
        <AbCreateWizard
          video={selectedVideo}
          siteId={siteId!}
          settings={wizardSettings!}
          onClose={() => setSelectedVideo(null)}
          onCreated={(testId) => router.push(`/cms/youtube/ab-lab/${testId}`)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {/* Header: seg-pills toggle + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Seg-pills */}
        <div className="seg-pills" role="radiogroup" aria-label="Modo de visualizacao">
          <button
            type="button"
            role="radio"
            aria-checked={activeView === 'library'}
            className={`seg-pill${activeView === 'library' ? ' on' : ''}`}
            onClick={() => setActiveView('library')}
          >
            Biblioteca
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={activeView === 'wizard'}
            className={`seg-pill${activeView === 'wizard' ? ' on' : ''}`}
            onClick={() => setActiveView('wizard')}
            disabled={!canWizard}
          >
            Wizard
          </button>
        </div>

        {/* Right actions */}
        {activeView === 'library' && (
          <div className="flex items-center gap-3">
            <LongevityLegend />
            <button
              type="button"
              onClick={triggerUpload}
              disabled={uploading}
              className="btn primary sm"
            >
              <Upload size={14} aria-hidden="true" />
              {uploading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        )}
      </div>

      {uploadError && <p className="text-xs" style={{ color: 'var(--cms-red, #ef4444)' }}>{uploadError}</p>}

      {/* ── LIBRARY VIEW ── */}
      {activeView === 'library' && (
        <div className="fade-in" key="library">
          {entries.length === 0 ? (
            <LibEmpty
              onUpload={triggerUpload}
              onCreateTest={() => {
                if (canWizard) {
                  setActiveView('wizard')
                } else {
                  router.push('/cms/youtube/ab-lab/new')
                }
              }}
            />
          ) : (
            <>
              {/* Search + tag filter bar */}
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 360 }}>
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--cms-text-dim)' }}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    placeholder="Buscar thumbs..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border"
                    style={{
                      borderColor: 'var(--cms-border)',
                      background: 'var(--cms-bg)',
                      color: 'var(--cms-text)',
                    }}
                  />
                </div>
                {allTags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setFilter(null)}
                      className={`chip${!filter ? ' on' : ''}`}
                      style={{ padding: '4px 10px', fontSize: 11 }}
                    >
                      Todos ({entries.length})
                    </button>
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setFilter(filter === tag ? null : tag)}
                        className={`chip${filter === tag ? ' on' : ''}`}
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Library grid */}
              <div className="lib-grid stagger">
                {filtered.map(entry => {
                  const dots = longevityDotCount(entry.thumbnail_longevity)
                  return (
                    <div
                      key={entry.id}
                      className="lib-card"
                      style={{
                        borderRadius: 'var(--radius, 14px)',
                        border: '1px solid var(--cms-border, #332D25)',
                        background: 'var(--cms-bg, #1A1714)',
                        overflow: 'hidden',
                        cursor: 'default',
                      }}
                    >
                      {/* Thumb with hover overlay */}
                      <div
                        className="lib-thumb-wrap"
                        style={{ position: 'relative', aspectRatio: '16/9' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={entry.blob_url}
                          alt={entry.title ?? ''}
                          className="h-full w-full object-cover"
                          style={{ display: 'block' }}
                        />
                        {/* Winner badge */}
                        {entry.source_type === 'test_winner' && (
                          <span
                            className="absolute rounded font-bold text-white"
                            style={{
                              top: 6,
                              left: 6,
                              background: '#16a34a',
                              padding: '2px 6px',
                              fontSize: 9,
                            }}
                          >
                            WINNER
                          </span>
                        )}
                        {/* Lift badge */}
                        {entry.lift_at_win !== null && (
                          <span
                            className="lib-lift absolute rounded font-mono font-semibold"
                            style={{
                              top: 6,
                              right: 6,
                              padding: '2px 6px',
                              fontSize: 10,
                              background: entry.lift_at_win > 0
                                ? 'rgba(34,197,94,0.2)'
                                : 'rgba(239,68,68,0.2)',
                              color: entry.lift_at_win > 0
                                ? '#4ade80'
                                : '#f87171',
                            }}
                          >
                            {entry.lift_at_win > 0 ? '+' : ''}{entry.lift_at_win}%
                          </span>
                        )}
                        {/* Hover overlay (lib-hover from youtube-motion.css) */}
                        <div className="lib-hover">
                          <button
                            type="button"
                            onClick={() => {
                              if (canWizard) {
                                setActiveView('wizard')
                              }
                            }}
                            className="btn primary sm"
                          >
                            Usar no teste
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            className="btn icon sm danger"
                            aria-label="Excluir thumbnail"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="lib-body space-y-1.5" style={{ padding: '11px 13px 13px' }}>
                        <p
                          className="truncate"
                          style={{ fontSize: 12, fontWeight: 500, color: 'var(--cms-text)' }}
                        >
                          {entry.title}
                        </p>
                        {entry.video_title && (
                          <p
                            className="truncate"
                            style={{ fontSize: 10, color: 'var(--cms-text-dim)' }}
                          >
                            {entry.video_title}
                          </p>
                        )}

                        {/* Longevity dots */}
                        <div className="flex items-center gap-2">
                          <Longevity n={dots} size={6} />
                        </div>

                        {/* Tags */}
                        <InlineTagEditor entryId={entry.id} currentTags={entry.tags} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* No results for filter */}
              {filtered.length === 0 && entries.length > 0 && (
                <div
                  className="text-center py-8"
                  style={{ fontSize: 13, color: 'var(--cms-text-dim)' }}
                >
                  Nenhum resultado para esse filtro.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── WIZARD VIEW (video picker) ── */}
      {activeView === 'wizard' && !selectedVideo && (
        <div className="fade-in" key="wizard-picker">
          <div className="flex flex-col items-center text-center py-12 px-4">
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--cms-text)',
                margin: '0 0 6px 0',
              }}
            >
              Criar novo teste A/B
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--cms-text-dim)',
                margin: '0 0 20px 0',
              }}
            >
              Selecione um video para comecar o wizard.
            </p>
            <button
              type="button"
              onClick={() => setShowVideoPicker(true)}
              className="btn primary"
            >
              Selecionar video
            </button>
          </div>

          {showVideoPicker && canWizard && (
            <VideoPickerDialog
              eligibleVideos={wizardEligibleVideos!}
              onSelect={(video) => {
                setSelectedVideo(video)
                setShowVideoPicker(false)
              }}
              onClose={() => setShowVideoPicker(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}
