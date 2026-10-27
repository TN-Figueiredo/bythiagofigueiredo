// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { PainelOQueFica, type AcoesDecisao } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/painel-o-que-fica'
import { painelDoAtivo } from '@/lib/youtube/ab-lab-pagina/painel-decisao'
import type { PainelDecisao } from '@/lib/youtube/ab-lab-pagina/tipos'
import { makeCardView } from './helpers/ab-fixtures'

const refresh = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
const expirou = vi.hoisted(() => ({ valor: false }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog', async importOriginal => {
  const real = await importOriginal<typeof import('@/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog')>()
  return { ...real, sessaoExpirou: async () => expirou.valor }
})

const mk = (id: string, label: 'A' | 'B' | 'C', isOriginal: boolean) => ({ id, label, color: '#000', thumbUrl: `https://img/${label}.jpg`, title: `Título ${label}`, isOriginal })
const vars = [mk('va', 'A', true), mk('vb', 'B', false), mk('vc', 'C', false)]
const card = () => makeCardView({ id: 't1', type: 'title', variants: vars, videoTitle: 'Aladdin', restoreSeq: 7 })
const ctrs = { va: 0.039, vb: 0.052, vc: 0.041 }
const ativoComSug = (noAr = 'B') => painelDoAtivo(card(), { ctrs, noArLetra: noAr, sugeridaId: 'vb', regraV2: true, podeDeixarVariante: true })
const ativoSemSug = (noAr = 'B') => painelDoAtivo(card(), { ctrs: {}, noArLetra: noAr, sugeridaId: null, regraV2: true, podeDeixarVariante: true })

const feitoR: ResultadoAcaoSaida = { ok: true, resultado: 'feito', campos: {} as never }
function acoes(o: Partial<{ [K in keyof AcoesDecisao]: ReturnType<typeof vi.fn> }> = {}) {
  return { encerrar: vi.fn(async () => feitoR), ...o } as unknown as AcoesDecisao & { encerrar: ReturnType<typeof vi.fn>; }
}
function monta(painel: PainelDecisao, a = acoes(), extra: { onAviso?: (t: string) => void } = {}) {
  const onFechar = vi.fn()
  const r = render(<PainelOQueFica painel={painel} acoes={a} onFechar={onFechar} {...extra} />)
  return { a, onFechar, ...r }
}
const radio = (letra: string) => screen.getByRole('radio', { name: `Versão ${letra}` }) as HTMLInputElement
const primario = () => document.querySelector('.lab-acoes .lab-btn.pri') as HTMLElement
const clica = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }

beforeEach(() => { refresh.mockClear(); push.mockClear(); expirou.valor = false })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('Painel "O que fica no vídeo?" (M7 T8)', () => {
  it('ativo: escolher C chama acoes.encerrar(testId, { destino: "variante", varianteId, seqVisto })', async () => {
    const { a } = monta(ativoComSug())
    fireEvent.click(radio('C'))
    await clica(primario())
    expect(a.encerrar).toHaveBeenCalledWith('t1', { destino: 'variante', varianteId: 'vc', seqVisto: 7 })
  })
  it('ativo sem sugerida: nada marcado; "Escolha uma versão" não chama encerrar; marcar C habilita e chama', async () => {
    const { a } = monta(ativoSemSug())
    expect(screen.getAllByRole('radio').filter(r => (r as HTMLInputElement).checked)).toHaveLength(0)
    expect(primario().textContent).toBe('Escolha uma versão')
    expect(primario().getAttribute('aria-disabled')).toBe('true')
    await clica(primario())
    expect(a.encerrar).not.toHaveBeenCalled()
    fireEvent.click(radio('C'))
    expect(primario().textContent).toBe('Encerrar e deixar C no ar')
    expect(primario().getAttribute('aria-disabled')).toBeNull()
    await clica(primario())
    expect(a.encerrar).toHaveBeenCalledWith('t1', { destino: 'variante', varianteId: 'vc', seqVisto: 7 })
  })
  it('aviso "escolher encerra o teste agora" aparece UMA vez (só na faixa), com o dia, com role="status" em UM só', () => {
    const p = { ...ativoSemSug(), diaDeTeto: 'dia 3 de 14' }
    monta(p)
    expect(screen.getByText('Aladdin')).toBeTruthy()
    expect(screen.getAllByText(/encerra o teste agora/)).toHaveLength(1)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(document.querySelector('.lab-acoes')!.contains(screen.getByRole('status'))).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('Escolher encerra o teste agora (dia 3 de 14).')
  })
  it('sem o dia no dado, o aviso fica sem parênteses', () => {
    monta(ativoSemSug())
    expect(screen.getByRole('status').textContent).toBe('Escolher encerra o teste agora.')
  })
  it('ativo com sugerida: B marcada, selo "Sugerida pelo teste", aviso só ao divergir e nota da regra v2', () => {
    monta(ativoComSug())
    expect(radio('B').checked).toBe(true)
    expect(screen.getByText('Sugerida pelo teste')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Encerrar à mão tira o teste da decisão: o resultado não será calculado.')).toBeTruthy()
    fireEvent.click(radio('C'))
    expect(screen.getByRole('status').textContent).toBe('O teste indicou B. Escolher C encerra o teste agora e coloca C no ar.')
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })
  it('ativo: escolher A chama encerrar com { destino: "original", seqVisto }', async () => {
    const { a } = monta(ativoComSug())
    fireEvent.click(radio('A'))
    expect(primario().textContent).toBe('Encerrar e manter A (original)')
    await clica(primario())
    expect(a.encerrar).toHaveBeenCalledWith('t1', { destino: 'original', seqVisto: 7 })
  })
  it('durante Aplicando…: Esc, X, Cancelar e clique no fundo não chamam onFechar', async () => {
    let solta!: (r: ResultadoAcaoSaida) => void
    const a = acoes({ encerrar: vi.fn(() => new Promise<ResultadoAcaoSaida>(res => { solta = res })) })
    const { onFechar } = monta(ativoComSug(), a)
    await clica(primario())
    expect(primario().textContent).toBe('Aplicando…')
    expect(primario().getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('dialog').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText('Mudando no YouTube. Aguarde, não feche esta janela.')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByTestId('painel-fundo'))
    expect(onFechar).not.toHaveBeenCalled()
    await clica(primario()) // segundo clique não reenvia
    expect(a.encerrar).toHaveBeenCalledTimes(1)
    await act(async () => { solta(feitoR) })
    expect(screen.getByText('Feito')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onFechar).toHaveBeenCalledTimes(1)
  })
  it('falha: mostra "Não consegui aplicar C. B continua no ar." com role alert e o botão "Tentar de novo"', async () => {
    const a = acoes({ encerrar: vi.fn(async () => ({ ok: false, resultado: 'erro', error: 'x' }) as ResultadoAcaoSaida) })
    const { onFechar } = monta(ativoComSug('B'), a)
    fireEvent.click(radio('C'))
    await clica(primario())
    const alerta = screen.getByRole('alert')
    expect(alerta.textContent).toBe('Não consegui aplicar C. B continua no ar.')
    expect(document.activeElement).toBe(alerta)
    expect(radio('C').checked).toBe(true)
    expect(primario().textContent).toBe('Tentar de novo')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onFechar).toHaveBeenCalledTimes(1) // sem envio em voo, Esc fecha
  })
  it('ja_encerrado: frase do servidor e "Recarregar" (sai sem a guarda, com refresh)', async () => {
    const a = acoes({ encerrar: vi.fn(async () => ({ ok: false, resultado: 'ja_encerrado', error: 'Este teste já não está neste estado. Recarregue a página.' }) as ResultadoAcaoSaida) })
    const { onFechar } = monta(ativoComSug(), a)
    await clica(primario())
    expect(screen.getByRole('alert').textContent).toContain('Este teste já não está neste estado')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onFechar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }))
    expect(refresh).toHaveBeenCalled()
    expect(onFechar).toHaveBeenCalledTimes(1)
  })
  it('sem_permissao unauthenticated manda para o login', async () => {
    const a = acoes({ encerrar: vi.fn(async () => ({ ok: false, resultado: 'sem_permissao', error: 'unauthenticated' }) as ResultadoAcaoSaida) })
    monta(ativoComSug(), a)
    await clica(primario())
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/cms/login?next='))
  })
  it('rejeição da promessa sem sessão expirada: mensagem de conexão caída; com sessão expirada: Entrar de novo', async () => {
    const a = acoes({ encerrar: vi.fn(async () => { throw new Error('rede') }) })
    monta(ativoComSug(), a)
    await clica(primario())
    expect(screen.getByRole('alert').textContent).toBe('A conexão caiu e não deu para confirmar se mudou. Confira o vídeo no YouTube antes de tentar de novo.')
    expect(primario().textContent).toBe('Tentar de novo')
    cleanup()
    expirou.valor = true
    monta(ativoComSug(), a)
    await clica(primario())
    expect(screen.getByRole('link', { name: 'Entrar de novo' })).toBeTruthy()
  })
  it('precisa_confirmar abre a confirmação (no lugar do painel) e "Aplicar mesmo assim" reenvia com forcar true', async () => {
    const pc: ResultadoAcaoSaida = { ok: true, resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'Editado por fora' }] }
    const a = acoes({ encerrar: vi.fn().mockResolvedValueOnce(pc).mockResolvedValueOnce(feitoR) })
    monta(ativoComSug(), a)
    await clica(primario())
    expect(screen.queryByText('O que fica no vídeo?')).toBeNull()
    expect(screen.getByText('Trocar mesmo assim?')).toBeTruthy()
    await clica(screen.getByRole('button', { name: 'Aplicar mesmo assim' }))
    expect(a.encerrar).toHaveBeenLastCalledWith('t1', { destino: 'variante', varianteId: 'vb', forcar: true, seqVisto: 7 })
    expect(screen.getByText('Feito')).toBeTruthy()
  })
  it('Esc na confirmação volta ao painel e não chama onFechar', async () => {
    const pc: ResultadoAcaoSaida = { ok: true, resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'x' }] }
    const a = acoes({ encerrar: vi.fn(async () => pc) })
    const { onFechar } = monta(ativoComSug(), a)
    fireEvent.click(radio('C'))
    await clica(primario())
    expect(screen.getByText('Trocar mesmo assim?')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByText('O que fica no vídeo?')).toBeTruthy()
    expect(onFechar).not.toHaveBeenCalled()
  })
  it('promessa que resolve em 46 s (fake timers): continua "sem resposta", sem "Feito"', async () => {
    vi.useFakeTimers()
    let solta!: (r: ResultadoAcaoSaida) => void
    const a = acoes({ encerrar: vi.fn(() => new Promise<ResultadoAcaoSaida>(res => { solta = res })) })
    monta(ativoComSug(), a)
    await clica(primario())
    await act(async () => { await vi.advanceTimersByTimeAsync(46_000) })
    expect(screen.getByRole('alert').textContent).toContain('A conexão caiu')
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeTruthy()
    await act(async () => { solta(feitoR) })
    expect(screen.queryByText('Feito')).toBeNull()
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeTruthy()
  })
  it('falha depois de desmontar chama onAviso e não lança', async () => {
    let solta!: (r: ResultadoAcaoSaida) => void
    const a = acoes({ encerrar: vi.fn(() => new Promise<ResultadoAcaoSaida>(res => { solta = res })) })
    const onAviso = vi.fn()
    const { unmount } = monta(ativoComSug('B'), a, { onAviso })
    fireEvent.click(radio('C'))
    await clica(primario())
    unmount()
    await act(async () => { solta({ ok: false, resultado: 'erro', error: 'x' }) })
    await flush()
    expect(onAviso).toHaveBeenCalledWith('Não consegui aplicar C. B continua no ar.')
  })
  it('feito: "Teste encerrado. C no ar desde dd/mm. Você escolheu C; o teste indicava B." e refresh', async () => {
    monta(ativoComSug())
    fireEvent.click(radio('C'))
    await clica(primario())
    const t = screen.getByRole('status').textContent ?? ''
    expect(t).toMatch(/^Teste encerrado\. C no ar desde \d{2}\/\d{2}\. Você escolheu C; o teste indicava B\.$/)
    expect(refresh).toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar' }))
  })
  it('foco inicial: opção marcada, senão a primeira escolhível', async () => {
    monta(ativoComSug())
    await flush()
    await act(async () => { await new Promise(r => requestAnimationFrame(() => r(null))) })
    expect(document.activeElement).toBe(radio('B'))
    cleanup()
    monta(ativoSemSug())
    await act(async () => { await new Promise(r => requestAnimationFrame(() => r(null))) })
    expect(document.activeElement).toBe(radio('A'))
  })
  it('sem permissão de administrar: só a original escolhível e a frase aparece', () => {
    const p = painelDoAtivo(card(), { ctrs, noArLetra: 'B', sugeridaId: null, regraV2: false, podeDeixarVariante: false })
    monta(p)
    expect(radio('A').disabled).toBe(false)
    expect(radio('B').disabled).toBe(true)
    expect(screen.getByText('Só quem administra o site pode deixar uma versão no ar.')).toBeTruthy()
  })
  it('CTR nulo escreve "CTR não medido", nunca 0', () => {
    const { container } = monta(ativoSemSug())
    expect(container.ownerDocument.body.textContent).toContain('CTR não medido')
    expect(container.ownerDocument.body.textContent).not.toMatch(/CTR 0[,.]0/)
  })
})
