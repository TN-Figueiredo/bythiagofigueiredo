'use client'

import { useState, useRef } from 'react'
import { Upload, Tag, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { uploadToLibrary, updateLibraryTags, deleteFromLibrary } from '../actions'

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

export function LibraryDashboard({ entries }: { entries: LibraryEntry[] }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const allTags = [...new Set(entries.flatMap(e => e.tags))]
  const filtered = filter ? entries.filter(e => e.tags.includes(filter)) : entries

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('title', file.name.replace(/\.[^.]+$/, ''))
    const result = await uploadToLibrary(fd)
    if (!result.ok) setUploadError(result.error ?? 'Upload failed')
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Thumbnail Library</h2>
        <label className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 cursor-pointer">
          <Upload className="h-4 w-4" />
          {uploading ? 'Enviando...' : 'Upload'}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
      </div>
      {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter(null)} className={`rounded-full px-3 py-1 text-xs ${!filter ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
            Todos ({entries.length})
          </button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setFilter(tag)} className={`rounded-full px-3 py-1 text-xs ${filter === tag ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(entry => (
          <div key={entry.id} className="group rounded-xl border border-zinc-700/50 bg-zinc-900/50 overflow-hidden">
            <div className="relative aspect-video">
              <img src={entry.blob_url} alt={entry.title ?? ''} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => { if (window.confirm('Remover esta thumbnail da biblioteca?')) { deleteFromLibrary(entry.id) } }} className="rounded-full bg-red-600 p-2 text-white">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {entry.source_type === 'test_winner' && (
                <span className="absolute top-1 left-1 rounded bg-green-600 px-1.5 py-0.5 text-[9px] font-bold text-white">WINNER</span>
              )}
            </div>
            <div className="p-3 space-y-1.5">
              <p className="text-xs font-medium text-zinc-200 truncate">{entry.title}</p>
              {entry.video_title && <p className="text-[10px] text-zinc-500 truncate">{entry.video_title}</p>}
              {entry.lift_at_win !== null && (
                <span className={`text-xs font-mono ${entry.lift_at_win > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.lift_at_win > 0 ? '+' : ''}{entry.lift_at_win}% lift
                </span>
              )}
              {/* Longevity dots */}
              {entry.thumbnail_longevity.length > 0 && (
                <div className="flex gap-1.5">
                  {[7, 30, 60, 90].map(days => {
                    const cp = entry.thumbnail_longevity.find(l => l.checkpoint_days === days)
                    if (!cp) return <span key={days} className="h-2 w-2 rounded-full bg-zinc-700" title={`${days}d: pendente`} />
                    const Icon = cp.status === 'growing' ? TrendingUp : cp.status === 'fading' ? TrendingDown : Minus
                    const color = cp.status === 'growing' ? 'text-green-400' : cp.status === 'fading' ? 'text-red-400' : 'text-zinc-400'
                    return <span key={days} title={`${days}d: ${cp.status} (${cp.change_percent ?? 0}%)`}><Icon className={`h-3 w-3 ${color}`} /></span>
                  })}
                </div>
              )}
              {/* Tags */}
              <div className="flex gap-1 flex-wrap">
                {entry.tags.map(tag => (
                  <span key={tag} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-zinc-500 text-sm">
          {entries.length === 0 ? 'Nenhuma thumbnail na biblioteca. Complete testes A/B ou faca upload.' : 'Nenhum resultado para esse filtro.'}
        </div>
      )}
    </div>
  )
}
