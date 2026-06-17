import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LaunchCta } from '../../src/app/cms/(authed)/waitlists/_components/launch-cta'

afterEach(cleanup)

const launchBtn = () => screen.getByRole('button', { name: /launch/i })

describe('<LaunchCta> gating predicate', () => {
  it('is disabled when there are 0 pending signups (even if status is open)', () => {
    render(<LaunchCta status="open" pending={0} />)
    expect(launchBtn()).toBeDisabled()
  })

  it('is disabled when status is not open/closed (even with pending signups)', () => {
    render(<LaunchCta status="draft" pending={5} />)
    expect(launchBtn()).toBeDisabled()
  })

  it('is disabled for the terminal launched status', () => {
    render(<LaunchCta status="launched" pending={5} />)
    expect(launchBtn()).toBeDisabled()
  })

  it('is enabled when pending>0 AND status is open, and fires onLaunch', () => {
    const onLaunch = vi.fn()
    render(<LaunchCta status="open" pending={3} onLaunch={onLaunch} />)
    const btn = launchBtn()
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onLaunch).toHaveBeenCalledTimes(1)
  })

  it('is enabled when pending>0 AND status is closed', () => {
    render(<LaunchCta status="closed" pending={1} onLaunch={vi.fn()} />)
    expect(launchBtn()).not.toBeDisabled()
  })
})
