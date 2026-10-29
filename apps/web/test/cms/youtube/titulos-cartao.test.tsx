// @vitest-environment jsdom
// F4 T9: a seção "Ideias de título pela forja" no cartão aberto. Os estados do mockup; recusado SEMPRE com o motivo; sem admin não há botão.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const nav = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh, replace: vi.fn(), push: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ children, href, ...r }: { children: React.ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))

import { TitulosDoCartao } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/titulos-cartao'
import { fraseDoDescarte, type TitulosDaVista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/titulos'
import type { RespostaDoPedidoDeTitulos } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/tipos'
import type { ParDeTitulos } from '@/lib/youtube/observatorio/sinais/titulos-complementares/ler'

afterEach(() => { cleanup(); vi.useRealTimers(); nav.refresh.mockClear() })

const SINAL = 'aaaaaaaa-0000-4000-8000-000000000001'
const V1 = 'bbbbbbbb-0000-4000-8000-000000000001'
const V2 = 'bbbbbbbb-0000-4000-8000-000000000002'
const vista = (o: Partial<TitulosDaVista> & { par?: ParDeTitulos | null; dois?: boolean } = {}): TitulosDaVista => ({
  sinalId: SINAL, leitura: 'ok', sabePedir: true, lugar: 'Japão', total: o.dois ? 2 : 1,
  videos: [{ id: V1, titulo: 'Japão: 15 dias de roteiro', par: o.par ?? null }, ...(o.dois ? [{ id: V2, titulo: 'Tóquio em 3 dias', par: null }] : [])],
  ...(o.leitura ? { leitura: o.leitura } : {}), ...(o.sabePedir !== undefined ? { sabePedir: o.sabePedir } : {}),
})
const ok = (): Promise<RespostaDoPedidoDeTitulos> => Promise.resolve({ ok: true })
const acoes = (pedir = vi.fn(ok), cancelar = vi.fn(ok)) => ({ pedirTitulos: pedir, cancelarTitulos: cancelar })
const quando = '2026-10-29T22:59:00Z' // 19h59 em São Paulo

describe('TitulosDoCartao', () => {
  it('o botão some sem permissão de admin (sem a ação por prop); sem pedido nenhum a seção nem aparece', () => {
    const { container } = render(<TitulosDoCartao titulos={vista()} acoes={null} />)
    expect(container.querySelector('.sg-tit')).toBeNull()
    expect(screen.queryByText('Pedir 5 títulos à forja')).toBeNull()
  })
  it('sem admin, o resultado que já existe continua visível (pronto, só leitura), sem "Pedir de novo"', () => {
    render(<TitulosDoCartao titulos={vista({ par: { own_video_id: V1, estado: 'pronto', titulos: ['A', 'B'], gerado_em: quando } })} acoes={null} />)
    expect(screen.getByText('2 ideias de título para “Japão: 15 dias de roteiro”')).toBeTruthy()
    expect(screen.queryByText('Pedir de novo')).toBeNull()
  })
  it('com admin: botão do mockup; pedir chama a ação com o vídeo e o sinal e mostra "Na fila"', async () => {
    const pedir = vi.fn(ok)
    render(<TitulosDoCartao titulos={vista()} acoes={acoes(pedir)} />)
    expect(screen.getByText('para “Japão: 15 dias de roteiro”')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByText('Pedir 5 títulos à forja')) })
    expect(pedir).toHaveBeenCalledExactlyOnceWith(V1, SINAL)
    expect(screen.getByText(/Pedido às \d\dh\d\d\. A forja passa a cada 10 minutos/)).toBeTruthy()
    expect(screen.getByLabelText('Etapas do pedido').querySelector('[aria-current="step"]')!.textContent).toContain('Na fila')
    expect(nav.refresh).toHaveBeenCalled()
  })
  it('forja sem a capacidade: botão desabilitado (aria-disabled), frase do mockup, e o clique não envia nada', async () => {
    const pedir = vi.fn(ok)
    render(<TitulosDoCartao titulos={vista({ sabePedir: false })} acoes={acoes(pedir)} />)
    const b = screen.getByText('Pedir 5 títulos à forja')
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('A forja ainda não sabe fazer este pedido: o kit dela precisa ser atualizado. Nada foi enviado.')).toBeTruthy()
    await act(async () => { fireEvent.click(b) })
    expect(pedir).not.toHaveBeenCalled()
  })
  it('recusado pelo validador: faixa com o MOTIVO, "Nada foi mostrado", e "Pedir de novo"; nunca lista vazia calada', () => {
    for (const [motivo, trecho] of [['demais', 'mandou mais de 5'], ['longo', 'passou de 100 caracteres'], ['repetido', 'repetiu um título que já existe'], ['numero_fora', 'usou um número que não está nos dados']] as const) {
      const { unmount, container } = render(<TitulosDoCartao titulos={vista({ par: { own_video_id: V1, estado: 'recusado', motivo, pedido_em: quando } })} acoes={acoes()} />)
      expect(container.querySelector('[role="alert"]')!.textContent).toContain(`A forja descartou os títulos: `)
      expect(container.querySelector('[role="alert"]')!.textContent).toContain(trecho)
      expect(container.querySelector('[role="alert"]')!.textContent).toContain('Nada foi mostrado.')
      expect(container.querySelector('.sg-ol-list')).toBeNull()
      expect(screen.getByText('Pedir de novo')).toBeTruthy()
      expect(container.textContent).not.toMatch(/validador|conferência/i)
      unmount()
    }
  })
  it('0 títulos válidos: diz que a forja não devolveu nenhum título válido', () => {
    const { container } = render(<TitulosDoCartao titulos={vista({ par: { own_video_id: V1, estado: 'recusado', motivo: 'vazio', pedido_em: quando } })} acoes={acoes()} />)
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('A forja não devolveu nenhum título válido.')
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('Peça de novo')
  })
  it('motivo desconhecido ainda diz algo (nunca vazio)', () => {
    expect(fraseDoDescarte('outro').titulo).toMatch(/^A forja descartou os títulos: .+\.$/)
  })
  it('pronto: até 5 com contagem n/100, "Copiar" e o aviso "ideias, não cópia"', async () => {
    const titulos = ['Um título', 'Dois', 'Três', 'Quatro', 'Cinco']
    const escrever = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true })
    const { container } = render(<TitulosDoCartao titulos={vista({ par: { own_video_id: V1, estado: 'pronto', titulos, gerado_em: quando } })} acoes={acoes()} />)
    expect(screen.getByText('5 ideias de título para “Japão: 15 dias de roteiro”')).toBeTruthy()
    expect(screen.getByText('Ideias para partir, não para copiar: confira se não repete o título dele.')).toBeTruthy()
    expect(container.querySelectorAll('.sg-ti')).toHaveLength(5)
    expect(container.querySelector('.sg-ti .sg-n')!.textContent).toBe('9/100')
    await act(async () => { fireEvent.click(screen.getByLabelText('Copiar título 2')) })
    expect(escrever).toHaveBeenCalledWith('Dois')
    expect(screen.getByLabelText('Copiar título 2').textContent).toBe('Copiado')
  })
  it('sem área de transferência: "Selecionado" e a instrução Ctrl+C', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('negado') } }, configurable: true })
    render(<TitulosDoCartao titulos={vista({ par: { own_video_id: V1, estado: 'pronto', titulos: ['A'], gerado_em: quando } })} acoes={acoes()} />)
    await act(async () => { fireEvent.click(screen.getByLabelText('Copiar título 1')) })
    expect(screen.getByText('Selecionado: use Ctrl+C.')).toBeTruthy()
  })
  it('na fila: etapas, hora do pedido e "Cancelar pedido" (que chama a ação)', async () => {
    const cancelar = vi.fn(ok)
    render(<TitulosDoCartao titulos={vista({ par: { own_video_id: V1, estado: 'fila', pedido_em: quando } })} acoes={acoes(vi.fn(ok), cancelar)} />)
    expect(screen.getByText('Pedido às 19h59. A forja passa a cada 10 minutos; pode sair da página.')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByText('Cancelar pedido')) })
    expect(cancelar).toHaveBeenCalledExactlyOnceWith(V1, SINAL)
    expect(screen.getByText('Pedir 5 títulos à forja')).toBeTruthy() // voltou ao começo
  })
  it('gerando: sem "Cancelar" (a máquina já pegou); forja parada: pedido guardado, desde a hora, com Cancelar', () => {
    const { unmount } = render(<TitulosDoCartao titulos={vista({ par: { own_video_id: V1, estado: 'gerando', pedido_em: quando } })} acoes={acoes()} />)
    expect(screen.getByText('A forja está escrevendo os títulos. Pode sair da página: o pedido continua.')).toBeTruthy()
    expect(screen.queryByText('Cancelar pedido')).toBeNull()
    unmount()
    render(<TitulosDoCartao titulos={vista({ par: { own_video_id: V1, estado: 'parada', pedido_em: quando, parada_desde: '2026-10-29T17:10:00Z' } })} acoes={acoes()} />)
    expect(screen.getByText('Pedido guardado às 19h59. A forja está parada desde 14h10; o pedido sai quando ela voltar.')).toBeTruthy()
    expect(screen.getByText('Cancelar pedido')).toBeTruthy()
  })
  it('enquanto espera, a tela se atualiza sozinha a cada 20 s', () => {
    vi.useFakeTimers()
    render(<TitulosDoCartao titulos={vista({ par: { own_video_id: V1, estado: 'fila', pedido_em: quando } })} acoes={acoes()} />)
    act(() => { vi.advanceTimersByTime(40_000) })
    expect(nav.refresh).toHaveBeenCalledTimes(2)
  })
  it('recusa do motor volta com a frase dele; conexão caída diz que nada foi guardado', async () => {
    const recusa = vi.fn(async (): Promise<RespostaDoPedidoDeTitulos> => ({ ok: false, motivo: 'recusado', texto: 'Nada enviado: já há um pedido de títulos para este vídeo e este sinal.' }))
    const { unmount } = render(<TitulosDoCartao titulos={vista()} acoes={acoes(recusa)} />)
    await act(async () => { fireEvent.click(screen.getByText('Pedir 5 títulos à forja')) })
    expect(screen.getByRole('alert').textContent).toContain('Nada enviado: já há um pedido')
    unmount()
    render(<TitulosDoCartao titulos={vista()} acoes={acoes(vi.fn(async () => { throw new Error('rede') }))} />)
    await act(async () => { fireEvent.click(screen.getByText('Pedir 5 títulos à forja')) })
    expect(screen.getByRole('alert').textContent).toContain('a conexão caiu. Nada foi guardado.')
    expect(screen.getByText('Tentar de novo')).toBeTruthy()
  })
  it('leitura falhou: diz que não deu para ler e não oferece o botão', () => {
    const { container } = render(<TitulosDoCartao titulos={vista({ leitura: 'erro' })} acoes={acoes()} />)
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('Não deu para ler os pedidos de título agora.')
    expect(screen.queryByText('Pedir 5 títulos à forja')).toBeNull()
  })
  it('2 vídeos seus: escolhe pelo rádio e pede para o escolhido', async () => {
    const pedir = vi.fn(ok)
    render(<TitulosDoCartao titulos={vista({ dois: true })} acoes={acoes(pedir)} />)
    expect(screen.getByText('Pedir títulos para um vídeo seu. Seus vídeos sobre Japão:')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Tóquio em 3 dias'))
    await act(async () => { fireEvent.click(screen.getByText('Pedir 5 títulos à forja')) })
    expect(pedir).toHaveBeenCalledWith(V2, SINAL)
  })
})
