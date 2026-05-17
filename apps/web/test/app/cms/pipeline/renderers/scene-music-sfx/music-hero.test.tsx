import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { MusicHeroSection } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-hero-section'
import type { SceneMusic, MusicRecommendation } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types'

function makeRec(overrides: Partial<MusicRecommendation> = {}): MusicRecommendation {
  return {
    track: 'Ocean Depth',
    artist: 'V. Draganov',
    resolve_status: 'LOCAL',
    score: 28,
    score_max: 34,
    is_empty_slot: false,
    artlist_search_tier: 'narrow',
    ...overrides,
  }
}

function makeEmptyRec(tier: 'narrow' | 'medium' | 'broad'): MusicRecommendation {
  return {
    track: '',
    artist: '',
    resolve_status: 'NO_MATCH',
    score: 0,
    score_max: 34,
    is_empty_slot: true,
    slot_label: tier === 'narrow' ? 'Buscar alternativa' : tier === 'medium' ? 'Alternativa similar' : 'Explorar gênero',
    artlist_search_url: `https://artlist.io/search?q=test&tier=${tier}`,
    artlist_search_tier: tier,
  }
}

function makeMusic(overrides: Partial<SceneMusic> = {}): SceneMusic {
  return {
    recommendations: [makeRec(), makeRec({ track: 'Alt 1', score: 22 }), makeRec({ track: 'Alt 2', score: 18 })],
    favorite_index: 0,
    fill_count: 3,
    search_tiers: { narrow: 'https://artlist.io/narrow', medium: 'https://artlist.io/medium', broad: 'https://artlist.io/broad' },
    style: 'Cinematic ambient with subtle tension',
    entry_cue: 'After first narration line',
    search_terms: 'cinematic ambient tension',
    ...overrides,
  }
}

describe('MusicHeroSection — 6 visual states', () => {
  describe('State 1: 3/3 filled, all LOCAL (green)', () => {
    it('renders region with correct aria-label', () => {
      render(<MusicHeroSection music={makeMusic()} sceneIndex={2} />)
      expect(screen.getByRole('region', { name: /Recomendações de música para cena 2/ })).toBeDefined()
    })

    it('shows green fill indicator 3/3', () => {
      render(<MusicHeroSection music={makeMusic()} sceneIndex={1} />)
      const fillIndicator = screen.getByRole('img', { name: /3 de 3 músicas encontradas/ })
      expect(fillIndicator).toBeDefined()
      expect(fillIndicator.textContent).toContain('3/3')
    })

    it('displays all track names', () => {
      render(<MusicHeroSection music={makeMusic()} sceneIndex={1} />)
      const container = screen.getByRole('region')
      expect(container.textContent).toContain('Ocean Depth')
      expect(container.textContent).toContain('Alt 1')
      expect(container.textContent).toContain('Alt 2')
    })

    it('shows hero card with percentage', () => {
      render(<MusicHeroSection music={makeMusic()} sceneIndex={1} />)
      // 28/34 = 82%
      const heroCard = screen.getByLabelText(/Ocean Depth, 82%, ✓ Local/)
      expect(heroCard).toBeDefined()
    })
  })

  describe('State 2: 2/3 filled (amber)', () => {
    const music = makeMusic({
      fill_count: 2,
      recommendations: [
        makeRec(),
        makeRec({ track: 'Second Track', score: 20 }),
        makeEmptyRec('medium'),
      ],
    })

    it('shows amber fill indicator 2/3', () => {
      render(<MusicHeroSection music={music} sceneIndex={1} />)
      const fillIndicator = screen.getByRole('img', { name: /2 de 3 músicas encontradas/ })
      expect(fillIndicator).toBeDefined()
      expect(fillIndicator.textContent).toContain('2/3')
    })

    it('renders one empty slot with search CTA', () => {
      render(<MusicHeroSection music={music} sceneIndex={1} />)
      const container = screen.getByRole('region')
      expect(container.textContent).toContain('Buscar')
    })

    it('renders filled alternative track', () => {
      render(<MusicHeroSection music={music} sceneIndex={1} />)
      const container = screen.getByRole('region')
      expect(container.textContent).toContain('Second Track')
    })
  })

  describe('State 3: 1/3 filled (amber)', () => {
    const music = makeMusic({
      fill_count: 1,
      recommendations: [
        makeRec(),
        makeEmptyRec('medium'),
        makeEmptyRec('broad'),
      ],
    })

    it('shows amber fill indicator 1/3', () => {
      render(<MusicHeroSection music={music} sceneIndex={1} />)
      const fillIndicator = screen.getByRole('img', { name: /1 de 3 músicas encontradas/ })
      expect(fillIndicator).toBeDefined()
      expect(fillIndicator.textContent).toContain('1/3')
    })

    it('renders two empty slots', () => {
      render(<MusicHeroSection music={music} sceneIndex={1} />)
      const emptySlots = screen.getAllByLabelText(/Slot \d+ vazio/)
      expect(emptySlots.length).toBe(2)
    })
  })

  describe('State 4: 0/3 filled (red)', () => {
    const music = makeMusic({
      fill_count: 0,
      recommendations: [
        makeEmptyRec('narrow'),
        makeEmptyRec('medium'),
        makeEmptyRec('broad'),
      ],
      favorite_index: 0,
    })

    it('shows red fill indicator 0/3', () => {
      render(<MusicHeroSection music={music} sceneIndex={1} />)
      const fillIndicator = screen.getByRole('img', { name: /0 de 3 músicas encontradas/ })
      expect(fillIndicator).toBeDefined()
      expect(fillIndicator.textContent).toContain('0/3')
    })

    it('renders all 3 slots as empty with search CTAs', () => {
      render(<MusicHeroSection music={music} sceneIndex={1} />)
      const emptySlots = screen.getAllByLabelText(/Slot \d+ vazio/)
      expect(emptySlots.length).toBe(3)
    })

    it('shows search CTA text', () => {
      render(<MusicHeroSection music={music} sceneIndex={1} />)
      const container = screen.getByRole('region')
      expect(container.textContent).toContain('Buscar no Artlist')
    })
  })

  describe('State 5: Continuation scene (dim)', () => {
    const music = makeMusic({
      continuation: 'Cena 3',
      fill_count: 1,
      track: 'Ocean Depth',
      artist: 'V. Draganov',
      resolve_status: 'LOCAL',
      score: 28,
    })

    it('shows dim fill indicator', () => {
      render(<MusicHeroSection music={music} sceneIndex={4} />)
      const fillIndicator = screen.getByRole('img', { name: /1 de 3 músicas encontradas/ })
      expect(fillIndicator).toBeDefined()
    })

    it('displays "Continua da" with source scene label', () => {
      render(<MusicHeroSection music={music} sceneIndex={4} />)
      const container = screen.getByRole('region')
      expect(container.textContent).toContain('Continua da')
      expect(container.textContent).toContain('Cena 3')
    })

    it('renders continuation card with source track name', () => {
      render(<MusicHeroSection music={music} sceneIndex={4} />)
      const container = screen.getByRole('region')
      expect(container.textContent).toContain('Ocean Depth')
    })
  })

  describe('PENDING_MATCH download CTA', () => {
    it('shows download CTA for PENDING_MATCH hero', () => {
      const music = makeMusic({
        recommendations: [
          makeRec({ resolve_status: 'PENDING_MATCH', artlist_url: 'https://artlist.io/track/123' }),
          makeRec({ track: 'Alt', score: 20 }),
          makeEmptyRec('broad'),
        ],
        fill_count: 2,
      })
      render(<MusicHeroSection music={music} sceneIndex={1} />)
      const container = screen.getByRole('region')
      expect(container.textContent).toContain('Baixar')
    })
  })

  describe('Delta vs favorite', () => {
    it('shows delta vs favorite on alternative slot when expanded', () => {
      const music = makeMusic({
        recommendations: [
          makeRec({ score: 30 }),
          makeRec({ track: 'Runner Up', score: 24, delta_vs_favorite: { mood: -2, energy: -1, bpm_in_range: -3 } }),
          makeRec({ track: 'Third', score: 18 }),
        ],
      })
      const { container } = render(<MusicHeroSection music={music} sceneIndex={1} />)
      // Delta shows in collapsed view as "−N pts vs #1"
      expect(container.textContent).toContain('vs #1')
    })
  })

  describe('Note absorption — entry_cue and style rendering', () => {
    it('filters MUSIC/STYLE/ENTRY/FLOW notes when music has recommendations', () => {
      const music = makeMusic({ entry_cue: 'After beat drop', style: 'Epic cinematic' })
      render(<MusicHeroSection music={music} sceneIndex={1} />)
      const container = screen.getByRole('region')
      expect(container.textContent).toContain('Entrada: After beat drop')
      expect(container.textContent).toContain('Epic cinematic')
    })
  })

  describe('State 6: Expanded breakdown', () => {
    const recWithBreakdown = makeRec({
      score_breakdown: {
        category: { score: 5, max: 5 },
        mood: { score: 4, max: 5 },
        energy: { score: 3, max: 5 },
        bpm_in_range: { score: 4, max: 5 },
        tags: { score: 5, max: 5 },
        instruments: { score: 3, max: 4 },
        duration_in_range: { score: 4, max: 5 },
      },
    })
    const music = makeMusic({
      recommendations: [recWithBreakdown, makeRec({ track: 'Alt 1', score: 22 }), makeRec({ track: 'Alt 2', score: 18 })],
    })

    it('renders without crashing when score_breakdown is present', () => {
      const { container } = render(<MusicHeroSection music={music} sceneIndex={1} />)
      expect(container.textContent).toContain('Ocean Depth')
    })

    it('shows Score Breakdown heading when hero card is expanded', () => {
      const { container } = render(<MusicHeroSection music={music} sceneIndex={1} />)
      const heroButton = container.querySelector('button[aria-expanded]')
      expect(heroButton).toBeDefined()
      act(() => { fireEvent.click(heroButton!) })
      expect(container.textContent).toContain('Detalhamento')
    })

    it('displays breakdown categories after expansion', () => {
      const { container } = render(<MusicHeroSection music={music} sceneIndex={1} />)
      const heroButton = container.querySelector('button[aria-expanded]')
      act(() => { fireEvent.click(heroButton!) })
      expect(container.textContent).toContain('category')
      expect(container.textContent).toContain('mood')
      expect(container.textContent).toContain('energy')
    })
  })
})
