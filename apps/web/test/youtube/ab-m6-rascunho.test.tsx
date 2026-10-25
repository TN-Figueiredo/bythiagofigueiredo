// @vitest-environment jsdom
// T4b (M6): rascunho reaberto traz o que já está gravado, não duplica nem apaga.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const m = vi.hoisted(() => ({
  createText: vi.fn(async (_i: { test_id: string; label?: string; title_text?: string }) => ({ ok: true, id: 'novo' })),
  updateText: vi.fn(async (_id: string, _u: { title_text?: string }) => ({ ok: true })),
  upload: vi.fn(async (_t: string, _fd: FormData) => ({ ok: true, variantId: 'up1' })),
  cleanup: vi.fn(async (_t: string, _o?: { manter?: string[] }) => ({ ok: true })),
  start: vi.fn(async (_id: string) => ({ ok: true })),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(), uploadVariant: m.upload, createTextVariant: m.createText, updateTextVariant: m.updateText,
  updateAbTestType: vi.fn(), cleanupDraftVariants: m.cleanup, fetchAbBriefingData: vi.fn(), fetchLibraryEntries: vi.fn(async () => []),
  lerDimensoesDaOriginal: vi.fn(async () => ({ ok: false })),
}))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { AbCreateWizard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'
import { toDraftList } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'

const video = { id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: 'https://i.ytimg.com/a.jpg' }
const A = { id: 'va', label: 'A', isOriginal: true, thumbUrl: 'https://blob/A.jpg', titleText: 'Meu vídeo' }
const gravada = (label: string, titleText: string, thumbUrl: string | null = null) => ({ id: `v${label}`, label, isOriginal: false, thumbUrl, titleText })

function montar(testType: 'title' | 'combo' | 'thumbnail', draftVariants: unknown[]) {
  return render(
    <AbCreateWizard
      video={video} siteId="s" settings={{} as never} onClose={vi.fn()} onCreated={vi.fn()} iniciarTeste={m.start}
      existingDraftId="d1" prefill={{ testType, draftVariants } as never}
    />,
  )
}
const ativar = () => fireEvent.click(screen.getByRole('button', { name: /Ativar teste/ }))
const voltar = () => fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))

beforeEach(() => {
  cleanup()
  for (const f of Object.values(m)) f.mockClear()
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
  })
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => undefined }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('M6 T4b: rascunho de título reaberto', () => {
  it('(a) o campo B mostra o texto do banco; Ativar não cria variante e inicia uma vez', async () => {
    montar('title', [A, gravada('B', 'Fila de 3 h')])
    voltar()
    expect((screen.getByLabelText('Título da variante B') as HTMLInputElement).value).toBe('Fila de 3 h')
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
    ativar()
    await waitFor(() => expect(m.start).toHaveBeenCalledTimes(1))
    expect(m.createText).not.toHaveBeenCalled()
    expect(m.updateText).not.toHaveBeenCalled()
  })

  it('(b) o rascunho do painel (toDraftList) leva o id de cada variante ao assistente', () => {
    const row = {
      id: 'd1', name: 'Test: Meu vídeo', test_type: 'title', created_at: new Date().toISOString(), youtube_video_id: 'yt', source_pipeline_id: null, original_thumbnail_url: null,
      variants: [
        { id: 'va', label: 'A', is_original: true, blob_url: null, title_text: 'Meu vídeo' },
        { id: 'vb', label: 'B', is_original: false, blob_url: null, title_text: 'Fila' },
      ],
    } as unknown as AbTestWithVariants
    expect(toDraftList([row])[0]?.variants?.map(v => v.id)).toEqual(['va', 'vb'])
  })

  it('(d) V=3 gravado e reaberto: Ativar não toca em createTextVariant', async () => {
    montar('title', [A, gravada('B', 'um'), gravada('C', 'dois')])
    ativar()
    await waitFor(() => expect(m.start).toHaveBeenCalledTimes(1))
    expect(m.createText).not.toHaveBeenCalled()
    expect(m.cleanup).toHaveBeenCalledWith('d1', { manter: ['B', 'C'] })
  })

  it('(e) B gravado com texto editado: updateTextVariant(gravada, ...) e nenhum createTextVariant', async () => {
    montar('title', [A, gravada('B', 'antes')])
    voltar()
    fireEvent.change(screen.getByLabelText('Título da variante B'), { target: { value: 'depois' } })
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
    ativar()
    await waitFor(() => expect(m.start).toHaveBeenCalledTimes(1))
    expect(m.updateText).toHaveBeenCalledWith('vB', { title_text: 'depois' })
    expect(m.createText).not.toHaveBeenCalled()
  })

  it('remover B gravado: C vira B como variante nova (rótulo explícito), a gravada antiga sai na limpeza', async () => {
    montar('title', [A, gravada('B', 'um'), gravada('C', 'dois')])
    voltar()
    fireEvent.click(screen.getByLabelText('Remover variante B'))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
    ativar()
    await waitFor(() => expect(m.start).toHaveBeenCalledTimes(1))
    expect(m.cleanup).toHaveBeenCalledWith('d1', { manter: [] })
    expect(m.createText).toHaveBeenCalledTimes(1)
    expect(m.createText).toHaveBeenCalledWith({ test_id: 'd1', title_text: 'dois', label: 'B' })
  })

  it('falha em C depois de B gravada: "Ativar" de novo cria B uma vez só no total', async () => {
    localStorage.setItem('ab-wizard-draft-v2-vid-1', JSON.stringify({
      step: 'revisar', type: 'title', draftTestId: 'd1', savedAt: Date.now(),
      variants: [{ label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' }, { label: 'B', isOriginal: false, thumbUrl: null, titleText: 'um' }, { label: 'C', isOriginal: false, thumbUrl: null, titleText: 'dois' }],
    }))
    m.createText.mockImplementation(async (i) => (i.label === 'C' ? { ok: false, id: undefined } : { ok: true, id: `id-${i.label}` }))
    render(<AbCreateWizard video={video} siteId="s" settings={{} as never} onClose={vi.fn()} onCreated={vi.fn()} iniciarTeste={m.start} />)
    ativar()
    await waitFor(() => expect(m.createText).toHaveBeenCalledTimes(2))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Tentar de novo' }) as HTMLButtonElement).disabled).toBe(false))
    m.createText.mockImplementation(async (i) => ({ ok: true, id: `id-${i.label}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(m.start).toHaveBeenCalledTimes(1))
    const rotulos = m.createText.mock.calls.map(c => c[0].label)
    expect(rotulos.filter(l => l === 'B')).toHaveLength(1)
    expect(rotulos.filter(l => l === 'C')).toHaveLength(2)
  })
})

describe('M6 T4b: combo reaberto', () => {
  it('(c) B gravado (blob) + C novo: limpeza mantém só o B e o upload de C leva o rótulo C', async () => {
    montar('combo', [A, gravada('B', 'um', 'https://blob/B.jpg')])
    voltar()
    fireEvent.click(screen.getByText('Adicionar variante'))
    fireEvent.change(screen.getByLabelText('Título da variante C'), { target: { value: 'dois' } })
    const arquivo = new File([new Uint8Array([1, 2, 3])], 'c.png', { type: 'image/png' })
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]')
    fireEvent.change(inputs[inputs.length - 1]!, { target: { files: [arquivo] } })
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
    ativar()
    await waitFor(() => expect(m.start).toHaveBeenCalledTimes(1))
    expect(m.cleanup).toHaveBeenCalledWith('d1', { manter: ['B'] })
    expect(m.upload).toHaveBeenCalledTimes(1)
    const fd = m.upload.mock.calls[0]![1]
    expect(fd.get('label')).toBe('C')
    expect(fd.get('title_text')).toBe('dois')
  })
})
