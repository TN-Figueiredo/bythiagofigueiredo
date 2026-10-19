// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const acoes = vi.hoisted(() => ({
  createAbTest: vi.fn(async () => ({ ok: true, id: 'novo-id' })),
}))
vi.mock('../src/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: acoes.createAbTest, uploadVariant: vi.fn(), startAbTest: vi.fn(), createTextVariant: vi.fn(),
  updateAbTestType: vi.fn(), cleanupDraftVariants: vi.fn(), fetchAbBriefingData: vi.fn(), fetchLibraryEntries: vi.fn(async () => []),
}))

import { AbCreateWizard } from '../src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'

const REF_ID = '123e4567-e89b-12d3-a456-426614174000'
const video = { id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: null, sourcePipelineId: null }

beforeEach(() => {
  cleanup()
  acoes.createAbTest.mockClear()
  const m = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() })
})

describe('assistente: a referência chega ao createAbTest (Y-B4)', () => {
  it('com referenciaDados, escolher o tipo cria o rascunho levando a referência', async () => {
    render(<AbCreateWizard video={video} siteId="s" settings={{} as never} onClose={vi.fn()} onCreated={vi.fn()}
      referenciaDados={{ refVideoId: REF_ID, refTroca: null, tipo: 'title' }} />)
    fireEvent.click(screen.getByRole('radio', { name: /Só o título muda/ }))
    await waitFor(() => expect(acoes.createAbTest).toHaveBeenCalledTimes(1))
    expect(acoes.createAbTest).toHaveBeenCalledWith(
      expect.objectContaining({ referencia: { refVideoId: REF_ID, refTroca: null, tipo: 'title' } }),
    )
  })

  it('sem referenciaDados, a chave `referencia` não vai', async () => {
    render(<AbCreateWizard video={video} siteId="s" settings={{} as never} onClose={vi.fn()} onCreated={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: /Só o título muda/ }))
    await waitFor(() => expect(acoes.createAbTest).toHaveBeenCalledTimes(1))
    const arg = acoes.createAbTest.mock.calls[0]![0] as Record<string, unknown>
    expect(arg).not.toHaveProperty('referencia')
  })
})
