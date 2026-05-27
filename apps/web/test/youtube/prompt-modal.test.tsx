// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — declared before any import that could trigger module evaluation
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/app/cms/(authed)/youtube/_actions/youtube-prompt-actions', () => ({
  fetchContentCalendarData: vi.fn(),
  fetchChannelHealthData: vi.fn(),
  fetchVideoOptimizerData: vi.fn(),
  logPromptCopy: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}))

vi.mock('@/lib/youtube/prompt-builders', () => ({
  buildYoutubePrompt: vi.fn((opts: { instructions: string }) =>
    opts.instructions?.trim() ? `MOCK_PROMPT:${opts.instructions}` : '',
  ),
}))

// Stub sub-components with heavy deps
vi.mock('@/components/prompt-preview', () => ({
  PromptPreview: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="prompt-preview">{children}</div>
  ),
}))

vi.mock(
  '@/app/cms/(authed)/youtube/videos/_components/data-freshness-badge',
  () => ({
    DataFreshnessBadge: () => <div data-testid="freshness-badge" />,
  }),
)

// Stub useFocusTrap so it doesn't interfere with keyboard tests
vi.mock('@/lib/hooks/use-focus-trap', () => ({
  useFocusTrap: () => () => undefined,
}))

// Clipboard
const writeText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText },
  writable: true,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Import components + mocks after vi.mock declarations
// ---------------------------------------------------------------------------

import { YouTubeCoworkPromptModal } from '@/app/cms/(authed)/youtube/_components/youtube-cowork-prompt-modal'
import { fetchContentCalendarData } from '@/app/cms/(authed)/youtube/_actions/youtube-prompt-actions'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const MOCK_CC_DATA = {
  channel: { name: 'Test Channel', subscribers: 5000, videoCount: 20, tier: 'micro' as const },
  searchTerms: [],
  topPerformingCategories: null,
  demographics: { topAge: '25-34', topCountry: 'BR', topDevice: 'mobile' },
  outlierSuccesses: null,
  bestPerformingDay: null,
  bestPerformingHour: null,
  recentUploads: [],
  snapshotAt: new Date().toISOString(),
  snapshotAgeHours: 2,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModal(isOpen = true, onClose = vi.fn()) {
  return render(
    <YouTubeCoworkPromptModal
      isOpen={isOpen}
      onClose={onClose}
      videos={[]}
      channelName="Test Channel"
      scoredVideoCount={0}
    />,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('YouTubeCoworkPromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    writeText.mockResolvedValue(undefined)
    vi.mocked(fetchContentCalendarData).mockResolvedValue({ ok: true, data: MOCK_CC_DATA })
  })

  afterEach(() => {
    cleanup()
  })

  // ---- 1. Returns null when isOpen is false ----

  it('returns null when isOpen is false', () => {
    const { container } = renderModal(false)
    expect(container.innerHTML).toBe('')
  })

  // ---- 2. Renders dialog with aria-modal when open ----

  it('renders dialog with role="dialog" and aria-modal="true" when open', async () => {
    await act(async () => {
      renderModal(true)
    })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('renders YouTube Cowork Prompt title', async () => {
    await act(async () => {
      renderModal(true)
    })
    expect(screen.getByText('YouTube Cowork Prompt')).toBeTruthy()
  })

  it('renders 3 preset buttons (Content Calendar, Channel Health, Video Optimizer)', async () => {
    await act(async () => {
      renderModal(true)
    })
    expect(screen.getByText('Content Calendar')).toBeTruthy()
    expect(screen.getByText('Channel Health')).toBeTruthy()
    expect(screen.getByText('Video Optimizer')).toBeTruthy()
  })

  // ---- 3. Escape key calls onClose ----

  it('Escape key on the dialog calls onClose', async () => {
    const onClose = vi.fn()
    await act(async () => {
      renderModal(true, onClose)
    })
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  // ---- 4. Backdrop click calls onClose ----

  it('clicking the backdrop calls onClose', async () => {
    const onClose = vi.fn()
    await act(async () => {
      renderModal(true, onClose)
    })
    // The backdrop is the outermost fixed div (parent of dialog)
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Fechar button calls onClose', async () => {
    const onClose = vi.fn()
    await act(async () => {
      renderModal(true, onClose)
    })
    const closeBtn = screen.getByRole('button', { name: /fechar/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Cancelar button calls onClose', async () => {
    const onClose = vi.fn()
    await act(async () => {
      renderModal(true, onClose)
    })
    const cancelBtn = screen.getByRole('button', { name: /cancelar/i })
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  // ---- 5. Copy button disabled when no instructions entered ----

  it('Copiar Prompt button is disabled when instructions are empty', async () => {
    await act(async () => {
      renderModal(true)
    })
    // Wait for any async fetch to settle
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
  })

  // ---- 6. Copy button works when instructions entered and data loaded ----

  it('Copiar Prompt button is enabled after entering instructions and data loads', async () => {
    await act(async () => {
      renderModal(true)
    })
    const textarea = screen.getByLabelText('Instruções para o AI')
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Qual nicho explorar?' } })
    })
    // Data is already mocked to resolve immediately — allow React to flush
    await act(async () => {})
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(false)
  })

  it('clicking Copiar Prompt calls clipboard.writeText', async () => {
    await act(async () => {
      renderModal(true)
    })
    const textarea = screen.getByLabelText('Instruções para o AI')
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Qual nicho?' } })
    })
    await act(async () => {})
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i })
    await act(async () => {
      fireEvent.click(copyBtn)
    })
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toContain('MOCK_PROMPT:')
  })

  it('shows "Copiado!" after successful copy', async () => {
    await act(async () => {
      renderModal(true)
    })
    const textarea = screen.getByLabelText('Instruções para o AI')
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Teste' } })
    })
    await act(async () => {})
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i })
    await act(async () => {
      fireEvent.click(copyBtn)
      // flush the async clipboard.writeText promise
      await Promise.resolve()
    })
    expect(screen.getByText(/Copiado!/)).toBeTruthy()
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Prompt copiado!')
  })

  it('shows error toast when clipboard write fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    await act(async () => {
      renderModal(true)
    })
    const textarea = screen.getByLabelText('Instruções para o AI')
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Teste' } })
    })
    await act(async () => {})
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i })
    await act(async () => {
      fireEvent.click(copyBtn)
      // flush the async clipboard.writeText rejection
      await Promise.resolve()
    })
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Falha ao copiar')
  })

  // ---- 7. Shows loading state during fetch ----

  it('shows loading status element while fetching', async () => {
    // Return a promise that never resolves within the render cycle
    let resolveData!: (v: { ok: true; data: typeof MOCK_CC_DATA }) => void
    vi.mocked(fetchContentCalendarData).mockReturnValueOnce(
      new Promise(resolve => { resolveData = resolve }),
    )
    await act(async () => {
      renderModal(true)
    })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(/carregando/i)).toBeTruthy()
    // Resolve to avoid unhandled rejection
    resolveData({ ok: true, data: MOCK_CC_DATA })
  })

  // ---- 8. Focus restoration on close ----

  it('restores focus to trigger element on close', async () => {
    const onClose = vi.fn()

    // Start with modal closed so the trigger button can receive focus first
    const { rerender } = render(
      <>
        <button id="trigger-btn">Open Modal</button>
        <YouTubeCoworkPromptModal
          isOpen={false}
          onClose={onClose}
          videos={[]}
          channelName="Test Channel"
          scoredVideoCount={0}
        />
      </>,
    )

    // Focus the trigger button (simulating user clicking it to open the modal)
    const triggerBtn = document.getElementById('trigger-btn') as HTMLButtonElement
    triggerBtn.focus()
    expect(document.activeElement).toBe(triggerBtn)

    // Open the modal — effect captures triggerBtn as document.activeElement
    await act(async () => {
      rerender(
        <>
          <button id="trigger-btn">Open Modal</button>
          <YouTubeCoworkPromptModal
            isOpen={true}
            onClose={onClose}
            videos={[]}
            channelName="Test Channel"
            scoredVideoCount={0}
          />
        </>,
      )
    })

    // Modal is open
    expect(screen.getByRole('dialog')).toBeTruthy()

    // Close the modal (isOpen → false) — effect restores focus to triggerBtn
    await act(async () => {
      rerender(
        <>
          <button id="trigger-btn">Open Modal</button>
          <YouTubeCoworkPromptModal
            isOpen={false}
            onClose={onClose}
            videos={[]}
            channelName="Test Channel"
            scoredVideoCount={0}
          />
        </>,
      )
    })

    // Focus should have returned to the trigger button
    expect(document.activeElement).toBe(triggerBtn)
  })

  // ---- 9. Shows error when fetch fails ----

  it('shows error alert when fetch returns ok: false', async () => {
    vi.mocked(fetchContentCalendarData).mockResolvedValueOnce({
      ok: false,
      error: 'No sync-enabled channel found',
    })
    await act(async () => {
      renderModal(true)
    })
    await act(async () => {})
    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain('No sync-enabled channel found')
  })

  // ---- 10. WAI-ARIA roving tabindex + arrow key navigation ----

  it('selected radio has tabIndex=0, others have tabIndex=-1', async () => {
    await act(async () => {
      renderModal(true)
    })
    const radios = screen.getAllByRole('radio')
    expect(radios[0].getAttribute('tabindex')).toBe('0')
    expect(radios[1].getAttribute('tabindex')).toBe('-1')
    expect(radios[2].getAttribute('tabindex')).toBe('-1')
  })

  it('ArrowRight cycles from content-calendar to channel-health', async () => {
    await act(async () => {
      renderModal(true)
    })
    const radios = screen.getAllByRole('radio')
    // Default: content-calendar is checked
    expect(radios[0].getAttribute('aria-checked')).toBe('true')
    expect(radios[1].getAttribute('aria-checked')).toBe('false')

    await act(async () => {
      fireEvent.keyDown(radios[0], { key: 'ArrowRight' })
    })

    const updated = screen.getAllByRole('radio')
    expect(updated[0].getAttribute('aria-checked')).toBe('false')
    expect(updated[1].getAttribute('aria-checked')).toBe('true')
  })

  it('ArrowDown cycles the same as ArrowRight', async () => {
    await act(async () => {
      renderModal(true)
    })
    const radios = screen.getAllByRole('radio')
    await act(async () => {
      fireEvent.keyDown(radios[0], { key: 'ArrowDown' })
    })

    const updated = screen.getAllByRole('radio')
    expect(updated[1].getAttribute('aria-checked')).toBe('true')
  })

  it('ArrowLeft wraps from content-calendar to video-optimizer', async () => {
    await act(async () => {
      renderModal(true)
    })
    const radios = screen.getAllByRole('radio')
    // content-calendar is index 0, ArrowLeft should wrap to index 2
    await act(async () => {
      fireEvent.keyDown(radios[0], { key: 'ArrowLeft' })
    })

    const updated = screen.getAllByRole('radio')
    expect(updated[0].getAttribute('aria-checked')).toBe('false')
    expect(updated[2].getAttribute('aria-checked')).toBe('true')
  })

  it('End key jumps to last preset', async () => {
    await act(async () => {
      renderModal(true)
    })
    const radios = screen.getAllByRole('radio')
    await act(async () => {
      fireEvent.keyDown(radios[0], { key: 'End' })
    })

    const updated = screen.getAllByRole('radio')
    expect(updated[2].getAttribute('aria-checked')).toBe('true')
  })

  it('Home key jumps to first preset', async () => {
    await act(async () => {
      renderModal(true)
    })
    // Move to last first, then Home
    const radios = screen.getAllByRole('radio')
    await act(async () => {
      fireEvent.keyDown(radios[0], { key: 'End' })
    })
    const afterEnd = screen.getAllByRole('radio')
    await act(async () => {
      fireEvent.keyDown(afterEnd[2], { key: 'Home' })
    })

    const updated = screen.getAllByRole('radio')
    expect(updated[0].getAttribute('aria-checked')).toBe('true')
  })

  it('tabIndex updates when selection changes via arrow key', async () => {
    await act(async () => {
      renderModal(true)
    })
    const radios = screen.getAllByRole('radio')
    await act(async () => {
      fireEvent.keyDown(radios[0], { key: 'ArrowRight' })
    })

    const updated = screen.getAllByRole('radio')
    expect(updated[0].getAttribute('tabindex')).toBe('-1')
    expect(updated[1].getAttribute('tabindex')).toBe('0')
    expect(updated[2].getAttribute('tabindex')).toBe('-1')
  })
})
