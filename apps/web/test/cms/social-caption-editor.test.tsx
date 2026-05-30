import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CaptionEditor } from '@/app/cms/(authed)/social/new/_components/caption-editor'

describe('CaptionEditor', () => {
  it('renders input for ig_story (not textarea)', () => {
    render(<CaptionEditor destId="ig_story" value="" onChange={vi.fn()} />)
    const input = screen.getByRole('textbox')
    expect(input).toBeTruthy()
    expect(input.tagName).toBe('INPUT')
  })

  it('renders textarea for yt_community', () => {
    render(<CaptionEditor destId="yt_community" value="" onChange={vi.fn()} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('shows character counter for yt_community', () => {
    render(<CaptionEditor destId="yt_community" value="Hello" onChange={vi.fn()} />)
    expect(screen.getByText('5/1500')).toBeTruthy()
  })

  it('shows poll button for yt_community when onAddPoll provided', () => {
    const onAddPoll = vi.fn()
    render(<CaptionEditor destId="yt_community" value="" onChange={vi.fn()} onAddPoll={onAddPoll} />)
    fireEvent.click(screen.getByText('Adicionar enquete'))
    expect(onAddPoll).toHaveBeenCalled()
  })

  it('does not show poll button for fb_page', () => {
    render(<CaptionEditor destId="fb_page" value="" onChange={vi.fn()} />)
    expect(screen.queryByText('Adicionar enquete')).toBeNull()
  })

  it('has aria-label on textarea', () => {
    render(<CaptionEditor destId="fb_page" value="" onChange={vi.fn()} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea.getAttribute('aria-label')).toContain('Facebook')
  })
})
