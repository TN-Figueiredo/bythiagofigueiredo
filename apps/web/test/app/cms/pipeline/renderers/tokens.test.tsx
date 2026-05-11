import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  TagPill,
  TimestampChip,
  DbChip,
  PauseChip,
  NegHighlight,
  EmphHighlight,
  OptionalBadge,
  TAG_COLORS,
} from '@/app/cms/(authed)/pipeline/_components/detail/renderers/tokens'

describe('TAG_COLORS', () => {
  it('has entries for all 8 tag types', () => {
    const expected = ['VISUAL', 'TOM', 'B-ROLL', 'CORTE', 'OVERLAY', 'TRANS', 'MUSIC', 'STYLE', 'TIMING', 'ENTRY', 'FLOW', 'NOTE']
    for (const tag of expected) {
      expect(TAG_COLORS[tag]).toBeDefined()
      expect(TAG_COLORS[tag].pill.bg).toBeTruthy()
      expect(TAG_COLORS[tag].pill.color).toBeTruthy()
      expect(TAG_COLORS[tag].text).toBeTruthy()
    }
  })
})

describe('TagPill', () => {
  it('renders the tag name with correct background', () => {
    const { container } = render(<TagPill tag="VISUAL" />)
    const pill = container.firstElementChild as HTMLElement
    expect(pill.textContent).toBe('VISUAL')
    expect(pill.style.background).toBe(TAG_COLORS.VISUAL.pill.bg)
    expect(pill.style.color).toBe(TAG_COLORS.VISUAL.pill.color)
  })

  it('falls back to NOTE styling for unknown tags', () => {
    const { container } = render(<TagPill tag="UNKNOWN" />)
    const pill = container.firstElementChild as HTMLElement
    expect(pill.style.background).toBe(TAG_COLORS.NOTE.pill.bg)
  })
})

describe('TimestampChip', () => {
  it('renders timestamp in monospace', () => {
    const { container } = render(<TimestampChip ts="01:42" />)
    const chip = container.firstElementChild as HTMLElement
    expect(chip.textContent).toBe('01:42')
    expect(chip.className).toContain('font-mono')
  })
})

describe('DbChip', () => {
  it('renders dB value', () => {
    const { container } = render(<DbChip value="-20dB" />)
    expect(container.textContent).toBe('-20dB')
  })
})

describe('PauseChip', () => {
  it('renders pause with duration', () => {
    const { container } = render(<PauseChip duration="0.5s" />)
    expect(container.textContent).toContain('0.5s')
    expect(container.textContent).toContain('⏸')
  })
})

describe('NegHighlight', () => {
  it('renders with red styling', () => {
    const { container } = render(<NegHighlight text="NÃO" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.textContent).toBe('NÃO')
    expect(el.style.color).toBe('#f87171')
  })
})

describe('EmphHighlight', () => {
  it('renders with yellow bold', () => {
    const { container } = render(<EmphHighlight text="HAVE" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.textContent).toBe('HAVE')
    expect(el.style.color).toBe('#fbbf24')
  })
})

describe('OptionalBadge', () => {
  it('renders OPT text', () => {
    const { container } = render(<OptionalBadge />)
    expect(container.textContent).toBe('OPT')
  })
})
