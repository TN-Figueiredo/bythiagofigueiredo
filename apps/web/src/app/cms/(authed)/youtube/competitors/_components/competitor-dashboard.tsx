'use client'

import { useState, useRef } from 'react'
import { RefreshCw, Trash2, Bookmark, ArrowRight } from 'lucide-react'
import { addCompetitorChannel, removeCompetitorChannel, syncCompetitorNow, toggleBookmark } from '../actions'
import { CompetitorTabs, type CompetitorTab } from './competitor-tabs'

interface SearchResult {
  channelId: string
  name: string
  thumbnail: string | null
  description: string
}

interface Props {
  activeTab: CompetitorTab
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

export function CompetitorDashboard({ activeTab, channels, changes }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 2) { setSearchResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/youtube/search-channels?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setSearchResults(data.results ?? [])
      } catch {
        setSearchResults([])
      }
      setSearching(false)
    }, 500)
  }

  const handleSelectChannel = async (channelId: string) => {
    setLoading(true)
    setError(null)
    const result = await addCompetitorChannel(channelId)
    if (!result.ok) {
      setError(result.error ?? 'Erro desconhecido')
    }
    setSearchQuery('')
    setSearchResults([])
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-cms-text">Observatório de Competidores</h2>
        <span className="text-xs text-cms-text-dim">{channels.length}/15 canais</span>
      </div>

      <CompetitorTabs activeTab={activeTab} />

      {activeTab === 'canais' && (
        <>
          {/* Search channel */}
          <div className="relative">
            <input
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar canal no YouTube..."
              disabled={loading}
              className="w-full rounded-lg border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim disabled:opacity-50"
            />
            {searching && <span className="absolute right-3 top-2.5 text-xs text-cms-text-dim">Buscando...</span>}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-cms-border bg-cms-surface shadow-xl z-50 overflow-hidden">
                {searchResults.map(result => (
                  <button
                    key={result.channelId}
                    onClick={() => handleSelectChannel(result.channelId)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-cms-surface-hover transition-colors"
                  >
                    {result.thumbnail && <img src={result.thumbnail} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-cms-text truncate">{result.name}</p>
                      <p className="text-xs text-cms-text-dim truncate">{result.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-xs text-cms-red">{error}</p>}

          {/* Channel list */}
          <div className="space-y-2">
            {channels.map(ch => (
              <div key={ch.id} className="flex items-center gap-3 rounded-lg border border-cms-border-subtle bg-cms-surface p-3">
                {ch.thumbnail_url && <img src={ch.thumbnail_url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-cms-text">{ch.channel_name}</p>
                  <p className="text-xs text-cms-text-dim">{ch.subscriber_count?.toLocaleString('pt-BR')} subs</p>
                </div>
                <button onClick={() => syncCompetitorNow(ch.id)} className="rounded p-1.5 text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => removeCompetitorChannel(ch.id)} className="rounded p-1.5 text-cms-text-muted hover:bg-cms-red-subtle hover:text-cms-red">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          {channels.length === 0 && (
            <div className="rounded-lg border border-dashed border-cms-border py-8 text-center">
              <p className="text-sm text-cms-text-muted">Nenhum canal competidor adicionado.</p>
              <p className="text-xs text-cms-text-dim mt-1">Busque acima para adicionar canais e acompanhar mudanças.</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'mudancas' && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-cms-text-muted">Mudanças detectadas</h3>
          {changes.length === 0 && <p className="text-xs text-cms-text-dim">Nenhuma mudança ainda. Sincronize os canais.</p>}
          {changes.map(change => (
            <div key={change.id} className="flex items-start gap-3 rounded-lg border border-cms-border-subtle bg-cms-bg p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    change.change_type === 'thumbnail' ? 'bg-cms-purple-subtle text-cms-purple' :
                    change.change_type === 'title' ? 'bg-cms-accent-subtle text-cms-accent' :
                    'bg-cms-amber-subtle text-cms-amber'
                  }`}>{change.change_type}</span>
                  {change.competitor_videos[0]?.competitor_channels[0]?.channel_name && (
                    <span className="text-xs text-cms-text-muted">{change.competitor_videos[0].competitor_channels[0].channel_name}</span>
                  )}
                  <span className="text-xs text-cms-text-dim">{new Date(change.detected_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {change.competitor_videos[0]?.title && (
                  <p className="mt-0.5 truncate text-xs text-cms-text-muted">{change.competitor_videos[0].title}</p>
                )}
                {change.change_type === 'title' && change.old_title && change.new_title && (
                  <div className="mt-1 text-xs">
                    <span className="text-cms-red line-through">{change.old_title}</span>
                    <ArrowRight className="mx-1 inline h-3 w-3 text-cms-text-dim" />
                    <span className="text-cms-green">{change.new_title}</span>
                  </div>
                )}
                {change.change_type === 'thumbnail' && (
                  <div className="mt-1 flex gap-2">
                    {change.old_thumbnail_url && <img src={change.old_thumbnail_url} alt="antes" referrerPolicy="no-referrer" className="h-12 w-20 rounded object-cover opacity-50" />}
                    {change.new_thumbnail_url && <img src={change.new_thumbnail_url} alt="depois" referrerPolicy="no-referrer" className="h-12 w-20 rounded object-cover" />}
                  </div>
                )}
                {change.view_count_at_change && (
                  <span className="text-[10px] text-cms-text-dim">{change.view_count_at_change.toLocaleString('pt-BR')} views</span>
                )}
              </div>
              <button onClick={() => toggleBookmark(change.id)} className={`rounded p-1 ${change.bookmarked ? 'text-cms-amber' : 'text-cms-text-dim hover:text-cms-text-muted'}`}>
                <Bookmark className="h-4 w-4" fill={change.bookmarked ? 'currentColor' : 'none'} />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'outliers' && (
        <div className="text-center py-12 text-cms-text-dim">
          <p className="text-sm">Sem outliers ainda. Aguarde dados suficientes dos competidores.</p>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="text-center py-12 text-cms-text-dim">
          <p className="text-sm">Dados insuficientes. Adicione competidores e aguarde sync.</p>
        </div>
      )}
    </div>
  )
}
