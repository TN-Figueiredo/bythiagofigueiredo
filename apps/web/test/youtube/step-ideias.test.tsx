// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — declared before any import that could trigger module evaluation
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  fetchAbBriefingData: vi.fn(),
}))

vi.mock('@/lib/youtube/prompt-builders-ab', () => ({
  buildAbBriefingPrompt: vi.fn(() => 'MOCK_BRIEFING_PROMPT'),
  buildAbWritePrompt: vi.fn(() => 'MOCK_WRITE_PROMPT with POST /api/pipeline/youtube/ab-tests/test-id/variants'),
}))

vi.mock('swr', () => ({
  default: vi.fn(() => ({ data: undefined, error: undefined, isLoading: false })),
}))

vi.mock('@/lib/youtube/prompt-sanitize', () => ({
  estimateChars: vi.fn((s: string) => s.length),
}))

vi.mock('@/app/cms/(authed)/youtube/videos/_components/data-freshness-badge', () => ({
  DataFreshnessBadge: ({ snapshotAgeHours }: { snapshotAgeHours: number }) => (
    <div data-testid="freshness-badge">{snapshotAgeHours}h</div>
  ),
}))

vi.mock('@/components/prompt-preview', () => ({
  PromptPreview: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="prompt-preview">{children}</div>
  ),
}))

// next/image stub
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

// Clipboard
const writeText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText },
  writable: true,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Imports after vi.mock declarations
// ---------------------------------------------------------------------------

import { StepIdeias } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-ideias'
import { fetchAbBriefingData } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'
import type { TestType } from '@/lib/youtube/ab-types'

// ---------------------------------------------------------------------------
// Factories & shared data
// ---------------------------------------------------------------------------

function makeAbBriefingData(overrides: Partial<AbBriefingData['video']> = {}): AbBriefingData {
  return {
    channel: { name: 'Test Channel', subscribers: 5000, tier: 'micro' as const },
    locale: 'pt',
    testId: '',
    video: {
      title: 'Test Video',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      ctr: 5.2,
      avgViewPercentage: 45.3,
      score: 72,
      grade: 'B',
      ...overrides,
    },
    testHistory: [],
    snapshotAgeHours: 2,
  }
}

const defaultVideo = { id: 'vid-1', title: 'Test Video', thumbnailUrl: 'https://example.com/thumb.jpg' }

interface RenderProps {
  testType?: TestType
  briefingData?: AbBriefingData | null
  focus?: string
  slotNotes?: [string, string, string]
  briefingCopied?: boolean
  onFocusChange?: (v: string) => void
  onSlotNoteChange?: (i: number, v: string) => void
  onBriefingCopied?: () => void
  onBriefingDataChange?: (d: AbBriefingData | null) => void
  draftTestId?: string | null
  onVariantsReceived?: (variants: Array<{
    label: string
    title_text: string | null
    description_text: string | null
    metadata: Record<string, unknown> | null
  }>) => void
}

function renderStep(props: RenderProps = {}) {
  const {
    testType = 'thumbnail',
    briefingData = null,
    focus = '',
    slotNotes = ['', '', ''],
    briefingCopied = false,
    onFocusChange = vi.fn(),
    onSlotNoteChange = vi.fn(),
    onBriefingCopied = vi.fn(),
    onBriefingDataChange = vi.fn(),
    draftTestId = null,
    onVariantsReceived,
  } = props

  return render(
    <StepIdeias
      testType={testType}
      video={defaultVideo}
      focus={focus}
      onFocusChange={onFocusChange}
      slotNotes={slotNotes as [string, string, string]}
      onSlotNoteChange={onSlotNoteChange}
      briefingCopied={briefingCopied}
      onBriefingCopied={onBriefingCopied}
      briefingData={briefingData}
      onBriefingDataChange={onBriefingDataChange}
      draftTestId={draftTestId}
      onVariantsReceived={onVariantsReceived}
    />,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StepIdeias', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    writeText.mockResolvedValue(undefined)
    // Default: fetch never resolves (keeps loading state by default)
    vi.mocked(fetchAbBriefingData).mockReturnValue(new Promise(() => {}))
  })

  afterEach(() => {
    cleanup()
  })

  // ---- 1. Loading skeleton when briefingData is null ----

  it('renders loading skeleton when briefingData is null', async () => {
    await act(async () => {
      renderStep({ briefingData: null })
    })
    const busy = document.querySelector('[aria-busy="true"]')
    expect(busy).toBeTruthy()
  })

  // ---- 2. Error state with retry button ----

  it('renders error state with retry button when fetch fails', async () => {
    vi.mocked(fetchAbBriefingData).mockResolvedValueOnce({ ok: false, error: 'Erro de rede' })
    await act(async () => {
      renderStep({ briefingData: null })
    })
    await act(async () => {})
    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain('Erro de rede')
    const retryBtn = screen.getByRole('button', { name: /tentar novamente/i })
    expect(retryBtn).toBeTruthy()
  })

  // ---- 3. Ready state renders header, prompt card, and directions ----

  it('renders header, prompt card, and directions when briefingData is provided', async () => {
    const data = makeAbBriefingData()
    await act(async () => {
      renderStep({ briefingData: data })
    })
    // v7 compact header
    expect(screen.getByText('Monte sua hipótese')).toBeTruthy()
    // Prompt card: "Prompt pronto" badge
    expect(screen.getByText('Prompt pronto')).toBeTruthy()
    // Prompt preview renders mock content
    expect(screen.getByTestId('prompt-preview').textContent).toContain('MOCK_BRIEFING_PROMPT')
    // Directions section is collapsible — labels visible after expand
    expect(screen.getByText('Guiar cada variação')).toBeTruthy()
  })

  // ---- 4. Copies prompt to clipboard on button click ----

  it('copies prompt to clipboard when copy button is clicked', async () => {
    const data = makeAbBriefingData()
    const onBriefingCopied = vi.fn()
    await act(async () => {
      renderStep({ briefingData: data, onBriefingCopied })
    })
    // Find copy button — it contains "Copiar" text
    const copyBtn = screen.getByRole('button', { name: /copiar/i })
    await act(async () => {
      fireEvent.click(copyBtn)
      await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toBe('MOCK_BRIEFING_PROMPT')
    expect(onBriefingCopied).toHaveBeenCalledOnce()
  })

  // ---- 5. No-data warning when video has no CTR/score ----

  it('shows no-data warning when video has no CTR and no score', async () => {
    const data = makeAbBriefingData({ ctr: null, score: null })
    await act(async () => {
      renderStep({ briefingData: data })
    })
    const warning = screen.getByText(/sem dados de performance/i)
    expect(warning).toBeTruthy()
  })

  // ---- 6. Example chips append to focus text on click ----

  it('example chip appends to existing focus text on click', async () => {
    const data = makeAbBriefingData()
    const onFocusChange = vi.fn()
    await act(async () => {
      renderStep({ briefingData: data, focus: 'Foco inicial', onFocusChange, testType: 'thumbnail' })
    })
    // First chip for 'thumbnail': 'Testar close-up vs paisagem'
    const chip = screen.getByRole('button', { name: /testar close-up vs paisagem/i })
    fireEvent.click(chip)
    expect(onFocusChange).toHaveBeenCalledWith('Foco inicial. Testar close-up vs paisagem')
  })

  it('example chip sets focus text when focus is empty', async () => {
    const data = makeAbBriefingData()
    const onFocusChange = vi.fn()
    await act(async () => {
      renderStep({ briefingData: data, focus: '', onFocusChange, testType: 'thumbnail' })
    })
    const chip = screen.getByRole('button', { name: /testar close-up vs paisagem/i })
    fireEvent.click(chip)
    expect(onFocusChange).toHaveBeenCalledWith('Testar close-up vs paisagem')
  })

  // ---- 7. Slot note inputs update correctly (via collapsible directions) ----

  it('slot note input calls onSlotNoteChange with correct index after expanding directions', async () => {
    const data = makeAbBriefingData()
    const onSlotNoteChange = vi.fn()
    await act(async () => {
      renderStep({ briefingData: data, onSlotNoteChange })
    })
    // Expand the directions section first
    fireEvent.click(screen.getByText('Guiar cada variação'))
    // Slot B is index 0 in slotNotes
    const slotBInput = screen.getByPlaceholderText('Direção para variação B...')
    fireEvent.change(slotBInput, { target: { value: 'Nova ideia B' } })
    expect(onSlotNoteChange).toHaveBeenCalledWith(0, 'Nova ideia B')
  })

  it('slot note input for C calls onSlotNoteChange with index 1', async () => {
    const data = makeAbBriefingData()
    const onSlotNoteChange = vi.fn()
    await act(async () => {
      renderStep({ briefingData: data, onSlotNoteChange })
    })
    // Expand the directions section first
    fireEvent.click(screen.getByText('Guiar cada variação'))
    const slotCInput = screen.getByPlaceholderText('Direção para variação C...')
    fireEvent.change(slotCInput, { target: { value: 'Ideia C' } })
    expect(onSlotNoteChange).toHaveBeenCalledWith(1, 'Ideia C')
  })

  // ---- 8. Retry button triggers re-fetch ----

  it('retry button triggers a new fetch call', async () => {
    vi.mocked(fetchAbBriefingData).mockResolvedValueOnce({ ok: false, error: 'Timeout' })
    // Second call resolves with data
    vi.mocked(fetchAbBriefingData).mockResolvedValueOnce({
      ok: true,
      data: makeAbBriefingData(),
    })

    await act(async () => {
      renderStep({ briefingData: null })
    })
    await act(async () => {})

    const retryBtn = screen.getByRole('button', { name: /tentar novamente/i })
    await act(async () => {
      fireEvent.click(retryBtn)
    })

    expect(vi.mocked(fetchAbBriefingData)).toHaveBeenCalledTimes(2)
  })

  // ---- 9. Write prompt when draftTestId is provided ----

  it('renders write prompt when draftTestId is provided', async () => {
    const data = makeAbBriefingData()
    await act(async () => {
      renderStep({ briefingData: data, draftTestId: 'test-123' })
    })
    expect(screen.getByTestId('prompt-preview').textContent).toContain('MOCK_WRITE_PROMPT')
  })

  // ---- 10. Briefing prompt when no draftTestId ----

  it('renders briefing prompt when draftTestId is null', async () => {
    const data = makeAbBriefingData()
    await act(async () => {
      renderStep({ briefingData: data, draftTestId: null })
    })
    expect(screen.getByTestId('prompt-preview').textContent).toContain('MOCK_BRIEFING_PROMPT')
  })

  // ---- 11. Pre-copy state shows empty placeholder ----

  it('shows empty placeholder in pre-copy state', async () => {
    const data = makeAbBriefingData()
    await act(async () => {
      renderStep({ briefingData: data, briefingCopied: false, draftTestId: 'test-123' })
    })
    expect(screen.getByText(/copie o prompt acima/i)).toBeTruthy()
  })

  // ---- 12. Waiting state shows skeleton cards after copy ----

  it('shows skeleton cards in waiting state after briefing is copied', async () => {
    const data = makeAbBriefingData()
    await act(async () => {
      renderStep({ briefingData: data, briefingCopied: true, draftTestId: 'test-123' })
    })
    // Should have 3 skeleton cards with motion-safe:animate-pulse
    const pulsingCards = document.querySelectorAll('.motion-safe\\:animate-pulse')
    expect(pulsingCards.length).toBe(3)
    // Should NOT have the pre-copy placeholder
    expect(screen.queryByText(/copie o prompt acima/i)).toBeNull()
  })

  // ---- 13. Variant cards when SWR returns data ----

  it('shows variant cards when SWR returns external variants', async () => {
    const useSWR = (await import('swr')).default as unknown as ReturnType<typeof vi.fn>
    useSWR.mockReturnValue({
      data: [
        { label: 'A', is_original: true, title_text: 'Original' },
        { label: 'B', is_original: false, title_text: 'Title B', description_text: null, metadata: { rationale: 'test rationale' } },
      ],
      error: undefined,
      isLoading: false,
    })

    const data = makeAbBriefingData()
    await act(async () => {
      renderStep({ briefingData: data, draftTestId: 'test-123', briefingCopied: true })
    })

    expect(screen.getByText('Variação B')).toBeTruthy()
    expect(screen.getByText('Title B')).toBeTruthy()
    expect(screen.getByText('test rationale')).toBeTruthy()
    // Original shows as "Opção A" gray card
    expect(screen.getByText('Opção A')).toBeTruthy()

    // Reset mock for other tests
    useSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false })
  })

  // ---- 14. Combo warning shown only for combo type ----

  it('shows combo warning only for combo test type', async () => {
    const data = makeAbBriefingData()

    // Render with combo type
    await act(async () => {
      renderStep({ briefingData: data, testType: 'combo' })
    })
    expect(screen.getByText(/teste combo gera variações/i)).toBeTruthy()

    cleanup()

    // Render with thumbnail type — should not have combo warning
    await act(async () => {
      renderStep({ briefingData: data, testType: 'thumbnail' })
    })
    expect(screen.queryByText(/teste combo gera variações/i)).toBeNull()
  })

  // ---- 15. onVariantsReceived callback fires when variants arrive ----

  it('calls onVariantsReceived when non-original variants arrive', async () => {
    const useSWR = (await import('swr')).default as unknown as ReturnType<typeof vi.fn>
    const onVariantsReceived = vi.fn()

    useSWR.mockReturnValue({
      data: [
        { label: 'A', is_original: true, title_text: 'Original' },
        { label: 'B', is_original: false, title_text: 'Title B', description_text: null, metadata: { rationale: 'r' } },
      ],
      error: undefined,
      isLoading: false,
    })

    const data = makeAbBriefingData()
    await act(async () => {
      renderStep({ briefingData: data, draftTestId: 'test-123', briefingCopied: true, onVariantsReceived })
    })

    expect(onVariantsReceived).toHaveBeenCalledOnce()
    expect(onVariantsReceived.mock.calls[0][0]).toHaveLength(1)
    expect(onVariantsReceived.mock.calls[0][0][0].label).toBe('B')

    // Reset mock for other tests
    useSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false })
  })
})
