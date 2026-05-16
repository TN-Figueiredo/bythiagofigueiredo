import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'

// WaveformMini renders SVG — mock it to keep tests simple and fast
vi.mock(
  '@/app/cms/(authed)/pipeline/audio/_components/waveform-mini',
  () => ({
    WaveformMini: () => <svg data-testid="waveform-mini" aria-hidden="true" />,
  }),
)

import { AudioTable } from '@/app/cms/(authed)/pipeline/audio/_components/audio-table'

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

const ASSET_A = makeAsset({ id: 'asset-1', track_name: 'Alpha Track', status: 'downloaded' })
const ASSET_B = makeAsset({
  id: 'asset-2',
  asset_id: 'file-002',
  track_name: 'Bravo Beat',
  status: 'pending',
  type: 'sfx',
  bpm: 90,
  energy: 1,
  tags: ['short', 'bright', 'stinger', 'punchy'],
})

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderTable(overrides: {
  assets?: AudioAssetRow[]
  selectedId?: string | null
  onSelect?: ReturnType<typeof vi.fn>
  onRefetch?: ReturnType<typeof vi.fn>
} = {}) {
  const props = {
    assets: [ASSET_A, ASSET_B],
    selectedId: null,
    onSelect: vi.fn(),
    onRefetch: vi.fn(),
    ...overrides,
  }
  render(<AudioTable {...props} />)
  return props
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AudioTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders table with assets', () => {
    renderTable()
    expect(screen.getByRole('table', { name: /audio assets/i })).toBeDefined()
    expect(screen.getByText('Alpha Track')).toBeDefined()
    expect(screen.getByText('Bravo Beat')).toBeDefined()
  })

  it('calls onSelect when row clicked', () => {
    const onSelect = vi.fn()
    renderTable({ onSelect })
    // Click a row — the entire <tr> fires onSelect
    fireEvent.click(screen.getByText('Alpha Track'))
    expect(onSelect).toHaveBeenCalledWith('asset-1')
  })

  it('sorts by name ascending then descending', () => {
    renderTable()
    const nameHeader = screen.getByText(/^Name/)
    // Default sort is name ascending; clicking again flips to descending
    fireEvent.click(nameHeader)
    // After second click the sort indicator should change to ↓
    const descHeader = screen.getByText(/Name.*↓/)
    expect(descHeader).toBeDefined()
  })

  it('checkbox toggles selection and shows checked state', () => {
    renderTable()
    const checkboxes = screen.getAllByRole('checkbox')
    // First checkbox is the header "select all"; rows start from index 1
    const firstRowCheckbox = checkboxes[1] as HTMLInputElement
    expect(firstRowCheckbox.checked).toBe(false)
    fireEvent.click(firstRowCheckbox)
    expect(firstRowCheckbox.checked).toBe(true)
  })

  it('select all checkbox checks all rows', () => {
    renderTable()
    const checkboxes = screen.getAllByRole('checkbox')
    const headerCheckbox = checkboxes[0] as HTMLInputElement
    fireEvent.click(headerCheckbox)
    // After selecting all, each row checkbox should be checked
    const updated = screen.getAllByRole('checkbox')
    const rowCheckboxes = updated.slice(1) as HTMLInputElement[]
    expect(rowCheckboxes.every(cb => cb.checked)).toBe(true)
  })

  it('shows bulk action bar when items are selected', () => {
    renderTable()
    const checkboxes = screen.getAllByRole('checkbox')
    // Select the first row
    fireEvent.click(checkboxes[1]!)
    // Bulk bar should now show "1 selected"
    expect(screen.getByText(/1 selected/)).toBeDefined()
    // Bulk action buttons should appear
    expect(screen.getByText('Tag')).toBeDefined()
    expect(screen.getByText('Export')).toBeDefined()
    expect(screen.getByText('Delete')).toBeDefined()
  })
})
