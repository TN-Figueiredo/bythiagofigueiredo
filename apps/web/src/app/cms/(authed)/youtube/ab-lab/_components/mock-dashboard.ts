import type {
  DashboardStats,
  AbTestCardView,
  AbTestDraft,
  LearningsData,
  SuggestedVideo,
  AbTestSiteSettings,
} from '@/lib/youtube/ab-types'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import { VARIANT_COLORS } from './ab-constants'

const MOCK_STATS: DashboardStats = {
  activeTests: 2,
  avgConfidence: 81,
  winRate: 64,
  avgLift: 16.8,
  completedTests: 11,
  testsWon: 7,
}

const MOCK_CARDS: AbTestCardView[] = [
  {
    id: 'mock-active-1',
    name: '🇹🇭 O Que Esperar Do MBK Center em Bangkok: Ouro, Ternos e Equipamentos!',
    type: 'combo',
    status: 'active',
    dayOf: 9,
    confidence: 81,
    lift: 53,
    leader: 'D',
    leaderColor: VARIANT_COLORS.D,
    leaderThumbUrl: null,
    variants: [
      { label: 'A', color: VARIANT_COLORS.A, thumbUrl: null },
      { label: 'B', color: VARIANT_COLORS.B, thumbUrl: null },
      { label: 'C', color: VARIANT_COLORS.C, thumbUrl: null },
      { label: 'D', color: VARIANT_COLORS.D, thumbUrl: null },
    ],
    hasPlayoff: false,
    roundNumber: 1,
    createdAt: new Date(Date.now() - 9 * 86400000).toISOString(),
    statusNote: null,
    cycleStartedAt: new Date(Date.now() - 3600000).toISOString(),
    queueStartAfter: null,
  },
  {
    id: 'mock-active-2',
    name: '🇹🇭 24h Comendo SÓ Comida de Rua na Tailândia',
    type: 'combo',
    status: 'active',
    dayOf: 14,
    confidence: 71,
    lift: 25,
    leader: 'D',
    leaderColor: VARIANT_COLORS.D,
    leaderThumbUrl: null,
    variants: [
      { label: 'A', color: VARIANT_COLORS.A, thumbUrl: null },
      { label: 'B', color: VARIANT_COLORS.B, thumbUrl: null },
      { label: 'C', color: VARIANT_COLORS.C, thumbUrl: null },
      { label: 'D', color: VARIANT_COLORS.D, thumbUrl: null },
    ],
    hasPlayoff: true,
    roundNumber: 2,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    statusNote: null,
    cycleStartedAt: new Date(Date.now() - 3600000).toISOString(),
    queueStartAfter: null,
  },
]

const MOCK_DRAFTS: AbTestDraft[] = [
  {
    id: 'mock-draft-1',
    name: '🇹🇭 O Que Esperar Do MBK Center em Bangkok: Ouro, Ternos e Equipamentos!',
    type: 'combo',
    step: 3,
    thumbUrl: null,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdAgo: 'ontem',
    videoId: 'mock-video-1',
    sourcePipelineId: null,
  },
]

const MOCK_COMPLETED: AbTestCardView[] = [
  {
    id: 'mock-completed-1',
    name: '🇯🇵 Comi no Ramen Mais Premiado de Tóquio (Fila de 3h)',
    type: 'thumbnail',
    status: 'completed',
    dayOf: 14,
    confidence: 97.2,
    lift: 23.4,
    leader: 'B',
    leaderColor: VARIANT_COLORS.B,
    leaderThumbUrl: null,
    variants: [
      { label: 'A', color: VARIANT_COLORS.A, thumbUrl: null },
      { label: 'B', color: VARIANT_COLORS.B, thumbUrl: null },
    ],
    hasPlayoff: false,
    roundNumber: 1,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    statusNote: null,
    cycleStartedAt: new Date(Date.now() - 3600000).toISOString(),
    queueStartAfter: null,
  },
  {
    id: 'mock-completed-2',
    name: '🇰🇷 Seoul Street Food Tour — os 10 melhores pratos',
    type: 'title',
    status: 'completed',
    dayOf: 14,
    confidence: 94,
    lift: 12.1,
    leader: 'C',
    leaderColor: VARIANT_COLORS.C,
    leaderThumbUrl: null,
    variants: [
      { label: 'A', color: VARIANT_COLORS.A, thumbUrl: null },
      { label: 'B', color: VARIANT_COLORS.B, thumbUrl: null },
      { label: 'C', color: VARIANT_COLORS.C, thumbUrl: null },
    ],
    hasPlayoff: false,
    roundNumber: 1,
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    statusNote: null,
    cycleStartedAt: new Date(Date.now() - 3600000).toISOString(),
    queueStartAfter: null,
  },
  {
    id: 'mock-completed-3',
    name: '🇹🇭 24h Comendo SÓ Comida de Rua na Tailândia',
    type: 'combo',
    status: 'completed',
    dayOf: 14,
    confidence: 71,
    lift: 0,
    leader: 'D',
    leaderColor: VARIANT_COLORS.D,
    leaderThumbUrl: null,
    variants: [
      { label: 'A', color: VARIANT_COLORS.A, thumbUrl: null },
      { label: 'B', color: VARIANT_COLORS.B, thumbUrl: null },
      { label: 'C', color: VARIANT_COLORS.C, thumbUrl: null },
      { label: 'D', color: VARIANT_COLORS.D, thumbUrl: null },
    ],
    hasPlayoff: true,
    roundNumber: 2,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    statusNote: null,
    cycleStartedAt: new Date(Date.now() - 3600000).toISOString(),
    queueStartAfter: null,
  },
]

const MOCK_LEARNINGS: LearningsData = {
  tags: [
    { tag: 'ancoragem de preço', wins: 5, avgLift: 22, kind: 'title' },
    { tag: 'close-up + expressão', wins: 4, avgLift: 19, kind: 'thumb' },
    { tag: 'número específico no título', wins: 4, avgLift: 17, kind: 'title' },
    { tag: "primeira pessoa ('Comprei')", wins: 3, avgLift: 12, kind: 'title' },
    { tag: 'split-screen comparativo', wins: 2, avgLift: 24, kind: 'thumb' },
    { tag: 'texto longo na thumb', wins: 0, avgLift: -8, kind: 'thumb', negative: true },
  ],
  totalTests: 11,
  insightText: 'ancoragem de preço venceu 5× com +22% médio. Texto longo na thumb está te custando cliques.',
}

const MOCK_SUGGESTED: SuggestedVideo[] = [
  {
    id: 'sug-1',
    title: '🇻🇳 Street Food em Ho Chi Minh — Vale a Pena?',
    thumbnailUrl: null,
    ctr: 3.2,
    channelMedianCtr: 5.1,
    grade: 'D',
    reason: 'CTR 37% abaixo da mediana do canal',
    suggest: 'thumbnail',
  },
  {
    id: 'sug-2',
    title: '🇮🇳 Mumbai: 48h com R$100',
    thumbnailUrl: null,
    ctr: 4.1,
    channelMedianCtr: 5.1,
    grade: 'C',
    reason: 'CTR 20% abaixo da mediana',
    suggest: 'combo',
  },
]

const MOCK_SETTINGS: AbTestSiteSettings = AB_SITE_SETTINGS_DEFAULTS

export const MOCK_DASHBOARD = {
  stats: MOCK_STATS,
  cards: MOCK_CARDS,
  drafts: MOCK_DRAFTS,
  completed: MOCK_COMPLETED,
  learnings: MOCK_LEARNINGS,
  suggested: MOCK_SUGGESTED,
  settings: MOCK_SETTINGS,
} as const
