import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LaunchRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/launch-renderer'

const basePlcSequence = [
  { number: 1, title: 'The Opportunity', theme: 'opportunity', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: '2026-07-01', status: 'drafted', key_message: 'AI is changing everything', mental_triggers: ['authority'] },
  { number: 2, title: 'The Framework', theme: 'teaching', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: 'Master the system', mental_triggers: [] },
  { number: 3, title: 'Ownership', theme: 'ownership', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
]

const baseMentalTriggers = {
  authority: 'Expert em IA desde 2020',
  social_proof: null,
  reciprocity: null,
  scarcity: null,
  community: null,
  anticipation: null,
}

describe('LaunchRenderer — read mode', () => {
  const baseProps = {
    content: {
      launch_type: 'seed',
      plc_sequence: basePlcSequence,
      cart_open_date: '2026-08-01',
      cart_close_date: '2026-08-07',
      early_bird_deadline: null,
      bonuses: [
        { title: 'Templates Exclusivos', description: 'Pack de templates prontos', type: 'tool', deadline: '2026-08-03' },
      ],
      email_campaign_id: null,
      mental_triggers: baseMentalTriggers,
      notes: 'Lançamento focado em devs',
    },
    isEditing: false,
    lang: 'shared',
    onContentChange: vi.fn(),
  }

  it('renders launch type label in Portuguese', () => {
    render(<LaunchRenderer {...baseProps} />)
    expect(screen.getByText('Semente')).toBeTruthy()
  })

  it('renders all PLC card titles', () => {
    render(<LaunchRenderer {...baseProps} />)
    expect(screen.getByText('The Opportunity')).toBeTruthy()
    expect(screen.getByText('The Framework')).toBeTruthy()
    expect(screen.getByText('Ownership')).toBeTruthy()
  })

  it('renders PLC key messages', () => {
    render(<LaunchRenderer {...baseProps} />)
    expect(screen.getByText('AI is changing everything')).toBeTruthy()
    expect(screen.getByText('Master the system')).toBeTruthy()
  })

  it('renders cart open and close dates formatted', () => {
    render(<LaunchRenderer {...baseProps} />)
    // Dates are formatted in pt-BR; there may be multiple date elements
    // Use getAllByText to handle multiple matches for partial date strings
    const dateEls = screen.getAllByText(/ago/)
    expect(dateEls.length).toBeGreaterThan(0)
  })

  it('renders bonus title', () => {
    render(<LaunchRenderer {...baseProps} />)
    expect(screen.getByText('Templates Exclusivos')).toBeTruthy()
  })

  it('renders bonus description', () => {
    render(<LaunchRenderer {...baseProps} />)
    expect(screen.getByText('Pack de templates prontos')).toBeTruthy()
  })

  it('renders bonus type badge', () => {
    render(<LaunchRenderer {...baseProps} />)
    // type 'tool' maps to 'Ferramenta'
    expect(screen.getByText('Ferramenta')).toBeTruthy()
  })

  it('renders notes text', () => {
    render(<LaunchRenderer {...baseProps} />)
    expect(screen.getByText('Lançamento focado em devs')).toBeTruthy()
  })

  it('renders filled mental trigger label and value', () => {
    render(<LaunchRenderer {...baseProps} />)
    // 'Autoridade' appears multiple times (label + trigger row) — use getAllByText
    const autoridade = screen.getAllByText('Autoridade')
    expect(autoridade.length).toBeGreaterThan(0)
    expect(screen.getByText('Expert em IA desde 2020')).toBeTruthy()
  })

  it('renders default content without errors when content is empty string', () => {
    render(
      <LaunchRenderer
        content=""
        isEditing={false}
        lang="shared"
        onContentChange={vi.fn()}
      />
    )
    // Falls back to defaults — launch_type 'seed' → 'Semente'
    expect(screen.getByText('Semente')).toBeTruthy()
  })

  it('renders default content without errors when content is null', () => {
    render(
      <LaunchRenderer
        content={null}
        isEditing={false}
        lang="shared"
        onContentChange={vi.fn()}
      />
    )
    expect(screen.getByText('Semente')).toBeTruthy()
  })

  it('renders empty state (no bonuses section) when bonuses array is empty', () => {
    const { container } = render(
      <LaunchRenderer
        {...baseProps}
        content={{ ...baseProps.content, bonuses: [] }}
      />
    )
    // "Bônus" section label should not appear
    const bonusHeadings = container.querySelectorAll('div')
    const allText = Array.from(bonusHeadings).map((el) => el.textContent ?? '')
    // The bonus section count "(0)" should not exist since the section is hidden
    expect(allText.some((t) => t.includes('Bônus (0)'))).toBe(false)
  })
})

describe('LaunchRenderer — edit mode', () => {
  const editProps = {
    content: {
      launch_type: 'seed',
      plc_sequence: basePlcSequence,
      cart_open_date: null,
      cart_close_date: null,
      early_bird_deadline: null,
      bonuses: [],
      email_campaign_id: null,
      mental_triggers: baseMentalTriggers,
      notes: '',
    },
    isEditing: true,
    lang: 'shared',
    onContentChange: vi.fn(),
  }

  it('shows launch type selector buttons', () => {
    render(<LaunchRenderer {...editProps} />)
    expect(screen.getByText('Semente')).toBeTruthy()
    expect(screen.getByText('Interno')).toBeTruthy()
    expect(screen.getByText('Joint Venture')).toBeTruthy()
    expect(screen.getByText('Evergreen')).toBeTruthy()
  })

  it('clicking a launch type calls onContentChange with the new type', () => {
    const onContentChange = vi.fn()
    render(<LaunchRenderer {...editProps} onContentChange={onContentChange} />)
    fireEvent.click(screen.getByText('Evergreen'))
    expect(onContentChange).toHaveBeenCalledOnce()
    const updated = onContentChange.mock.calls[0][0] as { launch_type: string }
    expect(updated.launch_type).toBe('evergreen')
  })

  it('shows add bonus button', () => {
    render(<LaunchRenderer {...editProps} />)
    expect(screen.getByText('+ Adicionar')).toBeTruthy()
  })

  it('adding a bonus calls onContentChange with one bonus', () => {
    const onContentChange = vi.fn()
    render(<LaunchRenderer {...editProps} onContentChange={onContentChange} />)
    fireEvent.click(screen.getByText('+ Adicionar'))
    expect(onContentChange).toHaveBeenCalledOnce()
    const updated = onContentChange.mock.calls[0][0] as { bonuses: unknown[] }
    expect(updated.bonuses).toHaveLength(1)
  })

  it('removing a bonus calls onContentChange with empty bonuses', () => {
    const onContentChange = vi.fn()
    render(
      <LaunchRenderer
        {...editProps}
        content={{
          ...editProps.content,
          bonuses: [{ title: 'Bônus X', description: 'Desc', type: 'content', deadline: null }],
        }}
        onContentChange={onContentChange}
      />
    )
    fireEvent.click(screen.getByText('Remover'))
    expect(onContentChange).toHaveBeenCalledOnce()
    const updated = onContentChange.mock.calls[0][0] as { bonuses: unknown[] }
    expect(updated.bonuses).toHaveLength(0)
  })

  it('shows PLC title inputs for editing', () => {
    render(<LaunchRenderer {...editProps} />)
    const input = screen.getByDisplayValue('The Opportunity')
    expect(input).toBeTruthy()
  })
})
