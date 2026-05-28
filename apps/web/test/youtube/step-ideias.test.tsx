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

  // ---- 3. Ready state renders asset preview, prompt card, and slot notes ----

  it('renders asset preview, prompt card, and slot notes when briefingData is provided', async () => {
    const data = makeAbBriefingData()
    await act(async () => {
      renderStep({ briefingData: data })
    })
    // Asset preview: "Vídeo atual" label
    expect(screen.getByText('Vídeo atual')).toBeTruthy()
    // Freshness badge from sub-component mock
    expect(screen.getByTestId('freshness-badge')).toBeTruthy()
    // Prompt card: "Prompt pronto" badge
    expect(screen.getByText('Prompt pronto')).toBeTruthy()
    // Prompt preview renders mock content
    expect(screen.getByTestId('prompt-preview').textContent).toContain('MOCK_BRIEFING_PROMPT')
    // Slot notes: labels B, C, D
    expect(screen.getByText('B')).toBeTruthy()
    expect(screen.getByText('C')).toBeTruthy()
    expect(screen.getByText('D')).toBeTruthy()
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

  // ---- 5. Cross-test insights bar when testHistory has items ----

  it('shows cross-test insights bar when testHistory has items', async () => {
    const data = makeAbBriefingData()
    data.testHistory = [
      { test_type: 'thumbnail', winner_label: 'B', ctr_lift_percent: 8.5 },
      { test_type: 'title', winner_label: 'C', ctr_lift_percent: 3.0 },
    ]
    await act(async () => {
      renderStep({ briefingData: data })
    })
    // Insights bar text: "Em 2 testes anteriores, lift médio de +X% CTR"
    const insightsText = screen.getByText(/em 2 testes anteriores/i)
    expect(insightsText).toBeTruthy()
    expect(insightsText.textContent).toContain('lift médio')
  })

  // ---- 6. No-data warning when video has no CTR/score ----

  it('shows no-data warning when video has no CTR and no score', async () => {
    const data = makeAbBriefingData({ ctr: null, score: null })
    await act(async () => {
      renderStep({ briefingData: data })
    })
    const warning = screen.getByText(/sem dados de performance/i)
    expect(warning).toBeTruthy()
  })

  // ---- 7. Example chips append to focus text on click ----

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

  // ---- 8. Slot note inputs update correctly ----

  it('slot note input calls onSlotNoteChange with correct index and value', async () => {
    const data = makeAbBriefingData()
    const onSlotNoteChange = vi.fn()
    await act(async () => {
      renderStep({ briefingData: data, onSlotNoteChange })
    })
    // Slot B is index 0 in slotNotes
    const slotBInput = screen.getByPlaceholderText('Ideia para variante B...')
    fireEvent.change(slotBInput, { target: { value: 'Nova ideia B' } })
    expect(onSlotNoteChange).toHaveBeenCalledWith(0, 'Nova ideia B')
  })

  it('slot note input for C calls onSlotNoteChange with index 1', async () => {
    const data = makeAbBriefingData()
    const onSlotNoteChange = vi.fn()
    await act(async () => {
      renderStep({ briefingData: data, onSlotNoteChange })
    })
    const slotCInput = screen.getByPlaceholderText('Ideia para variante C...')
    fireEvent.change(slotCInput, { target: { value: 'Ideia C' } })
    expect(onSlotNoteChange).toHaveBeenCalledWith(1, 'Ideia C')
  })

  // ---- 9. No insights bar when testHistory is empty ----

  it('does not show cross-test insights bar when testHistory is empty', async () => {
    const data = makeAbBriefingData()
    data.testHistory = []
    await act(async () => {
      renderStep({ briefingData: data })
    })
    // The insights text includes "testes anteriores" — should not be present
    expect(screen.queryByText(/testes anteriores/i)).toBeNull()
  })

  // ---- 10. Retry button triggers re-fetch ----

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
})
