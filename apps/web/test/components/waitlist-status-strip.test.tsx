import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WaitlistStatusStrip } from '../../src/app/cms/(authed)/waitlists/_components/status-strip'

afterEach(cleanup)

describe('<WaitlistStatusStrip>', () => {
  it('draft → offers "Open signups" and calls onTransition("open")', () => {
    const onTransition = vi.fn()
    render(<WaitlistStatusStrip status="draft" onTransition={onTransition} />)
    fireEvent.click(screen.getByRole('button', { name: /open signups/i }))
    expect(onTransition).toHaveBeenCalledWith('open')
  })

  it('open → offers "Close signups" and calls onTransition("closed")', () => {
    const onTransition = vi.fn()
    render(<WaitlistStatusStrip status="open" onTransition={onTransition} />)
    fireEvent.click(screen.getByRole('button', { name: /close signups/i }))
    expect(onTransition).toHaveBeenCalledWith('closed')
  })

  it('closed → offers "Reopen signups"', () => {
    render(<WaitlistStatusStrip status="closed" onTransition={vi.fn()} />)
    expect(screen.getByRole('button', { name: /reopen signups/i })).toBeTruthy()
  })

  it('failed → offers the recover action "Reset to closed"', () => {
    const onTransition = vi.fn()
    render(<WaitlistStatusStrip status="failed" onTransition={onTransition} />)
    fireEvent.click(screen.getByRole('button', { name: /reset to closed/i }))
    expect(onTransition).toHaveBeenCalledWith('closed')
  })

  it('launched is terminal → no transition buttons', () => {
    render(<WaitlistStatusStrip status="launched" onTransition={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('launching → no transition buttons (owned by the launch broadcast)', () => {
    render(<WaitlistStatusStrip status="launching" onTransition={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('disables the buttons while a transition is pending', () => {
    render(<WaitlistStatusStrip status="open" onTransition={vi.fn()} pending />)
    expect(screen.getByRole('button', { name: /close signups/i })).toHaveProperty('disabled', true)
  })
})
