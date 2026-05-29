// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { VariantMetadata } from '@/lib/youtube/ab-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { toast } from 'sonner'
import { WizardVariantCard } from '../../src/app/cms/(authed)/youtube/ab-lab/_components/wizard-variant-card'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fullMetadata(overrides: Partial<VariantMetadata> = {}): VariantMetadata {
  return {
    ai_image_prompt: 'A cinematic shot of a cat wearing sunglasses',
    rationale: 'High contrast thumbnail grabs attention',
    classification: 'hero',
    composition: { face_position: 'center', background: 'gradient', product_placement: 'left' },
    expression: 'surprised',
    synergy: { division: 'Title focuses on curiosity, thumbnail on visual impact', reinforcement: 'strong' },
    score: { thumbnail: 85, title: 90, combo: 88 },
    palette: [
      { hex: '#FF0000', role: 'primary', purpose: 'attention' },
      { hex: '#00FF00', role: 'accent', purpose: 'contrast' },
    ],
    ...overrides,
  }
}

const defaultProps = () => ({
  label: 'Variante A',
  metadata: fullMetadata(),
  titleText: 'My Test Title',
  onTitleChange: vi.fn(),
  color: 'green' as const,
})

// ---------------------------------------------------------------------------
// Clipboard stub
// ---------------------------------------------------------------------------

const writeTextMock = vi.fn(() => Promise.resolve())

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WizardVariantCard', () => {
  // 1 — Renders variant label and color border
  it.each([
    ['green', 'border-t-green-500'],
    ['blue', 'border-t-blue-500'],
    ['amber', 'border-t-amber-500'],
  ] as const)('renders label and applies %s border class', (color, expectedClass) => {
    const { container } = render(
      <WizardVariantCard {...defaultProps()} color={color} />,
    )
    expect(screen.getByText('Variante A')).toBeDefined()
    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain(expectedClass)
  })

  // 2 — Shows combo score badge when metadata.score.combo exists
  it('shows combo score badge when metadata.score.combo exists', () => {
    render(<WizardVariantCard {...defaultProps()} />)
    expect(screen.getByText('88')).toBeDefined()
  })

  // 3 — Hides combo score badge when no score data
  it('hides combo score badge when no score data', () => {
    const props = defaultProps()
    props.metadata = fullMetadata({ score: undefined })
    render(<WizardVariantCard {...props} />)
    expect(screen.queryByText('88')).toBeNull()
  })

  // 4 — Editable title input calls onTitleChange on change
  it('calls onTitleChange when title input changes', () => {
    const props = defaultProps()
    render(<WizardVariantCard {...props} />)
    const input = screen.getByDisplayValue('My Test Title')
    fireEvent.change(input, { target: { value: 'Updated Title' } })
    expect(props.onTitleChange).toHaveBeenCalledWith('Updated Title')
  })

  // 5 — Description textarea appears when onDescriptionChange provided
  it('shows description textarea when onDescriptionChange is provided', () => {
    const onChange = vi.fn()
    render(
      <WizardVariantCard
        {...defaultProps()}
        descriptionText="Some description"
        onDescriptionChange={onChange}
      />,
    )
    const textarea = screen.getByDisplayValue('Some description')
    expect(textarea.tagName).toBe('TEXTAREA')
    fireEvent.change(textarea, { target: { value: 'New desc' } })
    expect(onChange).toHaveBeenCalledWith('New desc')
  })

  // 6 — Description textarea hidden when onDescriptionChange not provided
  it('hides description textarea when onDescriptionChange is not provided', () => {
    const { container } = render(<WizardVariantCard {...defaultProps()} />)
    const textareas = container.querySelectorAll('textarea')
    expect(textareas.length).toBe(0)
  })

  // 7 — "Copiar Image Prompt" button copies ai_image_prompt to clipboard
  it('copies ai_image_prompt to clipboard on "Copiar Image Prompt" click', async () => {
    render(<WizardVariantCard {...defaultProps()} />)
    const btn = screen.getByText('Copiar Image Prompt')
    fireEvent.click(btn)
    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        'A cinematic shot of a cat wearing sunglasses',
      )
      expect(toast.success).toHaveBeenCalledWith('Image prompt copiado!')
    })
  })

  // 8 — "Copiar Image Prompt" hidden when no ai_image_prompt
  it('hides "Copiar Image Prompt" when no ai_image_prompt', () => {
    const props = defaultProps()
    props.metadata = fullMetadata({ ai_image_prompt: undefined })
    render(<WizardVariantCard {...props} />)
    expect(screen.queryByText('Copiar Image Prompt')).toBeNull()
  })

  // 9 — Collapsible synergy section shows summary from metadata.synergy.division
  it('shows synergy division as collapsible summary', () => {
    render(<WizardVariantCard {...defaultProps()} />)
    const summary = screen.getByText(
      'Title focuses on curiosity, thumbnail on visual impact',
    )
    expect(summary).toBeDefined()
    expect(summary.tagName).toBe('SUMMARY')
  })

  it('truncates synergy division longer than 80 chars', () => {
    const longDivision = 'A'.repeat(100)
    const props = defaultProps()
    props.metadata = fullMetadata({
      synergy: { division: longDivision },
    })
    render(<WizardVariantCard {...props} />)
    const summary = screen.getByText(`${'A'.repeat(80)}...`)
    expect(summary).toBeDefined()
  })

  // 10 — Palette swatches render from metadata.palette array
  it('renders palette swatches with correct colors', () => {
    const { container } = render(<WizardVariantCard {...defaultProps()} />)
    const swatches = container.querySelectorAll('button[title]')
    // Filter to palette swatches (the ones with backgroundColor style)
    const paletteButtons = Array.from(swatches).filter((b) =>
      (b as HTMLElement).style.backgroundColor,
    )
    expect(paletteButtons.length).toBe(2)
    expect(paletteButtons[0].getAttribute('title')).toBe('primary')
    expect(paletteButtons[1].getAttribute('title')).toBe('accent')
  })

  // 11 — Palette swatch click copies hex to clipboard
  it('copies hex to clipboard when palette swatch is clicked', async () => {
    const { container } = render(<WizardVariantCard {...defaultProps()} />)
    const swatches = Array.from(container.querySelectorAll('button[title]')).filter(
      (b) => (b as HTMLElement).style.backgroundColor,
    )
    fireEvent.click(swatches[0])
    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('#FF0000')
      expect(toast.success).toHaveBeenCalledWith('#FF0000 copiado!')
    })
  })

  // 12 — Handles empty metadata gracefully
  it('handles empty metadata without crashing', () => {
    const { container } = render(
      <WizardVariantCard
        label="Empty"
        metadata={{}}
        titleText=""
        onTitleChange={vi.fn()}
        color="blue"
      />,
    )
    // Card should render with label and input
    expect(screen.getByText('Empty')).toBeDefined()
    const input = container.querySelector('input[type="text"]')
    expect(input).not.toBeNull()
    // No combo badge, no image prompt button, no palette, no details
    expect(screen.queryByText('Copiar Image Prompt')).toBeNull()
    expect(container.querySelectorAll('details').length).toBe(0)
    const paletteButtons = Array.from(container.querySelectorAll('button[title]')).filter(
      (b) => (b as HTMLElement).style.backgroundColor,
    )
    expect(paletteButtons.length).toBe(0)
  })

  // Extra edge: classification text shown
  it('shows classification text when present', () => {
    render(<WizardVariantCard {...defaultProps()} />)
    expect(screen.getByText('hero')).toBeDefined()
  })

  // Extra edge: falls back to rationale when synergy.division is absent
  it('uses rationale as synopsis fallback when synergy.division is absent', () => {
    const props = defaultProps()
    props.metadata = fullMetadata({
      synergy: undefined,
      rationale: 'This is the rationale text',
    })
    const { container } = render(<WizardVariantCard {...props} />)
    const summary = container.querySelector('summary')
    expect(summary).not.toBeNull()
    expect(summary!.textContent).toBe('This is the rationale text')
  })
})
