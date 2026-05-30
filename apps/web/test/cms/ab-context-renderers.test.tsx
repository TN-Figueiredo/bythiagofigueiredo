import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'),
    Lock: icon('Lock'), Plus: icon('Plus'), Trash2: icon('Trash2'), Sparkles: icon('Sparkles'),
    CheckCircle: icon('CheckCircle'), Play: icon('Play'), ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'), ArrowLeft: icon('ArrowLeft'), Copy: icon('Copy'),
    Download: icon('Download'), Pause: icon('Pause'), Square: icon('Square'),
    LayoutGrid: icon('LayoutGrid'), Search: icon('Search'), ListVideo: icon('ListVideo'),
    Smartphone: icon('Smartphone'), Trophy: icon('Trophy'), TrendingUp: icon('TrendingUp'),
    TrendingDown: icon('TrendingDown'),
  }
})

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}))

import {
  HomeCard,
  SearchRow,
  SidebarRow,
  MobilePhone,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/context-renderers'

const baseProps = {
  thumbUrl: 'https://example.com/thumb.jpg',
  thumbBg: '#E8823C',
  title: 'How to Build Great Thumbnails',
  channelName: 'DesignChannel',
  views: '12K views',
  age: '3 days ago',
  duration: '10:42',
  label: 'A',
}

// ---------------------------------------------------------------------------
// HomeCard
// ---------------------------------------------------------------------------

describe('HomeCard', () => {
  it('renders full-width, shows title, channel name, views/age, duration via YTThumb', () => {
    const { container } = render(<HomeCard {...baseProps} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('w-full')
    expect(screen.getByText(baseProps.title)).toBeTruthy()
    expect(screen.getByText(baseProps.channelName)).toBeTruthy()
    expect(screen.getByText(`${baseProps.views} · ${baseProps.age}`)).toBeTruthy()
    expect(screen.getByText(baseProps.duration)).toBeTruthy()
  })

  it('shows channel avatar with first letter', () => {
    render(<HomeCard {...baseProps} />)
    const avatar = screen.getByText(baseProps.channelName.charAt(0).toUpperCase())
    expect(avatar).toBeTruthy()
    expect(avatar.className).toContain('rounded-full')
  })
})

// ---------------------------------------------------------------------------
// SearchRow
// ---------------------------------------------------------------------------

describe('SearchRow', () => {
  it('thumbnail container is 340px wide (w-[340px] class)', () => {
    const { container } = render(<SearchRow {...baseProps} />)
    const thumbWrapper = container.querySelector('.w-\\[340px\\]')
    expect(thumbWrapper).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// SidebarRow
// ---------------------------------------------------------------------------

describe('SidebarRow', () => {
  it('thumbnail is 168px wide (w-[168px] class) and uses mini mode on YTThumb', () => {
    const { container } = render(<SidebarRow {...baseProps} />)
    const thumbWrapper = container.querySelector('.w-\\[168px\\]')
    expect(thumbWrapper).toBeTruthy()
    // In mini mode, duration and overlay text are hidden
    expect(container.textContent).not.toContain(baseProps.duration)
  })
})

// ---------------------------------------------------------------------------
// MobilePhone
// ---------------------------------------------------------------------------

describe('MobilePhone', () => {
  it('has phone frame (rounded-[40px]), notch bar, dark background', () => {
    const { container } = render(<MobilePhone {...baseProps} />)
    const phone = container.firstElementChild as HTMLElement
    expect(phone.className).toContain('rounded-[40px]')
    expect(phone.className).toContain('bg-black')
    // Notch bar
    const notch = phone.querySelector('.rounded-b-2xl')
    expect(notch).toBeTruthy()
  })

  it('shows white text', () => {
    const { container } = render(<MobilePhone {...baseProps} />)
    const titleEl = screen.getByText(baseProps.title)
    expect(titleEl.className).toContain('text-white')
  })
})

// ---------------------------------------------------------------------------
// All renderers
// ---------------------------------------------------------------------------

describe('All context renderers', () => {
  const renderers = [
    { name: 'HomeCard', Component: HomeCard },
    { name: 'SearchRow', Component: SearchRow },
    { name: 'SidebarRow', Component: SidebarRow },
    { name: 'MobilePhone', Component: MobilePhone },
  ]

  it.each(renderers)('$name renders the title text', ({ Component }) => {
    render(<Component {...baseProps} />)
    expect(screen.getByText(baseProps.title)).toBeTruthy()
  })

  it.each(renderers)('$name shows the channel name', ({ Component }) => {
    render(<Component {...baseProps} />)
    expect(screen.getByText(baseProps.channelName)).toBeTruthy()
  })
})
