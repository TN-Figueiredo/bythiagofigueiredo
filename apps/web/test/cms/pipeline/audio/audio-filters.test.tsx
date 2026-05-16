import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { AudioFilters } from '@/app/cms/(authed)/pipeline/audio/_components/audio-filters'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderFilters(overrides: {
  filters?: Record<string, string>
  onChange?: ReturnType<typeof vi.fn>
  categories?: string[]
  availableTags?: string[]
} = {}) {
  const props = {
    filters: {},
    onChange: vi.fn(),
    ...overrides,
  }
  render(<AudioFilters {...props} />)
  return props
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AudioFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders type radio buttons — All, Music, SFX', () => {
    renderFilters()
    const radios = screen.getAllByRole('radio')
    const names = radios.map(r => (r as HTMLInputElement).name)
    // All type radios share name="type"
    const typeRadios = radios.filter(r => (r as HTMLInputElement).name === 'type')
    expect(typeRadios).toHaveLength(3)

    // Labels rendered next to radios
    expect(screen.getByText('All')).toBeDefined()
    expect(screen.getByText(/Music/i)).toBeDefined()
    expect(screen.getByText(/SFX/i)).toBeDefined()
  })

  it('type selection calls onChange with { type: "music" }', () => {
    const onChange = vi.fn()
    renderFilters({ onChange })
    // Click the "Music" radio label text — get the label that wraps the radio
    const musicLabel = screen.getByText(/🎵 Music/)
    fireEvent.click(musicLabel)
    expect(onChange).toHaveBeenCalledWith({ type: 'music' })
  })

  it('renders category buttons when categories are provided', () => {
    renderFilters({ categories: ['Cinematic', 'Ambient', 'Electronic'] })
    expect(screen.getByText('Cinematic')).toBeDefined()
    expect(screen.getByText('Ambient')).toBeDefined()
    expect(screen.getByText('Electronic')).toBeDefined()
  })

  it('search input has data-audio-search attribute', () => {
    renderFilters()
    const input = document.querySelector('[data-audio-search]')
    expect(input).not.toBeNull()
  })

  it('clear filters button resets to empty object', () => {
    const onChange = vi.fn()
    renderFilters({ filters: { type: 'music', status: 'downloaded' }, onChange })
    const clearBtn = screen.getByText('Clear filters')
    fireEvent.click(clearBtn)
    expect(onChange).toHaveBeenCalledWith({})
  })
})
