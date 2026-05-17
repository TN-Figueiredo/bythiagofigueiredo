import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SceneGuideRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer'

const noop = vi.fn()

// Scene without music — STYLE/FLOW notes are shown as pills (not absorbed)
const SCENE_DATA_NO_MUSIC = {
  scenes: [
    {
      number: 1,
      label: 'Scene 1',
      beat_ref: '0',
      duration: '~15s',
      status: 'DONE',
      narrative: 'Hook — montagem rapida 3 paises.',
      edit_notes: [
        'Style: Minimal dark pads, subtle low drone. Not dramatic.',
        'Continues into Beat 1 — don\'t change track here.',
        '00:00: fade in 1s, -20dB under voice',
        '00:10: Lower third with channel name, hold 4s.',
      ],
      sfx: [{ timestamp: '00:03', description: 'Subtle whoosh', search_terms: 'whoosh soft' }],
      overlays: [{ timestamp: '00:10', instruction: 'Channel name lower third' }],
      mix: [{ parameter: 'Voice', value: '-6dB' }],
      transition: { type: 'Cross-dissolve', reasoning: 'Suave transicao' },
    },
  ],
}

// Scene with music — STYLE/FLOW notes are absorbed into MusicHeroSection
const SCENE_DATA = {
  scenes: [
    {
      ...SCENE_DATA_NO_MUSIC.scenes[0],
      narrative: 'Hook — montagem rapida 3 paises.',
      music: { search_terms: 'Mysterious, Dark', style: 'Ambient pads', entry_cue: '00:00 fade in' },
    },
  ],
}

describe('SceneGuideRenderer — category pills', () => {
  it('renders category pills for edit notes', () => {
    // Use scene without music so STYLE/FLOW pills are shown (not absorbed into music section)
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA_NO_MUSIC} isEditing={false} lang="en" onContentChange={noop} />
    )
    const pills = container.querySelectorAll('[class*="uppercase"]')
    const pillTexts = Array.from(pills).map(p => p.textContent)
    expect(pillTexts).toContain('STYLE')
    expect(pillTexts).toContain('FLOW')
  })

  it('renders OVERLAY pill for "Lower third" note', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    const pills = container.querySelectorAll('[class*="uppercase"]')
    const pillTexts = Array.from(pills).map(p => p.textContent)
    expect(pillTexts).toContain('OVERLAY')
  })
})

describe('SceneGuideRenderer — timeline', () => {
  it('renders timeline points for timestamped notes', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    const tlPoints = container.querySelectorAll('[class*="tl-point"]')
    expect(tlPoints.length).toBeGreaterThanOrEqual(2)
  })
})

describe('SceneGuideRenderer — narrative summary', () => {
  it('renders narrative when present', () => {
    render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(screen.getByText(/Hook — montagem/)).toBeTruthy()
  })
})

describe('SceneGuideRenderer — token highlighting', () => {
  it('highlights -20dB in edit notes', () => {
    // Use scene without music so timestamped note with -20dB is rendered
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA_NO_MUSIC} isEditing={false} lang="en" onContentChange={noop} />
    )
    const dbChips = container.querySelectorAll('[style*="fbbf24"]')
    expect(dbChips.length).toBeGreaterThanOrEqual(1)
  })

  it('highlights "Not" negation in edit notes', () => {
    // Use scene without music so STYLE note containing "Not dramatic" is rendered
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA_NO_MUSIC} isEditing={false} lang="en" onContentChange={noop} />
    )
    const negs = container.querySelectorAll('[style*="f87171"]')
    expect(negs.length).toBeGreaterThanOrEqual(1)
  })
})

describe('SceneGuideRenderer — structured subsections', () => {
  it('renders Music subsection', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Mysterious, Dark')
  })

  it('renders SFX subsection', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Subtle whoosh')
  })

  it('renders Transition subsection', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Cross-dissolve')
  })
})

describe('SceneGuideRenderer — edge cases', () => {
  it('handles empty scenes array', () => {
    const { container } = render(
      <SceneGuideRenderer content={{ scenes: [] }} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Nenhuma cena')
  })

  it('handles scenes without edit_notes', () => {
    const content = { scenes: [{ number: 1, status: 'DONE' }] }
    const { container } = render(
      <SceneGuideRenderer content={content} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container).toBeTruthy()
  })
})
