import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { SceneGuideRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer'
import { AudioSummaryV2 } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/audio-summary'

const noop = vi.fn()

describe('SceneGuideRenderer — MusicFallback path', () => {
  it('renders old-format music data without recommendations', () => {
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
    expect(container.textContent).toContain('continua da cena anterior')
  })

  it('renders music without recommendations using fallback', () => {
    const data = {
      scenes: [{
        number: 1,
        label: 'Empty',
        music: { track: 'Test', artist: 'Artist', resolve_status: 'NO_MATCH' as const },
      }],
    }
    const { container } = render(<SceneGuideRenderer content={data} isEditing={false} lang="en" onContentChange={noop} />)
    expect(container.textContent).toContain('Test')
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
