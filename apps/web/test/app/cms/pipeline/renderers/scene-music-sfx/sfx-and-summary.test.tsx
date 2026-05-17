import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { SFXItemCard } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/sfx-item-card'
import { SfxRecommendationsList } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/sfx-recommendations-list'
import { AudioSummaryV2 } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/audio-summary'
import { ScoreBar } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-bar'
import type { SceneSFX, SceneMusic, SfxRecommendation } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types'

describe('SFXItemCard', () => {
  it('renders LOCAL state with filename and score', () => {
    const sfx: SceneSFX = {
      timestamp: '00:06',
      description: 'Impact leve — marca entrada do talking head',
      resolve_status: 'LOCAL',
      sfx_category: 'IMPACT',
      original_filename: 'Deep Low Impact.wav',
      score: 30,
      score_max: 34,
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('00:06')
    expect(container.textContent).toContain('Impact leve')
    expect(container.textContent).toContain('Deep Low Impact.wav')
    expect(container.textContent).toContain('IMPACT')
    expect(container.textContent).toContain('Local')
  })

  it('renders NO_MATCH with individual search term chips', () => {
    const sfx: SceneSFX = {
      timestamp: '00:17',
      description: 'SFX bass drop — marca fim do hook',
      resolve_status: 'NO_MATCH',
      sfx_category: 'DROP',
      search_terms: 'bass drop,impact hit low',
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('Buscar')
    const links = container.querySelectorAll('a')
    expect(links.length).toBe(2)
    expect(links[0]?.textContent).toContain('bass drop')
    expect(links[1]?.textContent).toContain('impact hit low')
    expect(links[0]?.getAttribute('href')).toContain('artlist.io')
  })

  it('renders PARTIAL_MATCH with filename and search fallback', () => {
    const sfx: SceneSFX = {
      timestamp: '00:11',
      description: 'Riser sutil 2s — build tensão',
      resolve_status: 'PARTIAL_MATCH',
      sfx_category: 'RISER',
      original_filename: 'Short Riser.wav',
      score: 15,
      score_max: 34,
      search_terms: 'subtle riser 2s',
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('Parcial')
    expect(container.textContent).toContain('Short Riser.wav')
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
  })

  it('shows search chips for LOCAL items with low score (<50%)', () => {
    const sfx: SceneSFX = {
      timestamp: '00:06',
      description: 'Impact leve',
      resolve_status: 'LOCAL',
      sfx_category: 'IMPACT',
      original_filename: 'Deep Low Impact.wav',
      score: 8,
      score_max: 34,
      search_terms: 'subtle impact,deep hit',
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    const links = container.querySelectorAll('a')
    expect(links.length).toBe(2)
    expect(links[0]?.textContent).toContain('subtle impact')
  })

  it('shows search chips for LOCAL items with high score when search_terms present', () => {
    const sfx: SceneSFX = {
      timestamp: '00:06',
      description: 'Impact leve',
      resolve_status: 'LOCAL',
      sfx_category: 'IMPACT',
      original_filename: 'Deep Low Impact.wav',
      score: 20,
      score_max: 34,
      search_terms: 'subtle impact',
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    const links = container.querySelectorAll('a')
    expect(links.length).toBe(1)
    expect(links[0]!.textContent).toContain('subtle impact')
  })

  it('renders cue_text when provided', () => {
    const sfx: SceneSFX = {
      timestamp: '00:06',
      description: 'Impact leve',
      resolve_status: 'LOCAL',
      sfx_category: 'IMPACT',
      original_filename: 'Deep Low Impact.wav',
      cue_text: 'vida estável',
      score: 30,
      score_max: 34,
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('vida estável')
    expect(container.textContent).toContain('IMPACT')
  })

  it('renders category pill with correct color', () => {
    const sfx: SceneSFX = {
      timestamp: '00:03',
      description: 'Ambient wind loop',
      resolve_status: 'LOCAL',
      sfx_category: 'AMBIENT',
      original_filename: 'Wind.wav',
      score: 20,
      score_max: 34,
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('AMBIENT')
  })

  it('renders without sfx_category', () => {
    const sfx: SceneSFX = {
      timestamp: '00:10',
      description: 'Generic sound',
      resolve_status: 'LOCAL',
      original_filename: 'sound.wav',
      score: 20,
      score_max: 34,
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('Generic sound')
    expect(container.textContent).toContain('sound.wav')
    // No category pill should render
    const pills = container.querySelectorAll('[class*="uppercase"]')
    expect(pills.length).toBe(0)
  })

  it('wraps search terms in accessible group', () => {
    const sfx: SceneSFX = {
      timestamp: '00:10',
      description: 'Impact',
      resolve_status: 'NO_MATCH',
      sfx_category: 'IMPACT',
      search_terms: 'boom,crash',
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    const group = container.querySelector('[role="group"]')
    expect(group).toBeTruthy()
    expect(group!.getAttribute('aria-label')).toBe('Termos de busca no Artlist')
  })
})

function makeRec(overrides: Partial<SfxRecommendation> = {}): SfxRecommendation {
  return {
    title: 'Construction Ambience',
    artist: 'SoundBits',
    resolve_status: 'LOCAL',
    score: 22,
    score_max: 25,
    ...overrides,
  }
}

function makeSfxWithRecs(overrides: Partial<SceneSFX> = {}): SceneSFX {
  return {
    timestamp: '00:56',
    description: 'Construção civil (2s, -18dB)',
    sfx_category: 'FOLEY',
    resolve_status: 'LOCAL',
    original_filename: 'SoundBits - Building Site - Construction Ambience.wav',
    score: 22,
    score_max: 25,
    score_breakdown: {
      category: { score: 5, max: 5 },
      subcategory: { score: 4, max: 4 },
      tags: { score: 6, max: 6 },
      mood: { score: 4, max: 4 },
      duration: { score: 3, max: 3 },
      reuse: { score: 0, max: 3 },
    },
    reasoning: 'Construction ambience matches perfectly.',
    recommendations: [
      makeRec({ rank: 1, preferred: true }),
      makeRec({ rank: 2, title: 'Machinery Compressor', artist: 'Artlist', score: 19, resolve_status: 'LOCAL' }),
      makeRec({ rank: 3, title: 'Jackhammer Site', artist: 'InspectorJ', score: 17, resolve_status: 'NO_MATCH', artlist_url: 'https://artlist.io/sfx/search?search=jackhammer' }),
    ],
    ...overrides,
  }
}

describe('SFXItemCard — expand/collapse with recommendations', () => {
  it('shows expand button when recommendations exist', () => {
    const sfx = makeSfxWithRecs()
    const { container } = render(<SFXItemCard sfx={sfx} />)
    const expandBtn = container.querySelector('button[aria-expanded]')
    expect(expandBtn).toBeTruthy()
    expect(expandBtn!.textContent).toContain('+3 alt')
  })

  it('does not show expand button for legacy SFX without recommendations or breakdown', () => {
    const sfx: SceneSFX = {
      timestamp: '00:06',
      description: 'Impact leve',
      resolve_status: 'LOCAL',
      sfx_category: 'IMPACT',
      original_filename: 'Deep Low Impact.wav',
      score: 30,
      score_max: 34,
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    const expandBtn = container.querySelector('button[aria-expanded]')
    expect(expandBtn).toBeNull()
  })

  it('shows score breakdown and reasoning when expanded', () => {
    const sfx = makeSfxWithRecs()
    const { container } = render(<SFXItemCard sfx={sfx} />)
    const expandBtn = container.querySelector('button[aria-expanded]')!
    act(() => { fireEvent.click(expandBtn) })
    expect(container.textContent).toContain('Detalhamento')
    expect(container.textContent).toContain('category')
    expect(container.textContent).toContain('subcategory')
    expect(container.textContent).toContain('Construction ambience matches perfectly.')
  })

  it('shows recommendation list when expanded', () => {
    const sfx = makeSfxWithRecs()
    const { container } = render(<SFXItemCard sfx={sfx} />)
    const expandBtn = container.querySelector('button[aria-expanded]')!
    act(() => { fireEvent.click(expandBtn) })
    expect(container.textContent).toContain('Machinery Compressor')
    expect(container.textContent).toContain('Jackhammer Site')
  })

  it('hides expandable content when collapsed', () => {
    const sfx = makeSfxWithRecs()
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).not.toContain('Detalhamento')
    expect(container.textContent).not.toContain('Machinery Compressor')
  })

  it('shows expand button with just score_breakdown (no recommendations)', () => {
    const sfx = makeSfxWithRecs({ recommendations: undefined })
    const { container } = render(<SFXItemCard sfx={sfx} />)
    const expandBtn = container.querySelector('button[aria-expanded]')
    expect(expandBtn).toBeTruthy()
    expect(expandBtn!.textContent).toContain('▸')
    expect(expandBtn!.textContent).not.toContain('alt')
  })

  it('shows expand button with just reasoning (no breakdown, no recs)', () => {
    const sfx: SceneSFX = {
      timestamp: '00:10',
      description: 'Ambient sound',
      resolve_status: 'LOCAL',
      original_filename: 'wind.wav',
      score: 20,
      score_max: 25,
      reasoning: 'Good ambient match.',
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    const expandBtn = container.querySelector('button[aria-expanded]')
    expect(expandBtn).toBeTruthy()
    act(() => { fireEvent.click(expandBtn!) })
    expect(container.textContent).toContain('Good ambient match.')
  })
})

describe('SfxRecommendationsList', () => {
  it('renders all recommendations with rank', () => {
    const recs: SfxRecommendation[] = [
      makeRec({ rank: 1, preferred: true }),
      makeRec({ rank: 2, title: 'Track B', score: 19 }),
      makeRec({ rank: 3, title: 'Track C', score: 15, resolve_status: 'NO_MATCH' }),
    ]
    const { container } = render(<SfxRecommendationsList recommendations={recs} />)
    expect(container.textContent).toContain('#1')
    expect(container.textContent).toContain('#2')
    expect(container.textContent).toContain('#3')
    expect(container.textContent).toContain('Construction Ambience')
    expect(container.textContent).toContain('Track B')
    expect(container.textContent).toContain('Track C')
  })

  it('shows preferred badge on preferred recommendation', () => {
    const recs = [makeRec({ preferred: true })]
    const { container } = render(<SfxRecommendationsList recommendations={recs} />)
    expect(container.textContent).toContain('★')
  })

  it('expands recommendation to show breakdown and reasoning', () => {
    const recs = [makeRec({
      reasoning: 'Perfect construction match.',
      score_breakdown: {
        category: { score: 5, max: 5 },
        tags: { score: 6, max: 6 },
      },
    })]
    const { container } = render(<SfxRecommendationsList recommendations={recs} />)
    const btn = container.querySelector('button[aria-expanded]')!
    act(() => { fireEvent.click(btn) })
    expect(container.textContent).toContain('Perfect construction match.')
    expect(container.textContent).toContain('Detalhamento')
    expect(container.textContent).toContain('category')
    expect(container.textContent).toContain('tags')
  })

  it('shows resolve status badge on each recommendation', () => {
    const recs = [
      makeRec({ resolve_status: 'LOCAL' }),
      makeRec({ title: 'Remote', resolve_status: 'NO_MATCH', score: 10 }),
    ]
    const { container } = render(<SfxRecommendationsList recommendations={recs} />)
    expect(container.textContent).toContain('Local')
    expect(container.textContent).toContain('Buscar')
  })

  it('has accessible list role and label', () => {
    const recs = [makeRec()]
    const { container } = render(<SfxRecommendationsList recommendations={recs} />)
    const list = container.querySelector('[role="list"]')
    expect(list).toBeTruthy()
    expect(list!.getAttribute('aria-label')).toBe('Alternativas de SFX')
  })

  it('shows SFX breakdown criteria (category, subcategory, tags, mood, duration, reuse)', () => {
    const recs = [makeRec({
      score_breakdown: {
        category: { score: 5, max: 5 },
        subcategory: { score: 4, max: 4 },
        tags: { score: 6, max: 6 },
        mood: { score: 4, max: 4 },
        duration: { score: 3, max: 3 },
        reuse: { score: 0, max: 3 },
      },
    })]
    const { container } = render(<SfxRecommendationsList recommendations={recs} />)
    const btn = container.querySelector('button[aria-expanded]')!
    act(() => { fireEvent.click(btn) })
    expect(container.textContent).toContain('category')
    expect(container.textContent).toContain('subcategory')
    expect(container.textContent).toContain('tags')
    expect(container.textContent).toContain('mood')
    expect(container.textContent).toContain('duration')
    expect(container.textContent).toContain('reuse')
    expect(container.textContent).toContain('22/25')
  })
})

describe('ScoreBar', () => {
  it('renders progressbar with correct ARIA attributes', () => {
    const { container } = render(<ScoreBar score={28} max={34} />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar).toBeTruthy()
    expect(bar!.getAttribute('aria-valuenow')).toBe('82')
    expect(bar!.getAttribute('aria-valuemin')).toBe('0')
    expect(bar!.getAttribute('aria-valuemax')).toBe('100')
  })

  it('returns null for max=0', () => {
    const { container } = render(<ScoreBar score={5} max={0} />)
    expect(container.innerHTML).toBe('')
  })
})

interface Scene {
  music?: SceneMusic
  sfx?: SceneSFX[]
  [key: string]: unknown
}

describe('AudioSummaryV2', () => {
  const SCENES: Scene[] = [
    {
      music: { track: 'A', resolve_status: 'LOCAL' },
      sfx: [
        { timestamp: '00:03', description: 'x', resolve_status: 'LOCAL' },
        { timestamp: '00:06', description: 'y', resolve_status: 'NO_MATCH' },
      ],
    },
    {
      music: { track: 'B', resolve_status: 'PENDING_MATCH' },
      sfx: [{ timestamp: '00:01', description: 'z', resolve_status: 'PARTIAL_MATCH' }],
    },
    {
      music: { continuation: 'Continues from Beat 0' },
      sfx: [],
    },
  ]

  it('renders Audio Resolver header', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES} />)
    expect(container.textContent).toContain('Audio Resolver')
  })

  it('renders side-by-side Música and SFX columns', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES} />)
    expect(container.textContent).toContain('Música')
    expect(container.textContent).toContain('SFX')
  })

  it('counts continuations', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES} />)
    expect(container.textContent).toContain('1 cont.')
  })

  it('shows stat counts', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES} />)
    expect(container.textContent).toContain('1 local')
    expect(container.textContent).toContain('1 download')
  })

  it('returns null when no audio data', () => {
    const { container } = render(<AudioSummaryV2 scenes={[{ number: 1 } as Scene]} />)
    expect(container.innerHTML).toBe('')
  })
})
