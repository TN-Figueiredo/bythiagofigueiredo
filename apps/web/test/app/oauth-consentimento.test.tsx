// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Consentimento } from '@/app/oauth/consentimento/formulario'
import type { DadosDoPedido, EstadoDaTela } from '@/app/oauth/consentimento/tipos'

const ID = 'A'.repeat(43)
const PEDIDO: DadosDoPedido = { ia: 'ChatGPT', email: 'irma@exemplo.com', hora: '11:58', tarde: false, privado: true, valeAte: '11/02/2027', jaConectado: false }
afterEach(cleanup)

const montar = (aprovar = vi.fn(), negar = vi.fn(), inicial: EstadoDaTela | null = null) =>
  render(<Consentimento authorizationId={ID} inicial={inicial} pedido={PEDIDO} aprovar={aprovar} negar={negar} />)

const redirectDoNext = (): Error => Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;https://chatgpt.com/x;303;' })

describe('redirect da action (o Next o entrega ao cliente como exceção)', () => {
  const semAlerta = (): void => {
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  }
  it('Aprovar com redirect: tela de saída, sem erro, sem recarregar', async () => {
    montar(vi.fn(async () => { throw redirectDoNext() }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sim, fui eu. Aprovar' })) })
    semAlerta()
    expect(screen.getByText('Voltando ao ChatGPT...')).toBeTruthy()
    expect(screen.getByText('Pronto. O ChatGPT está conectado.')).toBeTruthy()
    expect(screen.queryByText(/Não deu para conectar/)).toBeNull()
  })
  it('Não conectar com redirect: "Conexão negada.", sem erro', async () => {
    montar(vi.fn(), vi.fn(async () => { throw redirectDoNext() }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Não conectar' })) })
    semAlerta()
    expect(screen.getByText('Conexão negada.')).toBeTruthy()
    expect(screen.queryByText(/Não deu para conectar/)).toBeNull()
  })
  it('controle: falha real (rede) continua virando erro c1-sem-resposta', async () => {
    montar(vi.fn(async () => { throw new Error('rede') }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sim, fui eu. Aprovar' })) })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('c1-sem-resposta')).toBeTruthy()
  })
})

describe('formulário de consentimento', () => {
  it('leva o authorization_id num input hidden', () => {
    const { container } = montar()
    expect(container.querySelector('input[type="hidden"][name="authorization_id"]')?.getAttribute('value')).toBe(ID)
  })

  it('hidratado: os dois botões habilitam (o efeito já rodou no render do teste)', () => {
    montar()
    expect((screen.getByRole('button', { name: 'Sim, fui eu. Aprovar' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Não conectar' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('antes do efeito de hidratação os dois botões estão disabled (HTML do servidor)', async () => {
    const { renderToString } = await import('react-dom/server')
    const html = renderToString(<Consentimento authorizationId={ID} inicial={null} pedido={PEDIDO} aprovar={vi.fn()} negar={vi.fn()} />)
    const botoes = html.match(/<button[^>]*>/g)?.filter((b) => b.includes('type="button"')) ?? []
    expect(botoes).toHaveLength(2)
    for (const b of botoes) expect(b).toContain('disabled')
  })

  it('clique em Aprovar: q1e com aria-busy, "Aprovando...", status para leitor de tela e botões travados', async () => {
    const aprovar = vi.fn(() => new Promise<EstadoDaTela>(() => {}))
    const { container } = montar(aprovar)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sim, fui eu. Aprovar' })) })
    expect(aprovar).toHaveBeenCalledTimes(1)
    expect((aprovar.mock.calls[0] as unknown as [FormData])[0].get('authorization_id')).toBe(ID)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Aprovando...')
    expect((screen.getByRole('button', { name: 'Aprovando...' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Não conectar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a action devolve um estado: troca o cartão e o foco vai ao h1', async () => {
    const aprovar = vi.fn(async (): Promise<EstadoDaTela> => ({ estado: 'sem_direito' }))
    montar(aprovar)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sim, fui eu. Aprovar' })) })
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('Não foi possível conectar.')
    expect(document.activeElement).toBe(h1)
    expect(screen.getByText('Esta conta não tem acesso a esta área.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Voltar ao ChatGPT' })).toBeTruthy()
  })

  it('"Voltar ao ChatGPT" nega o pedido', async () => {
    const negar = vi.fn(async (): Promise<EstadoDaTela> => ({ estado: 'sem_direito' }))
    montar(vi.fn(), negar, { estado: 'sem_direito' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Voltar ao ChatGPT' })) })
    expect(negar).toHaveBeenCalledTimes(1)
  })

  it('action que lança: estado de erro com código', async () => {
    montar(vi.fn(async () => { throw new Error('x') }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sim, fui eu. Aprovar' })) })
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Não deu para conectar agora.')
  })

  it('sem_login: botão Entrar leva ao login com o mesmo next', () => {
    montar(vi.fn(), vi.fn(), { estado: 'sem_login' })
    expect((screen.getByRole('link', { name: 'Entrar' }) as HTMLAnchorElement).getAttribute('href')).toBe(`/cms/login?next=%2Foauth%2Fconsentimento%3Fauthorization_id%3D${ID}`)
  })
})

describe('ícones da tela (T22 emenda): svg do lucide, nunca emoji', () => {
  it('pedido: selo, listas, risco e alerta usam svg aria-hidden', () => {
    const { container } = montar()
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(10)
    expect(container.querySelector('.badge svg')).not.toBeNull()
    expect(container.querySelectorAll('.lists .ok').length).toBe(2)
    expect(container.querySelectorAll('.lists .no').length).toBe(2)
    expect(container.querySelector('.alert svg')).not.toBeNull()
    for (const svg of Array.from(container.querySelectorAll('svg'))) expect(svg.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(container.textContent).not.toMatch(/[🔒✋⏻◷⊘✓✕]/u)
  })
  it('estado: o selo é svg', () => {
    const { container } = montar(vi.fn(), vi.fn(), { estado: 'cortado' })
    expect(container.querySelector('.badge svg')).not.toBeNull()
    expect(container.querySelector('.badge')?.textContent).toBe('')
  })
  it('ja_conectado vem antes de "Você entrou como" e fora do aviso', () => {
    const { container } = render(<Consentimento authorizationId={ID} inicial={null} pedido={{ ...PEDIDO, jaConectado: true }} aprovar={vi.fn()} negar={vi.fn()} />)
    const t = container.textContent ?? ''
    expect(t).toContain('Você já conectou o ChatGPT antes. Se aprovar, a conexão antiga para de funcionar e vale esta.')
    expect(t.indexOf('já conectou')).toBeLessThan(t.indexOf('Você entrou como'))
  })
  it('outro_navegador: título e texto novos', () => {
    montar(vi.fn(), vi.fn(), { estado: 'outro_navegador' })
    expect(screen.getByText('Este pedido não vale mais.')).toBeTruthy()
    expect(screen.getByText('Volte à sua IA e toque em Conectar de novo. Faça tudo neste mesmo navegador, sem abrir outra aba.')).toBeTruthy()
  })
})
