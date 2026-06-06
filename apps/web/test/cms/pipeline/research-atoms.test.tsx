import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  StatusBadge,
  TemaDot,
  TemaTag,
  HorizonChip,
  DecisionStatusBadge,
  SourceTag,
} from '@/app/cms/(authed)/pipeline/research/_components/atoms'
import {
  STATUS_META,
  THEME_META,
  HORIZON_META,
  DECISION_STATUS_META,
  SOURCE_META,
} from '@/lib/pipeline/research-types'
import type {
  ResearchStatus,
  ThemeId,
  DecisionHorizon,
  DecisionStatus,
} from '@/lib/pipeline/research-types'
import type { ResearchSource } from '@/lib/pipeline/research-schemas'

// ---------------------------------------------------------------------------
// 1. StatusBadge
// ---------------------------------------------------------------------------

describe('StatusBadge', () => {
  const statuses: ResearchStatus[] = ['fresca', 'analise', 'aplicada', 'arquivada']

  it.each(statuses)('renders correct label for status "%s"', (status) => {
    const { container } = render(<StatusBadge status={status} />)
    const expected = STATUS_META[status].label
    expect(container.textContent).toContain(expected)
  })

  it.each(statuses)('renders a colored dot element for status "%s"', (status) => {
    const { container } = render(<StatusBadge status={status} />)
    const dot = container.querySelector('.dot')
    expect(dot).not.toBeNull()
    // Verify dot dimensions are set inline (background with CSS vars may be
    // stripped by happy-dom, so we check structural presence instead)
    const style = dot!.getAttribute('style') ?? ''
    expect(style).toContain('width: 7')
    expect(style).toContain('height: 7')
    expect(style).toContain('border-radius: 50%')
  })

  it('returns null for invalid status', () => {
    // @ts-expect-error - testing invalid status
    const { container } = render(<StatusBadge status="INVALID_STATUS" />)
    expect(container.innerHTML).toBe('')
  })

  it('defaults to size "sm"', () => {
    const { container } = render(<StatusBadge status="fresca" />)
    const badge = container.querySelector('.badge')
    expect(badge!.getAttribute('style')).toContain('font-size: 11')
  })

  it('applies size "md" font size', () => {
    const { container } = render(<StatusBadge status="fresca" size="md" />)
    const badge = container.querySelector('.badge')
    expect(badge!.getAttribute('style')).toContain('font-size: 12.5')
  })
})

// ---------------------------------------------------------------------------
// 2. TemaDot
// ---------------------------------------------------------------------------

describe('TemaDot', () => {
  const themeIds: ThemeId[] = ['asia', 'ia', 'dev', 'games', 'grana', 'canal']

  it.each(themeIds)('renders a colored dot for theme "%s"', (id) => {
    const { container } = render(<TemaDot id={id} />)
    const dot = container.querySelector('.tdot')
    expect(dot).not.toBeNull()
    expect(dot!.getAttribute('style')).toContain(THEME_META[id].color)
  })

  it('hides label by default (showLabel=false)', () => {
    const { container } = render(<TemaDot id="asia" />)
    // Should only have the dot span, no text content for the label
    expect(container.textContent).not.toContain(THEME_META.asia.short)
  })

  it('shows label when showLabel=true', () => {
    const { container } = render(<TemaDot id="asia" showLabel />)
    expect(container.textContent).toContain(THEME_META.asia.short)
  })

  it('uses default size of 8', () => {
    const { container } = render(<TemaDot id="dev" />)
    const dot = container.querySelector('.tdot')
    expect(dot!.getAttribute('style')).toContain('width: 8')
    expect(dot!.getAttribute('style')).toContain('height: 8')
  })

  it('respects custom size prop', () => {
    const { container } = render(<TemaDot id="dev" size={12} />)
    const dot = container.querySelector('.tdot')
    expect(dot!.getAttribute('style')).toContain('width: 12')
    expect(dot!.getAttribute('style')).toContain('height: 12')
  })

  it('returns null for invalid theme id', () => {
    // @ts-expect-error - testing invalid id
    const { container } = render(<TemaDot id="INVALID_THEME" />)
    expect(container.innerHTML).toBe('')
  })
})

// ---------------------------------------------------------------------------
// 3. TemaTag
// ---------------------------------------------------------------------------

describe('TemaTag', () => {
  const themeIds: ThemeId[] = ['asia', 'ia', 'dev', 'games', 'grana', 'canal']

  it.each(themeIds)('renders short label for theme "%s"', (id) => {
    const { container } = render(<TemaTag id={id} />)
    expect(container.textContent).toContain(THEME_META[id].short)
  })

  it.each(themeIds)('renders colored dot for theme "%s"', (id) => {
    const { container } = render(<TemaTag id={id} />)
    const dot = container.querySelector('.tdot')
    expect(dot).not.toBeNull()
    expect(dot!.getAttribute('style')).toContain(THEME_META[id].color)
  })

  it('returns null for invalid theme id', () => {
    // @ts-expect-error - testing invalid id
    const { container } = render(<TemaTag id="INVALID_THEME" />)
    expect(container.innerHTML).toBe('')
  })
})

// ---------------------------------------------------------------------------
// 4. HorizonChip
// ---------------------------------------------------------------------------

describe('HorizonChip', () => {
  const horizons: DecisionHorizon[] = ['agora', 'proximo', 'explorar']

  it.each(horizons)('renders label for horizon "%s"', (horizon) => {
    const { container } = render(<HorizonChip horizon={horizon} />)
    expect(container.textContent).toContain(HORIZON_META[horizon].label)
  })

  it.each(horizons)('applies --hc CSS custom property for horizon "%s"', (horizon) => {
    const { container } = render(<HorizonChip horizon={horizon} />)
    const chip = container.querySelector('.hz-chip')
    expect(chip).not.toBeNull()
    expect(chip!.getAttribute('style')).toContain(HORIZON_META[horizon].color)
  })

  it('returns null for invalid horizon', () => {
    // @ts-expect-error - testing invalid horizon
    const { container } = render(<HorizonChip horizon="INVALID" />)
    expect(container.innerHTML).toBe('')
  })
})

// ---------------------------------------------------------------------------
// 5. DecisionStatusBadge
// ---------------------------------------------------------------------------

describe('DecisionStatusBadge', () => {
  const statuses: DecisionStatus[] = ['decidido', 'testando', 'revisar', 'arquivado']

  it.each(statuses)('renders label for decision status "%s"', (status) => {
    const { container } = render(<DecisionStatusBadge status={status} />)
    expect(container.textContent).toContain(DECISION_STATUS_META[status].label)
  })

  it.each(statuses)('applies --ds CSS custom property for status "%s"', (status) => {
    const { container } = render(<DecisionStatusBadge status={status} />)
    const el = container.querySelector('.dstat')
    expect(el).not.toBeNull()
    // All statuses should have --ds style
    expect(el!.getAttribute('style')).toContain('--ds')
  })

  it('uses var(--text-dim) for muted kind (arquivado)', () => {
    const { container } = render(<DecisionStatusBadge status="arquivado" />)
    const el = container.querySelector('.dstat')
    expect(el!.getAttribute('style')).toContain('var(--text-dim)')
  })

  it('uses var(--ok) for ok kind (decidido)', () => {
    const { container } = render(<DecisionStatusBadge status="decidido" />)
    const el = container.querySelector('.dstat')
    expect(el!.getAttribute('style')).toContain('var(--ok)')
  })

  it('returns null for invalid status', () => {
    // @ts-expect-error - testing invalid status
    const { container } = render(<DecisionStatusBadge status="INVALID" />)
    expect(container.innerHTML).toBe('')
  })
})

// ---------------------------------------------------------------------------
// 6. SourceTag
// ---------------------------------------------------------------------------

describe('SourceTag', () => {
  const sources: ResearchSource[] = ['cowork', 'thiago', 'dupla']

  it.each(sources)('renders label for source "%s"', (source) => {
    const { container } = render(<SourceTag source={source} />)
    expect(container.textContent).toContain(SOURCE_META[source].label)
  })

  it.each(sources)('applies --st CSS custom property for source "%s"', (source) => {
    const { container } = render(<SourceTag source={source} />)
    const el = container.querySelector('.src-tag')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('style')).toContain(SOURCE_META[source].tone)
  })

  it('returns null for invalid source', () => {
    // @ts-expect-error - testing invalid source
    const { container } = render(<SourceTag source="INVALID" />)
    expect(container.innerHTML).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Meta constants integrity
// ---------------------------------------------------------------------------

describe('Meta constants integrity', () => {
  it('STATUS_META covers all 4 statuses', () => {
    expect(Object.keys(STATUS_META)).toEqual(['fresca', 'analise', 'aplicada', 'arquivada'])
  })

  it('THEME_META covers all 6 themes', () => {
    expect(Object.keys(THEME_META)).toEqual(['asia', 'ia', 'dev', 'games', 'grana', 'canal'])
  })

  it('HORIZON_META covers all 3 horizons', () => {
    expect(Object.keys(HORIZON_META)).toEqual(['agora', 'proximo', 'explorar'])
  })

  it('DECISION_STATUS_META covers all 4 statuses', () => {
    expect(Object.keys(DECISION_STATUS_META)).toEqual(['decidido', 'testando', 'revisar', 'arquivado'])
  })

  it('SOURCE_META covers all 3 sources', () => {
    expect(Object.keys(SOURCE_META)).toEqual(['cowork', 'thiago', 'dupla'])
  })

  it('every StatusMeta has label, kind, and dot', () => {
    for (const meta of Object.values(STATUS_META)) {
      expect(meta).toHaveProperty('label')
      expect(meta).toHaveProperty('kind')
      expect(meta).toHaveProperty('dot')
      expect(typeof meta.label).toBe('string')
      expect(['info', 'warn', 'ok', 'muted']).toContain(meta.kind)
    }
  })

  it('every ThemeMeta has id, label, short, color, and icon', () => {
    for (const meta of Object.values(THEME_META)) {
      expect(meta).toHaveProperty('id')
      expect(meta).toHaveProperty('label')
      expect(meta).toHaveProperty('short')
      expect(meta).toHaveProperty('color')
      expect(meta).toHaveProperty('icon')
    }
  })
})
