/**
 * Observatory fixtures — development-only mock data for the Competitor Dashboard.
 * Gated by NODE_ENV === 'development'.
 */

import type {
  CompetitorChannelView,
  CompetitorChangeView,
  CompetitorOutlierView,
  CompetitorInsights,
  OurChannelStats,
  CompetitorVideoView,
} from '../observatory-types'

function makeVideo(i: number, channelIdx: number): CompetitorVideoView {
  const views = Math.round(20_000 + Math.random() * 300_000)
  return {
    id: `vid-${channelIdx}-${i}`,
    videoId: `yt-vid-${channelIdx}-${i}`,
    title: `Video ${i + 1} do canal ${channelIdx + 1}`,
    thumbnailUrl: null,
    viewCount: views,
    likeCount: Math.round(views * 0.035),
    commentCount: Math.round(views * 0.004),
    publishedAt: new Date(Date.now() - i * 3 * 86_400_000).toISOString(),
    durationSeconds: 300 + Math.round(Math.random() * 900),
    viewDelta: Math.round(views * 0.12),
    outlierMultiplier: null,
    outlierTier: null,
  }
}

function makeSparkline(length: number, base: number, volatility: number): number[] {
  const data: number[] = []
  let v = base
  for (let i = 0; i < length; i++) {
    v += (Math.random() - 0.45) * volatility
    data.push(Math.max(0, Math.round(v)))
  }
  return data
}

const CHANNEL_NAMES = [
  'Dev Nomade', 'Codigo Viajante', 'Tech Abroad', 'Pixel Travel',
  'Nerd na Estrada', 'Byte & Bagagem', 'Stack Overflow Life', 'Remote Code',
  'Terminal Global', 'Deploy & Go', 'Git Trip', 'Cloud Walker',
]

export const FIXTURE_CHANNELS: CompetitorChannelView[] = CHANNEL_NAMES.map((name, idx) => {
  const subs = 10_000 + Math.round(Math.random() * 500_000)
  const vids = makeVideo(0, idx)
  const avgViews = 15_000 + Math.round(Math.random() * 80_000)
  const engagement = 0.02 + Math.random() * 0.08
  return {
    id: `ch-${idx}`,
    channelId: `UC${idx}ABCDEF`,
    channelName: name,
    thumbnailUrl: null,
    subscriberCount: subs,
    videoCount: 30 + Math.round(Math.random() * 200),
    addedAt: new Date(Date.now() - idx * 7 * 86_400_000).toISOString(),
    lastSyncedAt: new Date(Date.now() - Math.random() * 86_400_000 * 2).toISOString(),
    avgEngagement: engagement,
    growthDelta: Math.round((Math.random() - 0.3) * 5000),
    growthSparkline: makeSparkline(30, subs, subs * 0.005),
    recentVideos: [0, 1, 2].map(i => makeVideo(i, idx)),
    vsYou: [
      {
        channelName: 'tnFigueiredo',
        channelId: 'ch-own-1',
        subsDelta: Math.round((Math.random() - 0.5) * 100_000),
        engagementDelta: +(Math.random() - 0.5).toFixed(3) * 0.04,
        avgViewsDelta: Math.round((Math.random() - 0.5) * 50_000),
        frequencyDelta: +(Math.random() - 0.5).toFixed(1) * 4,
      },
      {
        channelName: 'Thiago Figueiredo',
        channelId: 'ch-own-2',
        subsDelta: Math.round((Math.random() - 0.5) * 80_000),
        engagementDelta: +(Math.random() - 0.5).toFixed(3) * 0.03,
        avgViewsDelta: Math.round((Math.random() - 0.5) * 40_000),
        frequencyDelta: +(Math.random() - 0.5).toFixed(1) * 3,
      },
    ],
    changeFlags: idx % 3 === 0 ? [{ type: 'thumbnail' as const, count: 1, latestAt: new Date(Date.now() - 7200_000).toISOString() }] : [],
    syncMode: 'recent' as const,
    syncStatus: 'idle' as const,
    syncProgress: 0,
    syncError: null,
    youtubeVideoCount: 30 + Math.round(Math.random() * 200),
    fullSyncCompletedAt: null,
  }
})

export const FIXTURE_CHANGES: CompetitorChangeView[] = [
  {
    id: 'chg-1',
    videoId: 'vid-0-0',
    videoTitle: 'Como viver com $1000/mes na Tailandia',
    channelName: 'Dev Nomade',
    channelThumbnailUrl: null,
    changeType: 'thumbnail',
    oldTitle: null,
    newTitle: null,
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 45_000,
    detectedAt: new Date(Date.now() - 3_600_000).toISOString(),
    bookmarked: false,
    history: [
      {
        id: 'chg-1-h1',
        videoId: 'vid-0-0',
        videoTitle: 'Como viver com $1000/mes na Tailandia',
        channelName: 'Dev Nomade',
        channelThumbnailUrl: null,
        changeType: 'thumbnail',
        oldTitle: null,
        newTitle: null,
        oldThumbnailUrl: null,
        newThumbnailUrl: null,
        viewCountAtChange: 38_000,
        detectedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        bookmarked: false,
        history: [],
      },
      {
        id: 'chg-1-h2',
        videoId: 'vid-0-0',
        videoTitle: 'Como viver com $1000/mes na Tailandia',
        channelName: 'Dev Nomade',
        channelThumbnailUrl: null,
        changeType: 'title',
        oldTitle: 'Custo de vida na Tailandia',
        newTitle: 'Como viver com $1000/mes na Tailandia',
        oldThumbnailUrl: null,
        newThumbnailUrl: null,
        viewCountAtChange: 28_000,
        detectedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        bookmarked: false,
        history: [],
      },
    ],
  },
  {
    id: 'chg-2',
    videoId: 'vid-1-0',
    videoTitle: 'Salario de dev remoto em 2026',
    channelName: 'Codigo Viajante',
    channelThumbnailUrl: null,
    changeType: 'title',
    oldTitle: 'Quanto ganha dev remoto',
    newTitle: 'Salario de dev remoto em 2026 (REAL)',
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 120_000,
    detectedAt: new Date(Date.now() - 86_400_000).toISOString(),
    bookmarked: true,
    history: [
      {
        id: 'chg-2-h1',
        videoId: 'vid-1-0',
        videoTitle: 'Salario de dev remoto em 2026',
        channelName: 'Codigo Viajante',
        channelThumbnailUrl: null,
        changeType: 'title',
        oldTitle: 'Salario dev remoto — quanto ganha?',
        newTitle: 'Quanto ganha dev remoto',
        oldThumbnailUrl: null,
        newThumbnailUrl: null,
        viewCountAtChange: 85_000,
        detectedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
        bookmarked: false,
        history: [],
      },
    ],
  },
  {
    id: 'chg-3',
    videoId: 'vid-2-1',
    videoTitle: 'Setup minimalista pra viajar',
    channelName: 'Tech Abroad',
    channelThumbnailUrl: null,
    changeType: 'thumbnail',
    oldTitle: null,
    newTitle: null,
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 33_000,
    detectedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    bookmarked: false,
    history: [],
  },
  {
    id: 'chg-4',
    videoId: 'vid-3-0',
    videoTitle: 'Melhor pais pra nomade digital',
    channelName: 'Pixel Travel',
    channelThumbnailUrl: null,
    changeType: 'title',
    oldTitle: 'Melhor pais pra nomade',
    newTitle: 'Melhor pais pra nomade digital (Top 5)',
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 88_000,
    detectedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    bookmarked: false,
    history: [],
  },
  {
    id: 'chg-5',
    videoId: 'vid-4-2',
    videoTitle: 'Internet na Asia — guia completo',
    channelName: 'Nerd na Estrada',
    channelThumbnailUrl: null,
    changeType: 'description',
    oldTitle: null,
    newTitle: null,
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 22_000,
    detectedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    bookmarked: true,
    history: [],
  },
  {
    id: 'chg-6',
    videoId: 'vid-5-0',
    videoTitle: 'Visto digital na Tailandia 2026',
    channelName: 'Byte & Bagagem',
    channelThumbnailUrl: null,
    changeType: 'thumbnail',
    oldTitle: null,
    newTitle: null,
    oldThumbnailUrl: null,
    newThumbnailUrl: null,
    viewCountAtChange: 56_000,
    detectedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    bookmarked: false,
    history: [
      {
        id: 'chg-6-h1',
        videoId: 'vid-5-0',
        videoTitle: 'Visto digital na Tailandia 2026',
        channelName: 'Byte & Bagagem',
        channelThumbnailUrl: null,
        changeType: 'thumbnail',
        oldTitle: null,
        newTitle: null,
        oldThumbnailUrl: null,
        newThumbnailUrl: null,
        viewCountAtChange: 42_000,
        detectedAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
        bookmarked: false,
        history: [],
      },
      {
        id: 'chg-6-h2',
        videoId: 'vid-5-0',
        videoTitle: 'Visto digital na Tailandia 2026',
        channelName: 'Byte & Bagagem',
        channelThumbnailUrl: null,
        changeType: 'title',
        oldTitle: 'Visto pra Tailandia — guia 2026',
        newTitle: 'Visto digital na Tailandia 2026',
        oldThumbnailUrl: null,
        newThumbnailUrl: null,
        viewCountAtChange: 35_000,
        detectedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        bookmarked: false,
        history: [],
      },
      {
        id: 'chg-6-h3',
        videoId: 'vid-5-0',
        videoTitle: 'Visto digital na Tailandia 2026',
        channelName: 'Byte & Bagagem',
        channelThumbnailUrl: null,
        changeType: 'description',
        oldTitle: null,
        newTitle: null,
        oldThumbnailUrl: null,
        newThumbnailUrl: null,
        viewCountAtChange: 30_000,
        detectedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
        bookmarked: false,
        history: [],
      },
    ],
  },
]

export const FIXTURE_OUTLIERS: CompetitorOutlierView[] = [
  { id: 'out-1', videoId: 'yt-out-1', title: 'FUI ASSALTADO na Tailandia (a verdade)', thumbnailUrl: null, channelName: 'Dev Nomade', channelThumbnailUrl: null, viewCount: 890_000, likeCount: 42_000, commentCount: 3_100, durationSeconds: 912, publishedAt: new Date(Date.now() - 86_400_000 * 5).toISOString(), multiplier: 12.4, tier: 'top' },
  { id: 'out-2', videoId: 'yt-out-2', title: 'Quanto ganhei trabalhando da praia', thumbnailUrl: null, channelName: 'Codigo Viajante', channelThumbnailUrl: null, viewCount: 450_000, likeCount: 18_500, commentCount: 1_200, durationSeconds: 720, publishedAt: new Date(Date.now() - 86_400_000 * 8).toISOString(), multiplier: 8.2, tier: 'high' },
  { id: 'out-3', videoId: 'yt-out-3', title: 'Setup de 500 reais vs 5000 reais', thumbnailUrl: null, channelName: 'Tech Abroad', channelThumbnailUrl: null, viewCount: 320_000, likeCount: 14_200, commentCount: 890, durationSeconds: 1080, publishedAt: new Date(Date.now() - 86_400_000 * 3).toISOString(), multiplier: 6.7, tier: 'high' },
  { id: 'out-4', videoId: 'yt-out-4', title: 'Um dia na vida de dev nomade', thumbnailUrl: null, channelName: 'Pixel Travel', channelThumbnailUrl: null, viewCount: 210_000, likeCount: 9_800, commentCount: 540, durationSeconds: 600, publishedAt: new Date(Date.now() - 86_400_000 * 12).toISOString(), multiplier: 4.3, tier: 'mid' },
  { id: 'out-5', videoId: 'yt-out-5', title: 'NAS caseiro por R$300', thumbnailUrl: null, channelName: 'Nerd na Estrada', channelThumbnailUrl: null, viewCount: 180_000, likeCount: 7_200, commentCount: 410, durationSeconds: 840, publishedAt: new Date(Date.now() - 86_400_000 * 7).toISOString(), multiplier: 3.1, tier: 'mid' },
  { id: 'out-6', videoId: 'yt-out-6', title: 'Passaporte brasileiro — vale a pena?', thumbnailUrl: null, channelName: 'Byte & Bagagem', channelThumbnailUrl: null, viewCount: 145_000, likeCount: 5_600, commentCount: 320, durationSeconds: 480, publishedAt: new Date(Date.now() - 86_400_000 * 14).toISOString(), multiplier: 2.8, tier: 'mid' },
]

export const FIXTURE_INSIGHTS: CompetitorInsights = {
  heatmap: Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => Math.round(Math.random() * 100))
  ),
  tags: [
    { tag: 'nomade digital', count: 28, avgViews: 95_000 },
    { tag: 'trabalho remoto', count: 24, avgViews: 88_000 },
    { tag: 'asia', count: 19, avgViews: 72_000 },
    { tag: 'tailandia', count: 17, avgViews: 110_000 },
    { tag: 'programacao', count: 15, avgViews: 65_000 },
    { tag: 'dev life', count: 14, avgViews: 58_000 },
    { tag: 'custo de vida', count: 12, avgViews: 120_000 },
    { tag: 'setup', count: 10, avgViews: 78_000 },
    { tag: 'visto', count: 8, avgViews: 45_000 },
    { tag: 'freelancer', count: 7, avgViews: 52_000 },
  ],
  engagement: [
    { channelName: 'Dev Nomade', channelThumbnailUrl: null, engagementRate: 0.072, isUs: false },
    { channelName: 'Thiago Figueiredo', channelThumbnailUrl: null, engagementRate: 0.065, isUs: true },
    { channelName: 'Codigo Viajante', channelThumbnailUrl: null, engagementRate: 0.058, isUs: false },
    { channelName: 'Tech Abroad', channelThumbnailUrl: null, engagementRate: 0.051, isUs: false },
    { channelName: 'Pixel Travel', channelThumbnailUrl: null, engagementRate: 0.044, isUs: false },
    { channelName: 'Nerd na Estrada', channelThumbnailUrl: null, engagementRate: 0.038, isUs: false },
  ],
  gaps: [
    { topic: 'vlog diario', competitorCount: 4, avgViews: 85_000, weCover: false, channelNames: ['Nômade Raiz', 'Código Fonte TV'] },
    { topic: 'financas pessoais', competitorCount: 3, avgViews: 120_000, weCover: false, channelNames: ['Nômade Raiz'] },
    { topic: 'review de equipamento', competitorCount: 5, avgViews: 95_000, weCover: true, channelNames: ['Código Fonte TV'] },
    { topic: 'entrevistas', competitorCount: 2, avgViews: 60_000, weCover: false, channelNames: ['Nômade Raiz'] },
    { topic: 'morar no exterior', competitorCount: 6, avgViews: 140_000, weCover: true, channelNames: ['Nômade Raiz', 'Código Fonte TV'] },
    { topic: 'saude mental', competitorCount: 2, avgViews: 70_000, weCover: false, channelNames: ['Código Fonte TV'] },
  ],
  hitsHeatmap: Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => Math.random() > 0.7 ? Math.ceil(Math.random() * 3) : 0)
  ),
  cadence: [
    { channelName: 'Dev Nomade', channelId: 'ch-dn', color: 'rgb(232, 130, 60)', freq: 2.3, window: 'Ter 18h', videos: [{ title: 'FUI ASSALTADO na Tailandia', viewCount: 890_000, publishedAt: new Date(Date.now() - 86_400_000 * 2).toISOString() }], lastUploadDays: 2 },
    { channelName: 'Codigo Viajante', channelId: 'ch-cv', color: 'rgb(167, 124, 232)', freq: 1.7, window: 'Qui 14h', videos: [{ title: 'Quanto ganhei trabalhando da praia', viewCount: 450_000, publishedAt: new Date(Date.now() - 86_400_000 * 5).toISOString() }], lastUploadDays: 5 },
    { channelName: 'Tech Abroad', channelId: 'ch-ta', color: 'rgb(63, 169, 192)', freq: 1.0, window: 'Sex 10h', videos: [{ title: 'Setup de 500 reais vs 5000 reais', viewCount: 320_000, publishedAt: new Date(Date.now() - 86_400_000 * 8).toISOString() }], lastUploadDays: 8 },
  ],
  formulas: [
    { label: 'Nome do lugar', hint: 'o estrangeiro nítido', multiplier: 8.4, count: 5, exampleTitle: 'FUI ASSALTADO na Tailandia (a verdade)' },
    { label: 'Primeira pessoa', hint: '"larguei tudo"', multiplier: 6.2, count: 3, exampleTitle: 'Quanto ganhei trabalhando da praia' },
    { label: 'Preço em R$', hint: 'o número que dói', multiplier: 4.8, count: 2, exampleTitle: 'Setup de 500 reais vs 5000 reais' },
  ],
  play: {
    topicBold: 'vlog diario',
    formulaBold: 'Nome do lugar',
    formulaMult: 8.4,
    windowBold: 'Ter 18h',
    windowReason: 'onde nascem os hits e o volume é fraco',
  },
  ownTagsByChannel: [
    { channelName: 'tnFigueiredo', tags: ['programação', 'IA', 'setup remoto'] },
    { channelName: 'BrightCurios', tags: ['games', 'NAS caseiro'] },
  ],
  competitorTagsByChannel: [
    { channelName: 'Nômade Raiz', tags: ['morar fora', 'nômade digital', 'ásia', 'custo de vida', 'vietnã'] },
    { channelName: 'Código Fonte TV', tags: ['programação', 'IA', 'tecnologia'] },
  ],
}

export const FIXTURE_OUR_STATS: OurChannelStats = {
  subscriberCount: 85_000,
  avgViews: 42_000,
  engagementRate: 0.065,
  uploadFrequency: 3.5,
}
