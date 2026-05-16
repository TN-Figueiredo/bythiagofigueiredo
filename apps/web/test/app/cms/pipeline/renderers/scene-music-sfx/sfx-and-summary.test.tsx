import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SFXItemCard } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/sfx-item-card'
import { AudioSummaryV2 } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/audio-summary'
import type { SceneSFX, SceneMusic } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types'

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

  it('renders NO_MATCH with search link', () => {
    const sfx: SceneSFX = {
      timestamp: '00:17',
      description: 'SFX bass drop — marca fim do hook',
      resolve_status: 'NO_MATCH',
      sfx_category: 'DROP',
      search_terms: 'bass drop impact',
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('Search')
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toContain('artlist.io')
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
    expect(container.textContent).toContain('Partial')
    expect(container.textContent).toContain('Short Riser.wav')
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
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

  it('renders Música label', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES} />)
    expect(container.textContent).toContain('Música')
  })

  it('renders SFX label', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES} />)
    expect(container.textContent).toContain('SFX')
  })

  it('counts continuations', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES} />)
    expect(container.textContent).toContain('1 cont')
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
