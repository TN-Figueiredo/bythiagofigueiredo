// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../../src/app/cms/(authed)/youtube/videos/actions', () => ({
  updateVideo: vi.fn(),
  approveCategory: vi.fn(),
  rejectCategory: vi.fn(),
  pinWeeklyPick: vi.fn(),
  unpinWeeklyPick: vi.fn(),
  triggerSync: vi.fn(),
}))

import { PinButton } from '../../../src/app/cms/(authed)/youtube/videos/video-row-actions'

describe('PinButton', () => {
  it('shows "Pin" when not pinned', () => {
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={null} />)
    expect(screen.getByText('☆ Pin')).toBeTruthy()
  })

  it('shows "Pin" when pinned_until is in the past', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={pastDate} />)
    expect(screen.getByText('☆ Pin')).toBeTruthy()
  })

  it('shows pinned state with unpin button when pinned_until is in the future', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString()
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={futureDate} />)
    expect(screen.getByText('Unpin')).toBeTruthy()
    expect(screen.getByText(/★/)).toBeTruthy()
  })

  it('shows duration picker on click', () => {
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={null} />)
    fireEvent.click(screen.getByText('☆ Pin'))
    expect(screen.getByText('7 days')).toBeTruthy()
    expect(screen.getByText('15 days')).toBeTruthy()
    expect(screen.getByText('30 days')).toBeTruthy()
  })
})
