// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const { ler, start } = vi.hoisted(() => ({ ler: vi.fn(), start: vi.fn(async () => ({ ok: true })) }))  // vi.mock é içado antes de const
vi.mock('../src/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(), uploadVariant: vi.fn(), startAbTest: start, createTextVariant: vi.fn(),
  updateAbTestType: vi.fn(), cleanupDraftVariants: vi.fn(async () => ({ ok: true })), fetchAbBriefingData: vi.fn(),
  fetchLibraryEntries: vi.fn(async () => []), lerDimensoesDaOriginal: (id: string) => ler(id),
}))

import { AbCreateWizard } from '../src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'

const settings = {} as never
const video = { id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: null, sourcePipelineId: null }
const prefill = { testType: 'thumbnail' as const, draftVariants: [
  { label: 'A', isOriginal: true, thumbUrl: 'https://i.ytimg.com/a.jpg', titleText: 'v' },
  { label: 'B', isOriginal: false, thumbUrl: 'https://blob/b.jpg', titleText: '' } ] }
const montar = () => render(<AbCreateWizard video={video} siteId="s" settings={settings}
  onClose={vi.fn()} onCreated={vi.fn()} iniciarTeste={start} prefill={prefill} existingDraftId="d1" />)

beforeEach(() => {
  cleanup()
  ler.mockReset()
  start.mockClear()
  const m = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() })
})

describe('passo Revisar: aviso da original (D12)', () => {
  it('aviso aparece, lido pelo rascunho, e Ativar teste segue habilitado e inicia', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: '480x360', medida: true })
    montar()
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('480×360'))
    expect(ler).toHaveBeenCalledWith('d1')
    const ativar = screen.getByRole('button', { name: /Ativar teste/ }) as HTMLButtonElement
    expect(ativar.disabled).toBe(false)
    expect((screen.getByRole('button', { name: /Salvar rascunho/ }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(ativar)
    await waitFor(() => expect(start).toHaveBeenCalledWith('d1'))
  })
  it('leitura pendurada: botões habilitados, esqueleto e "Pronto para ativar." (nunca "Tudo pronto."), sem role=status', () => {
    ler.mockReturnValueOnce(new Promise(() => {}))
    montar()
    expect((screen.getByRole('button', { name: /Ativar teste/ }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('Pronto para ativar.')).toBeTruthy()
    expect(screen.queryByText('Tudo pronto.')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy()  // o assistente renderiza em portal
  })
  it('leitura que falha: linha neutra e Ativar teste habilitado', async () => {
    ler.mockResolvedValueOnce({ ok: false })
    montar()
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Não consegui conferir'))
    expect((screen.getByRole('button', { name: /Ativar teste/ }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('C3: abre direto em Variantes e já lê a original', async () => {
    // step inicial = prefillType || existingDraftId ? 'variantes' : 'tipo' quando não é continuingDraft (sem draftVariants > 1); localStorage limpo.
    ler.mockResolvedValue({ ok: true, dimensions: '1280x720', medida: true })
    render(<AbCreateWizard video={video} siteId="s" settings={settings}
      onClose={vi.fn()} onCreated={vi.fn()} iniciarTeste={start} prefill={{ testType: 'thumbnail' } as never} existingDraftId="d2" />)
    await waitFor(() => expect(ler).toHaveBeenCalledWith('d2'))
    expect(ler).toHaveBeenCalledTimes(1)
  })
  it('C3b: no passo Tipo a leitura não começa', async () => {
    // mesmo formato do rascunho local v2 de ab-wizard-variante-vazia: chave `ab-wizard-draft-v2-<videoId>`
    localStorage.setItem('ab-wizard-draft-v2-vid-1', JSON.stringify({
      step: 'tipo', type: 'thumbnail',
      variants: [
        { label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' },
        { label: 'B', isOriginal: false, thumbUrl: null, titleText: '' },
      ],
      draftTestId: null, savedAt: Date.now(),
    }))
    render(<AbCreateWizard video={video} siteId="s" settings={settings}
      onClose={vi.fn()} onCreated={vi.fn()} iniciarTeste={start} prefill={{} as never} />)
    await Promise.resolve()
    expect(ler).not.toHaveBeenCalled()
  })
  it('A1: a leitura só dispara com o diálogo (portal) já no DOM, para não atrasar a montagem atrás da fila de actions', async () => {
    let dialogoNoDom: boolean | null = null
    ler.mockImplementationOnce(() => { dialogoNoDom = document.querySelector('[role="dialog"]') !== null; return new Promise(() => {}) })
    montar()
    await waitFor(() => expect(ler).toHaveBeenCalledTimes(1))
    expect(dialogoNoDom).toBe(true)
  })
})
