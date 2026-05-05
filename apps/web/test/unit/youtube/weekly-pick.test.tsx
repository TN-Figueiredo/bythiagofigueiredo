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
  it('shows "Pin as Weekly Pick" when not pinned', () => {
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={null} hasExistingPin={false} />)
    expect(screen.getByText('☆ Pin as Weekly Pick')).toBeTruthy()
  })

  it('shows "Pin as Weekly Pick" when pinned_until is in the past', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={pastDate} hasExistingPin={false} />)
    expect(screen.getByText('☆ Pin as Weekly Pick')).toBeTruthy()
  })

  it('shows pinned state with unpin button when pinned_until is in the future', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString()
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={futureDate} hasExistingPin={false} />)
    expect(screen.getByText('Unpin')).toBeTruthy()
    expect(screen.getByText(/★/)).toBeTruthy()
  })

  it('shows duration picker on click', () => {
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={null} hasExistingPin={false} />)
    fireEvent.click(screen.getByText('☆ Pin as Weekly Pick'))
    expect(screen.getByText('7 days')).toBeTruthy()
    expect(screen.getByText('15 days')).toBeTruthy()
    expect(screen.getByText('30 days')).toBeTruthy()
  })

  it('shows "replaces current" hint when another video in channel is pinned', () => {
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={null} hasExistingPin={true} />)
    expect(screen.getByText('replaces current')).toBeTruthy()
  })

  it('shows unpin confirmation before executing', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString()
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={futureDate} hasExistingPin={false} />)
    fireEvent.click(screen.getByText('Unpin'))
    expect(screen.getByText('Remove pin?')).toBeTruthy()
    expect(screen.getByText('Confirm')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })
})
