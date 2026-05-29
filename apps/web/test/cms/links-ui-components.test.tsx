// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Info: icon('Info'),
    ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'),
    Check: icon('Check'),
    AlertTriangle: icon('AlertTriangle'),
    Clock: icon('Clock'),
    TrendingUp: icon('TrendingUp'),
    TrendingDown: icon('TrendingDown'),
  }
})

import { FilterGroup } from '@/app/cms/(authed)/links/_components/filter-group'
import { StatusDot } from '@/app/cms/(authed)/links/_components/status-dot'
import { HealthBadge } from '@/app/cms/(authed)/links/_components/health-badge'
import { RangeTabs } from '@/app/cms/(authed)/links/_components/range-tabs'

afterEach(() => cleanup())

describe('FilterGroup', () => {
  const opts = [
    { id: 'all', label: 'Tudo' },
    { id: 'newsletter', label: 'Newsletter' },
    { id: 'social', label: 'Social' },
  ]

  it('renders label and all options', () => {
    const { getByText } = render(
      <FilterGroup label="Origem" value="all" onChange={() => {}} opts={opts} />
    )
    expect(getByText('Origem')).toBeTruthy()
    expect(getByText('Tudo')).toBeTruthy()
    expect(getByText('Newsletter')).toBeTruthy()
    expect(getByText('Social')).toBeTruthy()
  })

  it('calls onChange when option clicked', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <FilterGroup label="Origem" value="all" onChange={onChange} opts={opts} />
    )
    fireEvent.click(getByText('Newsletter'))
    expect(onChange).toHaveBeenCalledWith('newsletter')
  })

  it('highlights active option', () => {
    const { getByText } = render(
      <FilterGroup label="Origem" value="newsletter" onChange={() => {}} opts={opts} />
    )
    const btn = getByText('Newsletter')
    expect(btn.className).toContain('bg-primary')
  })
})

describe('StatusDot', () => {
  it('renders active status with green dot', () => {
    const { getByText, container } = render(<StatusDot status="active" />)
    expect(getByText('Ativo')).toBeTruthy()
    const dot = container.querySelector('[data-status-dot]')
    expect(dot?.className).toContain('bg-green')
  })

  it('renders paused status with amber dot', () => {
    const { getByText, container } = render(<StatusDot status="paused" />)
    expect(getByText('Pausado')).toBeTruthy()
    const dot = container.querySelector('[data-status-dot]')
    expect(dot?.className).toContain('bg-amber')
  })

  it('renders expired status with red dot', () => {
    const { getByText, container } = render(<StatusDot status="expired" />)
    expect(getByText('Expirado')).toBeTruthy()
    const dot = container.querySelector('[data-status-dot]')
    expect(dot?.className).toContain('bg-red')
  })
})

describe('HealthBadge', () => {
  it('renders ok health as green', () => {
    const { getByText } = render(<HealthBadge health="ok" />)
    const el = getByText('saudavel')
    expect(el.closest('[data-health-badge]')?.className).toContain('green')
  })

  it('renders warn health as amber', () => {
    const { getByText } = render(<HealthBadge health="warn" />)
    expect(getByText('a expirar')).toBeTruthy()
  })

  it('renders broken health as red', () => {
    const { getByText } = render(<HealthBadge health="broken" />)
    expect(getByText('quebrado')).toBeTruthy()
  })
})

describe('RangeTabs', () => {
  it('renders all 4 range options', () => {
    const { getByText } = render(<RangeTabs value="30d" onChange={() => {}} />)
    expect(getByText('7 dias')).toBeTruthy()
    expect(getByText('30 dias')).toBeTruthy()
    expect(getByText('90 dias')).toBeTruthy()
    expect(getByText('1 ano')).toBeTruthy()
  })

  it('calls onChange with range id', () => {
    const onChange = vi.fn()
    const { getByText } = render(<RangeTabs value="30d" onChange={onChange} />)
    fireEvent.click(getByText('7 dias'))
    expect(onChange).toHaveBeenCalledWith('7d')
  })

  it('highlights active tab', () => {
    const { getByText } = render(<RangeTabs value="90d" onChange={() => {}} />)
    const btn = getByText('90 dias')
    expect(btn.className).toContain('bg-primary')
  })
})
