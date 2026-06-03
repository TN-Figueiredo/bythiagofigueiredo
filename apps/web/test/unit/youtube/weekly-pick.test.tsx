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
  it('shows "Fixar como Video da Semana" when not pinned', () => {
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={null} hasExistingPin={false} />)
    expect(screen.getByText(/Fixar como Video da Semana/)).toBeTruthy()
  })

  it('shows "Fixar como Video da Semana" when pinned_until is in the past', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={pastDate} hasExistingPin={false} />)
    expect(screen.getByText(/Fixar como Video da Semana/)).toBeTruthy()
  })

  it('shows pinned state with unpin button when pinned_until is in the future', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString()
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={futureDate} hasExistingPin={false} />)
    expect(screen.getByText('Desafixar')).toBeTruthy()
    expect(screen.getByText(/★/)).toBeTruthy()
  })

  it('shows duration picker on click', () => {
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={null} hasExistingPin={false} />)
    fireEvent.click(screen.getByText(/Fixar como Video da Semana/))
    expect(screen.getByText('7 dias')).toBeTruthy()
    expect(screen.getByText('15 dias')).toBeTruthy()
    expect(screen.getByText('30 dias')).toBeTruthy()
  })

  it('shows "substitui atual" hint when another video in channel is pinned', () => {
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={null} hasExistingPin={true} />)
    expect(screen.getByText('substitui atual')).toBeTruthy()
  })

  it('shows unpin confirmation before executing', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString()
    render(<PinButton videoId="v1" channelId="ch1" pinnedUntil={futureDate} hasExistingPin={false} />)
    fireEvent.click(screen.getByText('Desafixar'))
    expect(screen.getByText('Remover fixacao?')).toBeTruthy()
    expect(screen.getByText('Confirmar')).toBeTruthy()
    expect(screen.getByText('Cancelar')).toBeTruthy()
  })
})
