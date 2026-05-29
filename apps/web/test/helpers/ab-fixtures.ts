import type {
  AbTestWithVariants, AbTestCardView, AbTestDraft, AbTestRow, AbTestVariantRow,
  AbTestCycleRow, DashboardStats, SuggestedVideo, LearningsData, LearningsTag,
  AbTestConfig, AbTestSiteSettings, TestType, DisplayLabel, VariantStats,
} from '@/lib/youtube/ab-types'
import { AB_TEST_CONFIG_DEFAULTS, AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'

let counter = 0
function uid() { return `test-${++counter}` }

export function makeTestRow(overrides?: Partial<AbTestRow>): AbTestRow {
  return {
    id: uid(), site_id: 'site-1', youtube_video_id: 'vid-1',
    source_pipeline_id: null, name: 'Test Thumbnail A',
    status: 'active', config: { ...AB_TEST_CONFIG_DEFAULTS },
    test_type: 'thumbnail', original_thumbnail_url: 'https://img.youtube.com/vi/test/hqdefault.jpg',
    original_title: null, original_description: null,
    winner_variant_id: null, started_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    paused_at: null, completed_at: null, completed_reason: null,
    confidence_at_completion: null, consecutive_confident_evals: 0,
    status_note: null, result_metadata: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    parent_test_id: null, round_number: 1, playoff_test_id: null, playoff_start_after: null,
    ...overrides,
  }
}

export function makeVariant(overrides?: Partial<AbTestVariantRow>): AbTestVariantRow {
  return {
    id: uid(), test_id: 'test-1', label: 'original', is_original: true,
    blob_url: null, blob_key: null, file_size_bytes: null, dimensions: null,
    title_text: null, description_text: null, metadata: {},
    sort_order: 0, created_at: new Date().toISOString(), source_variant_id: null,
    ...overrides,
  }
}

export function makeTestWithVariants(overrides?: {
  variantCtr?: number[]; confidence?: number; hasWinner?: boolean;
  startedDaysAgo?: number; createdAt?: string; playoffTestId?: string;
}): AbTestWithVariants {
  const row = makeTestRow({
    started_at: overrides?.startedDaysAgo
      ? new Date(Date.now() - overrides.startedDaysAgo * 86400000).toISOString()
      : new Date(Date.now() - 5 * 86400000).toISOString(),
    created_at: overrides?.createdAt ?? new Date().toISOString(),
    playoff_test_id: overrides?.playoffTestId ?? null,
    winner_variant_id: overrides?.hasWinner ? 'var-b' : null,
    confidence_at_completion: overrides?.confidence ?? null,
  })
  const variants: AbTestVariantRow[] = [
    makeVariant({ id: 'var-a', test_id: row.id, label: 'original', is_original: true, sort_order: 0 }),
    makeVariant({ id: 'var-b', test_id: row.id, label: 'B', is_original: false, sort_order: 1,
      blob_url: 'https://blob.vercel-storage.com/thumb-b.jpg' }),
  ]
  return { ...row, variants, current_cycle: null, total_cycles: 4 }
}

export function makeCardView(overrides?: Partial<AbTestCardView>): AbTestCardView {
  return {
    id: uid(), name: 'Test Thumbnail A', type: 'thumbnail', status: 'active',
    dayOf: 5, confidence: 88, lift: 12.3, leader: 'B', leaderColor: '#E8823C',
    leaderThumbUrl: 'https://blob.vercel-storage.com/thumb-b.jpg',
    variants: [
      { label: 'A', color: '#8A8F98', thumbUrl: 'https://img.youtube.com/vi/test/hqdefault.jpg' },
      { label: 'B', color: '#E8823C', thumbUrl: 'https://blob.vercel-storage.com/thumb-b.jpg' },
    ],
    hasPlayoff: false, roundNumber: 1, createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeCompleted(overrides?: { winner?: string | null; lift?: number }): AbTestCardView {
  return makeCardView({
    status: 'completed',
    leader: (overrides?.winner as DisplayLabel) ?? 'B',
    lift: overrides?.lift ?? 15,
    ...overrides,
  })
}

export function makeDraft(overrides?: Partial<AbTestDraft>): AbTestDraft {
  return {
    id: uid(), name: 'Draft Test', type: 'thumbnail', step: 1,
    thumbUrl: null, createdAt: new Date().toISOString(), createdAgo: '2 hours ago',
    ...overrides,
  }
}

export function makeLearnings(overrides?: { tags?: number; negativeTag?: boolean }): LearningsData {
  const count = overrides?.tags ?? 5
  const tags: LearningsTag[] = Array.from({ length: count }, (_, i) => ({
    tag: overrides?.negativeTag && i === 0 ? 'no-text' : `tag-${i}`,
    wins: 3 + i, avgLift: overrides?.negativeTag && i === 0 ? -5 : 8 + i,
    kind: 'thumb' as const,
    negative: overrides?.negativeTag && i === 0 ? true : undefined,
  }))
  return { tags, totalTests: 10, insightText: 'Close-up faces perform 23% better on average.' }
}

export function makeSuggestion(overrides?: Partial<SuggestedVideo>): SuggestedVideo {
  return {
    id: uid(), title: 'Underperforming Video',
    thumbnailUrl: 'https://img.youtube.com/vi/test/hqdefault.jpg',
    ctr: 2.1, channelMedianCtr: 5.0, grade: 'D',
    reason: 'CTR 58% below channel median', suggest: 'thumbnail',
    ...overrides,
  }
}

export function makeSuggestions(count: number): SuggestedVideo[] {
  return Array.from({ length: count }, () => makeSuggestion())
}

export const defaultSettings: AbTestSiteSettings = { ...AB_SITE_SETTINGS_DEFAULTS }
