import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/cms/ui/toast'

// Helper component that triggers toasts via the hook
function ToastTrigger({ variant = 'success', message = 'Test message', action }: {
  variant?: 'success' | 'error' | 'warning' | 'info'
  message?: string
  action?: { label: string; onClick: () => void }
}) {
  const { toast } = useToast()
  return (
    <button
      data-testid="trigger"
      onClick={() => toast(variant, message, action)}
    >
      Show toast
    </button>
  )
}

function renderWithProvider(props: Parameters<typeof ToastTrigger>[0] = {}) {
  return render(
    <ToastProvider>
      <ToastTrigger {...props} />
    </ToastProvider>
  )
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows toast message when triggered', () => {
    renderWithProvider({ message: 'Saved successfully' })
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('Saved successfully')).toBeTruthy()
  })

  it('auto-dismisses success toast after 5 seconds', () => {
    renderWithProvider({ variant: 'success', message: 'Auto-dismissed' })
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('Auto-dismissed')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.queryByText('Auto-dismissed')).toBeNull()
  })

  it('auto-dismisses info toast after 5 seconds', () => {
    renderWithProvider({ variant: 'info', message: 'Info message' })
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('Info message')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.queryByText('Info message')).toBeNull()
  })

  it('does NOT auto-dismiss error toasts', () => {
    renderWithProvider({ variant: 'error', message: 'Something went wrong' })
    fireEvent.click(screen.getByTestId('trigger'))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('does NOT auto-dismiss warning toasts', () => {
    renderWithProvider({ variant: 'warning', message: 'Watch out' })
    fireEvent.click(screen.getByTestId('trigger'))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText('Watch out')).toBeTruthy()
  })

  it('can be dismissed manually via the ✕ button', () => {
    renderWithProvider({ variant: 'error', message: 'Dismiss me' })
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('Dismiss me')).toBeTruthy()
    fireEvent.click(screen.getByText('✕'))
    expect(screen.queryByText('Dismiss me')).toBeNull()
  })

  it('renders action button and calls its onClick', () => {
    const actionClick = vi.fn()
    renderWithProvider({
      message: 'Post deleted',
      action: { label: 'Undo', onClick: actionClick },
    })
    fireEvent.click(screen.getByTestId('trigger'))
    const undoBtn = screen.getByText('Undo')
    expect(undoBtn).toBeTruthy()
    fireEvent.click(undoBtn)
    expect(actionClick).toHaveBeenCalledOnce()
  })

  it('does not render action button when no action provided', () => {
    renderWithProvider({ message: 'No action' })
    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.queryByText('Undo')).toBeNull()
  })

  it('shows multiple toasts (up to 3 at once)', () => {
    renderWithProvider({ variant: 'error' })
    const trigger = screen.getByTestId('trigger')

    // Fire 3 times with forced fake UUIDs via crypto mock
    fireEvent.click(trigger) // message = 'Test message' repeated
    fireEvent.click(trigger)
    fireEvent.click(trigger)

    // All 3 should be visible (error never auto-dismisses)
    const messages = screen.getAllByText('Test message')
    expect(messages.length).toBe(3)
  })

  it('renders children alongside the toast container', () => {
    render(
      <ToastProvider>
        <p data-testid="child">Child content</p>
      </ToastProvider>
    )
    expect(screen.getByTestId('child')).toBeTruthy()
  })
})
