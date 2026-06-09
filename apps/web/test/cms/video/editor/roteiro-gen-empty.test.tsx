// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { RoteiroStage } from '@/app/cms/(authed)/video/[id]/edit/stages/roteiro-stage'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'
import type { Version } from '@/app/cms/(authed)/video/[id]/edit/editor-model'

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'roteiro', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'roteiro', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false, editMode: 'edit',
}

function makeVersion(over: Partial<Version> = {}): Version {
  return {
    title: 'Meu vídeo', direction: '', siblings: [], logline: '', pillar: 'codigo',
    angles: '', framework: '', duration: '', location: '', recorded: '—', beats: [],
    ...over,
  }
}

function wrap(over: { direction?: string } = {}) {
  const direction = over.direction ?? ''
  const versions = {
    pt: makeVersion({ direction }),
    en: makeVersion(),
  }
  const data = {
    ideia: {
      pt: { title: 'Meu vídeo', direction, siblings: [], logline: '', angles: '', framework: '' },
      en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' },
    },
    roteiro: { pt: null, en: null },
    versions,
    pillar: 'codigo' as const, durationRange: '14–17 min',
    saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(),
    saveRoteiro: vi.fn().mockResolvedValue(undefined),
  }
  return {
    data,
    ...render(
      <VideoEditorProvider initialState={seed}>
        <VideoDataProvider value={data as never}><RoteiroStage /></VideoDataProvider>
      </VideoEditorProvider>,
    ),
  }
}

describe('RoteiroStage — "gerar roteiro" empty state (direction selected)', () => {
  it('renders .rot-gen with both actions, edit link, and the direction text', () => {
    const { container } = wrap({ direction: 'Alguma direção ativa' })
    expect(container.querySelector('.rot-gen')).toBeTruthy()
    expect(container.querySelector('.rot-empty')).toBeNull()
    expect(container.textContent).toContain('Gerar roteiro com Cowork')
    expect(container.textContent).toContain('Começar do zero')
    expect(container.textContent).toContain('editar')
    expect(container.querySelector('.vi-seed-text')!.textContent).toContain('Alguma direção ativa')
  })

  it('"Começar do zero" calls saveRoteiro with a v3 single-beat blank roteiro', () => {
    const { container, data } = wrap({ direction: 'Alguma direção ativa' })
    const btn = Array.from(container.querySelectorAll('.rot-gen-actions .btn'))
      .find((b) => b.textContent?.includes('Começar do zero')) as HTMLElement
    fireEvent.click(btn)
    expect(data.saveRoteiro).toHaveBeenCalledWith('pt', {
      version: 3, meta: {}, beats: [{ idx: 0, name: 'Beat 1', status: 'PENDING', script: [] }],
    })
  })
})

describe('RoteiroStage — fallback empty state (no direction)', () => {
  it('renders the old "Ainda é só uma ideia" .rot-empty, NOT .rot-gen', () => {
    const { container } = wrap({ direction: '' })
    expect(container.querySelector('.rot-empty')).toBeTruthy()
    expect(container.querySelector('.rot-gen')).toBeNull()
    expect(container.textContent).toContain('Ainda é só uma ideia')
  })
})
