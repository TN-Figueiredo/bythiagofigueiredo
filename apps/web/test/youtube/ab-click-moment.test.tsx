import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ClickMomentVariant } from '@/lib/youtube/ab-wizard-adapter'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'),
    LayoutGrid: icon('LayoutGrid'), Search: icon('Search'), ListVideo: icon('ListVideo'), Smartphone: icon('Smartphone'),
    Trophy: icon('Trophy'), TrendingUp: icon('TrendingUp'), Lock: icon('Lock'), Plus: icon('Plus'),
    Trash2: icon('Trash2'), Sparkles: icon('Sparkles'), CheckCircle: icon('CheckCircle'), Play: icon('Play'),
    ChevronDown: icon('ChevronDown'), X: icon('X'), ArrowLeft: icon('ArrowLeft'),
  }
})

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}))

/* ── YTThumb ── */
import { YTThumb } from '@/app/cms/(authed)/youtube/ab-lab/_components/yt-thumb'

describe('YTThumb', () => {
  it('renders img when thumbUrl provided', () => {
    const { container } = render(<YTThumb thumbUrl="https://example.com/thumb.jpg" />)
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('renders gradient when thumbBg provided without thumbUrl', () => {
    const { container } = render(<YTThumb thumbBg="#E8823C" overlayText="Test" />)
    expect(container.querySelector('[style]')).toBeTruthy()
  })

  it('renders solid fallback when both missing', () => {
    const { container } = render(<YTThumb />)
    expect(container.querySelector('.bg-\\[\\#1a1814\\]')).toBeTruthy()
  })

  it('hides overlay and duration in mini mode', () => {
    const { container } = render(<YTThumb thumbBg="#E8823C" overlayText="Hidden" duration="12:34" mini />)
    expect(container.textContent).not.toContain('Hidden')
    expect(container.textContent).not.toContain('12:34')
  })

  it('shows duration chip', () => {
    render(<YTThumb thumbUrl="https://example.com/thumb.jpg" duration="12:34" />)
    expect(screen.getByText('12:34')).toBeTruthy()
  })

  it('shows label badge', () => {
    render(<YTThumb thumbUrl="https://example.com/thumb.jpg" label="Winner" />)
    expect(screen.getByText('Winner')).toBeTruthy()
  })
})

/* ── BehaviorStrip ── */
import { BehaviorStrip } from '@/app/cms/(authed)/youtube/ab-lab/_components/behavior-strip'

describe('BehaviorStrip', () => {
  it('renders VChip with label', () => {
    render(<BehaviorStrip label="A" color="#8A8F98" ctr={5.0} maxCtr={7.0} />)
    expect(screen.getByLabelText('Variant A')).toBeTruthy()
  })

  it('shows CTR value', () => {
    render(<BehaviorStrip label="B" color="#E8823C" ctr={6.5} maxCtr={7.0} />)
    expect(screen.getByText('6.50%')).toBeTruthy()
  })

  it('shows green delta for positive lift', () => {
    const { container } = render(<BehaviorStrip label="B" color="#E8823C" ctr={6.0} maxCtr={7.0} delta={20} />)
    expect(container.querySelector('.text-cms-green')).toBeTruthy()
    expect(screen.getByText('+20%')).toBeTruthy()
  })

  it('shows red delta for negative lift', () => {
    const { container } = render(<BehaviorStrip label="C" color="#3FA9C0" ctr={4.0} maxCtr={7.0} delta={-15} />)
    expect(container.querySelector('.text-red-400')).toBeTruthy()
  })

  it('hides delta for baseline', () => {
    const { container } = render(<BehaviorStrip label="A" color="#8A8F98" ctr={5.0} maxCtr={7.0} isBaseline delta={0} />)
    expect(container.querySelectorAll('.text-cms-green, .text-red-400').length).toBe(0)
  })

  it('renders leader ring on VChip', () => {
    render(<BehaviorStrip label="B" color="#E8823C" ctr={7.0} maxCtr={7.0} isLeader />)
    const chip = screen.getByLabelText('Variant B')
    expect(chip.getAttribute('style')).toContain('box-shadow')
  })
})

/* ── ClickMoment ── */
import { ClickMoment } from '@/app/cms/(authed)/youtube/ab-lab/_components/click-moment'

const mockVariants: ClickMomentVariant[] = [
  { label: 'A', color: '#8A8F98', thumbUrl: null, thumbBg: '#8A8F98', title: 'Original Title', ctr: 5.0 },
  { label: 'B', color: '#E8823C', thumbUrl: 'https://example.com/b.jpg', title: 'Variant B Title', ctr: 7.0, isLeader: true },
]

describe('ClickMoment', () => {
  it('renders header with "The click moment"', () => {
    render(<ClickMoment variants={mockVariants} />)
    expect(screen.getByText('The click moment')).toBeTruthy()
  })

  it('renders view-mode radiogroup', () => {
    render(<ClickMoment variants={mockVariants} />)
    expect(screen.getByRole('radiogroup', { name: 'View mode' })).toBeTruthy()
  })

  it('renders context switcher with 4 buttons', () => {
    render(<ClickMoment variants={mockVariants} />)
    const ctxGroup = screen.getByRole('radiogroup', { name: 'YouTube context' })
    const buttons = ctxGroup.querySelectorAll('[role="radio"]')
    expect(buttons.length).toBe(4)
  })

  it('renders variant cards in compare mode', () => {
    render(<ClickMoment variants={mockVariants} />)
    // Should render BehaviorStrip for each variant, which contains VChip
    expect(screen.getByLabelText('Variant A')).toBeTruthy()
    expect(screen.getByLabelText('Variant B')).toBeTruthy()
  })

  it('shows Trophy badge for winner', () => {
    render(<ClickMoment variants={mockVariants} winnerId="B" />)
    // "Winner" appears both as YTThumb label badge and as Trophy badge
    const winners = screen.getAllByText('Winner')
    expect(winners.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByTestId('icon-Trophy')).toBeTruthy()
  })

  it('shows Leader badge for leader', () => {
    render(<ClickMoment variants={mockVariants} leaderId="B" />)
    // "Leader" appears both as YTThumb label badge and as TrendingUp badge
    const leaders = screen.getAllByText('Leader')
    expect(leaders.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByTestId('icon-TrendingUp')).toBeTruthy()
  })

  it('renders without crashing for empty variants', () => {
    const { container } = render(<ClickMoment variants={[]} />)
    expect(screen.getByText('The click moment')).toBeTruthy()
    // No variant cards
    expect(container.querySelector('[aria-label="Variant A"]')).toBeNull()
  })

  it('switches to feed mode', () => {
    render(<ClickMoment variants={mockVariants} />)
    const viewGroup = screen.getByRole('radiogroup', { name: 'View mode' })
    const feedBtn = viewGroup.querySelector('[role="radio"]:last-child')!
    fireEvent.click(feedBtn)
    // In feed mode, "Your video" badge should appear
    expect(screen.getByText('Your video')).toBeTruthy()
  })
})

/* ── FeedView ── */
import { FeedView } from '@/app/cms/(authed)/youtube/ab-lab/_components/feed-view'

describe('FeedView', () => {
  const variants: ClickMomentVariant[] = [
    { label: 'A', color: '#8A8F98', thumbUrl: null, title: 'Test Video', ctr: 5.0 },
    { label: 'B', color: '#E8823C', thumbUrl: null, title: 'Variant B', ctr: 7.0 },
  ]

  it('renders decoy videos', () => {
    const { container } = render(<FeedView variants={variants} />)
    const hidden = container.querySelectorAll('[aria-hidden="true"]')
    expect(hidden.length).toBeGreaterThanOrEqual(5)
  })

  it('shows "Your video" badge', () => {
    render(<FeedView variants={variants} />)
    expect(screen.getByText('Your video')).toBeTruthy()
  })

  it('renders variant selector', () => {
    render(<FeedView variants={variants} />)
    expect(screen.getByRole('radiogroup', { name: 'Select variant to preview' })).toBeTruthy()
  })

  it('returns null for empty variants', () => {
    const { container } = render(<FeedView variants={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
