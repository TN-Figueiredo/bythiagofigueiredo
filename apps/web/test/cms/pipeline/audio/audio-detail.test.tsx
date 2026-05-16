import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AudioAssetRow, AudioAssetUsageRow } from '@/lib/pipeline/audio-schemas'

// Mock Waveform to avoid SVG complexity
vi.mock('@/app/cms/(authed)/pipeline/audio/_components/waveform', () => ({
  Waveform: () => <div data-testid="waveform" />,
}))

import { AudioDetail } from '@/app/cms/(authed)/pipeline/audio/_components/audio-detail'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

function makeAsset(overrides: Partial<AudioAssetRow> = {}): AudioAssetRow {
  return {
    id: 'asset-uuid-1',
    site_id: 'site-uuid-1',
    asset_id: 'track-001',
    original_filename: 'track-001.mp3',
    renamed_to: null,
    sha256: null,
    type: 'music',
    source: 'artlist',
    category: 'Cinematic',
    subcategory: null,
    genre: null,
    artist: 'Test Artist',
    track_name: 'My Test Track',
    artlist_url: null,
    duration_seconds: null,
    bpm: null,
    music_key: null,
    time_signature: '4/4',
    energy: null,
    tempo_feel: null,
    tags: ['epic', 'dramatic'],
    mood: ['intense'],
    instruments: ['piano', 'strings'],
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

type AssetWithUsage = AudioAssetRow & { usage: AudioAssetUsageRow[] }

function makeAssetWithUsage(overrides: Partial<AudioAssetRow> = {}): AssetWithUsage {
  return { ...makeAsset(overrides), usage: [] }
}

const mockFetchSuccess = (asset: AssetWithUsage) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: asset }),
  } as Response)
}

const mockFetchError = (status: number) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  } as Response)
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AudioDetail', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    // Fetch that never resolves — keeps us in loading state
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))

    render(<AudioDetail assetId="asset-uuid-1" onClose={onClose} />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('renders asset details after fetch', async () => {
    const asset = makeAssetWithUsage({ track_name: 'My Test Track', asset_id: 'track-001' })
    mockFetchSuccess(asset)

    render(<AudioDetail assetId="asset-uuid-1" onClose={onClose} />)

    // Should display track_name in the header once loaded
    await waitFor(() => {
      expect(screen.getByText('My Test Track')).toBeDefined()
    })

    // Also verify asset_id appears in the Identity section
    expect(screen.getByText('track-001')).toBeDefined()
  })

  it('shows error on failed fetch', async () => {
    mockFetchError(500)

    render(<AudioDetail assetId="asset-uuid-1" onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load asset')).toBeDefined()
    })
  })

  it('opens edit mode on Edit button click', async () => {
    const asset = makeAssetWithUsage()
    mockFetchSuccess(asset)

    render(<AudioDetail assetId="asset-uuid-1" onClose={onClose} />)

    // Wait for the asset to load
    await waitFor(() => screen.getByText('My Test Track'))

    const editButton = screen.getByRole('button', { name: /edit asset/i })
    fireEvent.click(editButton)

    // Save and Cancel buttons should now appear
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /cancel editing/i })).toBeDefined()
  })

  it('cancels edit on Cancel click', async () => {
    const asset = makeAssetWithUsage()
    mockFetchSuccess(asset)

    render(<AudioDetail assetId="asset-uuid-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('My Test Track'))

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /edit asset/i }))
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDefined()

    // Cancel
    fireEvent.click(screen.getByRole('button', { name: /cancel editing/i }))

    // Edit button should reappear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit asset/i })).toBeDefined()
    })
  })

  it('handles 409 conflict on save', async () => {
    const asset = makeAssetWithUsage()
    mockFetchSuccess(asset)

    render(<AudioDetail assetId="asset-uuid-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('My Test Track'))

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /edit asset/i }))

    // Now mock PATCH to return 409
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({}),
    } as Response)

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    // Conflict alert should appear
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
      expect(screen.getByText(/modified by another user/i)).toBeDefined()
    })
  })

  it('closes on Escape key when not editing', async () => {
    const asset = makeAssetWithUsage()
    mockFetchSuccess(asset)

    render(<AudioDetail assetId="asset-uuid-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('My Test Track'))

    // Fire Escape — should call onClose
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape in edit mode cancels edit, does not close', async () => {
    const asset = makeAssetWithUsage()
    mockFetchSuccess(asset)

    render(<AudioDetail assetId="asset-uuid-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('My Test Track'))

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /edit asset/i }))
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDefined()

    // Fire Escape — should cancel edit, NOT close
    fireEvent.keyDown(window, { key: 'Escape' })

    // Edit button should reappear (edit cancelled)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit asset/i })).toBeDefined()
    })

    // onClose must NOT have been called
    expect(onClose).not.toHaveBeenCalled()
  })
})
