'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Users, Activity, Flame, Sparkles } from 'lucide-react'
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

// ── Dev-only mock data for empty Observatory tabs ──────────────────────────
const IS_DEV = process.env.NODE_ENV === 'development'

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString()
}

const MOCK_CHANGES: CompetitorChangeView[] = IS_DEV ? [
  {
    id: 'mock-ch-1',
    videoId: 'v1',
    videoTitle: 'Quanto Custa Morar no Vietnã em 2026',
    channelName: 'Nomade Raiz',
    channelThumbnailUrl: null,
    changeType: 'thumbnail',
    oldTitle: null,
    newTitle: null,
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 84_200,
    detectedAt: hoursAgo(2),
    bookmarked: false,
    history: [],
  },
  {
    id: 'mock-ch-2',
    videoId: 'v2',
    videoTitle: 'Quanto Custa Morar no Vietnã em 2026',
    channelName: 'Nomade Raiz',
    channelThumbnailUrl: null,
    changeType: 'title',
    oldTitle: 'Quanto custa morar no Vietnã?',
    newTitle: 'Morar no Vietnam por R$2.500/mês — vale a pena?',
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 79_300,
    detectedAt: hoursAgo(4),
    bookmarked: true,
    history: [],
  },
  {
    id: 'mock-ch-3',
    videoId: 'v3',
    videoTitle: 'COMO EU GANHO DINHEIRO VIAJANDO',
    channelName: 'Matheus Fonseca',
    channelThumbnailUrl: null,
    changeType: 'thumbnail',
    oldTitle: null,
    newTitle: null,
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 210_000,
    detectedAt: hoursAgo(24),
    bookmarked: false,
    history: [],
  },
  {
    id: 'mock-ch-4',
    videoId: 'v4',
    videoTitle: 'Fed Chair Press Conference — June 2026',
    channelName: 'Esq Untd Daily',
    channelThumbnailUrl: null,
    changeType: 'description',
    oldTitle: null,
    newTitle: null,
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 53_800,
    detectedAt: hoursAgo(48),
    bookmarked: false,
    history: [],
  },
  {
    id: 'mock-ch-5',
    videoId: 'v5',
    videoTitle: 'Roteiro de 15 Dias pela Tailândia',
    channelName: 'Nomade Raiz',
    channelThumbnailUrl: null,
    changeType: 'thumbnail',
    oldTitle: null,
    newTitle: null,
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 122_500,
    detectedAt: hoursAgo(72),
    bookmarked: true,
    history: [
      {
        id: 'mock-ch-5h',
        videoId: 'v5',
        videoTitle: 'Roteiro de 15 Dias pela Tailândia',
        channelName: 'Nomade Raiz',
        channelThumbnailUrl: null,
        changeType: 'thumbnail',
        oldTitle: null,
        newTitle: null,
        oldThumbnailUrl: null,
        newThumbnailUrl: null,
        viewCountAtChange: 95_000,
        detectedAt: hoursAgo(240),
        bookmarked: false,
        history: [],
      },
    ],
  },
  {
    id: 'mock-ch-6',
    videoId: 'v6',
    videoTitle: 'O que NÃO fazer em Bangkok',
    channelName: 'Matheus Fonseca',
    channelThumbnailUrl: null,
    changeType: 'title',
    oldTitle: 'Erros em Bangkok',
    newTitle: 'O que NÃO fazer em Bangkok (aprendi da pior forma)',
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 175_000,
    detectedAt: hoursAgo(120),
    bookmarked: false,
    history: [],
  },
] : []

const MOCK_OUTLIERS: CompetitorOutlierView[] = IS_DEV ? [
  { id: 'mock-ol-1', videoId: 'ol1', title: 'SAIU! Visto Digital Nomad pro Japão — como tirar', thumbnailUrl: null, channelName: 'Nomade Raiz', viewCount: 2_050_000, publishedAt: hoursAgo(48), multiplier: 21.5, tier: 'top' },
  { id: 'mock-ol-2', videoId: 'ol2', title: 'Morei 1 Mês no Japão por R$3.000', thumbnailUrl: null, channelName: 'Nomade Raiz', viewCount: 1_200_000, publishedAt: hoursAgo(168), multiplier: 12.6, tier: 'top' },
  { id: 'mock-ol-3', videoId: 'ol3', title: 'O Colapso do Mercado Imobiliário Chinês', thumbnailUrl: null, channelName: 'Esq Untd Daily', viewCount: 890_000, publishedAt: hoursAgo(96), multiplier: 8.4, tier: 'high' },
  { id: 'mock-ol-4', videoId: 'ol4', title: 'COMO EU GANHO R$30K/MÊS VIAJANDO', thumbnailUrl: null, channelName: 'Matheus Fonseca', viewCount: 540_000, publishedAt: hoursAgo(240), multiplier: 7.1, tier: 'high' },
  { id: 'mock-ol-5', videoId: 'ol5', title: 'Inflação Global — O Que Esperar em 2027', thumbnailUrl: null, channelName: 'Esq Untd Daily', viewCount: 410_000, publishedAt: hoursAgo(72), multiplier: 5.2, tier: 'high' },
  { id: 'mock-ol-6', videoId: 'ol6', title: 'Custo de Vida na Coreia do Sul — Realidade', thumbnailUrl: null, channelName: 'Nomade Raiz', viewCount: 185_000, publishedAt: hoursAgo(360), multiplier: 3.8, tier: 'mid' },
  { id: 'mock-ol-7', videoId: 'ol7', title: 'Meu Setup de Trabalho Remoto em Bali', thumbnailUrl: null, channelName: 'Matheus Fonseca', viewCount: 120_000, publishedAt: hoursAgo(480), multiplier: 2.9, tier: 'mid' },
  { id: 'mock-ol-8', videoId: 'ol8', title: 'Bangkok vs Chiang Mai — Qual Escolher?', thumbnailUrl: null, channelName: 'Nomade Raiz', viewCount: 52_000, publishedAt: hoursAgo(600), multiplier: 2.1, tier: 'mid' },
] : []

const MOCK_INSIGHTS: CompetitorInsights = IS_DEV ? {
  heatmap: [
    /* Seg */ [0,0,0,0,0,1,3,8,22,35,28,18,14,16,20,25,30,38,42,35,22,12,5,1],
    /* Ter */ [0,0,0,0,0,1,2,9,25,38,32,20,15,17,22,28,34,40,45,38,25,14,6,2],
    /* Qua */ [0,0,0,0,0,1,4,10,28,42,36,24,16,18,24,30,36,44,48,40,28,16,7,2],
    /* Qui */ [0,0,0,0,0,1,3,9,24,36,30,22,15,17,21,27,32,39,43,36,24,13,6,1],
    /* Sex */ [0,0,0,0,0,0,2,7,20,30,26,18,14,15,18,22,28,34,38,32,20,11,4,1],
    /* Sab */ [0,0,0,0,0,0,1,3,8,14,18,22,20,18,16,14,12,15,18,20,16,10,4,1],
    /* Dom */ [0,0,0,0,0,0,0,2,6,10,14,18,16,14,12,10,8,10,14,16,12,8,3,0],
  ],
  tags: [
    { tag: 'viagem', count: 87, avgViews: 145_000 },
    { tag: 'asia', count: 64, avgViews: 168_000 },
    { tag: 'nomade digital', count: 52, avgViews: 132_000 },
    { tag: 'bangkok', count: 41, avgViews: 112_000 },
    { tag: 'custo de vida', count: 38, avgViews: 195_000 },
    { tag: 'trabalho remoto', count: 34, avgViews: 98_000 },
    { tag: 'tailândia', count: 29, avgViews: 124_000 },
    { tag: 'visto', count: 25, avgViews: 210_000 },
    { tag: 'japão', count: 22, avgViews: 185_000 },
    { tag: 'morando fora', count: 18, avgViews: 78_000 },
  ],
  engagement: [
    { channelName: 'Nomade Raiz', channelThumbnailUrl: null, engagementRate: 0.072, isUs: false },
    { channelName: 'VOCÊ', channelThumbnailUrl: null, engagementRate: 0.058, isUs: true },
    { channelName: 'Matheus Fonseca', channelThumbnailUrl: null, engagementRate: 0.045, isUs: false },
    { channelName: 'Esq Untd Daily', channelThumbnailUrl: null, engagementRate: 0.038, isUs: false },
    { channelName: 'Canal Viajante', channelThumbnailUrl: null, engagementRate: 0.029, isUs: false },
  ],
  gaps: [
    { topic: 'vietnã', competitorCount: 3, avgViews: 165_000, weCover: false },
    { topic: 'japão', competitorCount: 3, avgViews: 185_000, weCover: false },
    { topic: 'coreia', competitorCount: 2, avgViews: 142_000, weCover: false },
    { topic: 'tailândia', competitorCount: 3, avgViews: 124_000, weCover: true },
    { topic: 'bangkok', competitorCount: 3, avgViews: 112_000, weCover: true },
    { topic: 'bali', competitorCount: 2, avgViews: 98_000, weCover: false },
  ],
} : {
  heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
  tags: [],
  engagement: [],
  gaps: [],
}

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

  // Dev-only fallbacks for empty tabs
  const displayChanges = changes.length > 0 ? changes : MOCK_CHANGES
  const displayOutliers = outliers.length > 0 ? outliers : MOCK_OUTLIERS
  const displayInsights = useMemo(() => {
    const hasReal = insights.tags.length > 0 || insights.engagement.length > 0 || insights.gaps.length > 0
    return hasReal ? insights : MOCK_INSIGHTS
  }, [insights])

  // Channel names for Mudancas filter
  const channelNames = useMemo(() => {
    const src = displayChanges
    return [...new Set(src.map(c => c.channelName))].sort()
  }, [displayChanges])

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

  const tabs: Array<{ id: SubTab; label: string; count?: number; icon: React.ReactNode }> = [
    { id: 'canais', label: 'Canais', count: channels.length, icon: <Users style={{ width: 15, height: 15 }} aria-hidden="true" /> },
    { id: 'mudancas', label: 'Mudanças', count: displayChanges.length, icon: <Activity style={{ width: 15, height: 15 }} aria-hidden="true" /> },
    { id: 'outliers', label: 'Outliers', count: displayOutliers.length, icon: <Flame style={{ width: 15, height: 15 }} aria-hidden="true" /> },
    { id: 'insights', label: 'Insights', icon: <Sparkles style={{ width: 15, height: 15 }} aria-hidden="true" /> },
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
            {tab.icon}
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
              {/* "Adicionar" button removed — clicking a search result adds directly */}
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
          <MudancasTab changes={displayChanges} channelNames={channelNames} />
        </div>
      )}

      {/* Outliers tab */}
      {activeTab === 'outliers' && (
        <div key="outliers">
          <OutliersTab outliers={displayOutliers} onVideoClick={handleOutlierClick} />
        </div>
      )}

      {/* Insights tab */}
      {activeTab === 'insights' && (
        <div key="insights">
          <InsightsTab insights={displayInsights} />
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
