// @vitest-environment jsdom
// T6 (M6): banner honesto, regra numa linha, aviso de volume em cartão que não some e nota.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act, renderHook } from '@testing-library/react'

const m = vi.hoisted(() => ({
  start: vi.fn(async (_id: string): Promise<Record<string, unknown>> => ({ ok: true })),
  dim: vi.fn(async (_id: string): Promise<Record<string, unknown>> => ({ ok: true, dimensions: '1280x720', medida: true })),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(), uploadVariant: vi.fn(), createTextVariant: vi.fn(), updateTextVariant: vi.fn(),
  updateAbTestType: vi.fn(), cleanupDraftVariants: vi.fn(async () => ({ ok: true })), fetchAbBriefingData: vi.fn(),
  fetchLibraryEntries: vi.fn(async () => []), lerDimensoesDaOriginal: (id: string) => m.dim(id),
}))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { AbCreateWizard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'
import { StepRevisar } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-revisar'
import { useAvisoVolume, type LerAvisoDeVolume } from '@/app/cms/(authed)/youtube/ab-lab/_components/use-aviso-volume'
import { seloDoAvisoDeVolume } from '@/app/cms/(authed)/youtube/ab-lab/_components/aviso-volume-selo'
import { textoAvisoOriginalBaixa } from '@/lib/youtube/ab-original-resolucao'
import { initWizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'

const config = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
const meta = { canal: null, publicadoEm: null, duracao: null }
const v2 = [
  { label: 'A' as const, thumbUrl: 'a.jpg', title: 't', isOriginal: true },
  { label: 'B' as const, thumbUrl: 'b.jpg', title: 't2', isOriginal: false },
]
const v3 = [...v2, { label: 'C' as const, thumbUrl: 'c.jpg', title: 't3', isOriginal: false }]
const naoChega = { estado: 'nao_chega' as const, texto: 'este teste não chega ao volume em 15 dias' }

beforeEach(() => { cleanup(); vi.useRealTimers() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('M6 T6: banner e selos', () => {
  it('leitor pendente: esqueleto com aria-label e banner "Pronto para ativar."', () => {
    render(<StepRevisar type="thumbnail" variants={v2} config={config} meta={meta} avisoVolume="pendente" />)
    expect(document.querySelector('[aria-busy="true"]')?.getAttribute('aria-label')).toBe('Estimando o volume do teste')
    expect(screen.getByText('Pronto para ativar.')).toBeTruthy()
    expect(screen.queryByText('Tudo pronto.')).toBeNull()
  })
  it('nao_chega: selo âmbar, frase de tela e banner com aviso, sem o verde', () => {
    const { container } = render(<StepRevisar type="thumbnail" variants={v2} config={config} meta={meta} avisoVolume={naoChega} />)
    expect(screen.getByText('Volume insuficiente')).toBeTruthy()
    expect(screen.getByText('Este teste não chega ao volume em 15 dias.')).toBeTruthy()
    expect(screen.getByText('Pronto para ativar, com um aviso abaixo.')).toBeTruthy()
    expect(container.querySelector('[data-tom="verde"]')).toBeNull()
    expect(screen.queryByTestId('icon-CheckCircle')?.getAttribute('class') ?? '').not.toContain('green')
  })
  it('ok (null) ⇒ "Tudo pronto." e nenhum aviso; selos dos outros estados', () => {
    const { container } = render(<StepRevisar type="thumbnail" variants={v2} config={config} meta={meta} avisoVolume={null} />)
    expect(screen.getByText('Tudo pronto.')).toBeTruthy()
    expect(container.querySelector('[data-aviso-volume]')).toBeNull()
    expect(container.querySelector('[data-tom="verde"]')).toBeTruthy()
    expect(seloDoAvisoDeVolume('so_decide_depois')).toEqual({ selo: 'Decide mais tarde', tom: 'neutro' })
    expect(seloDoAvisoDeVolume('teto_justo')).toEqual({ selo: 'Rotação apertada', tom: 'neutro' })
    expect(seloDoAvisoDeVolume('sem_medicao')).toEqual({ selo: 'Sem medição', tom: 'neutro' })
    expect(seloDoAvisoDeVolume('nao_chega')).toEqual({ selo: 'Volume insuficiente', tom: 'ambar' })
    expect(seloDoAvisoDeVolume('sem_variantes')).toBeNull()
  })
  it.each([['so_decide_depois', 'Decide mais tarde'], ['teto_justo', 'Rotação apertada'], ['sem_medicao', 'Sem medição']] as const)('%s ⇒ selo %s tracejado', (estado, selo) => {
    render(<StepRevisar type="thumbnail" variants={v2} config={config} meta={meta} avisoVolume={{ estado, texto: 'x y' }} />)
    expect(screen.getByText(selo).getAttribute('data-tracejado')).toBe('true')
  })
  it('regra: V=2 e V=3, ⓘ com a sequência, sem "Duração:" e resumo "2 variantes de título"', () => {
    const a = render(<StepRevisar type="title" variants={v2} config={config} meta={meta} />)
    expect(screen.getByText(/Roda até 15 dias \(mínimo 12\)/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('Duração:')
    expect(screen.getByText(/2 variantes de título/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Por que 15 dias' }))
    expect(document.body.textContent).toContain('(A, B, B, A)')
    a.unmount()
    render(<StepRevisar type="title" variants={v3} config={config} meta={meta} />)
    expect(screen.getByText(/Roda até 17 dias \(mínimo 16\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Por que 17 dias' }))
    expect(document.body.textContent).toContain('(A, B, C, C, B, A)')
  })
  it('aviso da original visível junto do volume mantém a ordem original → volume', () => {
    render(<StepRevisar type="thumbnail" variants={v2} config={config} meta={meta} avisoOriginal={textoAvisoOriginalBaixa('480x360', true)} avisoVolume={naoChega} />)
    const o = screen.getByText('Baixa resolução'); const v = screen.getByText('Volume insuficiente')
    expect(o.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('falta thumbnail: banner, nota e sem a nota normal; ocupado esconde a nota', () => {
    const semB = [v2[0]!, { ...v2[1]!, thumbUrl: null }]
    const r = render(<StepRevisar type="combo" variants={semB} config={config} meta={meta} faltaThumb="B" />)
    expect(screen.getByText('Falta a thumbnail da variante B.')).toBeTruthy()
    expect(document.body.textContent).toContain('está desativado: a variante B ainda não tem thumbnail')
    r.rerender(<StepRevisar type="combo" variants={semB} config={config} meta={meta} faltaThumb="B" ocupado />)
    expect(document.querySelector('[data-nota-ativar]')).toBeNull()
  })
  it('nota normal é o NOTA_ATIVAR novo', () => {
    render(<StepRevisar type="title" variants={v2} config={config} meta={meta} />)
    expect(document.querySelector('[data-nota-ativar]')?.textContent).toContain('começam a alternar depois que o teste for ativado no YouTube')
    expect(document.body.textContent).not.toContain('rotacionar na hora')
  })
})

describe('M6 T6: aviso indisponível (I1/B5)', () => {
  const texto21 = 'Não foi possível estimar o volume agora. Você pode ativar mesmo assim.'
  it('rejeição, ok:false e Revisar sem rascunho ⇒ texto 21, "Pronto para ativar.", warn quando há erro', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const rej: LerAvisoDeVolume = async () => { throw new Error('x') }
    const r1 = renderHook(() => useAvisoVolume(rej, 'd1', true, 2))
    await waitFor(() => expect(r1.result.current).toBe('indisponivel'))
    expect(warn).toHaveBeenCalled()
    const bad: LerAvisoDeVolume = async () => ({ ok: false, error: 'e' })
    const r2 = renderHook(() => useAvisoVolume(bad, 'd1', true, 2))
    await waitFor(() => expect(r2.result.current).toBe('indisponivel'))
    expect(renderHook(() => useAvisoVolume(bad, null, true, 2)).result.current).toBe('indisponivel')
    render(<StepRevisar type="title" variants={v2} config={config} meta={meta} avisoVolume="indisponivel" />)
    expect(screen.getByText(texto21)).toBeTruthy()
    expect(screen.getByText('Pronto para ativar.')).toBeTruthy()
    expect(screen.queryByText('Tudo pronto.')).toBeNull()
  })
  it('leitor pendente por 8 s ⇒ indisponivel; resposta ok tardia substitui', async () => {
    vi.useFakeTimers()
    let fim: (v: Awaited<ReturnType<LerAvisoDeVolume>>) => void = () => undefined
    const ler: LerAvisoDeVolume = () => new Promise(r => { fim = r })
    const { result } = renderHook(() => useAvisoVolume(ler, 'd1', true, 2))
    expect(result.current).toBe('pendente')
    await act(async () => { vi.advanceTimersByTime(8000) })
    expect(result.current).toBe('indisponivel')
    await act(async () => { fim({ ok: true, aviso: { estado: 'sem_medicao', texto: 'sem medição para estimar o volume' } }) })
    expect(result.current).toEqual({ estado: 'sem_medicao', texto: 'sem medição para estimar o volume' })
  })
  it('Foco 3: mudar V volta a pendente e o texto de outro V nunca aparece', async () => {
    const resp: Record<number, (v: Awaited<ReturnType<LerAvisoDeVolume>>) => void> = {}
    const ler: LerAvisoDeVolume = (_id, p) => new Promise(r => { resp[p?.V ?? 0] = r })
    const { result, rerender } = renderHook(({ v }) => useAvisoVolume(ler, 'd1', true, v), { initialProps: { v: 3 } })
    await act(async () => { resp[3]!({ ok: true, aviso: { estado: 'sem_medicao', texto: 'sem medição para estimar o volume' } }) })
    expect(result.current).toEqual({ estado: 'sem_medicao', texto: 'sem medição para estimar o volume' })
    rerender({ v: 2 })
    expect(result.current).toBe('pendente')
  })
})

describe('M6 T6: no assistente', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear(); m.start.mockReset(); m.start.mockResolvedValue({ ok: true }); m.dim.mockClear()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) }, clear: () => store.clear() })
  })
  afterEach(() => { vi.unstubAllGlobals() })
  const video = { id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: null, sourcePipelineId: null }
  const montar = (extra: Record<string, unknown>, onClose = vi.fn()) => render(
    <AbCreateWizard video={video} siteId="s" settings={{} as never} onClose={onClose} onCreated={vi.fn()} onAbrirExistente={vi.fn()} iniciarTeste={m.start} {...extra} />,
  )
  const combo = { testType: 'combo' as const, draftVariants: [
    { id: 'va', label: 'A', isOriginal: true, thumbUrl: 'https://i.ytimg.com/a.jpg', titleText: 'Meu vídeo' },
    { id: 'vb', label: 'B', isOriginal: false, thumbUrl: null, titleText: 'Outro' },
  ] }

  it('Foco 2: combo com B sem imagem aberto no Revisar ⇒ banner, Ativar desativado, Salvar habilitado, nota', async () => {
    montar({ existingDraftId: 'd1', prefill: combo })
    expect(await screen.findByText('Falta a thumbnail da variante B.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Ativar teste/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Salvar rascunho/ }) as HTMLButtonElement).disabled).toBe(false)
    expect(document.body.textContent).toContain('está desativado: a variante B ainda não tem thumbnail')
  })
  it('aviso estável: ativar não faz o selo sumir nem refaz a leitura', async () => {
    const ler = vi.fn(async (_id: string, _p?: { V: number }) => ({ ok: true as const, aviso: { estado: 'nao_chega' as const, texto: 'este teste não chega ao volume em 15 dias', dias_previstos: 20, impressoes_dia: 1, n: 1, base_estimada: false } }))
    let fim: (v: Record<string, unknown>) => void = () => undefined
    m.start.mockReturnValue(new Promise(r => { fim = r }))
    montar({ existingDraftId: 'd1', prefill: { testType: 'title', draftVariants: [
      { id: 'va', label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' },
      { id: 'vb', label: 'B', isOriginal: false, thumbUrl: null, titleText: 'Outro' }] }, avisoDeVolume: ler })
    expect(await screen.findByText('Volume insuficiente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Ativar teste/ }))
    await waitFor(() => expect(m.start).toHaveBeenCalled())
    expect(screen.getByText('Volume insuficiente')).toBeTruthy()
    expect(ler).toHaveBeenCalledTimes(1)
    await act(async () => { fim({ ok: true }) })
  })
  it('Foco 5: Esc com o ⓘ aberto fecha só a dica, não o assistente', async () => {
    const onClose = vi.fn()
    montar({ existingDraftId: 'd1', prefill: { testType: 'title', draftVariants: [
      { id: 'va', label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' },
      { id: 'vb', label: 'B', isOriginal: false, thumbUrl: null, titleText: 'Outro' }] } }, onClose)
    const i = await screen.findByRole('button', { name: 'Por que 15 dias' })
    fireEvent.click(i)
    expect(i.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(i.getAttribute('aria-expanded')).toBe('false')
    expect(onClose).not.toHaveBeenCalled()
  })
})
