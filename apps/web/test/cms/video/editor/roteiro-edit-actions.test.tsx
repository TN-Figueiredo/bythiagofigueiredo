// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn() } }))
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { RoteiroStage } from '@/app/cms/(authed)/video/[id]/edit/stages/roteiro-stage'
import { htmlToMarkup } from '@/app/cms/(authed)/video/[id]/edit/stages/script-line'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'roteiro', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'roteiro', focus: false, notes: false,
  showRecStatus: false, recStatus: {}, retakeNotes: {},
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

const ROTEIRO: RoteiroContentV3 = {
  version: 3, meta: {},
  beats: [
    { idx: 0, name: 'HOOK', status: 'PENDING', script: [{ type: 'line', text: 'Acordei às **6h**.', key: true }, { type: 'line', text: 'Olha isso.' }] },
    { idx: 1, name: 'ENTRADAS + PERGUNTAS', status: 'PENDING', script: [{ type: 'action', text: 'Aborde um finisher' }] },
  ],
}

function wrap(over: { notes?: boolean } = {}) {
  const saveRoteiro = vi.fn().mockResolvedValue(undefined)
  const data = {
    ideia: { pt: { title: 'Acordei às 6h', direction: '', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
    roteiro: { pt: ROTEIRO, en: null }, pillar: 'viagem' as const, durationRange: '6–7 min',
    saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(), saveRoteiro,
  }
  const r = render(
    <VideoEditorProvider initialState={{ ...seed, notes: over.notes ?? false }}>
      <VideoDataProvider value={data as never}><RoteiroStage /></VideoDataProvider>
    </VideoEditorProvider>,
  )
  return { ...r, saveRoteiro }
}

describe('htmlToMarkup — emphasis round-trips on edit', () => {
  it('serializes <b class="emph"> back to **markers** (no silent strip)', () => {
    const el = document.createElement('div')
    el.innerHTML = 'Acordei às <b class="emph">6h</b> hoje'
    expect(htmlToMarkup(el)).toBe('Acordei às **6h** hoje')
  })
  it('drops other tags but keeps their text', () => {
    const el = document.createElement('div')
    el.innerHTML = 'oi <span>mundo</span><br>fim'
    expect(htmlToMarkup(el)).toBe('oi mundofim')
  })
  it('strips an orphan ** so a half-marker never persists', () => {
    const el = document.createElement('div')
    el.textContent = 'palavra **solta'
    expect(htmlToMarkup(el)).toBe('palavra solta')
  })
  it('flattens nested emphasis to a single level (no ****)', () => {
    const el = document.createElement('div')
    el.innerHTML = '<b class="emph"><b class="emph">x</b></b> y'
    expect(htmlToMarkup(el)).toBe('**x** y')
  })
})

describe('RoteiroStage — spoken counter integrity (the metric the user cared about)', () => {
  it('marking an ACTION does not increment the "faladas" counter', () => {
    const { container } = wrap()
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('0/2') // 2 fala lines
    fireEvent.click(container.querySelector('.rb-act .rb-actbox')!)              // check an action
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('0/2') // still 0/2 faladas
    expect(container.querySelector('.rb-act.done')).toBeTruthy()                 // action did toggle
  })
  it('marking a fala line DOES increment it', () => {
    const { container } = wrap()
    fireEvent.keyDown(document, { key: ' ' })
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('1/2')
  })
})

describe('RoteiroStage — classification recovery', () => {
  it('an auto-classified acao beat offers "é fala?" and stamps an explicit kind on click', () => {
    const { container, saveRoteiro } = wrap()
    const recover = container.querySelector('.rb-recover')!
    expect(recover).toBeTruthy()
    fireEvent.click(recover)
    expect(saveRoteiro).toHaveBeenCalledTimes(1)
    const [, content] = saveRoteiro.mock.calls[0]!
    expect(content.beats[1].kind).toBe('fala')
  })
})

describe('RoteiroStage — add editor cue (the real "how to add")', () => {
  it('with Notas ON, "+ nota pro editor" appends a vis item to the beat', () => {
    const { container, saveRoteiro } = wrap({ notes: true })
    const addBtn = container.querySelector('.rb-addcue')!
    expect(addBtn).toBeTruthy()
    fireEvent.click(addBtn)
    expect(saveRoteiro).toHaveBeenCalledTimes(1)
    const [, content] = saveRoteiro.mock.calls[0]!
    expect(content.beats[0].script.some((s: { type: string }) => s.type === 'vis')).toBe(true)
  })
  it('the editor handoff footer counts inline vis cues, not just whole editor beats', () => {
    const { container } = wrap({ notes: true })
    // seed has no vis yet → no footer
    expect(container.querySelector('.rot-edh')).toBeNull()
  })
})
