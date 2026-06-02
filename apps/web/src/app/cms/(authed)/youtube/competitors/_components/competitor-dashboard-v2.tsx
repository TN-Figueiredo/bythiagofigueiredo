'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { fmtC } from '@/lib/youtube/format'
import { ChannelCard } from './channel-card'
import { ChannelDrawer } from './channel-drawer'
import { VideoModal } from './video-modal'
import { MudancasTab } from './mudancas-tab'
import { OutliersTab } from './outliers-tab'
import { InsightsTab } from './insights-tab'
import { RemoveChannelDialog } from './remove-channel-dialog'
import { addCompetitorChannel, removeCompetitorChannel, syncCompetitorNow } from '../actions'
import type {
  CompetitorChannelView,
  CompetitorChangeView,
  CompetitorOutlierView,
  CompetitorInsights,
  CompetitorVideoView,
  OurChannelStats,
} from '@/lib/youtube/observatory-types'

type SubTab = 'canais' | 'mudancas' | 'outliers' | 'insights'

interface CompetitorDashboardV2Props {
  channels: CompetitorChannelView[]
  changes: CompetitorChangeView[]
  outliers: CompetitorOutlierView[]
  insights: CompetitorInsights
  ourStats: OurChannelStats
  maxChannels: number
  activeTab: SubTab
}

interface SearchResult {
  channelId: string
  name: string
  thumbnail: string | null
  description: string
  handle: string | null
  subscriberCount: number | null
}

export function CompetitorDashboardV2({
  channels,
  changes,
  outliers,
  insights,
  ourStats,
  maxChannels,
  activeTab: initialTab,
}: CompetitorDashboardV2Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab)

  // Channel search state
  const [searchQuery, setSearchQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drawer & modal state
  const [drawerChannelId, setDrawerChannelId] = useState<string | null>(null)
  const [modalVideo, setModalVideo] = useState<{
    video: CompetitorVideoView
    channelName: string
    channelThumbnailUrl?: string | null
    allVideos?: CompetitorVideoView[]
  } | null>(null)

  // Remove confirmation state
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)

  const drawerChannel = useMemo(
    () => channels.find(c => c.id === drawerChannelId) ?? null,
    [channels, drawerChannelId]
  )

  // Filtered channels for Canais tab
  const filteredChannels = useMemo(() => {
    if (!channelFilter) return channels
    const q = channelFilter.toLowerCase()
    return channels.filter(c => c.channelName.toLowerCase().includes(q))
  }, [channels, channelFilter])

  // Channel names for Mudancas filter
  const channelNames = useMemo(() => [...new Set(channels.map(c => c.channelName))].sort(), [channels])

  const handleTabChange = (tab: SubTab) => {
    setActiveTab(tab)
    router.push(`/cms/youtube/competitors?tab=${tab}`, { scroll: false })
  }

  // Add channel search
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

  const handleAddChannel = async (channelId: string) => {
    setAdding(true)
    const result = await addCompetitorChannel(channelId)
    if (result.ok) {
      toast.success('Canal adicionado com sucesso.')
    } else {
      toast.error(result.error ?? 'Erro ao adicionar canal.')
    }
    setSearchQuery('')
    setSearchResults([])
    setAdding(false)
  }

  const handleSync = async (channelId: string) => {
    toast('Sincronizando canal...')
    try {
      const res = await syncCompetitorNow(channelId)
      if (res.ok) {
        const r = res.result
        toast.success(
          r
            ? `Canal sincronizado — ${r.videosChecked} vídeos verificados, ${r.changesDetected} mudanças detectadas.`
            : 'Canal sincronizado com sucesso.',
        )
      } else {
        toast.error('Falha ao sincronizar canal.')
      }
    } catch {
      toast.error('Erro inesperado ao sincronizar canal.')
    }
  }

  const handleRemove = (channelId: string) => {
    const ch = channels.find(c => c.id === channelId)
    setRemoveTarget({ id: channelId, name: ch?.channelName ?? 'Canal' })
  }

  const handleConfirmRemove = async () => {
    if (!removeTarget) return
    await removeCompetitorChannel(removeTarget.id)
    toast.success('Canal removido.')
    setRemoveTarget(null)
  }

  const handleVideoClick = useCallback((
    video: CompetitorVideoView,
    channelName: string,
    channelThumbnailUrl?: string | null,
    allVideos?: CompetitorVideoView[],
  ) => {
    setModalVideo({ video, channelName, channelThumbnailUrl, allVideos })
  }, [])

  const handleOutlierClick = useCallback((outlier: CompetitorOutlierView) => {
    const video: CompetitorVideoView = {
      id: outlier.id,
      videoId: outlier.videoId,
      title: outlier.title,
      thumbnailUrl: outlier.thumbnailUrl,
      viewCount: outlier.viewCount,
      likeCount: 0,
      commentCount: 0,
      publishedAt: outlier.publishedAt,
      durationSeconds: null,
      viewDelta: null,
      outlierMultiplier: outlier.multiplier,
      outlierTier: outlier.tier,
    }
    setModalVideo({ video, channelName: outlier.channelName })
  }, [])

  const tabs: Array<{ id: SubTab; label: string; count?: number }> = [
    { id: 'canais', label: 'Canais', count: channels.length },
    { id: 'mudancas', label: 'Mudanças', count: changes.length },
    { id: 'outliers', label: 'Outliers', count: outliers.length },
    { id: 'insights', label: 'Insights' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* page-head */}
      <div className="page-head flex items-center justify-between mb-4">
        <div>
          <h1 className="page-h1 display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            Observatório de Competidores
          </h1>
          <p className="page-desc text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Monitore canais concorrentes — thumbnails, títulos, outliers e lacunas.
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <nav className="flex gap-0 mb-5" style={{ borderBottom: '1px solid var(--border)' }} aria-label="Sub-abas do observatório">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`subtab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
            {tab.count != null && (
              <span className="subtab-count tnum">{tab.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Canais tab */}
      {activeTab === 'canais' && (
        <div className="fade-in" key="canais" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top bar: search + counter + add */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter existing channels */}
            <div className="search-wrap relative" style={{ minWidth: 320, maxWidth: 440, flex: '1 1 320px' }}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
              <input
                value={channelFilter}
                onChange={e => setChannelFilter(e.target.value)}
                placeholder="Filtrar canais monitorados..."
                className="w-full rounded-[9px] py-2 pl-9 pr-3 text-xs"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <span className="counter-pill text-xs mono" style={{ color: 'var(--text-dim)' }}>
              {channels.length} /{maxChannels} canais monitorados
            </span>

            {/* Add channel: search input + button */}
            <div className="flex gap-2 items-center">
              <div className="relative" style={{ width: 220 }}>
                <input
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Buscar canal no YouTube..."
                  disabled={adding}
                  className="w-full rounded-[9px] py-2 px-3 text-xs"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                />
                {searching && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: 'var(--text-dim)' }}>Buscando...</span>
                )}
                {searchResults.length > 0 && (
                  <div
                    className="absolute mt-1 rounded-[9px] z-20"
                    style={{
                      top: '100%',
                      left: 0,
                      width: '100%',
                      maxHeight: 300,
                      overflowY: 'auto',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-pop)',
                    }}
                  >
                    {searchResults.map(result => (
                      <button
                        key={result.channelId}
                        onClick={() => handleAddChannel(result.channelId)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ color: 'var(--text)' }}
                      >
                        {result.thumbnail && <img src={result.thumbnail} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{result.name}</p>
                          {result.handle ? (
                            <p className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>{result.handle}</p>
                          ) : result.subscriberCount != null ? (
                            <p className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>{fmtC(result.subscriberCount)} inscritos</p>
                          ) : null}
                          {result.description && (
                            <p className="truncate" style={{ color: 'var(--text-dim)' }}>{result.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn primary sm" disabled={adding}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Adicionar
              </button>
            </div>
          </div>

          {/* obs-grid */}
          {filteredChannels.length > 0 ? (
            <div className="obs-grid stagger">
              {filteredChannels.map(ch => (
                <ChannelCard
                  key={ch.id}
                  channel={ch}
                  onOpen={id => setDrawerChannelId(id)}
                  onSync={handleSync}
                  onRemove={handleRemove}
                  onVideoClick={handleVideoClick}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: 'var(--text-dim)' }}>
              {channels.length === 0 ? (
                <>
                  <p className="text-sm">Nenhum canal competidor adicionado.</p>
                  <p className="text-xs mt-1">Busque acima para adicionar canais e acompanhar mudanças.</p>
                </>
              ) : (
                <p className="text-sm">Nenhum canal corresponde ao filtro.</p>
              )}
            </div>
          )}

          {/* Load end — all channels shown */}
          {filteredChannels.length > 0 && (
            <p className="load-end">— fim —</p>
          )}
        </div>
      )}

      {/* Mudancas tab */}
      {activeTab === 'mudancas' && (
        <div key="mudancas">
          <MudancasTab changes={changes} channelNames={channelNames} />
        </div>
      )}

      {/* Outliers tab */}
      {activeTab === 'outliers' && (
        <div key="outliers">
          <OutliersTab outliers={outliers} onVideoClick={handleOutlierClick} />
        </div>
      )}

      {/* Insights tab */}
      {activeTab === 'insights' && (
        <div key="insights">
          <InsightsTab insights={insights} />
        </div>
      )}

      {/* Channel Drawer */}
      {drawerChannel && (
        <ChannelDrawer
          channel={drawerChannel}
          open={drawerChannelId != null}
          onClose={() => setDrawerChannelId(null)}
          onVideoClick={handleVideoClick}
        />
      )}

      {/* Video Modal */}
      {modalVideo && (
        <VideoModal
          video={modalVideo.video}
          channelName={modalVideo.channelName}
          channelThumbnailUrl={modalVideo.channelThumbnailUrl}
          allVideos={modalVideo.allVideos}
          open={modalVideo != null}
          onClose={() => setModalVideo(null)}
        />
      )}

      {/* Remove Channel Confirmation Dialog */}
      {removeTarget && (
        <RemoveChannelDialog
          channelName={removeTarget.name}
          onConfirm={handleConfirmRemove}
          onClose={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}
