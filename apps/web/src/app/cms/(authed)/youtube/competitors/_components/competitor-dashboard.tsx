'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Trash2, Bookmark, ArrowRight, Eye } from 'lucide-react'
import { addCompetitorChannel, removeCompetitorChannel, syncCompetitorNow, toggleBookmark } from '../actions'

interface SearchResult {
  channelId: string
  name: string
  thumbnail: string | null
  description: string
}

interface OutlierItem {
  video: {
    id: string
    video_id: string
    title: string | null
    thumbnail_url: string | null
    view_count: number | null
    published_at: string | null
  }
  channelName: string
  channelThumb: string | null
  multiplier: number
}

interface Props {
  channels: Array<{
    id: string
    channel_id: string
    channel_name: string
    thumbnail_url: string | null
    subscriber_count: number | null
    last_synced_at: string | null
    videos: Array<{
      id: string
      video_id: string
      title: string | null
      thumbnail_url: string | null
      view_count: number | null
      published_at: string | null
    }>
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
  activeTab: TabId
  outliers: OutlierItem[]
  insights: {
    uploadsByDay: number[]
    dayLabels: string[]
    topTags: [string, number][]
    engagementByChannel: Array<{ name: string; avgViews: number; videoCount: number }>
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('pt-BR')
}

type TabId = 'canais' | 'mudancas' | 'outliers' | 'insights'

export function CompetitorDashboard({ activeTab, channels, changes, outliers, insights }: Props) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null)
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

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'canais', label: 'Canais', count: channels.length },
    { id: 'mudancas', label: 'Mudanças', count: changes.length },
    { id: 'outliers', label: 'Outliers', count: outliers.length },
    { id: 'insights', label: 'Insights' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-cms-text">Observatório de Competidores</h2>
        <span className="text-xs text-cms-text-dim">{channels.length}/15 canais</span>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-cms-border/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => router.push(`/cms/youtube/competitors?tab=${tab.id}`)}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-cms-text text-cms-text'
                : 'border-transparent text-cms-text-dim hover:text-cms-text'
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="ml-1.5 rounded-full bg-cms-surface-hover px-1.5 py-0.5 text-[10px] font-normal">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Canais tab */}
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
          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Channel list */}
          <div className="space-y-3">
            {channels.map(ch => {
              const isExpanded = expandedChannel === ch.id
              return (
                <div key={ch.id} className="rounded-xl border border-cms-border/50 bg-cms-surface/50 overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    {ch.thumbnail_url && <img src={ch.thumbnail_url} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-cms-text">{ch.channel_name}</p>
                      <div className="flex items-center gap-3 text-xs text-cms-text-dim">
                        {ch.subscriber_count != null && <span>{formatCount(ch.subscriber_count)} subs</span>}
                        {ch.videos.length > 0 && <span>{ch.videos.length} vídeos</span>}
                      </div>
                    </div>
                    <button onClick={() => setExpandedChannel(isExpanded ? null : ch.id)} className="rounded p-1.5 text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text" title={isExpanded ? 'Recolher' : 'Ver vídeos'}>
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => syncCompetitorNow(ch.id)} className="rounded p-1.5 text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeCompetitorChannel(ch.id)} className="rounded p-1.5 text-cms-text-muted hover:bg-red-900/30 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {isExpanded && ch.videos.length > 0 && (
                    <div className="border-t border-cms-border/30 px-3 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {ch.videos.map(v => (
                          <a key={v.id} href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noopener noreferrer" className="group rounded-lg border border-cms-border/30 bg-cms-bg/50 overflow-hidden hover:border-cms-accent/40 transition-colors">
                            {v.thumbnail_url ? (
                              <img src={v.thumbnail_url} alt={v.title ?? ''} referrerPolicy="no-referrer" className="w-full aspect-video object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full aspect-video bg-cms-bg flex items-center justify-center text-cms-text-dim text-[10px]">Sem thumb</div>
                            )}
                            <div className="p-1.5">
                              <p className="text-[10px] font-medium text-cms-text line-clamp-2 group-hover:text-cms-accent">{v.title}</p>
                              <span className="text-[9px] text-cms-text-dim">{v.view_count != null ? formatCount(v.view_count) + ' views' : ''}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {isExpanded && ch.videos.length === 0 && (
                    <div className="border-t border-cms-border/30 px-3 py-4 text-center text-xs text-cms-text-dim">Nenhum vídeo. Sincronize o canal.</div>
                  )}
                </div>
              )
            })}
          </div>
          {channels.length === 0 && (
            <div className="rounded-lg border border-dashed border-cms-border py-8 text-center">
              <p className="text-sm text-cms-text-muted">Nenhum canal competidor adicionado.</p>
              <p className="text-xs text-cms-text-dim mt-1">Busque acima para adicionar canais e acompanhar mudanças.</p>
            </div>
          )}
        </>
      )}

      {/* Mudanças tab */}
      {activeTab === 'mudancas' && (
        <div className="space-y-2">
          {changes.length === 0 && <p className="text-xs text-cms-text-dim">Nenhuma mudanca ainda. Sincronize os canais.</p>}
          {changes.map(change => (
            <div key={change.id} className="flex items-start gap-3 rounded-lg border border-cms-border/30 bg-cms-bg/50 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    change.change_type === 'thumbnail' ? 'bg-purple-500/20 text-purple-400' :
                    change.change_type === 'title' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-amber-500/20 text-amber-400'
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
                    <span className="text-red-400 line-through">{change.old_title}</span>
                    <ArrowRight className="mx-1 inline h-3 w-3 text-cms-text-dim" />
                    <span className="text-green-400">{change.new_title}</span>
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
              <button onClick={() => toggleBookmark(change.id)} className={`rounded p-1 ${change.bookmarked ? 'text-yellow-400' : 'text-cms-text-dim hover:text-cms-text-muted'}`}>
                <Bookmark className="h-4 w-4" fill={change.bookmarked ? 'currentColor' : 'none'} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Outliers tab */}
      {activeTab === 'outliers' && (
        outliers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {outliers.map(o => (
              <a
                key={o.video.id}
                href={`https://www.youtube.com/watch?v=${o.video.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-cms-border/50 bg-cms-surface/50 overflow-hidden hover:border-cms-accent/40 transition-colors"
              >
                <div className="relative">
                  {o.video.thumbnail_url ? (
                    <img src={o.video.thumbnail_url} alt="" referrerPolicy="no-referrer" className="w-full aspect-video object-cover" />
                  ) : (
                    <div className="w-full aspect-video bg-cms-bg flex items-center justify-center text-cms-text-dim text-xs">Sem thumbnail</div>
                  )}
                  <span className={`absolute top-2 right-2 rounded-lg px-2 py-1 font-mono text-sm font-bold ${
                    o.multiplier >= 10 ? 'bg-red-500/90 text-white' :
                    o.multiplier >= 5 ? 'bg-purple-500/90 text-white' :
                    'bg-blue-500/90 text-white'
                  }`}>
                    {o.multiplier.toFixed(1)}x
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-cms-text line-clamp-2 group-hover:text-cms-text">{o.video.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {o.channelThumb && <img src={o.channelThumb} alt="" referrerPolicy="no-referrer" className="h-4 w-4 rounded-full" />}
                    <span className="text-[10px] text-cms-text-dim">{o.channelName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-cms-text-dim">
                    {o.video.view_count != null && <span>{formatCount(o.video.view_count)} views</span>}
                    {o.video.published_at && <span>{new Date(o.video.published_at).toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-cms-text-dim">
            <p className="text-sm">Sem outliers nos competidores trackeados.</p>
            <p className="text-xs mt-1">Adicione mais canais e aguarde dados suficientes (minimo 3 videos por canal).</p>
          </div>
        )
      )}

      {/* Insights tab — placeholder */}
      {activeTab === 'insights' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-medium text-cms-text mb-3">Frequência de Upload</h3>
            <div className="flex gap-2 items-end h-32">
              {insights.uploadsByDay.map((count, i) => {
                const max = Math.max(...insights.uploadsByDay, 1)
                const height = (count / max) * 100
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-cms-accent/60 transition-all" style={{ height: `${height}%` }} />
                    <span className="text-[10px] text-cms-text-dim">{insights.dayLabels[i]}</span>
                    <span className="text-[10px] font-mono text-cms-text-muted">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {insights.topTags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-cms-text mb-3">Tags Mais Usadas</h3>
              <div className="space-y-1.5">
                {insights.topTags.map(([tag, count]) => {
                  const max = insights.topTags[0]?.[1] ?? 1
                  const width = (count / max) * 100
                  return (
                    <div key={tag} className="flex items-center gap-2">
                      <span className="text-xs text-cms-text-muted w-32 truncate text-right">{tag}</span>
                      <div className="flex-1 h-4 rounded bg-cms-surface-hover overflow-hidden">
                        <div className="h-full rounded bg-cms-accent/40" style={{ width: `${width}%` }} />
                      </div>
                      <span className="text-xs font-mono text-cms-text-dim w-8">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {insights.engagementByChannel.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-cms-text mb-3">Views Médias por Canal</h3>
              <div className="space-y-2">
                {insights.engagementByChannel.map(ch => {
                  const max = insights.engagementByChannel[0]?.avgViews ?? 1
                  const width = (ch.avgViews / max) * 100
                  return (
                    <div key={ch.name} className="flex items-center gap-3">
                      <span className="text-xs text-cms-text-muted w-28 truncate text-right">{ch.name}</span>
                      <div className="flex-1 h-5 rounded bg-cms-surface-hover overflow-hidden">
                        <div className="h-full rounded bg-blue-500/40" style={{ width: `${width}%` }} />
                      </div>
                      <span className="text-xs font-mono text-cms-text-dim w-16">{formatCount(ch.avgViews)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {insights.topTags.length === 0 && insights.engagementByChannel.length === 0 && (
            <div className="text-center py-12 text-cms-text-dim">
              <p className="text-sm">Dados insuficientes. Adicione competidores e aguarde sync.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
