// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { toast } from 'sonner'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn() } }))
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { RoteiroStage } from '@/app/cms/(authed)/video/[id]/edit/stages/roteiro-stage'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'roteiro', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'roteiro', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

const ROTEIRO: RoteiroContentV3 = {
  version: 3, meta: {},
  beats: [{
    idx: 0, name: 'Abertura', status: 'PENDING', duration: 40, tone: 'Calmo, confiante',
    script: [
      { type: 'line', text: 'Primeira **fala** importante.', key: true },
      { type: 'pause', duration: 0.5 },
      { type: 'line', text: 'Segunda fala que continua.' },
      { type: 'vis', text: 'B-roll dos servidores' },
      { type: 'line', text: 'Terceira fala final.' },
    ],
  }],
}

function wrap(over: { notes?: boolean; roteiro?: RoteiroContentV3 | null } = {}) {
  const data = {
    ideia: { pt: { title: 'Meu vídeo', direction: '', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
    roteiro: { pt: over.roteiro === undefined ? ROTEIRO : over.roteiro, en: null },
    pillar: 'codigo' as const, durationRange: '14–17 min',
    saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(),
    saveRoteiro: vi.fn().mockResolvedValue(undefined),
  }
  return render(
    <VideoEditorProvider initialState={{ ...seed, notes: over.notes ?? false }}>
      <VideoDataProvider value={data as never}><RoteiroStage /></VideoDataProvider>
    </VideoEditorProvider>,
  )
}

describe('RoteiroStage — summary row', () => {
  it('shows "N beats", "alvo <dur>", reading clock, spoken counter, and Notas toggle (default OFF)', () => {
    const { container } = wrap()
    const sum = container.querySelector('.rot-sum')!
    expect(sum.textContent).toContain('beats')
    expect(sum.textContent).toContain('alvo')
    expect(sum.querySelector('.rot-clock')!.textContent).toContain('0:00')
    expect(sum.querySelector('.rot-spoken')!.textContent).toContain('0/3') // 3 line items
    const tgl = sum.querySelector('.rot-notetgl')!
    expect(tgl.className).not.toContain('on')
  })
  it('.rot-readbar inner width tracks readPct (0% at start)', () => {
    const { container } = wrap()
    const bar = container.querySelector('.rot-readbar > span') as HTMLElement
    expect(bar.style.width).toBe('0%')
  })
  it('"limpar" is absent until a line is marked', () => {
    const { container } = wrap()
    expect(container.querySelector('.rot-clear')).toBeNull()
  })
})

describe('RoteiroStage — teleprompter keyboard', () => {
  it('Space marks current line + advances; clock + scrubber + spoken counter update', () => {
    const { container } = wrap()
    fireEvent.keyDown(document, { key: ' ' })
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('1/3')
    expect(container.querySelector('.rot-clear')).toBeTruthy()
    const bar = container.querySelector('.rot-readbar > span') as HTMLElement
    expect(parseInt(bar.style.width)).toBeGreaterThan(0)
  })
  it('ArrowDown and Enter also advance + mark', () => {
    const { container } = wrap()
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('1/3')
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('2/3')
  })
  it('ArrowUp steps back and unmarks', () => {
    const { container } = wrap()
    fireEvent.keyDown(document, { key: ' ' })
    fireEvent.keyDown(document, { key: ' ' })
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('2/3')
    fireEvent.keyDown(document, { key: 'ArrowUp' })
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('1/3')
  })
  it('ignores keys while focus is in a contentEditable line', () => {
    const { container } = wrap()
    const tx = container.querySelector('.rb-line .rb-line-tx') as HTMLElement
    // jsdom does not set isContentEditable from the attribute; emulate focus state.
    Object.defineProperty(tx, 'isContentEditable', { configurable: true, value: true })
    tx.focus()
    fireEvent.keyDown(document, { key: ' ', target: tx })
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('0/3')
  })
  it('"limpar" clears all marks and resets clock/scrubber', () => {
    const { container, getByText } = wrap()
    fireEvent.keyDown(document, { key: ' ' })
    fireEvent.click(getByText(/limpar/i).closest('button')!)
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('0/3')
    expect((container.querySelector('.rot-readbar > span') as HTMLElement).style.width).toBe('0%')
    expect(container.querySelector('.rot-clock')!.textContent).toContain('0:00')
  })
})

describe('RoteiroStage — beat markup', () => {
  it('renders .rot-beat with .rb-head (#1, name), .rb-prog "x/y faladas", .rb-info', () => {
    const { container } = wrap()
    const beat = container.querySelector('.rot-beat')!
    expect(beat.querySelector('.rb-num')!.textContent).toBe('#1')
    expect(beat.querySelector('.rb-name')!.textContent).toBe('Abertura')
    expect(beat.querySelector('.rb-prog')!.textContent).toContain('0/3 faladas')
    expect(beat.querySelector('.rb-info')!.textContent).toContain('s de fala')
    expect(beat.querySelector('.rb-progbar > span')).toBeTruthy()
  })
  it('renders **word** as <b class="emph"> inside .rb-line-tx, key line gets .rb-line.key', () => {
    const { container } = wrap()
    expect(container.querySelector('.rb-line.key .rb-line-tx .emph')!.textContent).toBe('fala')
  })
  it('pause shows .rb-breath "respira 0,5s"', () => {
    const { container } = wrap()
    expect(container.querySelector('.rb-breath')!.textContent).toContain('respira')
    expect(container.querySelector('.rb-dur')!.textContent).toBe('0,5s')
  })
  it('mark button is .rb-mark with aria-pressed, dot toggles spoken', () => {
    const { container } = wrap()
    const mark = container.querySelector('.rb-line .rb-mark') as HTMLButtonElement
    expect(mark.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(mark)
    expect((container.querySelector('.rb-line .rb-mark') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.rb-line.spoken')).toBeTruthy()
  })
  it('beat.tone renders .rb-tone (eye icon) regardless of Notas toggle', () => {
    const { container } = wrap({ notes: false })
    expect(container.querySelector('.rb-tone')!.textContent).toContain('Calmo, confiante')
  })
  it('vis note hidden when Notas OFF, shown as .rb-note.vis when ON', () => {
    const off = wrap({ notes: false })
    expect(off.container.querySelector('.rb-note.vis')).toBeNull()
    expect(off.container.textContent).not.toContain('B-roll dos servidores')
    const on = wrap({ notes: true })
    const note = on.container.querySelector('.rb-note.vis')!
    expect(note.querySelector('.rn-tag')!.textContent).toBe('Visual')
    expect(note.querySelector('.rn-tx')!.textContent).toContain('B-roll dos servidores')
  })
})

describe('RoteiroStage — beat-navigation rail', () => {
  const TWO_BEATS: RoteiroContentV3 = {
    version: 3, meta: {},
    beats: [
      {
        idx: 0, name: 'Abertura', status: 'PENDING', duration: 40,
        script: [
          { type: 'line', text: 'Primeira fala.' },
          { type: 'line', text: 'Segunda fala.' },
        ],
      },
      {
        idx: 1, name: 'Desenvolvimento', status: 'PENDING', duration: 60,
        script: [
          { type: 'line', text: 'Terceira fala.' },
        ],
      },
    ],
  }

  it('does NOT render .rot-rail with a single beat', () => {
    const { container } = wrap() // ROTEIRO has 1 beat
    expect(container.querySelector('.rot-rail')).toBeNull()
  })

  it('renders .rot-rail with one .rrl-chip per beat when >1 beat', () => {
    const { container } = wrap({ roteiro: TWO_BEATS })
    const rail = container.querySelector('.rot-rail')!
    expect(rail).toBeTruthy()
    const chips = rail.querySelectorAll('.rrl-chip')
    expect(chips.length).toBe(2)
    // each chip has number badge + name
    expect(chips[0].querySelector('.rrl-n')!.textContent).toBe('1')
    expect(chips[0].querySelector('.rrl-nm')!.textContent).toBe('Abertura')
    expect(chips[1].querySelector('.rrl-n')!.textContent).toBe('2')
    expect(chips[1].querySelector('.rrl-nm')!.textContent).toBe('Desenvolvimento')
  })

  it('the first beat carries the rb-0 anchor id for the rail jump', () => {
    const { container } = wrap({ roteiro: TWO_BEATS })
    const beat = container.querySelector('.rot-beat')!
    expect(beat.getAttribute('id')).toBe('rb-0')
  })

  it('a chip turns .done once all spoken lines of its beat are marked', () => {
    const { container } = wrap({ roteiro: TWO_BEATS })
    let chips = container.querySelectorAll('.rot-rail .rrl-chip')
    expect(chips[0].className).not.toContain('done')
    // beat 0 has 2 lines → mark both via teleprompter Space
    fireEvent.keyDown(document, { key: ' ' })
    fireEvent.keyDown(document, { key: ' ' })
    chips = container.querySelectorAll('.rot-rail .rrl-chip')
    expect(chips[0].className).toContain('done')
    expect(chips[1].className).not.toContain('done') // beat 1 still pending
  })

  it('clicking a chip does not throw (jsdom getElementById guard)', () => {
    const { container } = wrap({ roteiro: TWO_BEATS })
    const chip = container.querySelector('.rot-rail .rrl-chip') as HTMLButtonElement
    expect(() => fireEvent.click(chip)).not.toThrow()
  })
})

describe('RoteiroStage — document chrome', () => {
  it('renders .rot-doc.fade-in, .rot-title, and .rot-hint with .rk keys', () => {
    const { container } = wrap()
    expect(container.querySelector('.rot-doc.fade-in')).toBeTruthy()
    expect(container.querySelector('.rot-title')!.textContent).toBe('Meu vídeo')
    const hint = container.querySelector('.rot-hint')!
    expect(hint.querySelectorAll('.rk').length).toBeGreaterThanOrEqual(2)
    expect(hint.querySelector('.rsep')).toBeTruthy()
  })
  it('idea-only (no beats) shows the .rot-empty "Ainda é só uma ideia" state', () => {
    const { container } = wrap({ roteiro: { version: 3, meta: {}, beats: [] } as RoteiroContentV3 })
    expect(container.querySelector('.rot-empty')).toBeTruthy()
    expect(container.textContent).toContain('Ainda é só uma ideia')
    expect(container.textContent).toContain('Ver a direção')
  })
})

describe('RoteiroStage — Recomeçar (reset to chooser)', () => {
  function wrapReset() {
    const saveRoteiro = vi.fn().mockResolvedValue(undefined)
    const data = {
      ideia: { pt: { title: 'Meu vídeo', direction: 'Uma direção', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
      roteiro: { pt: ROTEIRO, en: null },
      pillar: 'codigo' as const, durationRange: '14–17 min',
      saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(), saveRoteiro,
    }
    const r = render(
      <VideoEditorProvider initialState={seed}>
        <VideoDataProvider value={data as never}><RoteiroStage /></VideoDataProvider>
      </VideoEditorProvider>,
    )
    return { ...r, saveRoteiro }
  }

  it('shows "Recomeçar" in the filled bar; clicking reveals an INLINE confirm (no popup)', () => {
    const { container } = wrapReset()
    const reset = container.querySelector('.rot-reset') as HTMLElement
    expect(reset.textContent).toContain('Recomeçar')
    fireEvent.click(reset)
    const confirm = container.querySelector('.rot-reset-confirm')!
    expect(confirm.textContent).toContain('Apagar o roteiro?')
    expect(confirm.querySelector('.rot-reset-yes')!.textContent).toContain('apagar')
    expect(confirm.querySelector('.rot-reset-no')!.textContent).toContain('cancelar')
    expect(container.querySelector('.rot-reset')).toBeNull() // plain button hidden while confirming
  })

  it('"apagar" clears the roteiro (saveRoteiro with empty beats → back to chooser)', () => {
    vi.mocked(toast.info).mockClear()
    const { container, saveRoteiro } = wrapReset()
    fireEvent.click(container.querySelector('.rot-reset') as HTMLElement)
    fireEvent.click(container.querySelector('.rot-reset-yes') as HTMLElement)
    expect(saveRoteiro).toHaveBeenCalledWith('pt', { version: 3, meta: {}, beats: [] })
    expect(toast.info).toHaveBeenCalledWith('Roteiro limpo', expect.anything())
  })

  it('marking a line then "apagar" resets state (empty-beats save, no lingering confirm)', () => {
    const { container, saveRoteiro } = wrapReset()
    fireEvent.keyDown(document, { key: ' ' }) // mark first line → spoken counter advances
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('1/3')
    fireEvent.click(container.querySelector('.rot-reset') as HTMLElement)
    fireEvent.click(container.querySelector('.rot-reset-yes') as HTMLElement)
    expect(saveRoteiro).toHaveBeenCalledWith('pt', { version: 3, meta: {}, beats: [] })
    expect(container.querySelector('.rot-reset-confirm')).toBeNull()
  })

  it('Escape dismisses the open confirm and restores the Recomeçar button', () => {
    const { container } = wrapReset()
    fireEvent.click(container.querySelector('.rot-reset') as HTMLElement)
    expect(container.querySelector('.rot-reset-confirm')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.querySelector('.rot-reset-confirm')).toBeNull()
    expect(container.querySelector('.rot-reset')).not.toBeNull()
  })

  it('"cancelar" dismisses the confirm without clearing (two-step guard)', () => {
    const { container, saveRoteiro } = wrapReset()
    fireEvent.click(container.querySelector('.rot-reset') as HTMLElement)
    fireEvent.click(container.querySelector('.rot-reset-no') as HTMLElement)
    expect(saveRoteiro).not.toHaveBeenCalled()
    expect(container.querySelector('.rot-reset')).not.toBeNull()
    expect(container.querySelector('.rot-reset-confirm')).toBeNull()
  })
})
