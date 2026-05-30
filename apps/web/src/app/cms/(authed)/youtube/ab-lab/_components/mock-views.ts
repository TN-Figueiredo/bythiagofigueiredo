import type {
  AbTestWinnerView,
  AbTestPlayoffView,
  AbTestActiveView,
  FullChartVariant,
  VariantThumb,
  GateResult,
} from '@/lib/youtube/ab-types'
import { VARIANT_COLORS } from './ab-constants'

const VARIANTS: FullChartVariant[] = [
  { label: 'A', color: VARIANT_COLORS.A, ctr: 0.052, impressions: 26000, clicks: 1352, pBest: 0.03, pTop2: 0.16, linkCtr: 0.012, retention: 0.45 },
  { label: 'B', color: VARIANT_COLORS.B, ctr: 0.064, impressions: 26000, clicks: 1664, pBest: 0.93, pTop2: 0.97, linkCtr: 0.018, retention: 0.52 },
  { label: 'C', color: VARIANT_COLORS.C, ctr: 0.053, impressions: 13000, clicks: 689, pBest: 0.03, pTop2: 0.71, linkCtr: 0.014, retention: 0.48 },
  { label: 'D', color: VARIANT_COLORS.D, ctr: 0.060, impressions: 13000, clicks: 780, pBest: 0.01, pTop2: 0.73, linkCtr: 0.016, retention: 0.50 },
]

const THUMBS: VariantThumb[] = [
  { label: 'A', color: VARIANT_COLORS.A, thumbUrl: null, isOriginal: true },
  { label: 'B', color: VARIANT_COLORS.B, thumbUrl: null, isOriginal: false },
  { label: 'C', color: VARIANT_COLORS.C, thumbUrl: null, isOriginal: false },
  { label: 'D', color: VARIANT_COLORS.D, thumbUrl: null, isOriginal: false },
]

const CONF_TREND = [12, 28, 35, 42, 55, 61, 68, 74, 79, 84, 88, 91, 94, 97.2]

const GATES: GateResult[] = [
  { name: 'confidence', passed: true, value: '97.2%', hint: '≥ 95%' },
  { name: 'min_impressions', passed: true, value: '13k/var', hint: '≥ 1000' },
  { name: 'min_duration', passed: true, value: '14 dias', hint: '≥ 7 dias' },
  { name: 'abba_cycles', passed: true, value: '16 ciclos', hint: '≥ 4' },
  { name: 'burn_in', passed: true, value: '2 dias', hint: '≥ 2 dias' },
  { name: 'stability', passed: true, value: 'Estável', hint: 'Sem queda > 20%' },
]

const BASE = {
  id: 'mock-test-id',
  videoTitle: '🇯🇵 Comi no Ramen Mais Premiado de Tóquio (Fila de 3h)',
  flag: 'thumbnail' as const,
  variants: VARIANTS,
  variantThumbs: THUMBS,
  confTrend: CONF_TREND,
  daily: {
    A: [5.1, 5.0, 5.3, 5.2, 5.1, 5.0, 5.2, 5.1, 5.3, 5.2, 5.1, 5.2, 5.2, 5.2],
    B: [5.8, 6.0, 6.2, 6.1, 6.3, 6.4, 6.2, 6.5, 6.3, 6.4, 6.5, 6.3, 6.4, 6.4],
    C: [5.0, 5.2, 5.4, 5.3, 5.1, 5.3, 5.2, 5.4, 5.3, 5.2, 5.3, 5.3, 5.3, 5.3],
    D: [5.5, 5.7, 5.9, 6.0, 5.8, 6.0, 5.9, 6.1, 6.0, 5.9, 6.0, 6.0, 6.0, 6.0],
  },
  abbaSeq: ['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A', 'C', 'D', 'D', 'C', 'C', 'D', 'D', 'C'] as const as unknown as import('@/lib/youtube/ab-types').DisplayLabel[],
  cycles: { total: 16, done: 16 },
  durationDays: 14,
  confidenceTarget: 0.95,
  totalRounds: 1,
  hasPlayoff: false,
  gates: GATES,
}

export const MOCK_WINNER: AbTestWinnerView = {
  ...BASE,
  status: 'completed',
  outcome: 'winner',
  winnerLabel: 'B',
  winnerColor: VARIANT_COLORS.B,
  lift: 23.4,
  confidence: 97.2,
  resultMeta: {
    ctrBefore: 5.2,
    ctrAfter: 6.4,
    totalImpressions: 52000,
    abbaCycles: 16,
    monthlyExtraClicks: 310,
  },
  learning: 'Thumbnails com comida em close-up e texto de localização específica (nome do restaurante) convertem 23% melhor do que thumbnails genéricas de viagem.',
  monitor: {
    liveCtr: 6.5,
    sparkline: [6.2, 6.0, 6.3, 6.4, 6.1, 6.5, 6.5, 6.4, 6.5],
    liftVsOriginal: 25,
    checkpoints: [
      { label: '7 dias', reached: true, date: '6.6%' },
      { label: '14 dias', reached: true, date: '6.5%' },
      { label: '30 dias', reached: false },
    ],
  },
}

export const MOCK_PLAYOFF: AbTestPlayoffView = {
  ...BASE,
  status: 'completed',
  outcome: 'playoff',
  flag: 'combo',
  videoTitle: '🇹🇭 24h Comendo SÓ Comida de Rua na Tailândia',
  totalRounds: 2,
  hasPlayoff: true,
  playoffTestId: 'mock-playoff-id',
  startsIn: '2h 48m',
  finalists: [
    { label: 'B', color: VARIANT_COLORS.B, ctr: 0.061, thumbnailUrl: null },
    { label: 'D', color: VARIANT_COLORS.D, ctr: 0.060, thumbnailUrl: null },
  ],
  confidenceReached: 71,
  reason: 'P(top2) separou B e D do resto com folga (gap 14pp para o 3º). Round 2 com 2 variantes converge mais rápido.',
  confTrend: [12, 24, 33, 38, 44, 49, 54, 58, 61, 64, 67, 69, 70, 71],
  gates: [
    { name: 'confidence', passed: false, value: '71%', hint: '< 95%' },
    { name: 'min_impressions', passed: true, value: '13k/var', hint: '≥ 1000' },
    { name: 'min_duration', passed: true, value: '14 dias', hint: '≥ 7 dias' },
    { name: 'abba_cycles', passed: true, value: '16 ciclos', hint: '≥ 4' },
    { name: 'burn_in', passed: true, value: '2 dias', hint: '≥ 2 dias' },
    { name: 'stability', passed: false, value: 'Instável', hint: 'Queda > 20% detectada' },
  ],
  variants: [
    { label: 'A', color: VARIANT_COLORS.A, ctr: 0.048, impressions: 13000, clicks: 624, pBest: 0.02, pTop2: 0.16, linkCtr: 0.010, retention: 0.42 },
    { label: 'B', color: VARIANT_COLORS.B, ctr: 0.061, impressions: 13000, clicks: 793, pBest: 0.45, pTop2: 0.71, linkCtr: 0.017, retention: 0.51 },
    { label: 'C', color: VARIANT_COLORS.C, ctr: 0.053, impressions: 13000, clicks: 689, pBest: 0.08, pTop2: 0.13, linkCtr: 0.013, retention: 0.46 },
    { label: 'D', color: VARIANT_COLORS.D, ctr: 0.060, impressions: 13000, clicks: 780, pBest: 0.45, pTop2: 0.73, linkCtr: 0.015, retention: 0.49 },
  ],
}

export const MOCK_WINNER_MINIMAL: AbTestWinnerView = {
  id: 'mock-minimal-id',
  videoTitle: 'Test',
  flag: 'thumbnail',
  status: 'completed',
  outcome: 'winner',
  variants: [
    { label: 'A', color: VARIANT_COLORS.A, ctr: 0.051, impressions: 1200, clicks: 61, pBest: 0.07, pTop2: 0.07, linkCtr: 0.009, retention: 0.40 },
    { label: 'B', color: VARIANT_COLORS.B, ctr: 0.052, impressions: 1200, clicks: 63, pBest: 0.93, pTop2: 0.93, linkCtr: 0.010, retention: 0.41 },
  ],
  variantThumbs: [
    { label: 'A', color: VARIANT_COLORS.A, thumbUrl: null, isOriginal: true },
    { label: 'B', color: VARIANT_COLORS.B, thumbUrl: null, isOriginal: false },
  ],
  confTrend: [],
  daily: {
    A: [5.1],
    B: [5.2],
  } as Record<import('@/lib/youtube/ab-types').DisplayLabel, number[]>,
  abbaSeq: ['A', 'B', 'B', 'A'] as const as unknown as import('@/lib/youtube/ab-types').DisplayLabel[],
  cycles: { total: 4, done: 1 },
  durationDays: 3,
  confidenceTarget: 0.95,
  totalRounds: 1,
  hasPlayoff: false,
  gates: [
    { name: 'confidence', passed: true, value: '95.1%', hint: '≥ 95%' },
    { name: 'min_impressions', passed: true, value: '1.2k/var', hint: '≥ 1000' },
    { name: 'min_duration', passed: false, value: '3 dias', hint: '≥ 7 dias' },
    { name: 'abba_cycles', passed: false, value: '1 ciclo', hint: '≥ 4' },
    { name: 'burn_in', passed: true, value: '2 dias', hint: '≥ 2 dias' },
    { name: 'stability', passed: false, value: 'Avaliando', hint: 'Precisa de mais dados' },
  ],
  winnerLabel: 'B',
  winnerColor: VARIANT_COLORS.B,
  lift: 2.3,
  confidence: 95.1,
  resultMeta: {
    ctrBefore: 5.1,
    ctrAfter: 5.2,
    totalImpressions: 2400,
    abbaCycles: 1,
    monthlyExtraClicks: 0,
  },
  learning: undefined,
  monitor: undefined,
}

export const MOCK_PLAYOFF_MINIMAL: AbTestPlayoffView = {
  id: 'mock-playoff-minimal-id',
  videoTitle: 'Test curto',
  flag: 'title',
  status: 'completed',
  outcome: 'playoff',
  variants: [
    { label: 'A', color: VARIANT_COLORS.A, ctr: 0.050, impressions: 1500, clicks: 75, pBest: 0.30, pTop2: 0.45, linkCtr: undefined, retention: undefined },
    { label: 'B', color: VARIANT_COLORS.B, ctr: 0.052, impressions: 1500, clicks: 78, pBest: 0.70, pTop2: 0.55, linkCtr: undefined, retention: undefined },
  ],
  variantThumbs: [
    { label: 'A', color: VARIANT_COLORS.A, thumbUrl: null, isOriginal: true },
    { label: 'B', color: VARIANT_COLORS.B, thumbUrl: null, isOriginal: false },
  ],
  confTrend: [],
  daily: { A: [], B: [] } as Record<import('@/lib/youtube/ab-types').DisplayLabel, number[]>,
  abbaSeq: [] as unknown as import('@/lib/youtube/ab-types').DisplayLabel[],
  cycles: { total: 4, done: 2 },
  durationDays: 5,
  confidenceTarget: 0.95,
  totalRounds: 1,
  hasPlayoff: false,
  gates: [],
  playoffTestId: '',
  startsIn: '',
  finalists: [
    { label: 'A', color: VARIANT_COLORS.A, ctr: 0.050, thumbnailUrl: null },
    { label: 'B', color: VARIANT_COLORS.B, ctr: 0.052, thumbnailUrl: null },
  ],
  confidenceReached: 42,
  reason: '',
}

export const MOCK_ACTIVE_MINIMAL: AbTestActiveView = {
  id: 'mock-active-minimal-id',
  videoTitle: 'Test rápido',
  flag: 'title',
  status: 'active',
  variants: [
    { label: 'A', color: VARIANT_COLORS.A, ctr: 0.051, impressions: 800, clicks: 41, pBest: 0.35, pTop2: 0.35, linkCtr: undefined, retention: undefined },
    { label: 'B', color: VARIANT_COLORS.B, ctr: 0.054, impressions: 800, clicks: 43, pBest: 0.65, pTop2: 0.65, linkCtr: undefined, retention: undefined },
  ],
  variantThumbs: [
    { label: 'A', color: VARIANT_COLORS.A, thumbUrl: null, isOriginal: true },
    { label: 'B', color: VARIANT_COLORS.B, thumbUrl: null, isOriginal: false },
  ],
  confTrend: [18],
  daily: { A: [5.1], B: [5.4] } as Record<import('@/lib/youtube/ab-types').DisplayLabel, number[]>,
  abbaSeq: ['A', 'B'] as unknown as import('@/lib/youtube/ab-types').DisplayLabel[],
  cycles: { total: 8, done: 1 },
  durationDays: 14,
  confidenceTarget: 0.95,
  totalRounds: 1,
  hasPlayoff: false,
  gates: [
    { name: 'confidence', passed: false, value: '18%', hint: '< 95%' },
    { name: 'min_impressions', passed: false, value: '800/var', hint: '≥ 1000' },
    { name: 'min_duration', passed: false, value: '1 dia', hint: '≥ 7 dias' },
    { name: 'abba_cycles', passed: false, value: '1 ciclo', hint: '≥ 4' },
    { name: 'burn_in', passed: false, value: '1 dia', hint: '≥ 2 dias' },
    { name: 'stability', passed: false, value: 'Avaliando', hint: 'Precisa de mais dados' },
  ],
  confirmedData: {
    confidence: 18,
    leader: 'B',
    leaderColor: VARIANT_COLORS.B,
    lift: 5.9,
  },
  liveData: undefined,
}

export const MOCK_ACTIVE: AbTestActiveView = {
  ...BASE,
  status: 'active',
  flag: 'combo',
  videoTitle: '🇰🇷 Seoul Street Food Tour — os 10 melhores pratos',
  cycles: { total: 16, done: 8 },
  confTrend: [12, 28, 35, 42, 55, 61, 68, 74],
  daily: {
    A: [5.1, 5.0, 5.3, 5.2, 5.1, 5.0, 5.2, 5.1],
    B: [5.8, 6.0, 6.2, 6.1, 6.3, 6.4, 6.2, 6.5],
    C: [5.0, 5.2, 5.4, 5.3, 5.1, 5.3, 5.2, 5.4],
    D: [5.5, 5.7, 5.9, 6.0, 5.8, 6.0, 5.9, 6.1],
  },
  gates: [
    { name: 'confidence', passed: false, value: '74%', hint: '< 95%' },
    { name: 'min_impressions', passed: true, value: '6.5k/var', hint: '≥ 1000' },
    { name: 'min_duration', passed: true, value: '8 dias', hint: '≥ 7 dias' },
    { name: 'abba_cycles', passed: true, value: '8 ciclos', hint: '≥ 4' },
    { name: 'burn_in', passed: true, value: '2 dias', hint: '≥ 2 dias' },
    { name: 'stability', passed: false, value: 'Avaliando', hint: 'Precisa de mais dados' },
  ],
  confirmedData: {
    confidence: 74,
    leader: 'B',
    leaderColor: VARIANT_COLORS.B,
    lift: 18.2,
  },
  liveData: {
    confidence: 76,
    leader: 'B',
    leaderColor: VARIANT_COLORS.B,
    lift: 19.5,
  },
}
