'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Trash2, Bookmark, ArrowRight } from 'lucide-react'
import { addCompetitorChannel, removeCompetitorChannel, syncCompetitorNow, toggleBookmark } from '../actions'

interface Props {
  channels: Array<{
    id: string
    channel_id: string
    channel_name: string
    thumbnail_url: string | null
    subscriber_count: number | null
    last_synced_at: string | null
  }>
  changes: Array<{
    id: string
    change_type: string
    old_title: string | null
    new_title: string | null
    old_thumbnail_url: string | null
    new_thumbnail_url: string | null
    view_count_at_change: number | null
    detected_at: string
    bookmarked: boolean
    competitor_videos: Array<{
      title: string | null
      video_id: string
      competitor_channels: Array<{
        channel_name: string
      }>
    }>
  }>
}

export function CompetitorDashboard({ channels, changes }: Props) {
  const [newChannelId, setNewChannelId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!newChannelId.trim()) return
    setLoading(true)
    setError(null)
    const result = await addCompetitorChannel(newChannelId.trim())
    if (!result.ok) {
      setError(result.error ?? 'Erro desconhecido')
    } else {
      setNewChannelId('')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Competitor Observatory</h2>
        <span className="text-xs text-zinc-500">{channels.length}/15 canais</span>
      </div>

      {/* Add channel */}
      <div className="flex gap-2">
        <input
          value={newChannelId}
          onChange={e => setNewChannelId(e.target.value)}
          placeholder="Channel ID (ex: UC_x5XG1OV2P6uZZ5FSM9Ttw)"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500"
        />
        <button onClick={handleAdd} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Channel list */}
      <div className="space-y-2">
        {channels.map(ch => (
          <div key={ch.id} className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
            {ch.thumbnail_url && <img src={ch.thumbnail_url} alt="" className="h-8 w-8 rounded-full" />}
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-200">{ch.channel_name}</p>
              <p className="text-xs text-zinc-500">{ch.subscriber_count?.toLocaleString('pt-BR')} subs</p>
            </div>
            <button onClick={() => syncCompetitorNow(ch.id)} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => removeCompetitorChannel(ch.id)} className="rounded p-1.5 text-zinc-400 hover:bg-red-900/30 hover:text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Change feed */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-300">Mudancas detectadas</h3>
        {changes.length === 0 && <p className="text-xs text-zinc-500">Nenhuma mudanca ainda. Sincronize os canais.</p>}
        {changes.map(change => (
          <div key={change.id} className="flex items-start gap-3 rounded-lg border border-zinc-700/30 bg-zinc-900/50 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  change.change_type === 'thumbnail' ? 'bg-purple-500/20 text-purple-400' :
                  change.change_type === 'title' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>{change.change_type}</span>
                {change.competitor_videos[0]?.competitor_channels[0]?.channel_name && (
                  <span className="text-xs text-zinc-400">{change.competitor_videos[0].competitor_channels[0].channel_name}</span>
                )}
                <span className="text-xs text-zinc-500">{new Date(change.detected_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {change.competitor_videos[0]?.title && (
                <p className="mt-0.5 truncate text-xs text-zinc-400">{change.competitor_videos[0].title}</p>
              )}
              {change.change_type === 'title' && change.old_title && change.new_title && (
                <div className="mt-1 text-xs">
                  <span className="text-red-400 line-through">{change.old_title}</span>
                  <ArrowRight className="mx-1 inline h-3 w-3 text-zinc-500" />
                  <span className="text-green-400">{change.new_title}</span>
                </div>
              )}
              {change.change_type === 'thumbnail' && (
                <div className="mt-1 flex gap-2">
                  {change.old_thumbnail_url && <img src={change.old_thumbnail_url} alt="antes" className="h-12 w-20 rounded object-cover opacity-50" />}
                  {change.new_thumbnail_url && <img src={change.new_thumbnail_url} alt="depois" className="h-12 w-20 rounded object-cover" />}
                </div>
              )}
              {change.view_count_at_change && (
                <span className="text-[10px] text-zinc-500">{change.view_count_at_change.toLocaleString('pt-BR')} views</span>
              )}
            </div>
            <button onClick={() => toggleBookmark(change.id)} className={`rounded p-1 ${change.bookmarked ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
              <Bookmark className="h-4 w-4" fill={change.bookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
