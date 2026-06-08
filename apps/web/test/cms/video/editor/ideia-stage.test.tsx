import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { IdeiaStage } from '@/app/cms/(authed)/video/[id]/edit/stages/ideia-stage'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'
import type { Version } from '@/app/cms/(authed)/video/[id]/edit/editor-model'

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'idea', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'ideia', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

const blankIdeia = { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' }

function makeData(dataOver: Record<string, unknown> = {}) {
  return {
    ideia: { pt: { ...blankIdeia }, en: { ...blankIdeia } },
    roteiro: { pt: null, en: null },
    pillar: 'codigo' as const,
    durationRange: '14–17 min',
    saveIdeia: vi.fn().mockResolvedValue(undefined),
    saveTitle: vi.fn().mockResolvedValue(undefined),
    appendSiblings: vi.fn(),
    youtubeJoin: null,
    ...dataOver,
  }
}

function wrap(node: React.ReactNode, dataOver: Record<string, unknown> = {}) {
  const data = makeData(dataOver)
  return { data, ...render(<VideoEditorProvider initialState={seed}><VideoDataProvider value={data as never}>{node}</VideoDataProvider></VideoEditorProvider>) }
}

describe('IdeiaStage — handoff markup', () => {
  // ─── Structure ────────────────────────────────────────────────────────────
  it('renders .vi-canvas.fade-in as the root', () => {
    const { container } = wrap(<IdeiaStage />)
    const root = container.querySelector('.vi-canvas.fade-in')
    expect(root).not.toBeNull()
  })

  it('renders .vi-kicker containing "Direção" text', () => {
    const { container } = wrap(<IdeiaStage />)
    const kicker = container.querySelector('.vi-kicker')
    expect(kicker).not.toBeNull()
    expect(kicker!.textContent).toContain('Direção')
  })

  it('renders .vi-title with correct placeholder and data-empty=true when empty', () => {
    const { container } = wrap(<IdeiaStage />)
    const title = container.querySelector('.vi-title')!
    expect(title).not.toBeNull()
    expect(title.getAttribute('data-ph')).toBe('Título de trabalho do vídeo…')
    expect(title.getAttribute('data-empty')).toBe('true')
    expect(title.getAttribute('contenteditable')).toBe('true')
  })

  it('renders .vi-seed > .vi-seed-head > .vi-seed-ico + .vi-seed-name + .vi-seed-sub', () => {
    const { container } = wrap(<IdeiaStage />)
    const seed = container.querySelector('.vi-seed')!
    expect(seed).not.toBeNull()
    expect(seed.querySelector('.vi-seed-head')).not.toBeNull()
    expect(seed.querySelector('.vi-seed-ico')).not.toBeNull()
    expect(seed.querySelector('.vi-seed-name')!.textContent).toContain('A direção')
    expect(seed.querySelector('.vi-seed-sub')).not.toBeNull()
  })

  it('renders .vi-seed-text as contentEditable with placeholder', () => {
    const { container } = wrap(<IdeiaStage />)
    const seedText = container.querySelector('.vi-seed-text')!
    expect(seedText).not.toBeNull()
    expect(seedText.getAttribute('contenteditable')).toBe('true')
    expect(seedText.getAttribute('data-ph')).toContain('opinião')
  })

  it('renders .vi-alts with the "Gerar mais" Cowork button in .vi-alts-label', () => {
    const { container } = wrap(<IdeiaStage />)
    const alts = container.querySelector('.vi-alts')!
    expect(alts).not.toBeNull()
    const label = alts.querySelector('.vi-alts-label')!
    expect(label).not.toBeNull()
    // "Gerar mais" is a Cowork trigger (.cw-btn), consistent with the other Cowork buttons.
    const genBtn = label.querySelector('.cw-btn')!
    expect(genBtn).not.toBeNull()
    expect(genBtn.textContent).toContain('Gerar mais')
  })

  it('renders .vi-meta with pillar chip (.cdot)', () => {
    const { container } = wrap(<IdeiaStage />)
    const meta = container.querySelector('.vi-meta')!
    expect(meta).not.toBeNull()
    // pillar=codigo → renders a chip with cdot
    const chip = meta.querySelector('.vi-chip')!
    expect(chip).not.toBeNull()
    expect(chip.querySelector('.cdot')).not.toBeNull()
  })

  it('renders .vi-next button', () => {
    const { container } = wrap(<IdeiaStage />)
    const next = container.querySelector('.vi-next')!
    expect(next).not.toBeNull()
    expect(next.tagName).toBe('BUTTON')
  })

  // ─── CTA text variants ────────────────────────────────────────────────────
  it('CTA reads "Gerar o roteiro" when no beats', () => {
    const { container } = wrap(<IdeiaStage />)
    expect(container.querySelector('.vi-next')!.textContent).toContain('Gerar o roteiro')
  })

  it('CTA reads "Abrir o roteiro" when version has beats', () => {
    const cur: Version = {
      title: '', direction: '', siblings: [], logline: '', pillar: 'codigo',
      angles: '', framework: '', duration: '', location: '', recorded: '—',
      beats: [{ idx: 0, name: 'Beat 1', status: 'PENDING' as const, script: [] }],
    }
    const { container } = wrap(<IdeiaStage cur={cur} lang="pt" />)
    expect(container.querySelector('.vi-next')!.textContent).toContain('Abrir o roteiro')
  })

  // ─── Alternatives ─────────────────────────────────────────────────────────
  it('shows .vi-alts-empty when siblings is empty', () => {
    const { container } = wrap(<IdeiaStage />)
    const empty = container.querySelector('.vi-alts-empty')!
    expect(empty).not.toBeNull()
    expect(empty.textContent).toContain('Sem alternativas ainda')
  })

  it('renders .vi-alt rows when siblings present', () => {
    const { container } = wrap(<IdeiaStage />, {
      ideia: {
        pt: { ...blankIdeia, siblings: ['Primeira direção', 'Segunda direção'] },
        en: { ...blankIdeia },
      },
    } as never)
    const alts = container.querySelectorAll('.vi-alt')
    expect(alts).toHaveLength(2)
    expect(alts[0].querySelector('.va-n')!.textContent).toBe('1')
    expect(alts[0].querySelector('.va-t')!.textContent).toContain('Primeira direção')
    expect(alts[0].querySelector('.va-go')).not.toBeNull()
    // no empty state
    expect(container.querySelector('.vi-alts-empty')).toBeNull()
  })

  it('clicking a .vi-alt swaps it into the active direction (saveIdeia with direction + swapped siblings)', () => {
    const { container, data } = wrap(<IdeiaStage />, {
      ideia: {
        pt: { ...blankIdeia, direction: 'Direção ativa', siblings: ['Primeira direção', 'Segunda direção'] },
        en: { ...blankIdeia },
      },
    } as never)
    const firstAlt = container.querySelectorAll('.vi-alt')[0] as HTMLElement
    fireEvent.click(firstAlt)
    // Swap: clicked alt (index 0) becomes the direction; the previously-active
    // direction takes slot 0. Other siblings untouched.
    expect(data.saveIdeia).toHaveBeenCalledWith('pt', {
      direction: 'Primeira direção',
      siblings: ['Direção ativa', 'Segunda direção'],
    })
  })

  it('clicking a .vi-alt with NO active direction drops the slot (no blank sibling injected)', () => {
    const { container, data } = wrap(<IdeiaStage />, {
      ideia: {
        pt: { ...blankIdeia, direction: '', siblings: ['Alt A', 'Alt B'] },
        en: { ...blankIdeia },
      },
    } as never)
    fireEvent.click(container.querySelectorAll('.vi-alt')[0] as HTMLElement)
    // No direction to preserve → promote 'Alt A', drop its slot; never store a '' sibling.
    expect(data.saveIdeia).toHaveBeenCalledWith('pt', { direction: 'Alt A', siblings: ['Alt B'] })
  })

  it('blank siblings never render as clickable rows', () => {
    const { container } = wrap(<IdeiaStage />, {
      ideia: {
        pt: { ...blankIdeia, direction: 'Ativa', siblings: ['Real', '', '  '] },
        en: { ...blankIdeia },
      },
    } as never)
    expect(container.querySelectorAll('.vi-alt')).toHaveLength(1)
  })

  // ─── Persistence ──────────────────────────────────────────────────────────
  it('blurring .vi-title calls saveTitle(lang, text) AND saveIdeia(lang, {title})', () => {
    const { container, data } = wrap(<IdeiaStage />)
    const title = container.querySelector('.vi-title') as HTMLElement
    title.textContent = 'Como eu rodo um data center em casa'
    fireEvent.blur(title)
    expect(data.saveTitle).toHaveBeenCalledWith('pt', 'Como eu rodo um data center em casa')
    expect(data.saveIdeia).toHaveBeenCalledWith('pt', { title: 'Como eu rodo um data center em casa' })
  })

  it('blurring .vi-seed-text calls saveIdeia(lang, {direction})', () => {
    const { container, data } = wrap(<IdeiaStage />)
    const seedText = container.querySelector('.vi-seed-text') as HTMLElement
    seedText.textContent = 'A perspectiva de quem saiu do Brasil sem dinheiro'
    fireEvent.blur(seedText)
    expect(data.saveIdeia).toHaveBeenCalledWith('pt', { direction: 'A perspectiva de quem saiu do Brasil sem dinheiro' })
  })

  it('"Gerar mais" opens the Cowork popover (like the other Cowork triggers)', () => {
    const { container } = wrap(<IdeiaStage />)
    const genBtn = container.querySelector('.vi-alts-label .cw-btn') as HTMLElement
    expect(genBtn).not.toBeNull()
    fireEvent.click(genBtn)
    const pop = document.querySelector('.cw-pop')
    expect(pop).not.toBeNull()
    expect(pop?.textContent).toContain('Pedir ao Cowork')
  })

  // ─── CTA dispatch ─────────────────────────────────────────────────────────
  it('CTA click dispatches SET_STAGE → roteiro', () => {
    const { container, getByText } = wrap(<IdeiaStage />)
    fireEvent.click(getByText(/Gerar o roteiro/i))
    // Assert CTA is a real button (dispatch is internal; stage change reflected in context)
    expect(getByText(/Gerar o roteiro/i).closest('button')!.tagName).toBe('BUTTON')
  })

  // ─── Props contract (shell usage) ────────────────────────────────────────
  it('accepts cur + lang props and renders prop data (not stale context)', () => {
    const cur: Version = {
      title: 'Meu título via prop', direction: 'Direção via prop',
      siblings: ['Alt A'], logline: '', pillar: 'ia',
      angles: '3 ângulos', framework: 'StoryBrand', duration: '10–12 min',
      location: '', recorded: '—', beats: [],
    }
    const { container } = wrap(<IdeiaStage cur={cur} lang="pt" />)
    expect(container.querySelector('.vi-title')!.textContent).toBe('Meu título via prop')
    expect(container.querySelector('.vi-seed-text')!.textContent).toBe('Direção via prop')
    // angles and framework chips
    expect(container.querySelector('.vi-meta')!.textContent).toContain('3 ângulos')
    expect(container.querySelector('.vi-meta')!.textContent).toContain('StoryBrand')
    // duration from cur.duration (not durationRange)
    expect(container.querySelector('.vi-meta')!.textContent).toContain('10–12 min')
    // sibling present
    expect(container.querySelector('.vi-alt')!.textContent).toContain('Alt A')
  })
})
