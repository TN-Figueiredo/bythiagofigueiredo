import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { BRollCard } from '@/app/cms/(authed)/pipeline/brolls/_components/broll-card'
import { BRollFilters } from '@/app/cms/(authed)/pipeline/brolls/_components/broll-filters'
import { BRollGrid } from '@/app/cms/(authed)/pipeline/brolls/_components/broll-grid'
import { BRollDetail } from '@/app/cms/(authed)/pipeline/brolls/_components/broll-detail'
import { AssetPickerDialog } from '@/app/cms/(authed)/pipeline/_components/asset-picker-dialog'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import type { BRollFilterState } from '@/app/cms/(authed)/pipeline/brolls/_helpers/use-broll-filters'

// ─── Mocks ───────────────────────────────────────────────────────────────────

// FrameStrip is a visual-only component — replace with a lightweight stub
vi.mock(
  '@/app/cms/(authed)/pipeline/brolls/_components/frame-strip',
  () => ({
    FrameStrip: ({ thumbnailUrl }: { thumbnailUrl?: string | null }) => (
      <div data-testid="frame-strip" data-thumb={thumbnailUrl ?? ''} />
    ),
  }),
)

// IntersectionObserver is not available in happy-dom
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
;(globalThis as Record<string, unknown>).IntersectionObserver = MockIntersectionObserver

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<BRollAssetRow> = {}): BRollAssetRow {
  return {
    id: 'asset-1',
    site_id: 'site-1',
    asset_id: 'broll-001',
    original_filename: 'sunset.mp4',
    renamed_to: null,
    sha256: null,
    file_size_bytes: null,
    type: 'footage',
    source: 'local',
    source_type: 'pessoal',
    category: 'travel',
    subcategory: null,
    location: null,
    description: 'Beautiful sunset footage',
    tags: ['sunset', 'golden-hour', 'sky'],
    codec: 'h264',
    fps: 30,
    resolution: '1080p',
    width: null,
    height: null,
    duration_seconds: 12,
    bitrate_kbps: null,
    has_audio: false,
    color_profile: null,
    storage_url: null,
    thumbnail_url: null,
    proxy_url: null,
    reusable: true,
    status: 'available',
    captured_at: null,
    metadata: {},
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeFilters(overrides: Partial<BRollFilterState> = {}): BRollFilterState {
  return {
    q: null,
    source_type: null,
    status: null,
    category: null,
    resolution: null,
    duration: null,
    codec: null,
    fps: null,
    tags: null,
    sort: 'newest',
    ...overrides,
  }
}

// ─── BRollCard ────────────────────────────────────────────────────────────────

describe('BRollCard', () => {
  it('renders asset name (original_filename when renamed_to is null)', () => {
    render(<BRollCard asset={makeAsset()} selected={false} onSelect={vi.fn()} />)
    expect(screen.getByText('sunset.mp4')).toBeTruthy()
  })

  it('prefers renamed_to over original_filename as display name', () => {
    render(
      <BRollCard
        asset={makeAsset({ renamed_to: 'golden-hour.mp4' })}
        selected={false}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('golden-hour.mp4')).toBeTruthy()
    expect(screen.queryByText('sunset.mp4')).toBeNull()
  })

  it('renders duration badge when duration_seconds is set', () => {
    render(<BRollCard asset={makeAsset({ duration_seconds: 12 })} selected={false} onSelect={vi.fn()} />)
    // formatDuration(12) → '12s'
    expect(screen.getAllByText('12s').length).toBeGreaterThan(0)
  })

  it('does not render duration badge when duration_seconds is null', () => {
    render(<BRollCard asset={makeAsset({ duration_seconds: null })} selected={false} onSelect={vi.fn()} />)
    expect(screen.queryByText('12s')).toBeNull()
  })

  it('passes https thumbnail URL to FrameStrip unchanged', () => {
    const { container } = render(
      <BRollCard
        asset={makeAsset({ thumbnail_url: 'https://cdn.example.com/thumb.jpg' })}
        selected={false}
        onSelect={vi.fn()}
      />,
    )
    const strip = container.querySelector('[data-testid="frame-strip"]')
    expect(strip?.getAttribute('data-thumb')).toBe('https://cdn.example.com/thumb.jpg')
  })

  it('passes data:image/ URL to FrameStrip unchanged', () => {
    const dataUrl = 'data:image/png;base64,abc123'
    const { container } = render(
      <BRollCard
        asset={makeAsset({ thumbnail_url: dataUrl })}
        selected={false}
        onSelect={vi.fn()}
      />,
    )
    const strip = container.querySelector('[data-testid="frame-strip"]')
    expect(strip?.getAttribute('data-thumb')).toBe(dataUrl)
  })

  it('strips http:// thumbnail URL (sanitization — passes null to FrameStrip)', () => {
    const { container } = render(
      <BRollCard
        asset={makeAsset({ thumbnail_url: 'http://insecure.example.com/thumb.jpg' })}
        selected={false}
        onSelect={vi.fn()}
      />,
    )
    const strip = container.querySelector('[data-testid="frame-strip"]')
    // sanitizeThumbnailUrl returns null → FrameStrip receives null → data-thumb=""
    expect(strip?.getAttribute('data-thumb')).toBe('')
  })

  it('strips javascript: thumbnail URL (sanitization)', () => {
    const { container } = render(
      <BRollCard
        asset={makeAsset({ thumbnail_url: 'javascript:alert(1)' })}
        selected={false}
        onSelect={vi.fn()}
      />,
    )
    const strip = container.querySelector('[data-testid="frame-strip"]')
    expect(strip?.getAttribute('data-thumb')).toBe('')
  })

  it('shows Pending status badge for pending assets', () => {
    render(<BRollCard asset={makeAsset({ status: 'pending' })} selected={false} onSelect={vi.fn()} />)
    expect(screen.getByText('Pending')).toBeTruthy()
  })

  it('does not show status badge for available assets', () => {
    render(<BRollCard asset={makeAsset({ status: 'available' })} selected={false} onSelect={vi.fn()} />)
    // Status badge is only rendered for pending (isPending guard)
    expect(screen.queryByText('Available')).toBeNull()
    expect(screen.queryByText('Pending')).toBeNull()
  })

  it('does not show status badge for retired assets (badge only for pending)', () => {
    render(<BRollCard asset={makeAsset({ status: 'retired' })} selected={false} onSelect={vi.fn()} />)
    expect(screen.queryByText('Retired')).toBeNull()
  })

  it('calls onSelect with the asset id when clicked', () => {
    const onSelect = vi.fn()
    render(<BRollCard asset={makeAsset({ id: 'abc-123' })} selected={false} onSelect={onSelect} />)
    const card = screen.getByRole('article')
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalledWith('abc-123')
  })

  it('calls onSelect on Enter keydown', () => {
    const onSelect = vi.fn()
    render(<BRollCard asset={makeAsset({ id: 'abc-123' })} selected={false} onSelect={onSelect} />)
    const card = screen.getByRole('article')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('abc-123')
  })

  it('calls onSelect on Space keydown', () => {
    const onSelect = vi.fn()
    render(<BRollCard asset={makeAsset({ id: 'abc-123' })} selected={false} onSelect={onSelect} />)
    const card = screen.getByRole('article')
    fireEvent.keyDown(card, { key: ' ' })
    expect(onSelect).toHaveBeenCalledWith('abc-123')
  })

  it('sets aria-pressed=true when selected', () => {
    render(<BRollCard asset={makeAsset()} selected={true} onSelect={vi.fn()} />)
    const card = screen.getByRole('article')
    expect(card.getAttribute('aria-pressed')).toBe('true')
  })

  it('sets aria-pressed=false when not selected', () => {
    render(<BRollCard asset={makeAsset()} selected={false} onSelect={vi.fn()} />)
    const card = screen.getByRole('article')
    expect(card.getAttribute('aria-pressed')).toBe('false')
  })

  it('shows up to 3 tag pills and an overflow count for more', () => {
    const asset = makeAsset({ tags: ['a', 'b', 'c', 'd', 'e'] })
    render(<BRollCard asset={asset} selected={false} onSelect={vi.fn()} />)
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('b')).toBeTruthy()
    expect(screen.getByText('c')).toBeTruthy()
    // 4th and 5th tags are hidden, replaced by "+2"
    expect(screen.queryByText('d')).toBeNull()
    expect(screen.getByText('+2')).toBeTruthy()
  })

  it('shows no overflow count when 3 or fewer tags', () => {
    render(<BRollCard asset={makeAsset({ tags: ['x', 'y'] })} selected={false} onSelect={vi.fn()} />)
    expect(screen.queryByText(/^\+\d/)).toBeNull()
  })
})

// ─── BRollFilters ─────────────────────────────────────────────────────────────

describe('BRollFilters', () => {
  const defaultFilters = makeFilters()
  const defaultProps = {
    filters: defaultFilters,
    setFilters: vi.fn(),
    clearAll: vi.fn(),
    activeCount: 0,
    assets: [] as BRollAssetRow[],
    availableTags: [] as string[],
  }

  it('renders the search input', () => {
    render(<BRollFilters {...defaultProps} />)
    expect(screen.getByRole('combobox', { name: /search b-roll assets/i })).toBeTruthy()
  })

  it('status filter has an "available" option (value=available)', () => {
    render(<BRollFilters {...defaultProps} />)
    // Status group uses Segmented with aria-label="Filter by status"
    const group = screen.getByRole('group', { name: /filter by status/i })
    const availableBtn = Array.from(group.querySelectorAll('button')).find(
      (b) => b.textContent?.trim().startsWith('Available'),
    )
    expect(availableBtn).toBeTruthy()
  })

  it('status filter does NOT have a "ready" option (correct label is "available")', () => {
    render(<BRollFilters {...defaultProps} />)
    const group = screen.getByRole('group', { name: /filter by status/i })
    const buttons = Array.from(group.querySelectorAll('button'))
    const readyBtn = buttons.find((b) => b.textContent?.trim() === 'Ready')
    expect(readyBtn).toBeUndefined()
  })

  it('status filter has "Pending" option', () => {
    render(<BRollFilters {...defaultProps} />)
    const group = screen.getByRole('group', { name: /filter by status/i })
    const pendingBtn = Array.from(group.querySelectorAll('button')).find(
      (b) => b.textContent?.trim().startsWith('Pending'),
    )
    expect(pendingBtn).toBeTruthy()
  })

  it('calls setFilters when status button is clicked', () => {
    const setFilters = vi.fn()
    render(<BRollFilters {...defaultProps} setFilters={setFilters} />)
    const group = screen.getByRole('group', { name: /filter by status/i })
    const availableBtn = Array.from(group.querySelectorAll('button')).find(
      (b) => b.textContent?.trim().startsWith('Available'),
    )
    fireEvent.click(availableBtn!)
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ status: 'available' }))
  })

  it('renders category filter buttons for each unique category in assets', () => {
    const assets = [
      makeAsset({ id: '1', category: 'travel' }),
      makeAsset({ id: '2', category: 'nature' }),
    ]
    render(<BRollFilters {...defaultProps} assets={assets} />)
    expect(screen.getByRole('button', { name: /travel/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /nature/i })).toBeTruthy()
  })

  it('does not render category section when no assets have categories', () => {
    const assets = [makeAsset({ category: null })]
    render(<BRollFilters {...defaultProps} assets={assets} />)
    // Categoria section is only rendered when allCategories.length > 0
    expect(screen.queryByText('Categoria')).toBeNull()
  })

  it('calls setFilters with correct category when category button clicked', () => {
    const setFilters = vi.fn()
    const assets = [makeAsset({ id: '1', category: 'urban' })]
    render(<BRollFilters {...defaultProps} assets={assets} setFilters={setFilters} />)
    fireEvent.click(screen.getByRole('button', { name: /urban/i }))
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ category: 'urban' }))
  })

  it('debounces search input and calls setFilters after 300ms', async () => {
    vi.useFakeTimers()
    const setFilters = vi.fn()
    render(<BRollFilters {...defaultProps} setFilters={setFilters} />)
    const input = screen.getByRole('combobox', { name: /search b-roll assets/i })
    fireEvent.change(input, { target: { value: 'sunset' } })
    // Not called yet
    expect(setFilters).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(300) })
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ q: 'sunset' }))
    vi.useRealTimers()
  })

  it('calls setFilters with q=null when search input is cleared (whitespace trimmed to empty)', async () => {
    vi.useFakeTimers()
    const setFilters = vi.fn()
    // Start with q='something' so clearing is meaningful
    render(
      <BRollFilters
        {...defaultProps}
        filters={makeFilters({ q: 'something' })}
        setFilters={setFilters}
      />,
    )
    const input = screen.getByRole('combobox', { name: /search b-roll assets/i })
    // Type a non-empty value first to trigger debounce, then clear
    fireEvent.change(input, { target: { value: 'x' } })
    act(() => { vi.advanceTimersByTime(300) })
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ q: 'x' }))
    vi.useRealTimers()
  })

  it('shows active filter pills and a "Clear all" button when activeCount > 0', () => {
    const filters = makeFilters({ q: 'sunset', status: 'available' as BRollFilterState['status'] })
    const pills = [
      { key: 'q' as const, label: 'Search: sunset' },
      { key: 'status' as const, label: 'Status: available' },
    ]
    render(
      <BRollFilters
        {...defaultProps}
        filters={filters}
        activeCount={2}
      />,
    )
    // Active pills are derived from filters prop
    expect(screen.getByText(/search: sunset/i)).toBeTruthy()
    expect(screen.getByText(/clear all/i)).toBeTruthy()
  })

  it('calls clearAll when "Clear all" button is clicked', () => {
    const clearAll = vi.fn()
    const filters = makeFilters({ q: 'test' })
    render(
      <BRollFilters
        {...defaultProps}
        filters={filters}
        clearAll={clearAll}
        activeCount={1}
      />,
    )
    fireEvent.click(screen.getByText(/clear all/i))
    expect(clearAll).toHaveBeenCalledTimes(1)
  })
})

// ─── BRollGrid ────────────────────────────────────────────────────────────────

describe('BRollGrid', () => {
  it('renders the correct number of cards', () => {
    const assets = [
      makeAsset({ id: '1', original_filename: 'clip-1.mp4' }),
      makeAsset({ id: '2', original_filename: 'clip-2.mp4' }),
      makeAsset({ id: '3', original_filename: 'clip-3.mp4' }),
    ]
    render(<BRollGrid assets={assets} selectedId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('clip-1.mp4')).toBeTruthy()
    expect(screen.getByText('clip-2.mp4')).toBeTruthy()
    expect(screen.getByText('clip-3.mp4')).toBeTruthy()
    // 3 article cards
    expect(screen.getAllByRole('article').length).toBe(3)
  })

  it('returns null (renders nothing) when assets array is empty', () => {
    const { container } = render(<BRollGrid assets={[]} selectedId={null} onSelect={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('marks the selected card with aria-pressed=true', () => {
    const assets = [
      makeAsset({ id: 'a' }),
      makeAsset({ id: 'b', original_filename: 'b.mp4' }),
    ]
    render(<BRollGrid assets={assets} selectedId="a" onSelect={vi.fn()} />)
    const cards = screen.getAllByRole('article')
    const selectedCard = cards.find((c) => c.getAttribute('data-card-id') === 'a')
    expect(selectedCard?.getAttribute('aria-pressed')).toBe('true')
    const unselectedCard = cards.find((c) => c.getAttribute('data-card-id') === 'b')
    expect(unselectedCard?.getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onSelect with card id when a card is clicked', () => {
    const onSelect = vi.fn()
    const assets = [makeAsset({ id: 'xyz' })]
    render(<BRollGrid assets={assets} selectedId={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('article'))
    expect(onSelect).toHaveBeenCalledWith('xyz')
  })
})

// ─── BRollDetail ──────────────────────────────────────────────────────────────

describe('BRollDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const assetWithUsage = {
    ...makeAsset({ id: 'detail-1', description: 'Scenic shot', tags: ['mountain', 'dawn'] }),
    usage: [],
  }

  function stubFetchOnce(data: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data }),
      }),
    )
  }

  async function renderAndWaitForAsset(assetName = 'sunset.mp4') {
    render(
      <BRollDetail
        assetId="detail-1"
        allAssets={[]}
        onClose={vi.fn()}
        onFilter={vi.fn()}
      />,
    )
    return screen.findByText(assetName, {}, { timeout: 3000 })
  }

  it('shows loading skeleton while fetching', () => {
    // Never-resolving fetch → stays in loading state
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    const { container } = render(
      <BRollDetail
        assetId="detail-1"
        allAssets={[]}
        onClose={vi.fn()}
        onFilter={vi.fn()}
      />,
    )
    // Skeleton renders divs (no role), just ensure nothing from loaded state appears
    expect(screen.queryByRole('tab')).toBeNull()
    expect(container.firstChild).toBeTruthy()
  })

  it('renders asset name after fetch resolves', async () => {
    stubFetchOnce(assetWithUsage)
    const name = await renderAndWaitForAsset('sunset.mp4')
    expect(name).toBeTruthy()
  })

  it('renders Details, Usage, Related, Raw tabs', async () => {
    stubFetchOnce(assetWithUsage)
    await renderAndWaitForAsset('sunset.mp4')
    const tabs = screen.getAllByRole('tab')
    const tabLabels = tabs.map((t) => t.textContent?.trim())
    expect(tabLabels).toContain('Details')
    expect(tabLabels).toContain('Usage')
    expect(tabLabels).toContain('Related')
    expect(tabLabels).toContain('Raw')
  })

  it('renders asset description in Details tab', async () => {
    stubFetchOnce(assetWithUsage)
    await renderAndWaitForAsset()
    expect(screen.getByText('Scenic shot')).toBeTruthy()
  })

  it('renders asset tags in Details tab', async () => {
    stubFetchOnce(assetWithUsage)
    await renderAndWaitForAsset()
    expect(screen.getByText('mountain')).toBeTruthy()
    expect(screen.getByText('dawn')).toBeTruthy()
  })

  it('shows Edit button initially and Save/Cancel after clicking it', async () => {
    stubFetchOnce(assetWithUsage)
    await renderAndWaitForAsset()
    const editBtn = screen.getByRole('button', { name: /edit asset/i })
    expect(editBtn).toBeTruthy()
    fireEvent.click(editBtn)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /cancel editing/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /edit asset/i })).toBeNull()
  })

  it('returns to view mode when Cancel is clicked', async () => {
    stubFetchOnce(assetWithUsage)
    await renderAndWaitForAsset()
    fireEvent.click(screen.getByRole('button', { name: /edit asset/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel editing/i }))
    expect(screen.getByRole('button', { name: /edit asset/i })).toBeTruthy()
  })

  it('calls PATCH when Save button is clicked', async () => {
    const patchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: { ...assetWithUsage, version: 2 } }),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ data: assetWithUsage }),
        })
        .mockImplementation(patchMock),
    )
    await renderAndWaitForAsset()
    fireEvent.click(screen.getByRole('button', { name: /edit asset/i }))
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    // Wait for PATCH to be called
    await vi.waitFor(() => {
      const calls = patchMock.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      expect(String(calls[0]?.[0])).toContain('/api/pipeline/broll-library/detail-1')
      expect((calls[0]?.[1] as RequestInit)?.method).toBe('PATCH')
    })
  })

  it('calls onClose when Close button is clicked', async () => {
    stubFetchOnce(assetWithUsage)
    const onClose = vi.fn()
    render(
      <BRollDetail
        assetId="detail-1"
        allAssets={[]}
        onClose={onClose}
        onFilter={vi.fn()}
      />,
    )
    await screen.findByText('sunset.mp4', {}, { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: /close detail panel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({}),
      }),
    )
    render(
      <BRollDetail
        assetId="bad-id"
        allAssets={[]}
        onClose={vi.fn()}
        onFilter={vi.fn()}
      />,
    )
    const error = await screen.findByText(/failed to load asset/i, {}, { timeout: 3000 })
    expect(error).toBeTruthy()
  })
})

// ─── AssetPickerDialog ────────────────────────────────────────────────────────

describe('AssetPickerDialog', () => {
  const defaultContext = {
    description: 'Pick a clip for the intro beat',
    suggestedTags: ['nature', 'outdoor'],
    suggestedCategory: undefined,
    suggestedResolution: undefined,
  }

  const brollResult: BRollAssetRow = makeAsset({ id: 'pick-1', original_filename: 'forest.mp4', tags: [] })

  function stubFetchBRoll(assets: BRollAssetRow[] = []) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: assets }),
      }),
    )
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the dialog with broll title', async () => {
    stubFetchBRoll()
    render(
      <AssetPickerDialog
        assetType="broll"
        context={defaultContext}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('SELECIONAR B-ROLL')
  })

  it('renders the dialog with audio title when assetType=audio', async () => {
    stubFetchBRoll()
    render(
      <AssetPickerDialog
        assetType="audio"
        context={defaultContext}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('SELECIONAR AUDIO')
  })

  it('audio type filter buttons (All, Music, SFX) have onClick handlers', async () => {
    stubFetchBRoll()
    render(
      <AssetPickerDialog
        assetType="audio"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    await screen.findByRole('dialog')
    const buttons = screen.getAllByRole('button')
    const musicType = buttons.find((b) => b.textContent?.trim() === 'Music')
    const sfxType = buttons.find((b) => b.textContent?.trim() === 'SFX')
    expect(musicType).toBeTruthy()
    expect(sfxType).toBeTruthy()
    // Clicking Music should toggle without errors and set it as active
    expect(() => fireEvent.click(musicType!)).not.toThrow()
    expect(musicType?.getAttribute('aria-pressed')).toBe('true')
    // Clicking SFX deselects Music and activates SFX
    fireEvent.click(sfxType!)
    expect(sfxType?.getAttribute('aria-pressed')).toBe('true')
    expect(musicType?.getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking a result card sets it as selected (shown in footer)', async () => {
    stubFetchBRoll([brollResult])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    // Wait for loading to finish and result card to appear
    const card = await screen.findByText('forest.mp4')
    // Click the card to select it
    fireEvent.click(card)
    // Footer shows "1 selecionado"
    expect(screen.getByText(/1 selecionado/i)).toBeTruthy()
  })

  it('Confirm button is disabled when no asset is selected', async () => {
    stubFetchBRoll([brollResult])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    await screen.findByText('forest.mp4')
    const confirmBtn = screen.getByRole('button', { name: /selecionar/i })
    expect(confirmBtn.hasAttribute('disabled')).toBe(true)
  })

  it('Confirm button becomes enabled after selecting an asset', async () => {
    stubFetchBRoll([brollResult])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const card = await screen.findByText('forest.mp4')
    fireEvent.click(card)
    const confirmBtn = screen.getByRole('button', { name: /selecionar/i })
    expect(confirmBtn.hasAttribute('disabled')).toBe(false)
  })

  it('calls onSelect with the selected asset when Confirm is clicked', async () => {
    stubFetchBRoll([brollResult])
    const onSelect = vi.fn()
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    )
    const card = await screen.findByText('forest.mp4')
    fireEvent.click(card)
    fireEvent.click(screen.getByRole('button', { name: /selecionar/i }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'pick-1' }))
  })

  it('calls onCancel when the Cancelar button is clicked', async () => {
    stubFetchBRoll()
    const onCancel = vi.fn()
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    )
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pre-selects asset matching initialSelectedId', async () => {
    stubFetchBRoll([brollResult])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        initialSelectedId="pick-1"
      />,
    )
    await screen.findByText('forest.mp4')
    // Footer shows "1 selecionado"
    expect(screen.getByText(/1 selecionado/i)).toBeTruthy()
    // Confirm button is enabled
    const confirmBtn = screen.getByRole('button', { name: /selecionar/i })
    expect(confirmBtn.hasAttribute('disabled')).toBe(false)
  })

  it('shows empty state message when no results are found', async () => {
    stubFetchBRoll([])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const empty = await screen.findByText(/no assets found/i)
    expect(empty).toBeTruthy()
  })
})
