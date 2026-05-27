// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/app/cms/(authed)/youtube/_actions/youtube-prompt-actions', () => ({
  fetchVideoOptimizerData: vi.fn(),
  saveVideoNotes: vi.fn(),
}))

// Stub sub-components to avoid deep import chains
vi.mock('@/app/cms/(authed)/youtube/videos/_components/drawer-header', () => ({
  DrawerHeader: ({ title }: { title: string }) => (
    <div data-testid="drawer-header">{title}</div>
  ),
}))

vi.mock('@/app/cms/(authed)/youtube/videos/_components/thumbnail-with-grade', () => ({
  ThumbnailWithGrade: ({ thumbnailUrl }: { thumbnailUrl: string | null }) => (
    <div data-testid="thumbnail-with-grade">{thumbnailUrl}</div>
  ),
}))

vi.mock('@/app/cms/(authed)/youtube/videos/_components/video-stats-card', () => ({
  VideoStatsCard: () => <div data-testid="video-stats-card" />,
}))

vi.mock('@/app/cms/(authed)/youtube/videos/_components/cms-notes-editor', () => ({
  CmsNotesEditor: () => <div data-testid="cms-notes-editor" />,
}))

vi.mock('@/app/cms/(authed)/youtube/videos/_components/drawer-prompt-section', () => ({
  DrawerPromptSection: () => <div data-testid="drawer-prompt-section" />,
}))

vi.mock('@/app/cms/(authed)/youtube/videos/_components/data-freshness-badge', () => ({
  DataFreshnessBadge: () => <div data-testid="freshness-badge" />,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { VideoOptimizerDrawer } from '@/app/cms/(authed)/youtube/videos/video-optimizer-drawer'
import { fetchVideoOptimizerData } from '@/app/cms/(authed)/youtube/_actions/youtube-prompt-actions'
import type { VideoRow } from '@/app/cms/(authed)/youtube/videos/videos-connected'

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const mockVideo: VideoRow = {
  id: '00000000-0000-4000-8000-000000000001',
  youtubeVideoId: 'dQw4w9WgXcQ',
  title: 'Test Video',
  titleTranslation: null,
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  duration: 'PT10M',
  publishedAt: '2026-05-01T12:00:00Z',
  viewCount: 1500,
  likeCount: 120,
  isFeatured: false,
  isHidden: false,
  categoryId: null,
  categoryName: null,
  categoryColor: null,
  suggestedCategoryId: null,
  suggestedCategoryName: null,
  channelId: 'channel-1',
  channelLocale: 'pt',
  channelHandle: '@testchannel',
  channelName: 'Test Channel',
  pinnedUntil: null,
  durationSeconds: 600,
  abTest: null,
  sourcePipelineId: null,
}

const MOCK_OPTIMIZER_DATA = {
  channel: { name: 'Test Channel', subscribers: 5000, videoCount: 20, tier: 'micro' as const },
  grade: {
    score: 65,
    grade: 'B' as const,
    axes: [{ axis: 'ctr', score: 60, channelMedian: 55, status: 'above' as const }],
    trend: 'stable' as const,
    streak: 3,
  },
  retentionCurve: [1.0, 0.8, 0.6, 0.5, 0.4],
  trafficSources: { browse: 40, search: 30, suggested: 20, other: 10 },
  optimizationState: 'active' as const,
  cycleNumber: 2,
  maxCycles: 5,
  cooldownUntil: null,
  previousDiagnosis: null,
  channelBaseline: { medianCtr: 4.5, medianRetention: 42 },
  snapshotAt: '2026-05-27T00:00:00Z',
  snapshotAgeHours: 2,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VideoOptimizerDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchVideoOptimizerData).mockResolvedValue({ ok: true, data: MOCK_OPTIMIZER_DATA })
  })

  afterEach(() => {
    cleanup()
  })

  // ---- 1. Returns null when video is null ----

  it('returns null when video is null', async () => {
    const { container } = render(
      <VideoOptimizerDrawer video={null} onClose={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  // ---- 2. Shows loading text while fetching ----

  it('shows loading status while fetching', async () => {
    let resolveData!: (v: { ok: true; data: typeof MOCK_OPTIMIZER_DATA }) => void
    vi.mocked(fetchVideoOptimizerData).mockReturnValueOnce(
      new Promise(resolve => { resolveData = resolve }),
    )
    await act(async () => {
      render(<VideoOptimizerDrawer video={mockVideo} onClose={vi.fn()} />)
    })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(/carregando/i)).toBeTruthy()
    // Resolve to prevent dangling promise
    resolveData({ ok: true, data: MOCK_OPTIMIZER_DATA })
  })

  // ---- 3. Shows error when fetch fails ----

  it('shows error alert when fetch returns ok: false', async () => {
    vi.mocked(fetchVideoOptimizerData).mockResolvedValueOnce({
      ok: false,
      error: 'Video not found',
    })
    await act(async () => {
      render(<VideoOptimizerDrawer video={mockVideo} onClose={vi.fn()} />)
    })
    await act(async () => {})
    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain('Video not found')
  })

  // ---- 4. Renders drawer content when data loads ----

  it('renders drawer with role="dialog" and aria-modal when video provided', async () => {
    await act(async () => {
      render(<VideoOptimizerDrawer video={mockVideo} onClose={vi.fn()} />)
    })
    await act(async () => {})
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('renders the video title in the drawer header', async () => {
    await act(async () => {
      render(<VideoOptimizerDrawer video={mockVideo} onClose={vi.fn()} />)
    })
    await act(async () => {})
    expect(screen.getByTestId('drawer-header').textContent).toContain('Test Video')
  })

  it('renders thumbnail after data loads', async () => {
    await act(async () => {
      render(<VideoOptimizerDrawer video={mockVideo} onClose={vi.fn()} />)
    })
    await act(async () => {})
    expect(screen.getByTestId('thumbnail-with-grade')).toBeTruthy()
  })

  it('renders video stats card after data loads', async () => {
    await act(async () => {
      render(<VideoOptimizerDrawer video={mockVideo} onClose={vi.fn()} />)
    })
    await act(async () => {})
    expect(screen.getByTestId('video-stats-card')).toBeTruthy()
  })

  it('renders notes editor after data loads', async () => {
    await act(async () => {
      render(<VideoOptimizerDrawer video={mockVideo} onClose={vi.fn()} />)
    })
    await act(async () => {})
    expect(screen.getByTestId('cms-notes-editor')).toBeTruthy()
  })

  it('renders prompt section after data loads', async () => {
    await act(async () => {
      render(<VideoOptimizerDrawer video={mockVideo} onClose={vi.fn()} />)
    })
    await act(async () => {})
    expect(screen.getByTestId('drawer-prompt-section')).toBeTruthy()
  })

  it('calls fetchVideoOptimizerData with the video id', async () => {
    await act(async () => {
      render(<VideoOptimizerDrawer video={mockVideo} onClose={vi.fn()} />)
    })
    await act(async () => {})
    expect(vi.mocked(fetchVideoOptimizerData)).toHaveBeenCalledWith(mockVideo.id)
  })
})
