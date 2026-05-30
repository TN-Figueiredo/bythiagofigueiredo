import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DestCard } from '@/app/cms/(authed)/social/new/_components/dest-card'

describe('DestCard', () => {
  const onToggle = vi.fn()
  const onFocus = vi.fn()

  it('renders destination label and sublabel', () => {
    render(<DestCard destId="ig_story" isOn={true} isFocused={false} onToggle={onToggle} onFocus={onFocus} />)
    expect(screen.getByText('Instagram')).toBeTruthy()
    expect(screen.getByText('Story')).toBeTruthy()
  })

  it('shows badge for default destinations', () => {
    render(<DestCard destId="ig_story" isOn={true} isFocused={false} onToggle={onToggle} onFocus={onFocus} />)
    expect(screen.getByText('padrao')).toBeTruthy()
  })

  it('shows rare badge for ig_feed', () => {
    render(<DestCard destId="ig_feed" isOn={true} isFocused={false} onToggle={onToggle} onFocus={onFocus} />)
    expect(screen.getByText('raro')).toBeTruthy()
  })

  it('calls onFocus when card is clicked', () => {
    render(<DestCard destId="fb_page" isOn={true} isFocused={false} onToggle={onToggle} onFocus={onFocus} />)
    fireEvent.click(screen.getByRole('option'))
    expect(onFocus).toHaveBeenCalledWith('fb_page')
  })

  it('calls onToggle when checkbox is clicked', () => {
    render(<DestCard destId="yt_community" isOn={true} isFocused={false} onToggle={onToggle} onFocus={onFocus} />)
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(onToggle).toHaveBeenCalledWith('yt_community')
  })

  it('has reduced opacity when off', () => {
    const { container } = render(<DestCard destId="ig_story" isOn={false} isFocused={false} onToggle={onToggle} onFocus={onFocus} />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('opacity')
  })
})
