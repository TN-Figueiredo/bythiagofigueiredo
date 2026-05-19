import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'

/* ------------------------------------------------------------------ */
/*  Next.js navigation mock                                            */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}))

/* ------------------------------------------------------------------ */
/*  Child component mocks                                              */
/* ------------------------------------------------------------------ */

vi.mock('@/app/cms/(authed)/pipeline/audio/_components/audio-filters-v2', () => ({
  AudioFiltersV2: (props: any) => (
    <div data-testid="audio-filters" onClick={() => props.setFilters({ type: 'music' })} />
  ),
}))

vi.mock('@/app/cms/(authed)/pipeline/audio/_components/audio-grid-v2', () => ({
  AudioGridV2: (props: any) => (
    <div data-testid="audio-grid">
      {props.assets.map((a: any) => (
        <div key={a.id}>{a.asset_id}</div>
      ))}
    </div>
  ),
}))

vi.mock('@/app/cms/(authed)/pipeline/audio/_components/audio-table-v2', () => ({
  AudioTableV2: (props: any) => (
    <div data-testid="audio-table">{props.assets.length} assets</div>
  ),
}))

vi.mock('@/app/cms/(authed)/pipeline/audio/_components/audio-detail-v2', () => ({
  AudioDetailV2: (props: any) => (
    <div data-testid="audio-detail">
      <button onClick={props.onClose}>close</button>
    </div>
  ),
}))

vi.mock('@/app/cms/(authed)/pipeline/audio/_components/audio-import-modal', () => ({
  AudioImportModal: (props: any) => (
    <div data-testid="import-modal">
      <button onClick={props.onClose}>close-import</button>
    </div>
  ),
}))

vi.mock('@/app/cms/(authed)/pipeline/audio/_components/audio-empty', () => ({
  AudioEmpty: () => <div data-testid="audio-empty" />,
}))

vi.mock('@/app/cms/(authed)/pipeline/audio/_components/audio-skeleton', () => ({
  AudioGridSkeleton: () => <div data-testid="audio-skeleton" />,
}))

vi.mock('@/app/cms/(authed)/pipeline/audio/_components/audio-toast', () => ({
  ToastContainer: () => null,
  useToasts: () => ({ toasts: [], addToast: vi.fn(), dismissToast: vi.fn() }),
}))

import { AudioLibrary } from '@/app/cms/(authed)/pipeline/audio/_components/audio-library'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

function makeAsset(overrides: Partial<AudioAssetRow> = {}): AudioAssetRow {
  return {
    id: 'asset-1',
    site_id: 'site-1',
    asset_id: 'file-001',
    original_filename: 'track-001.mp3',
    renamed_to: null,
    sha256: null,
    type: 'music',
    source: 'artlist',
    category: 'Cinematic',
    subcategory: null,
    genre: null,
    artist: 'Artist One',
    track_name: 'Alpha Track',
    artlist_url: null,
    duration_seconds: 180,
    bpm: 120,
    music_key: 'C',
    time_signature: '4/4',
    energy: 3,
    tempo_feel: null,
    tags: ['cinematic', 'epic'],
    mood: ['intense'],
    instruments: ['piano'],
    use_cases: [],
    reuse_scenarios: [],
    reusable: true,
    status: 'downloaded',
    priority: null,
    metadata: {},
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const ASSET_MUSIC = makeAsset({
  id: 'asset-1',
  asset_id: 'file-001',
  type: 'music',
  status: 'downloaded',
})

const ASSET_SFX = makeAsset({
  id: 'asset-2',
  asset_id: 'file-002',
  type: 'sfx',
  status: 'pending',
  category: 'SFX',
  tags: ['short', 'punchy'],
})

const INITIAL_ASSETS: AudioAssetRow[] = [ASSET_MUSIC, ASSET_SFX]

const MOCK_STATS = {
  total: 10,
  music: 5,
  sfx: 5,
  downloaded: 8,
  pending: 2,
  retired: 0,
}

/* ------------------------------------------------------------------ */
/*  matchMedia mock (wide screen — filters visible by default)         */
/* ------------------------------------------------------------------ */

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderLibrary(props: {
  initialAssets?: AudioAssetRow[]
  stats?: typeof MOCK_STATS
} = {}) {
  return render(
    <AudioLibrary
      initialAssets={props.initialAssets ?? INITIAL_ASSETS}
      stats={props.stats ?? MOCK_STATS}
    />,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AudioLibrary', () => {
  beforeEach(() => {
    mockMatchMedia(false) // wide screen: matches = false for (max-width: 900px)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders in grid view by default', () => {
    renderLibrary()
    expect(screen.getByTestId('audio-grid')).toBeTruthy()
    expect(screen.queryByTestId('audio-table')).toBeNull()
  })

  it('switches to table view on Table button click', () => {
    renderLibrary()
    fireEvent.click(screen.getByRole('button', { name: /^table$/i }))
    expect(screen.queryByTestId('audio-grid')).toBeNull()
    expect(screen.getByTestId('audio-table')).toBeTruthy()
  })

  it('shows stats bar with live counts', () => {
    renderLibrary()
    const statsEl = screen.getByText(/total/)
    expect(statsEl).toBeTruthy()
    const statsBar = statsEl.closest('div') as HTMLElement
    expect(statsBar.textContent).toContain('music')
    expect(statsBar.textContent).toContain('sfx')
    expect(statsBar.textContent).toContain('ready')
    expect(statsBar.textContent).toContain('pending')
  })

  it('shows filters panel by default on wide screen', () => {
    renderLibrary()
    expect(screen.getByTestId('audio-filters')).toBeTruthy()
  })

  it('hides filters panel when Hide Filters clicked', () => {
    renderLibrary()
    // Filters should be visible initially
    expect(screen.getByTestId('audio-filters')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /hide filters/i }))

    expect(screen.queryByTestId('audio-filters')).toBeNull()
  })

  it('opens import modal on Import JSON click', () => {
    renderLibrary()
    expect(screen.queryByTestId('import-modal')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /import json/i }))
    expect(screen.getByTestId('import-modal')).toBeTruthy()
  })

  it('shows error banner on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    )
    renderLibrary()

    // Trigger a filter change by clicking the mock AudioFilters
    fireEvent.click(screen.getByTestId('audio-filters'))

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeTruthy()
    })
  })

  it('shows Load more button when hasNext is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [ASSET_MUSIC, ASSET_SFX],
          meta: { has_next: true, next_cursor: 'abc', total: 100 },
        }),
      } as Response),
    )
    renderLibrary()

    // Trigger a filter change — refetch will be called
    fireEvent.click(screen.getByTestId('audio-filters'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /load more/i })).toBeTruthy()
    })
  })
})
