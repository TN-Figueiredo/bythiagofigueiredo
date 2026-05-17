import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { SceneGuideRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer'
import { AudioSummaryV2 } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/audio-summary'

const noop = vi.fn()

describe('SceneGuideRenderer — music normalization', () => {
  it('normalizes old-format music data into MusicHeroSection', () => {
    const data = {
      scenes: [{
        number: 1,
        label: 'Test',
        music: { track: 'Old Track', artist: 'Old Artist', resolve_status: 'LOCAL' as const, search_terms: 'ambient' },
      }],
    }
    const { container } = render(<SceneGuideRenderer content={data} isEditing={false} lang="en" onContentChange={noop} />)
    expect(container.textContent).toContain('Old Track')
    expect(container.textContent).toContain('Old Artist')
    expect(container.textContent).toContain('Local')
  })

  it('renders continuation track with minimal UI', () => {
    const data = {
      scenes: [{
        number: 1,
        label: 'Continuation',
        music: {
          track: 'Ocean Depth',
          continuation: 'Continues from Beat 0',
          recommendations: [{
            track: 'Ocean Depth',
            artist: 'V. Draganov',
            resolve_status: 'LOCAL' as const,
            score: 26,
            score_max: 34,
          }],
        },
      }],
    }
    const { container } = render(<SceneGuideRenderer content={data} isEditing={false} lang="en" onContentChange={noop} />)
    expect(container.textContent).toContain('Continua da')
  })

  it('normalizes music without recommendations into hero with empty slots', () => {
    const data = {
      scenes: [{
        number: 1,
        label: 'Empty',
        music: { track: 'Test', artist: 'Artist', resolve_status: 'NO_MATCH' as const, search_terms: 'ambient' },
      }],
    }
    const { container } = render(<SceneGuideRenderer content={data} isEditing={false} lang="en" onContentChange={noop} />)
    expect(container.textContent).toContain('Test')
    expect(container.textContent).toContain('Buscar')
  })

  it('absorbs MUSIC/STYLE/ENTRY notes from edit_notes when music exists', () => {
    const data = {
      scenes: [{
        number: 1,
        label: 'Note absorption',
        music: { track: 'Track', artist: 'Artist', resolve_status: 'LOCAL' as const, search_terms: 'test', style: 'cinematic' },
        edit_notes: [
          'Style: cinematic ambient',
          'Entry: after narrator speaks',
          'Hard cut at 00:05',
          'Search Artlist: mood: mysterious',
        ],
      }],
    }
    const { container } = render(<SceneGuideRenderer content={data} isEditing={false} lang="en" onContentChange={noop} />)
    expect(container.textContent).toContain('Hard cut at 00:05')
    expect(container.textContent).not.toContain('Search Artlist')
  })

  it('absorbs SFX notes from edit_notes when sfx data exists', () => {
    const data = {
      scenes: [{
        number: 1,
        label: 'SFX absorption',
        sfx: [{ timestamp: '00:06', description: 'Impact leve', resolve_status: 'LOCAL' as const }],
        edit_notes: [
          '00:04 Hard cut pra talking head',
          '00:06 SFX impact leve — Artlist "Low Impact Hit"',
          '00:17 SFX bass drop — marca fim do hook',
        ],
      }],
    }
    const { container } = render(<SceneGuideRenderer content={data} isEditing={false} lang="en" onContentChange={noop} />)
    expect(container.textContent).toContain('Hard cut pra talking head')
    expect(container.textContent).not.toContain('SFX impact leve')
    expect(container.textContent).not.toContain('SFX bass drop')
  })

  it('handles favorite_index out of bounds gracefully', () => {
    const data = {
      scenes: [{
        number: 1,
        label: 'OOB',
        music: {
          recommendations: [{
            track: 'Only Track',
            artist: 'Artist',
            resolve_status: 'LOCAL' as const,
            score: 20,
            score_max: 34,
          }],
          favorite_index: 99,
        },
      }],
    }
    const { container } = render(<SceneGuideRenderer content={data} isEditing={false} lang="en" onContentChange={noop} />)
    expect(container.textContent).toContain('Only Track')
  })
})

describe('AudioSummaryV2 — undefined resolve_status', () => {
  it('does not count items without resolve_status toward totals', () => {
    const scenes = [
      { music: { track: 'A' } }, // no resolve_status
      { music: { track: 'B', resolve_status: 'LOCAL' as const } },
    ]
    const { container } = render(<AudioSummaryV2 scenes={scenes} />)
    // Only 1 track counts toward total, that 1 is LOCAL -> 100%
    expect(container.textContent).toContain('100%')
  })
})
