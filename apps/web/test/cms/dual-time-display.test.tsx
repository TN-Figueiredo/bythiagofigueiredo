import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cms',
}))

import { DualTimeDisplay } from '../../src/app/cms/(authed)/_components/dual-time-display'
import { DualTimeBar } from '../../src/app/cms/(authed)/_components/dual-time-bar'

describe('DualTimeDisplay', () => {
  it('renders site time with timezone abbreviation badge', () => {
    const { container } = render(
      <DualTimeDisplay
        date="2026-05-07T17:30:00Z"
        siteTimezone="America/Sao_Paulo"
        mode="time-only"
      />,
    )
    const time = container.querySelector('time')
    expect(time).toBeTruthy()
    expect(time?.getAttribute('dateTime')).toBe('2026-05-07T17:30:00Z')
    expect(time?.getAttribute('title')).toContain('America/Sao_Paulo')
  })

  it('renders local time when showLocal is true', () => {
    const { container } = render(
      <DualTimeDisplay
        date="2026-05-07T17:30:00Z"
        siteTimezone="America/Sao_Paulo"
        mode="time-only"
        showLocal={true}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('·')
  })

  it('hides local time when showLocal is false', () => {
    const { container } = render(
      <DualTimeDisplay
        date="2026-05-07T17:30:00Z"
        siteTimezone="America/Sao_Paulo"
        mode="time-only"
        showLocal={false}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).not.toContain('·')
  })

  it('renders in short mode with date', () => {
    const { container } = render(
      <DualTimeDisplay
        date="2026-05-07T17:30:00Z"
        siteTimezone="America/Sao_Paulo"
        mode="short"
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('May')
    expect(text).toContain('at')
  })

  it('renders in full mode with "at" separator', () => {
    const { container } = render(
      <DualTimeDisplay
        date="2026-05-07T17:30:00Z"
        siteTimezone="America/Sao_Paulo"
        mode="full"
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('at')
  })

  it('accepts Date objects', () => {
    const date = new Date('2026-05-07T17:30:00Z')
    const { container } = render(
      <DualTimeDisplay
        date={date}
        siteTimezone="America/Sao_Paulo"
        mode="time-only"
      />,
    )
    const time = container.querySelector('time')
    expect(time?.getAttribute('dateTime')).toBe(date.toISOString())
  })
})

describe('DualTimeBar', () => {
  it('renders site and local times with connector when offset exists', () => {
    // Use a timezone far from the local tz to ensure offset > 0
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const siteTz = localTz === 'Asia/Tokyo' ? 'America/New_York' : 'Asia/Tokyo'
    const { container } = render(
      <DualTimeBar
        date="2026-05-07T17:30:00Z"
        siteTimezone={siteTz}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('🌐')
    expect(text).toContain('🖥')
  })

  it('shows offset direction in connector', () => {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const siteTz = localTz === 'Asia/Tokyo' ? 'America/New_York' : 'Asia/Tokyo'
    const { container } = render(
      <DualTimeBar
        date="2026-05-07T17:30:00Z"
        siteTimezone={siteTz}
      />,
    )
    const text = container.textContent ?? ''
    const hasDirection = text.includes('ahead') || text.includes('behind')
    expect(hasDirection).toBe(true)
  })

  it('shows same-tz message when timezones match', () => {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const { container } = render(
      <DualTimeBar
        date="2026-05-07T17:30:00Z"
        siteTimezone={localTz}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('matches')
  })
})
