import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { en } from '@/app/cms/(authed)/newsletters/_i18n/en'

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('lucide-react', () => ({
  Mail: (p: Record<string, unknown>) => <span data-testid="icon-mail" {...p} />,
  Send: (p: Record<string, unknown>) => <span data-testid="icon-send" {...p} />,
  Loader2: (p: Record<string, unknown>) => <span data-testid="icon-loader" {...p} />,
  CheckCircle2: (p: Record<string, unknown>) => <span data-testid="icon-check" {...p} />,
  RefreshCw: (p: Record<string, unknown>) => <span data-testid="icon-refresh" {...p} />,
  ExternalLink: (p: Record<string, unknown>) => <span data-testid="icon-external" {...p} />,
}))

const renderAction = vi.fn<[], Promise<{ ok: true; html: string; sizeBytes: number } | { ok: false; error: string }>>()
const sendAction = vi.fn<[], Promise<{ ok: true } | { ok: false; error: string }>>()

vi.mock('@/app/cms/(authed)/newsletters/actions-test-center', () => ({
  renderTestTemplate: (...args: unknown[]) => renderAction(...(args as [])),
  sendTestTemplate: (...args: unknown[]) => sendAction(...(args as [])),
}))

import { TestCenterTab } from '@/app/cms/(authed)/newsletters/_tabs/test-center/test-center-tab'

// ─── Helpers ───────────────────────────────────────────────────────────────

const tc = en.testCenter

const TYPES = [
  { id: 't1', name: 'Weekly Digest', color: '#FF8240' },
  { id: 't2', name: 'Dev Notes', color: '#3b82f6' },
]

const EDITIONS = [
  { id: 'ed-1', subject: 'First Edition', status: 'draft', typeId: 't1' },
  { id: 'ed-2', subject: 'Second Edition', status: 'ready', typeId: 't2' },
  { id: 'ed-3', subject: 'Third Edition', status: 'ready', typeId: 't1' },
]

const DEFAULT_RENDER_RESULT = { ok: true as const, html: '<html><body>Preview</body></html>', sizeBytes: 1234 }

function renderTab(overrides: Record<string, unknown> = {}) {
  const props = {
    strings: en,
    locale: 'en' as const,
    userEmail: 'admin@test.com',
    types: TYPES,
    editions: EDITIONS,
    ...overrides,
  }
  return render(<TestCenterTab {...props} />)
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('TestCenterTab', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    renderAction.mockResolvedValue(DEFAULT_RENDER_RESULT)
    sendAction.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    vi.clearAllMocks()
  })

  // ─── Core flow ─────────────────────────────────────────────────────────

  it('renders template selector, locale picker, edition controls', async () => {
    await act(async () => { renderTab() })

    expect(screen.getByRole('radiogroup', { name: 'Email template' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Email locale' })).toBeTruthy()
    expect(screen.getByLabelText(tc.selectType)).toBeTruthy()
  })

  it('calls renderTestTemplate on mount with confirm/en', async () => {
    await act(async () => { renderTab() })

    expect(renderAction).toHaveBeenCalledWith('confirm', 'en', { editionId: undefined })
  })

  it('changing template triggers new render call', async () => {
    await act(async () => { renderTab() })

    renderAction.mockClear()
    await act(async () => {
      fireEvent.click(screen.getByText(tc.templateWelcome))
    })

    expect(renderAction).toHaveBeenCalledWith('welcome', 'en', { editionId: undefined })
  })

  it('changing locale triggers new render call', async () => {
    await act(async () => { renderTab() })

    renderAction.mockClear()
    await act(async () => {
      fireEvent.click(screen.getByText('pt-BR'))
    })

    expect(renderAction).toHaveBeenCalledWith('confirm', 'pt-BR', { editionId: undefined })
  })

  it('selecting an edition triggers render with editionId', async () => {
    await act(async () => { renderTab() })

    const editionRadio = screen.getAllByRole('radio').find(r => r.textContent === tc.templateEdition)!
    await act(async () => {
      fireEvent.click(editionRadio)
    })

    renderAction.mockClear()
    await act(async () => {
      fireEvent.change(screen.getByLabelText(tc.selectEdition), { target: { value: 'ed-1' } })
    })

    expect(renderAction).toHaveBeenCalledWith('edition', 'en', { editionId: 'ed-1' })
  })

  it('refresh button re-triggers renderTestTemplate', async () => {
    await act(async () => { renderTab() })

    renderAction.mockClear()
    await act(async () => {
      fireEvent.click(screen.getByText(tc.refresh))
    })

    expect(renderAction).toHaveBeenCalledTimes(1)
  })

  it('send flow calls sendTestTemplate with correct args', async () => {
    await act(async () => { renderTab() })

    await act(async () => {
      fireEvent.click(screen.getByText(tc.sendTestEmail))
    })

    expect(sendAction).toHaveBeenCalledWith('confirm', 'en', {
      editionId: undefined,
      toEmail: 'admin@test.com',
    })
  })

  it('edition controls disabled when template !== edition', async () => {
    await act(async () => { renderTab() })

    const typeSelect = screen.getByLabelText(tc.selectType) as HTMLSelectElement
    expect(typeSelect.disabled).toBe(true)
  })

  // ─── Preview state ────────────────────────────────────────────────────

  it('loading state + aria-busy during render', async () => {
    renderAction.mockReturnValue(new Promise(() => {}))
    await act(async () => { renderTab() })

    const region = screen.getByRole('region', { name: 'Email preview' })
    expect(region.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText(tc.renderingPreview)).toBeTruthy()
  })

  it('error message when render returns not_found', async () => {
    renderAction.mockResolvedValue({ ok: false, error: 'not_found' })
    await act(async () => { renderTab() })

    expect(screen.getByText(tc.errorNotFound)).toBeTruthy()
  })

  it('render throws exception → shows renderFailed', async () => {
    renderAction.mockRejectedValue(new Error('network'))
    await act(async () => { renderTab() })

    expect(screen.getByText(tc.renderFailed)).toBeTruthy()
  })

  it('viewport toggle: Mobile changes iframe width', async () => {
    await act(async () => { renderTab() })

    const iframe = document.querySelector('iframe')!
    expect(iframe.style.width).toBe('600px')

    await act(async () => {
      fireEvent.click(screen.getByText(tc.viewportMobile))
    })

    expect(iframe.style.width).toBe('375px')
  })

  it('displays formatted size for sizeBytes', async () => {
    await act(async () => { renderTab() })

    expect(screen.getByText(/1\.2 KB/)).toBeTruthy()
  })

  // ─── Advanced ─────────────────────────────────────────────────────────

  it('stale response discarded (generationRef)', async () => {
    let resolveFirst: (v: { ok: true; html: string; sizeBytes: number }) => void
    const firstPromise = new Promise<{ ok: true; html: string; sizeBytes: number }>((r) => { resolveFirst = r })

    renderAction.mockReturnValueOnce(firstPromise)

    await act(async () => { renderTab() })

    const secondResult = { ok: true as const, html: '<html><body>Second</body></html>', sizeBytes: 2000 }
    renderAction.mockResolvedValueOnce(secondResult)

    await act(async () => {
      fireEvent.click(screen.getByText(tc.templateWelcome))
    })

    const iframe = document.querySelector('iframe')!
    expect(iframe.getAttribute('srcdoc')).toBe(secondResult.html)

    await act(async () => {
      resolveFirst!({ ok: true, html: '<html><body>Stale</body></html>', sizeBytes: 500 })
    })

    expect(iframe.getAttribute('srcdoc')).toBe(secondResult.html)
  })

  it('sample badge appears when template=edition + no editionId', async () => {
    await act(async () => { renderTab() })

    const editionRadio = screen.getAllByRole('radio').find(r => r.textContent === tc.templateEdition)!
    await act(async () => {
      fireEvent.click(editionRadio)
    })

    expect(screen.getByText(tc.sampleBadge)).toBeTruthy()
  })

  it('sample badge disappears when editionId IS selected', async () => {
    await act(async () => { renderTab() })

    const editionRadio = screen.getAllByRole('radio').find(r => r.textContent === tc.templateEdition)!
    await act(async () => {
      fireEvent.click(editionRadio)
    })

    expect(screen.getByText(tc.sampleBadge)).toBeTruthy()

    await act(async () => {
      fireEvent.change(screen.getByLabelText(tc.selectEdition), { target: { value: 'ed-1' } })
    })

    expect(screen.queryByText(tc.sampleBadge)).toBeNull()
  })

  it('type selection filters editions', async () => {
    await act(async () => { renderTab() })

    const editionRadio = screen.getAllByRole('radio').find(r => r.textContent === tc.templateEdition)!
    await act(async () => {
      fireEvent.click(editionRadio)
    })

    const editionSelect = screen.getByLabelText(tc.selectEdition) as HTMLSelectElement
    const allOptions = editionSelect.options.length - 1

    await act(async () => {
      fireEvent.change(screen.getByLabelText(tc.selectType), { target: { value: 't2' } })
    })

    const filteredOptions = editionSelect.options.length - 1
    expect(filteredOptions).toBeLessThan(allOptions)
    expect(filteredOptions).toBe(1)
  })

  // ─── Error boundary ──────────────────────────────────────────────────

  it('SectionErrorBoundary catches child error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const BrokenComponent = () => { throw new Error('test crash') }
    vi.doMock('@/app/cms/(authed)/newsletters/_tabs/test-center/page-state-links', () => ({
      PageStateLinks: BrokenComponent,
    }))

    renderAction.mockResolvedValue(DEFAULT_RENDER_RESULT)

    const { SectionErrorBoundary } = await import('@/app/cms/(authed)/newsletters/_shared/section-error-boundary')

    await act(async () => {
      render(
        <SectionErrorBoundary sectionName="Test section">
          <BrokenComponent />
        </SectionErrorBoundary>,
      )
    })

    expect(screen.getByText(/Failed to load/)).toBeTruthy()
    vi.mocked(console.error).mockRestore()
  })

  it('summaryStats sticky footer text renders', async () => {
    await act(async () => { renderTab() })

    expect(screen.getByText(tc.summaryStats)).toBeTruthy()
  })
})
