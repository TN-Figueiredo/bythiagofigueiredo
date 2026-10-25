// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { previaPorTipo, faltaThumbDe, descricaoDaPrevia } from '@/app/cms/(authed)/youtube/ab-lab/_components/previa-por-tipo'
import { StepRevisar, type ReviewVariant } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-revisar'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'

const { start, upload, cleanupDraft } = vi.hoisted(() => ({
  start: vi.fn(async () => ({ ok: true })),
  upload: vi.fn(async () => ({ ok: true })),
  cleanupDraft: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../../src/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(), uploadVariant: upload, startAbTest: start, createTextVariant: vi.fn(),
  updateAbTestType: vi.fn(), cleanupDraftVariants: cleanupDraft, fetchAbBriefingData: vi.fn(),
  fetchLibraryEntries: vi.fn(async () => [{ id: 'l1', blob_url: 'https://blob/lib.jpg', title: 'Lib', tags: [], lift_at_win: null, source_type: 'x', thumbnail_longevity: [] }]),
  lerDimensoesDaOriginal: vi.fn(async () => ({ ok: false })),
}))

import { AbCreateWizard } from '../../src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'

const A = { label: 'A' as const, thumbUrl: 'a.jpg', title: 'TA', isOriginal: true }
const semB = { label: 'B' as const, thumbUrl: null, title: 'TB', isOriginal: false }

describe('previaPorTipo / faltaThumbDe (puras)', () => {
  it('title: todas com a miniatura da original e o próprio título', () => {
    const r = previaPorTipo('title', [A, semB])
    expect(r.map((c) => c.thumbUrl)).toEqual(['a.jpg', 'a.jpg'])
    expect(r.map((c) => c.title)).toEqual(['TA', 'TB'])
  })
  it('thumbnail: título da original e a própria miniatura', () => {
    const r = previaPorTipo('thumbnail', [A, { label: 'B', thumbUrl: 'b.jpg', title: '', isOriginal: false }])
    expect(r.map((c) => c.title)).toEqual(['TA', 'TA'])
    expect(r.map((c) => c.thumbUrl)).toEqual(['a.jpg', 'b.jpg'])
  })
  it('combo: os próprios; título em branco vira "Sem título"', () => {
    const r = previaPorTipo('combo', [A, { ...semB, title: '  ' }])
    expect(r[0]!.title).toBe('TA')
    expect(r[1]!.title).toBe('Sem título')
    expect(r[1]!.thumbUrl).toBeNull()
  })
  it('faltaThumbDe', () => {
    expect(faltaThumbDe('combo', [A, semB])).toBe('B')
    expect(faltaThumbDe('thumbnail', [A, semB])).toBe('B')
    expect(faltaThumbDe('title', [A, semB])).toBeNull()
  })
  it('descricaoDaPrevia respeita o número de variantes', () => {
    expect(descricaoDaPrevia('title', 2)).toContain('nas duas')
    expect(descricaoDaPrevia('title', 3)).toContain('nas três')
  })
})

const config: WizardConfig = { confidence: 95, duration: 14, burnIn: 1, rotation: 'abba' }
const metaNula = { canal: null, publicadoEm: null, duracao: null }
const IMG_PROIBIDAS = /FILA DE|RAMEN|12 mil|há 2 dias|ByThiagoFigueiredo|MBK|Comparar|No feed/

function revisar(type: 'title' | 'thumbnail' | 'combo', variants: ReviewVariant[], extra: Partial<React.ComponentProps<typeof StepRevisar>> = {}) {
  return render(<StepRevisar type={type} variants={variants} config={config} meta={metaNula} {...extra} />)
}

describe('prévia do Revisar (revisar-titulo / -thumbnail / -combo)', () => {
  afterEach(cleanup)

  it('revisar-titulo: mesma miniatura nos dois cartões, cada um com o seu título', () => {
    const { container } = revisar('title', [A, { label: 'B', thumbUrl: null, title: 'Título novo', isOriginal: false }])
    const srcs = Array.from(container.querySelectorAll('img')).map((i) => i.getAttribute('src'))
    expect(srcs).toEqual(['a.jpg', 'a.jpg'])
    expect(container.textContent).toContain('Título novo')
    expect(container.textContent).not.toMatch(IMG_PROIBIDAS)
    expect(container.textContent).not.toMatch(/\bTF\b/)
    for (const pill of ['Busca', 'Sugeridos', 'Mobile']) {
      fireEvent.click(screen.getByRole('button', { name: pill }))
      expect(container.querySelectorAll('img').length).toBe(2)
      expect(container.textContent).toContain('TA')
      expect(container.textContent).toContain('Título novo')
    }
  })

  it('revisar-thumbnail: miniaturas diferentes, mesmo título', () => {
    const { container } = revisar('thumbnail', [A, { label: 'B', thumbUrl: 'b.jpg', title: '', isOriginal: false }])
    const srcs = Array.from(container.querySelectorAll('img')).map((i) => i.getAttribute('src'))
    expect(srcs).toEqual(['a.jpg', 'b.jpg'])
    expect(container.textContent?.match(/TA/g)?.length).toBe(2)
  })

  it('revisar-combo-sem-imagem: "Sem thumbnail" e botão da Biblioteca chamam o callback com B', () => {
    const cb = vi.fn()
    revisar('combo', [A, semB], { onEscolherDaBiblioteca: cb })
    expect(screen.getByText('Sem thumbnail')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher da Biblioteca' }))
    expect(cb).toHaveBeenCalledWith('B')
  })

  it('teste de título não oferece Biblioteca (a miniatura vem da original)', () => {
    revisar('title', [{ ...A, thumbUrl: null }, semB], { onEscolherDaBiblioteca: vi.fn() })
    expect(screen.queryByRole('button', { name: 'Escolher da Biblioteca' })).toBeNull()
  })

  it('meta real: duração e data; nula: nada; handle sem @@', () => {
    const { container, unmount } = revisar('combo', [A, { ...semB, thumbUrl: 'b.jpg' }], { meta: { canal: 'bythiago', publicadoEm: '21 out 2026', duracao: '12:48' } })
    expect(container.textContent).toContain('12:48')
    expect(container.textContent).toContain('Publicado em 21 out 2026')
    expect(container.textContent?.match(/@bythiago/g)?.length).toBe(2)
    expect(container.textContent).not.toContain('@@')
    unmount()
    const r2 = revisar('combo', [A, { ...semB, thumbUrl: 'b.jpg' }])
    expect(r2.container.textContent).not.toMatch(/@|Publicado em|12:48/)
  })
})

/* --- Biblioteca que grava (C2) e N2 --- */

const video = { id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: null, sourcePipelineId: null }
const prefillCombo = { testType: 'combo' as const, draftVariants: [
  { label: 'A', isOriginal: true, thumbUrl: 'https://i.ytimg.com/a.jpg', titleText: 'Meu vídeo' },
  { label: 'B', isOriginal: false, thumbUrl: null, titleText: 'Outro título' } ] }

function montar() {
  return render(<AbCreateWizard video={video} siteId="s" settings={{} as never}
    onClose={vi.fn()} onCreated={vi.fn()} iniciarTeste={start} prefill={prefillCombo as never} existingDraftId="d1" />)
}

async function escolherDaBiblioteca() {
  fireEvent.click(await screen.findByRole('button', { name: 'Escolher da Biblioteca' }))
  fireEvent.click(await screen.findByRole('button', { name: /Lib/ }))
}

function blobFalso(type: string, size = 100) {
  return { ok: true, blob: async () => new Blob([new Uint8Array(size)], { type }) }
}

describe('Biblioteca que grava (C2) e N2', () => {
  beforeEach(() => {
    cleanup()
    start.mockClear(); upload.mockClear(); cleanupDraft.mockClear()
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('combo com B da Biblioteca: Ativar baixa a URL, envia com o rótulo B e inicia', async () => {
    const f = vi.fn(async () => blobFalso('image/jpeg'))
    vi.stubGlobal('fetch', f)
    montar()
    await escolherDaBiblioteca()
    fireEvent.click(screen.getByRole('button', { name: /Ativar teste/ }))
    await waitFor(() => expect(start).toHaveBeenCalledWith('d1'))
    expect(f).toHaveBeenCalledWith('https://blob/lib.jpg')
    expect(upload).toHaveBeenCalledTimes(1)
    const fd = (upload.mock.calls[0] as unknown as [string, FormData])[1]
    expect((fd.get('file') as File).name).toBe('variant-B.jpg')
  })

  it('fetch rejeitado: iniciarTeste não é chamado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('CORS') }))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    montar()
    await escolherDaBiblioteca()
    fireEvent.click(screen.getByRole('button', { name: /Ativar teste/ }))
    await waitFor(() => expect(document.body.textContent).toContain('Failed to download library image'))
    expect(start).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('N2: imagem webp da Biblioteca: frase própria, sem limpar o rascunho nem enviar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => blobFalso('image/webp')))
    montar()
    await escolherDaBiblioteca()
    fireEvent.click(screen.getByRole('button', { name: /Ativar teste/ }))
    await waitFor(() => expect(document.body.textContent).toContain('Esta imagem da Biblioteca não pode ser usada (precisa ser JPEG ou PNG, até 2 MB). Escolha outra.'))
    expect(cleanupDraft).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
  })

  it('N2: imagem maior que 2 MB também é recusada antes de qualquer action', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => blobFalso('image/png', 2 * 1024 * 1024 + 1)))
    montar()
    await escolherDaBiblioteca()
    fireEvent.click(screen.getByRole('button', { name: /Ativar teste/ }))
    await waitFor(() => expect(document.body.textContent).toContain('até 2 MB'))
    expect(cleanupDraft).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })
})
