import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AssetPickerDialog } from '@/app/cms/(authed)/pipeline/_components/asset-picker-dialog'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeBRollAsset(overrides: Partial<BRollAssetRow> = {}): BRollAssetRow {
  return {
    id: 'broll-1',
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
    tags: ['sunset', 'sky'],
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

function makeAudioAsset(overrides: Partial<AudioAssetRow> = {}): AudioAssetRow {
  return {
    id: 'audio-1',
    site_id: 'site-1',
    asset_id: 'audio-001',
    original_filename: 'track.mp3',
    renamed_to: null,
    sha256: null,
    type: 'music',
    source: 'artlist',
    category: 'ambient',
    subcategory: null,
    genre: null,
    artist: null,
    track_name: 'Calm Waves',
    artlist_url: null,
    duration_seconds: 180,
    bpm: 90,
    music_key: 'C',
    time_signature: '4/4',
    energy: 2,
    tempo_feel: null,
    tags: ['calm', 'ambient'],
    mood: [],
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

const defaultContext = {
  description: 'Pick a clip for the intro beat',
  suggestedTags: ['nature'],
  suggestedCategory: undefined,
  suggestedResolution: undefined,
}

function stubFetch(assets: Array<BRollAssetRow | AudioAssetRow> = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: assets }),
    }),
  )
}

function stubFetchNeverResolves() {
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AssetPickerDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Title based on assetType ─────────────────────────────────────────────

  it('renders dialog with title "SELECIONAR B-ROLL" for broll assetType', () => {
    stubFetch()
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
    expect(screen.getByText('SELECIONAR B-ROLL')).toBeTruthy()
  })

  it('renders dialog with title "SELECIONAR AUDIO" for audio assetType', () => {
    stubFetch()
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
    expect(screen.getByText('SELECIONAR AUDIO')).toBeTruthy()
  })

  // ── Loading state ────────────────────────────────────────────────────────

  it('shows loading state initially before fetch resolves', () => {
    stubFetchNeverResolves()
    render(
      <AssetPickerDialog
        assetType="broll"
        context={defaultContext}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Loading...')).toBeTruthy()
    // The grid area should show aria-busy=true while loading
    const busyElement = screen.getByRole('dialog').querySelector('[aria-busy="true"]')
    expect(busyElement).toBeTruthy()
  })

  it('hides loading state after fetch resolves', async () => {
    stubFetch([makeBRollAsset()])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    // Wait for the asset to render
    await screen.findByText('sunset.mp4')
    expect(screen.queryByText('Loading...')).toBeNull()
  })

  // ── Escape key ───────────────────────────────────────────────────────────

  it('calls onCancel when Escape key is pressed', async () => {
    stubFetch()
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
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  // ── Backdrop click ───────────────────────────────────────────────────────

  it('calls onCancel when backdrop is clicked', async () => {
    stubFetch()
    const onCancel = vi.fn()
    const { container } = render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    )
    await screen.findByRole('dialog')
    // The backdrop is the outermost fixed div (parent of the dialog)
    const backdrop = container.firstElementChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onCancel when dialog content is clicked', async () => {
    stubFetch()
    const onCancel = vi.fn()
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(dialog)
    expect(onCancel).not.toHaveBeenCalled()
  })

  // ── Select button disabled state ─────────────────────────────────────────

  it('select button is disabled when nothing is selected', async () => {
    stubFetch([makeBRollAsset()])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    await screen.findByText('sunset.mp4')
    const selectBtn = screen.getByRole('button', { name: /selecionar/i })
    expect(selectBtn.hasAttribute('disabled')).toBe(true)
  })

  it('select button becomes enabled after selecting an asset', async () => {
    stubFetch([makeBRollAsset()])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const card = await screen.findByText('sunset.mp4')
    fireEvent.click(card)
    const selectBtn = screen.getByRole('button', { name: /selecionar/i })
    expect(selectBtn.hasAttribute('disabled')).toBe(false)
  })

  // ── Results count in footer ──────────────────────────────────────────────

  it('shows results count in footer', async () => {
    const assets = [
      makeBRollAsset({ id: 'a1', original_filename: 'clip-1.mp4' }),
      makeBRollAsset({ id: 'a2', original_filename: 'clip-2.mp4' }),
      makeBRollAsset({ id: 'a3', original_filename: 'clip-3.mp4' }),
    ]
    stubFetch(assets)
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    await screen.findByText('clip-1.mp4')
    // Footer uses aria-live="polite" role="status"
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('3 resultados')
  })

  it('shows singular "resultado" for exactly 1 result', async () => {
    stubFetch([makeBRollAsset()])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    await screen.findByText('sunset.mp4')
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('1 resultado')
    // Should NOT say "resultados" (plural)
    expect(status.textContent).not.toContain('resultados')
  })

  it('shows "0 resultados" when no results match', async () => {
    stubFetch([])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    await screen.findByText(/no assets found/i)
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('0 resultados')
  })

  it('shows "1 selecionado" in footer after selecting an asset', async () => {
    stubFetch([makeBRollAsset()])
    render(
      <AssetPickerDialog
        assetType="broll"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const card = await screen.findByText('sunset.mp4')
    fireEvent.click(card)
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('1 selecionado')
  })

  // ── Context description ──────────────────────────────────────────────────

  it('renders context description in the header', () => {
    stubFetch()
    render(
      <AssetPickerDialog
        assetType="broll"
        context={defaultContext}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Pick a clip for the intro beat')).toBeTruthy()
  })

  // ── Audio-specific rendering ─────────────────────────────────────────────

  it('renders audio asset cards with track_name', async () => {
    stubFetch([makeAudioAsset()])
    render(
      <AssetPickerDialog
        assetType="audio"
        context={{ ...defaultContext, suggestedTags: [] }}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    await screen.findByText('Calm Waves')
    expect(screen.getByText('Calm Waves')).toBeTruthy()
  })
})
