// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn() } }))
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { RoteiroStage } from '@/app/cms/(authed)/video/[id]/edit/stages/roteiro-stage'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'roteiro', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'roteiro', focus: false, notes: false,
  showRecStatus: false, recStatus: {}, retakeNotes: {},
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

// Mirrors the real "Acordei às 6h" shape: logistics + spoken + action + coverage beats.
const ROTEIRO: RoteiroContentV3 = {
  version: 3, meta: {},
  beats: [
    { idx: 0, name: 'KIT (resolver hoje à noite)', status: 'PENDING', script: [{ type: 'line', text: 'Mic lav + power bank' }] },
    { idx: 1, name: 'TIMELINE DE CAPTURA', status: 'PENDING', script: [{ type: 'line', text: '6:15 chega' }] },
    { idx: 2, name: 'HOOK', status: 'PENDING', script: [{ type: 'line', text: 'Acordei às 6h.', key: true }, { type: 'line', text: 'Olha isso.' }] },
    { idx: 3, name: 'ENTRADAS + PERGUNTAS', status: 'PENDING', script: [{ type: 'action', text: 'Aborde um finisher' }, { type: 'action', text: 'Pergunte como foi' }] },
    { idx: 4, name: 'B-ROLL SHOT LIST', status: 'PENDING', script: [{ type: 'line', text: 'orla vazia → enchendo' }] },
    { idx: 5, name: 'FECHO', status: 'PENDING', script: [{ type: 'line', text: 'Se curte, se inscreve.' }] },
  ],
}

function wrap(over: { notes?: boolean } = {}) {
  const data = {
    ideia: { pt: { title: 'Acordei às 6h', direction: '', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
    roteiro: { pt: ROTEIRO, en: null },
    pillar: 'viagem' as const, durationRange: '6–7 min',
    saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(), saveRoteiro: vi.fn().mockResolvedValue(undefined),
  }
  return render(
    <VideoEditorProvider initialState={{ ...seed, notes: over.notes ?? false }}>
      <VideoDataProvider value={data as never}><RoteiroStage /></VideoDataProvider>
    </VideoEditorProvider>,
  )
}

describe('RoteiroStage — performer lanes', () => {
  it('summary counts only performer beats (fala + acao), not prep/editor', () => {
    const { container } = wrap()
    // 6 beats total → 3 performer (HOOK, ENTRADAS, FECHO)
    expect(container.querySelector('.rot-sum .rs-k b')!.textContent).toBe('3')
  })

  it('spoken counter counts only fala spoken lines (HOOK 2 + FECHO 1 = 3); prep/editor/acao excluded', () => {
    const { container } = wrap()
    expect(container.querySelector('.rot-spoken')!.textContent).toContain('0/3')
  })

  it('prep logistics live in a collapsed "Antes de gravar" strip, out of the reading flow', () => {
    const { container } = wrap()
    const prep = container.querySelector('.rot-prep')!
    expect(prep).toBeTruthy()
    expect(prep.querySelector('.rot-prep-count')!.textContent).toBe('2') // KIT + TIMELINE
    expect(container.querySelector('.rot-prep-body')).toBeNull() // collapsed by default
    fireEvent.click(prep.querySelector('.rot-prep-head')!)
    expect(container.querySelector('.rot-prep-body')).toBeTruthy() // expands on click
    expect(container.querySelector('.rot-prep-body')!.textContent).toContain('Mic lav')
  })

  it('action beat renders as a checklist (.rb-act), distinct from teleprompter lines', () => {
    const { container } = wrap()
    const acts = container.querySelectorAll('.rb-act')
    expect(acts.length).toBe(2)
    expect(container.querySelector('.rb-kindtag')!.textContent).toContain('ação na câmera')
    // marking an action checks it off
    fireEvent.click(acts[0]!.querySelector('.rb-actbox')!)
    expect(container.querySelector('.rb-act.done')).toBeTruthy()
  })

  it('b-roll / coverage routes to a "Pro editor" handoff, never into the performer flow', () => {
    const { container } = wrap()
    const edh = container.querySelector('.rot-edh')!
    expect(edh).toBeTruthy()
    expect(edh.textContent).toContain('Pro editor')
    // the b-roll line is NOT rendered as a spoken teleprompter line
    expect(container.querySelector('.rb-line-tx')!.textContent).not.toContain('orla vazia')
    // editor content is hidden until Notas is on, but the routing note is always shown
    expect(edh.querySelector('.rot-edh-body')).toBeNull()
    expect(edh.textContent).toContain('Notas do editor')
  })

  it('with Notas ON, the editor handoff reveals the coverage list', () => {
    const { container } = wrap({ notes: true })
    const edh = container.querySelector('.rot-edh')!
    expect(edh.querySelector('.rot-edh-body')).toBeTruthy()
    expect(edh.textContent).toContain('orla vazia')
  })

  it('the navigation rail lists only performer beats, renumbered #1..#3', () => {
    const { container } = wrap()
    const chips = container.querySelectorAll('.rot-rail .rrl-chip')
    expect(chips.length).toBe(3)
    expect(chips[0]!.textContent).toContain('HOOK')
    expect(chips[1]!.querySelector('.rrl-n')!.textContent).toBe('2')
  })
})
