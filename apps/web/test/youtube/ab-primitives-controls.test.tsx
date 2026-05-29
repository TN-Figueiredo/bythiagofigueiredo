import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Seg, Toggle, NumberField, CheckRow, Slider, CfgRow, SectionLabel, Legend } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers') }
})

describe('Seg', () => {
  const opts = ['a', 'b', 'c'] as const
  it('renders radiogroup', () => { render(<Seg options={opts} value="a" onChange={() => {}} />); expect(screen.getByRole('radiogroup')).toBeDefined() })
  it('marks selected as aria-checked', () => {
    render(<Seg options={opts} value="b" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'b' }).getAttribute('aria-checked')).toBe('true')
  })
  it('marks others as not checked', () => {
    render(<Seg options={opts} value="b" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'a' }).getAttribute('aria-checked')).toBe('false')
  })
  it('calls onChange on click', () => {
    const fn = vi.fn()
    render(<Seg options={opts} value="a" onChange={fn} />)
    fireEvent.click(screen.getByRole('radio', { name: 'c' }))
    expect(fn).toHaveBeenCalledWith('c')
  })
  it('uses custom labels', () => { render(<Seg options={opts} value="a" onChange={() => {}} labels={{ a: 'Alpha' }} />); expect(screen.getByText('Alpha')).toBeDefined() })
  it('selected has tabIndex 0, others -1', () => {
    render(<Seg options={opts} value="b" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'b' }).tabIndex).toBe(0)
    expect(screen.getByRole('radio', { name: 'a' }).tabIndex).toBe(-1)
  })
})

describe('Toggle', () => {
  it('has role=switch', () => { render(<Toggle checked={false} onChange={() => {}} />); expect(screen.getByRole('switch')).toBeDefined() })
  it('reflects aria-checked=true', () => { render(<Toggle checked onChange={() => {}} />); expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true') })
  it('reflects aria-checked=false', () => { render(<Toggle checked={false} onChange={() => {}} />); expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false') })
  it('calls onChange with opposite value', () => {
    const fn = vi.fn()
    render(<Toggle checked={false} onChange={fn} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(fn).toHaveBeenCalledWith(true)
  })
})

describe('NumberField', () => {
  it('has role=spinbutton', () => { render(<NumberField value={5} onChange={() => {}} />); expect(screen.getByRole('spinbutton')).toBeDefined() })
  it('shows current value', () => { render(<NumberField value={7} onChange={() => {}} />); expect(screen.getByText('7')).toBeDefined() })
  it('increments on + click', () => {
    const fn = vi.fn()
    render(<NumberField value={5} onChange={fn} />)
    fireEvent.click(screen.getByLabelText('Increase'))
    expect(fn).toHaveBeenCalledWith(6)
  })
  it('decrements on - click', () => {
    const fn = vi.fn()
    render(<NumberField value={5} onChange={fn} />)
    fireEvent.click(screen.getByLabelText('Decrease'))
    expect(fn).toHaveBeenCalledWith(4)
  })
  it('clamps to max', () => {
    const fn = vi.fn()
    render(<NumberField value={10} max={10} onChange={fn} />)
    fireEvent.click(screen.getByLabelText('Increase'))
    expect(fn).toHaveBeenCalledWith(10)
  })
  it('has aria-valuenow', () => { render(<NumberField value={3} onChange={() => {}} />); expect(screen.getByRole('spinbutton').getAttribute('aria-valuenow')).toBe('3') })
})

describe('CheckRow', () => {
  it('renders label text', () => { render(<CheckRow checked={false} onChange={() => {}} label="Auto" />); expect(screen.getByText('Auto')).toBeDefined() })
  it('renders hint', () => { render(<CheckRow checked={false} onChange={() => {}} label="X" hint="Details" />); expect(screen.getByText('Details')).toBeDefined() })
  it('toggles checkbox', () => {
    const fn = vi.fn()
    render(<CheckRow checked={false} onChange={fn} label="Auto" />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(fn).toHaveBeenCalledWith(true)
  })
  it('checkbox reflects checked state', () => {
    render(<CheckRow checked onChange={() => {}} label="X" />)
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })
})

describe('Slider', () => {
  it('renders range input', () => { render(<Slider value={50} onChange={() => {}} />); expect(screen.getByRole('slider')).toBeDefined() })
  it('shows formatted value', () => { render(<Slider value={95} onChange={() => {}} format={v => `${v}%`} />); expect(screen.getByText('95%')).toBeDefined() })
  it('calls onChange with number', () => {
    const fn = vi.fn()
    render(<Slider value={50} onChange={fn} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '75' } })
    expect(fn).toHaveBeenCalledWith(75)
  })
  it('has aria-valuetext', () => {
    render(<Slider value={50} onChange={() => {}} format={v => `${v}%`} />)
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('50%')
  })
})

describe('CfgRow', () => {
  it('renders label', () => { render(<CfgRow label="Duration"><span>ctrl</span></CfgRow>); expect(screen.getByText('Duration')).toBeDefined() })
  it('renders children', () => { render(<CfgRow label="X"><span>ctrl</span></CfgRow>); expect(screen.getByText('ctrl')).toBeDefined() })
  it('renders hint', () => { render(<CfgRow label="X" hint="Help"><span>c</span></CfgRow>); expect(screen.getByText('Help')).toBeDefined() })
})

describe('SectionLabel', () => {
  it('renders as h3 by default', () => { const { container } = render(<SectionLabel>Title</SectionLabel>); expect(container.querySelector('h3')?.textContent).toBe('Title') })
  it('renders as h2 when specified', () => { const { container } = render(<SectionLabel as="h2">Title</SectionLabel>); expect(container.querySelector('h2')).not.toBeNull() })
  it('renders right content', () => { render(<SectionLabel right={<span>R</span>}>T</SectionLabel>); expect(screen.getByText('R')).toBeDefined() })
  it('renders as div', () => { const { container } = render(<SectionLabel as="div">T</SectionLabel>); expect(container.querySelector('div div')).not.toBeNull() })
})

describe('Legend', () => {
  it('renders all items', () => { render(<Legend items={[{ label: 'A', color: '#888' }, { label: 'B', color: '#f00' }]} />); expect(screen.getByText('A')).toBeDefined(); expect(screen.getByText('B')).toBeDefined() })
  it('applies color to swatch', () => {
    const { container } = render(<Legend items={[{ label: 'X', color: '#abc' }]} />)
    const swatch = container.querySelector('[aria-hidden="true"]')
    expect(swatch?.getAttribute('style')).toContain('#abc')
  })
  it('renders empty for no items', () => { const { container } = render(<Legend items={[]} />); expect(container.querySelectorAll('span > span').length).toBe(0) })
})
