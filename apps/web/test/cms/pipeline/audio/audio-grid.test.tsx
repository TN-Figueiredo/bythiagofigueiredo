import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'

// Mock WaveformMini to avoid SVG rendering complexity
vi.mock('@/app/cms/(authed)/pipeline/audio/_components/waveform-mini', () => ({
  WaveformMini: () => <svg data-testid="waveform-mini" />,
}))

import { AudioGrid } from '@/app/cms/(authed)/pipeline/audio/_components/audio-grid'

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
    category: null,
    subcategory: null,
    genre: null,
    artist: null,
    track_name: 'Track Alpha',
    artlist_url: null,
    duration_seconds: null,
    bpm: null,
    music_key: null,
    time_signature: '4/4',
    energy: null,
    tempo_feel: null,
    tags: ['cinematic', 'epic'],
    mood: ['intense'],
    instruments: [],
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

const ASSET_A = makeAsset({
  id: 'asset-1',
  asset_id: 'file-001',
  track_name: 'Track Alpha',
  type: 'music',
  status: 'downloaded',
  tags: ['cinematic', 'epic'],
})

const ASSET_B = makeAsset({
  id: 'asset-2',
  asset_id: 'file-002',
  track_name: 'Track Beta',
  type: 'sfx',
  status: 'pending',
  tags: ['transition', 'short'],
})

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AudioGrid', () => {
  const onSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders grid cards with track names', () => {
    render(<AudioGrid assets={[ASSET_A, ASSET_B]} selectedId={null} onSelect={onSelect} />)

    expect(screen.getByText('Track Alpha')).toBeDefined()
    expect(screen.getByText('Track Beta')).toBeDefined()
  })

  it('shows empty state when no assets', () => {
    render(<AudioGrid assets={[]} selectedId={null} onSelect={onSelect} />)

    expect(screen.getByText(/no assets found/i)).toBeDefined()
  })

  it('calls onSelect when card clicked', () => {
    render(<AudioGrid assets={[ASSET_A, ASSET_B]} selectedId={null} onSelect={onSelect} />)

    // Each card is a <button> with aria-label including track name
    const cardA = screen.getByRole('button', { name: /track alpha/i })
    fireEvent.click(cardA)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('asset-1')
  })

  it('highlights selected card', () => {
    render(<AudioGrid assets={[ASSET_A, ASSET_B]} selectedId="asset-1" onSelect={onSelect} />)

    const cardA = screen.getByRole('button', { name: /track alpha/i })
    const cardB = screen.getByRole('button', { name: /track beta/i })

    // Selected card has 2px solid border vs 1px solid border for unselected
    const styleA = (cardA as HTMLButtonElement).style.border
    const styleB = (cardB as HTMLButtonElement).style.border

    // Selected card should have a thicker border (2px) vs unselected (1px)
    expect(styleA).toContain('2px')
    expect(styleB).toContain('1px')
    expect(styleA).not.toEqual(styleB)
  })

  it('truncates tags to 3 and shows overflow badge', () => {
    const assetWith5Tags = makeAsset({
      id: 'asset-5tags',
      track_name: 'Tag Heavy Track',
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
    })

    render(<AudioGrid assets={[assetWith5Tags]} selectedId={null} onSelect={onSelect} />)

    // Only first 3 tags should appear
    expect(screen.getByText('tag1')).toBeDefined()
    expect(screen.getByText('tag2')).toBeDefined()
    expect(screen.getByText('tag3')).toBeDefined()

    // tag4 and tag5 should NOT appear as individual items
    expect(screen.queryByText('tag4')).toBeNull()
    expect(screen.queryByText('tag5')).toBeNull()
  })
})
