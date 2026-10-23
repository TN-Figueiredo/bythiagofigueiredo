// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('../src/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(), uploadVariant: vi.fn(), startAbTest: vi.fn(), createTextVariant: vi.fn(),
  updateAbTestType: vi.fn(), cleanupDraftVariants: vi.fn(), fetchAbBriefingData: vi.fn(), fetchLibraryEntries: vi.fn(async () => []),
  lerDimensoesDaOriginal: vi.fn(async () => ({ ok: false })),
}))

import { AbCreateWizard } from '../src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'
import { initWizardConfig } from '../src/lib/youtube/ab-wizard-adapter'

const settings = {} as never
const video = { id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: null, sourcePipelineId: null }
const montar = (testType: 'title' | 'thumbnail') =>
  render(<AbCreateWizard video={video} siteId="s" settings={settings} onClose={vi.fn()} onCreated={vi.fn()} prefill={{ testType }} />)

beforeEach(() => {
  cleanup()
  const m = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() })
})

describe('variante B nasce vazia (T3)', () => {
  it('prefill de título sem digitar nada: Próximo desligado; digitando, liga', () => {
    montar('title')
    const proximo = screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement
    expect(proximo.disabled).toBe(true)
    const campo = screen.getAllByRole('textbox').find((e) => (e as HTMLInputElement).value === '')
    expect(campo).toBeTruthy()
    fireEvent.change(campo!, { target: { value: 'Novo título' } })
    expect((screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('rascunho local de outro tipo para o mesmo vídeo não preenche a variante B (Yannis I2; avisar a sessão do A/B)', () => {
    localStorage.setItem('ab-wizard-draft-vid-1', JSON.stringify({
      step: 2, type: 'title',
      variants: [
        { label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' },
        { label: 'B', isOriginal: false, thumbUrl: null, titleText: 'Texto antigo' },
      ],
      config: initWizardConfig(settings), hypothesis: '', savedAt: Date.now(),
    }))
    montar('thumbnail')
    expect((screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('rascunho local do MESMO tipo continua restaurado', () => {
    localStorage.setItem('ab-wizard-draft-vid-1', JSON.stringify({
      step: 2, type: 'title',
      variants: [
        { label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' },
        { label: 'B', isOriginal: false, thumbUrl: null, titleText: 'Texto antigo' },
      ],
      config: initWizardConfig(settings), hypothesis: '', savedAt: Date.now(),
    }))
    montar('title')
    expect((screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(false)
  })
})
