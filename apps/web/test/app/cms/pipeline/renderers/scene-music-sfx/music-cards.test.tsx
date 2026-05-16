import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MusicRecommendationCard } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-recommendation-card'
import { MusicAlternativeRow } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-row'
import type { MusicRecommendation } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types'

const LOCAL_TRACK: MusicRecommendation = {
  track: 'Ocean Depth',
  artist: 'Veaceslav Draganov',
  original_filename: 'Veaceslav Draganov - Ocean Depth.wav',
  resolve_status: 'LOCAL',
  score: 26,
  score_max: 34,
  score_breakdown: {
    category: { score: 5, max: 5 },
    tags: { score: 6, max: 8 },
    mood: { score: 4, max: 6 },
    energy: { score: 3, max: 3 },
    bpm_in_range: { score: 3, max: 3 },
    duration_in_range: { score: 2, max: 2 },
    reuse_scenarios: { score: 0, max: 4 },
    instruments: { score: 3, max: 3 },
  },
  reasoning: 'Dark ambient pads match the cinematic tone needed for the hook.',
  energy: 2,
  bpm: 90,
  key: 'E3',
  duration: '3:42',
}

describe('MusicRecommendationCard', () => {
  it('renders track name and artist', () => {
    render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    expect(screen.getByText('Ocean Depth')).toBeTruthy()
    expect(screen.getByText(/Veaceslav Draganov/)).toBeTruthy()
  })

  it('shows star badge when favorite', () => {
    const { container } = render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    expect(container.textContent).toContain('★')
  })

  it('shows resolve status badge', () => {
    const { container } = render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    expect(container.textContent).toContain('Local')
  })

  it('shows score gauge with percentage', () => {
    const { container } = render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(container.textContent).toContain('76%')
  })

  it('expands to show score breakdown on click', () => {
    const { container } = render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    const button = container.querySelector('button')
    fireEvent.click(button!)
    expect(container.textContent).toContain('category')
    expect(container.textContent).toContain('5/5')
  })

  it('shows reasoning text', () => {
    render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    expect(screen.getByText(/Dark ambient pads/)).toBeTruthy()
  })

  it('shows PENDING_MATCH with download CTA always visible', () => {
    const pending: MusicRecommendation = { ...LOCAL_TRACK, resolve_status: 'PENDING_MATCH' }
    const { container } = render(<MusicRecommendationCard recommendation={pending} isFavorite />)
    expect(container.textContent).toContain('Download')
  })
})

describe('MusicAlternativeRow', () => {
  const ALT_TRACK: MusicRecommendation = {
    track: 'Fission',
    artist: 'Phillip Gross',
    resolve_status: 'LOCAL',
    score: 18,
    score_max: 34,
    reasoning: 'Similar dark tone but more electronic.',
    delta_vs_favorite: { tags: -2, mood: -2, reuse_scenarios: -4 },
    energy: 3,
  }

  it('renders index, track and artist', () => {
    const { container } = render(<MusicAlternativeRow recommendation={ALT_TRACK} index={2} />)
    expect(container.textContent).toContain('2.')
    expect(container.textContent).toContain('Fission')
    expect(container.textContent).toContain('Phillip Gross')
  })

  it('shows delta notes', () => {
    const { container } = render(<MusicAlternativeRow recommendation={ALT_TRACK} index={2} />)
    expect(container.textContent).toContain('Δ')
    expect(container.textContent).toContain('tags')
    expect(container.textContent).toContain('mood')
  })

  it('shows reasoning inline', () => {
    render(<MusicAlternativeRow recommendation={ALT_TRACK} index={2} />)
    expect(screen.getByText(/Similar dark tone/)).toBeTruthy()
  })
})
