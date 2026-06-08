// apps/web/test/cms/video/editor/ed-shell.test.tsx
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { VideoEdBar } from '@/app/cms/(authed)/video/[id]/edit/ed-bar'
import { VidStages } from '@/app/cms/(authed)/video/[id]/edit/vid-stages'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'gravacao', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'roteiro', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

const emptyVer = { title: '', direction: '', siblings: [], logline: '', pillar: undefined, angles: '', framework: '', duration: '', location: '', recorded: '—', beats: [] }
const stubData = {
  ideia: { pt: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
  roteiro: { pt: null, en: null }, versions: { pt: emptyVer, en: emptyVer }, pillar: undefined, durationRange: undefined,
}

function wrap(state: VideoEditorState, node: React.ReactNode) {
  return render(
    <VideoEditorProvider initialState={state}>
      <VideoDataProvider value={stubData as never}>{node}</VideoDataProvider>
    </VideoEditorProvider>,
  )
}

describe('VideoEdBar', () => {
  it('renders Voltar / Vídeos / CODE breadcrumb', () => {
    const { container } = wrap(seed, <VideoEdBar />)
    expect(container.querySelector('.ed-bar')).toBeTruthy()
    expect(container.querySelector('.eb-code')!.textContent).toBe('V-A07')
    expect(container.textContent).toContain('Voltar')
    expect(container.textContent).toContain('Vídeos')
  })
  it('focus toggle button is a real <button> with pointer cursor and focus state', () => {
    const { getByTitle, container } = wrap(seed, <VideoEdBar />)
    const btn = getByTitle('Modo foco (Esc)')
    expect(btn.tagName).toBe('BUTTON')
    fireEvent.click(btn)
    // after toggle the bar reflects focus via class
    expect(container.querySelector('.ed-iconbtn.on')).toBeTruthy()
  })
})

describe('VidStages', () => {
  it('renders 4 segmented tabs (Ideia/Roteiro/Pós/Publicação)', () => {
    const { container } = wrap(seed, <VidStages />)
    expect(container.querySelectorAll('.ed-stage').length).toBe(4)
    expect(container.textContent).toContain('Ideia')
    expect(container.textContent).toContain('Publicação')
  })
  it('Pós/Publicação locked below gravacao show the lock icon and stay clickable', () => {
    const { container } = wrap({ ...seed, stage: 'idea', activeStage: 'ideia' }, <VidStages />)
    const locked = container.querySelectorAll('.ed-stage.locked')
    expect(locked.length).toBe(2)
    locked.forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(false))
  })
  it('Pós/Publicação unlocked at gravacao', () => {
    const { container } = wrap(seed, <VidStages />)
    expect(container.querySelectorAll('.ed-stage.locked').length).toBe(0)
  })
  it('clicking a tab dispatches SET_STAGE', () => {
    const { container, getByText } = wrap(seed, <VidStages />)
    fireEvent.click(getByText('Ideia').closest('button')!)
    expect(container.querySelector('.ed-stage.on')!.textContent).toContain('Ideia')
  })
})
