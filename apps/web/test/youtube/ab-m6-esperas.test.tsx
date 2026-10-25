// @vitest-environment jsdom
// T4 (M6): esperas do assistente sem véu, só o clicado ocupado, erros em português.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'

const m = vi.hoisted(() => ({
  create: vi.fn(async (_i: unknown): Promise<Record<string, unknown>> => ({ ok: true, id: 't1' })),
  updateType: vi.fn(async (_id: string, _t: string): Promise<Record<string, unknown>> => ({ ok: true })),
  createText: vi.fn(async (_i: { label?: string }): Promise<Record<string, unknown>> => ({ ok: true, id: 'novo' })),
  cleanup: vi.fn(async (_t: string, _o?: unknown) => ({ ok: true })),
  start: vi.fn(async (_id: string): Promise<Record<string, unknown>> => ({ ok: true })),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: m.create, uploadVariant: vi.fn(), createTextVariant: m.createText, updateTextVariant: vi.fn(async () => ({ ok: true })),
  updateAbTestType: m.updateType, cleanupDraftVariants: m.cleanup, fetchAbBriefingData: vi.fn(), fetchLibraryEntries: vi.fn(async () => []),
  lerDimensoesDaOriginal: vi.fn(async () => ({ ok: false })),
}))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { AbCreateWizard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'

const video = { id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: 'https://i.ytimg.com/a.jpg' }
const onClose = vi.fn()
const onCreated = vi.fn()
const onAbrir = vi.fn()

function montar(extra: Record<string, unknown> = {}) {
  return render(
    <AbCreateWizard video={video} siteId="s" settings={{} as never} onClose={onClose} onCreated={onCreated}
      onAbrirExistente={onAbrir} iniciarTeste={m.start} {...extra} />,
  )
}
const tipo = (re: RegExp) => screen.getByRole('radio', { name: re })
const esc = () => fireEvent.keyDown(document, { key: 'Escape' })
const prox = () => fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
const ativar = () => fireEvent.click(screen.getByRole('button', { name: /Ativar teste/ }))
const draftTitulo = { testType: 'title', draftVariants: [
  { id: 'va', label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' },
  { id: 'vb', label: 'B', isOriginal: false, thumbUrl: null, titleText: 'Fila' },
] }
const montarNoRevisar = () => { const r = montar({ existingDraftId: 'd1', prefill: draftTitulo }); return r }

beforeEach(() => {
  cleanup()
  for (const f of Object.values(m)) f.mockReset()
  m.create.mockResolvedValue({ ok: true, id: 't1' })
  m.updateType.mockResolvedValue({ ok: true })
  m.createText.mockResolvedValue({ ok: true, id: 'novo' })
  m.cleanup.mockResolvedValue({ ok: true })
  m.start.mockResolvedValue({ ok: true })
  onClose.mockReset(); onCreated.mockReset(); onAbrir.mockReset()
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) }, clear: () => store.clear(),
  })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('M6 T4: criar o rascunho', () => {
  it('enquanto cria: sem véu, cartão aria-busy, outros aria-disabled, uma chamada, um status, fechar livre', async () => {
    let fim: (v: Record<string, unknown>) => void = () => undefined
    m.create.mockReturnValue(new Promise(r => { fim = r }))
    montar()
    const t = tipo(/Só o título muda/)
    fireEvent.click(t); fireEvent.click(t)
    fireEvent.keyDown(t, { key: 'ArrowRight' })
    expect(m.create).toHaveBeenCalledTimes(1)
    expect(tipo(/Só o título muda/).getAttribute('aria-busy')).toBe('true')
    expect(tipo(/^Thumbnail/).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getAllByRole('status').filter(s => s.textContent?.includes('Criando o rascunho…')).length).toBe(1)
    expect(document.querySelector('.animate-pulse')).toBeNull()
    esc(); expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); expect(onClose).toHaveBeenCalledTimes(2)
    await act(async () => { fim({ ok: true, id: 't1' }) })
  })

  it.each([
    ['rejeição genérica', () => m.create.mockResolvedValue({ ok: false, error: 'boom' })],
    ['exceção de rede', () => m.create.mockRejectedValue(new Error('net'))],
  ])('%s: alerta em português com Tentar de novo, sem texto cru', async (_n, prep) => {
    prep(); montar()
    fireEvent.click(tipo(/Só o título muda/))
    const a = await screen.findByRole('alert')
    expect(a.textContent).toContain('Não foi possível criar o rascunho')
    expect(document.body.textContent).not.toMatch(/boom|net\b/)
    m.create.mockResolvedValue({ ok: true, id: 't1' })
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(2))
  })

  it('short: frase do servidor, sem botão de tentar de novo', async () => {
    m.create.mockResolvedValue({ ok: false, error: 'Shorts não entram no A/B Lab.', codigo: 'short' })
    montar(); fireEvent.click(tipo(/Só o título muda/))
    const a = await screen.findByRole('alert')
    expect(a.textContent).toContain('Shorts não entram')
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it.each([['draft', 'Já existe um rascunho deste vídeo', 'Abrir rascunho'], ['active', 'Este vídeo já tem um teste', 'Abrir o teste']])(
    'ja_existe (%s): texto e botão certos, abre pelo callback', async (status, texto, botao) => {
      m.create.mockResolvedValue({ ok: false, error: 'x', codigo: 'ja_existe', existente: { id: 'ex1', status } })
      montar(); fireEvent.click(tipo(/Só o título muda/))
      await screen.findByText(texto)
      fireEvent.click(screen.getByRole('button', { name: botao }))
      expect(onAbrir).toHaveBeenCalledWith('ex1', status)
    })

  it('Y3: fechar durante criar e reabrir cai em ja_existe (texto 3)', async () => {
    let fim: (v: Record<string, unknown>) => void = () => undefined
    m.create.mockReturnValue(new Promise(r => { fim = r }))
    const a = montar(); fireEvent.click(tipo(/Só o título muda/)); esc(); a.unmount(); await act(async () => { fim({ ok: true, id: 't1' }) })
    m.create.mockResolvedValue({ ok: false, error: 'x', codigo: 'ja_existe', existente: { id: 't1', status: 'draft' } })
    montar(); fireEvent.click(tipo(/Só o título muda/))
    await screen.findByText('Já existe um rascunho deste vídeo')
  })

  it('trocar o tipo com rascunho: texto 18 e updateAbTestType; falha vira texto de troca', async () => {
    m.updateType.mockResolvedValue({ ok: false, error: 'boom' })
    montar({ existingDraftId: 'd1', prefill: { testType: 'title', draftVariants: draftTitulo.draftVariants } })
    fireEvent.click(screen.getByRole('button', { name: /Tipo/ }))
    fireEvent.click(tipo(/^Thumbnail/))
    await waitFor(() => expect(m.updateType).toHaveBeenCalledWith('d1', 'thumbnail'))
    const a = await screen.findByRole('alert')
    expect(a.textContent).toContain('Não foi possível trocar o tipo')
    expect(document.body.textContent).not.toContain('boom')
  })
})

describe('M6 T4: ativar', () => {
  it('ativando: botões desabilitados, X desabilitado, Esc bloqueado, só "Ativando…"', async () => {
    let fim: (v: Record<string, unknown>) => void = () => undefined
    m.start.mockReturnValue(new Promise(r => { fim = r }))
    montarNoRevisar(); ativar()
    fireEvent.click(screen.getByRole('button', { name: /Ativando/ }))
    await waitFor(() => expect(m.start).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /Ativando/ })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Voltar' }) as HTMLButtonElement).disabled).toBe(true)
    esc(); expect(onClose).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('Failed')
    await act(async () => { fim({ ok: true }) })
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
  })

  it('iniciarTeste ok:false: texto 10 sem texto cru; Tentar de novo só chama iniciarTeste', async () => {
    m.start.mockResolvedValueOnce({ ok: false, error: 'boom' })
    montarNoRevisar(); ativar()
    const a = await screen.findByRole('alert')
    expect(a.textContent).toContain('Não foi possível ativar')
    expect(document.body.textContent).not.toContain('boom')
    m.createText.mockClear(); m.cleanup.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(m.start).toHaveBeenCalledTimes(2))
    expect(m.createText).not.toHaveBeenCalled(); expect(m.cleanup).not.toHaveBeenCalled()
  })

  it('exceção do iniciarTeste: texto 10 e Esc volta a fechar', async () => {
    m.start.mockRejectedValue(new Error('Failed to fetch'))
    montarNoRevisar(); ativar()
    const a = await screen.findByRole('alert')
    expect(a.textContent).toContain('Não foi possível ativar')
    expect(document.body.textContent).not.toContain('Failed to fetch')
    esc(); expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('falha ao gravar variante nova (createTextVariant): texto 20, nada ativado', async () => {
    m.createText.mockResolvedValue({ ok: false, error: 'boom' })
    montar({ existingDraftId: 'd1', prefill: { testType: 'title', draftVariants: [draftTitulo.draftVariants[0]] } })
    fireEvent.change(screen.getByLabelText('Título da variante B'), { target: { value: 'Novo título' } })
    prox(); ativar()
    const a = await screen.findByRole('alert')
    expect(a.textContent).toContain('Não foi possível salvar as variantes')
    expect(a.textContent).toContain('Nada foi ativado')
    expect(m.start).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('boom')
  })

  it('Y1: onCreated que lança limpa o ocupado e Esc chama onClose', async () => {
    onCreated.mockImplementation(() => { throw new Error('nav') })
    montarNoRevisar(); ativar()
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    await waitFor(() => { esc(); expect(onClose).toHaveBeenCalled() })
  })

  it('Y1: onCreated que volta bem mantém ocupado (Esc não fecha)', async () => {
    montarNoRevisar(); ativar()
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    esc(); expect(onClose).not.toHaveBeenCalled()
  })
})
