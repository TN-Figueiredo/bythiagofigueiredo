// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { AbEndTestDialog, fraseDoAviso, cancelarFocoDaFaixa, type AbEndTestDialogProps } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog'
import { dadosDoDialogoEncerrar, originalBaixaResolucao } from '@/app/cms/(authed)/youtube/ab-lab/_components/encerrar-props'

const MSG_EM_ANDAMENTO = 'Outra tentativa está em andamento. Tente de novo em instantes.'
const opcoes = [
  { id: 'v1', rotulo: 'A (original)', isOriginal: true, titulo: 'Título original', miniatura: 'https://x/a.jpg' },
  { id: 'v2', rotulo: 'B', isOriginal: false, titulo: 'Título de B', miniatura: 'https://x/b.jpg' },
  { id: 'v3', rotulo: 'C', isOriginal: false, titulo: 'Título de C', miniatura: 'https://x/c.jpg' },
]
let encerrar: ReturnType<typeof vi.fn<(o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>>>
let onFechar: ReturnType<typeof vi.fn>
let onAviso: ReturnType<typeof vi.fn>

function props(over: Partial<AbEndTestDialogProps> = {}): AbEndTestDialogProps {
  return {
    aberto: true, onFechar, testeNome: 'Teste', noArAgora: { rotulo: 'C', desde: '07/10 05:00' }, opcoes,
    originalBaixaResolucao: false, podeDeixarVariante: true, encerrar, onAviso, ...over,
  }
}
const feito = (campos: Record<string, { estado: string }>): ResultadoAcaoSaida =>
  ({ ok: true, resultado: 'feito', campos: campos as never })
const marcarB = () => userEvent.click(screen.getByLabelText(/Variante B/))
const clicarEncerrar = () => userEvent.click(screen.getByRole('button', { name: /^Encerrar e ficar com/ }))

beforeEach(() => {
  encerrar = vi.fn()
  onFechar = vi.fn()
  onAviso = vi.fn()
  router.refresh.mockClear(); router.push.mockClear()
})
afterEach(() => { cleanup(); cancelarFocoDaFaixa(); vi.useRealTimers() })

describe('AbEndTestDialog: escolha', () => {
  it('E1: nenhuma opção marcada, botão aria-disabled com "Escolha uma opção."; clicar não chama encerrar', async () => {
    render(<AbEndTestDialog {...props()} />)
    const b = screen.getByRole('button', { name: /Escolha uma opção|Encerrar/ })
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Escolha uma opção.')).toBeTruthy()
    await userEvent.click(b)
    expect(encerrar).not.toHaveBeenCalled()
    expect(screen.getAllByRole('radio').every(r => !(r as HTMLInputElement).checked)).toBe(true)
  })

  it('E2: marcar B muda o botão para "Encerrar e ficar com B"; original -> "Encerrar e ficar com A (original)"', async () => {
    render(<AbEndTestDialog {...props()} />)
    await marcarB()
    expect(screen.getByRole('button', { name: 'Encerrar e ficar com B' })).toBeTruthy()
    await userEvent.click(screen.getByLabelText(/A \(original\)/))
    expect(screen.getByRole('button', { name: 'Encerrar e ficar com A (original)' })).toBeTruthy()
  })

  it('estrutura: dialog nomeado por "Encerrar teste", descrito pela frase, fieldset com legend, selo "no ar agora"', () => {
    render(<AbEndTestDialog {...props()} />)
    const d = screen.getByRole('dialog', { name: 'Encerrar teste' })
    expect(d.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(d.getAttribute('aria-describedby')!)!.textContent).toBe('A rotação para. No ar agora: variante C, desde 07/10 05:00.')
    expect(screen.getByRole('group', { name: 'O que fica no vídeo?' })).toBeTruthy()
    expect(screen.getAllByText('no ar agora')).toHaveLength(1)
  })

  it('aviso de baixa resolução só quando a prop liga', () => {
    const { rerender } = render(<AbEndTestDialog {...props()} />)
    expect(screen.queryByText('O original foi guardado em baixa resolução.')).toBeNull()
    rerender(<AbEndTestDialog {...props({ originalBaixaResolucao: true })} />)
    expect(screen.getByText('O original foi guardado em baixa resolução.')).toBeTruthy()
    expect(screen.getByText('Baixa resolução')).toBeTruthy()
  })

  it('E8: sem permissão -> variantes desabilitadas com a frase, original já marcado; miniatura quebrada mostra "Sem imagem"', () => {
    render(<AbEndTestDialog {...props({ podeDeixarVariante: false })} />)
    expect(screen.getByLabelText(/Variante B/)).toHaveProperty('disabled', true)
    expect(screen.getByLabelText(/Variante C/)).toHaveProperty('disabled', true)
    expect(screen.getByText(/Só quem administra o site pode deixar uma variante no ar\. Você pode voltar ao original\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Encerrar e ficar com A (original)' })).toBeTruthy()
    expect(screen.queryByText('Sem imagem')).toBeNull()
    fireEvent.error(document.querySelector('img')!)
    expect(screen.getByText('Sem imagem')).toBeTruthy()
  })

  it('E14: nenhum texto antigo', () => {
    render(<AbEndTestDialog {...props()} />)
    expect(document.body.textContent).not.toMatch(/Aplicar variante l[ií]der|Arquivar sem aplicar|Aplicar vencedor|Cancelar carência/)
  })

  it('foco inicial do Encerrar em Cancelar, não no X (Gio)', async () => {
    render(<AbEndTestDialog {...props()} />)
    await act(async () => {})
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }))
  })

  it('Esc fecha; o foco volta ao botão que abriu; Cancelar e X também fecham', async () => {
    const abrir = document.createElement('button')
    document.body.appendChild(abrir); abrir.focus()
    const { unmount } = render(<AbEndTestDialog {...props()} />)
    await userEvent.keyboard('{Escape}')
    expect(onFechar).toHaveBeenCalledTimes(1)
    unmount()
    expect(document.activeElement).toBe(abrir)
    abrir.remove()
    render(<AbEndTestDialog {...props()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onFechar).toHaveBeenCalledTimes(3)
  })
})

describe('AbEndTestDialog: envio', () => {
  it('E3: duplo clique -> encerrar chamado uma vez; 45 s sem resposta -> "Sem resposta" e nenhum botão Encerrar', async () => {
    vi.useFakeTimers()
    encerrar.mockReturnValue(new Promise(() => {}))
    render(<AbEndTestDialog {...props()} />)
    fireEvent.click(screen.getByLabelText(/Variante B/))
    const b = screen.getByRole('button', { name: 'Encerrar e ficar com B' })
    fireEvent.click(b); fireEvent.click(b)
    expect(encerrar).toHaveBeenCalledTimes(1)
    expect(encerrar).toHaveBeenCalledWith({ destino: 'variante', varianteId: 'v2' })
    expect(screen.getByRole('button', { name: 'Encerrando…' }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Trocando título e miniatura no YouTube')).toBeTruthy()
    expect(screen.getByText(/Pode levar até 1 minuto\. Se fechar, o resultado aparece no topo da página\./)).toBeTruthy()
    await act(async () => { vi.advanceTimersByTime(44_999) })
    expect(screen.queryByText('Sem resposta')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(2) })
    expect(screen.getByText('Sem resposta')).toBeTruthy()
    expect(screen.getByText('Não sabemos se o encerramento foi feito. Recarregue a página para ver o resultado.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(2) // o X e o botão
    expect(screen.queryByRole('button', { name: /Encerrar/ })).toBeNull()
  })

  it('D2: sessão expirada (a ação rejeita e a página redireciona) -> "Sessão expirada" com link ao login com next, não "Sem resposta"', async () => {
    encerrar.mockRejectedValue(new Error('An unexpected response was received from the server.'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ type: 'opaqueredirect', status: 0 }))
    window.history.pushState({}, '', '/cms/youtube/ab-lab/abc?x=1')
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect(await screen.findByText('Sessão expirada')).toBeTruthy()
    expect(screen.getByText('Sua sessão expirou. Entre de novo para encerrar o teste.')).toBeTruthy()
    expect(screen.queryByText('Sem resposta')).toBeNull()
    expect(screen.getByRole('link', { name: 'Entrar de novo' }).getAttribute('href')).toBe(`/cms/login?next=${encodeURIComponent('/cms/youtube/ab-lab/abc?x=1')}`)
    vi.unstubAllGlobals()
  })

  it('rede caída (a ação rejeita) -> "Sem resposta", sem repetir Encerrar', async () => {
    encerrar.mockRejectedValue(new Error('rede'))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect(await screen.findByText('Sem resposta')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Encerrar e ficar/ })).toBeNull()
    vi.unstubAllGlobals()
  })

  it('enviando: X e Esc seguem livres, Cancelar travado', async () => {
    encerrar.mockReturnValue(new Promise(() => {}))
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', true)
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onFechar).toHaveBeenCalledTimes(2)
  })

  it('original envia destino original', async () => {
    encerrar.mockResolvedValue(feito({ title: { estado: 'ok' }, thumbnail: { estado: 'ok' } }))
    render(<AbEndTestDialog {...props()} />)
    await userEvent.click(screen.getByLabelText(/A \(original\)/)); await clicarEncerrar()
    expect(encerrar).toHaveBeenCalledWith({ destino: 'original' })
  })

  it('feito com tudo ok -> fecha e atualiza a página, sem aviso', async () => {
    encerrar.mockResolvedValue(feito({ title: { estado: 'ok' }, thumbnail: { estado: 'ok' } }))
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(onFechar).toHaveBeenCalledTimes(1)
    expect(onAviso).not.toHaveBeenCalled()
  })

  it('E5: em_andamento -> mensagem exata, B continua marcada, o diálogo não fecha', async () => {
    encerrar.mockResolvedValue({ ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO })
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect(await screen.findByText(MSG_EM_ANDAMENTO)).toBeTruthy()
    expect(screen.getByText('Não foi possível encerrar')).toBeTruthy()
    expect((screen.getByLabelText(/Variante B/) as HTMLInputElement).checked).toBe(true)
    expect(onFechar).not.toHaveBeenCalled()
  })

  it('erro mostrado como erro, nunca como sucesso (sem refresh, sem fechar)', async () => {
    encerrar.mockResolvedValue({ ok: false, resultado: 'erro', error: 'Falhou feio.' })
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect(await screen.findByText('Falhou feio.')).toBeTruthy()
    expect(router.refresh).not.toHaveBeenCalled()
    expect(onFechar).not.toHaveBeenCalled()
  })

  it('ja_encerrado -> fecha e atualiza a página', async () => {
    encerrar.mockResolvedValue({ ok: false, resultado: 'ja_encerrado', error: 'x' })
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('unauthenticated -> router.push para o login; nada de aviso nem refresh', async () => {
    encerrar.mockResolvedValue({ ok: false, resultado: 'sem_permissao', error: 'unauthenticated' })
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/cms\/login\?next=/))
    expect(router.refresh).not.toHaveBeenCalled()
    expect(onAviso).not.toHaveBeenCalled()
  })

  it('aviso de página por campo recusado: título, thumbnail e os dois', async () => {
    const casos: Array<[Array<'title' | 'thumbnail'>, string]> = [
      [['title'], 'do título'], [['thumbnail'], 'da miniatura'], [['title', 'thumbnail'], 'do título e da miniatura'],
    ]
    for (const [campos, frase] of casos) {
      cleanup(); onAviso.mockClear()
      encerrar.mockResolvedValueOnce(feito(Object.fromEntries(campos.map(c => [c, { estado: 'falhou' }]))))
      render(<AbEndTestDialog {...props()} />)
      await marcarB(); await clicarEncerrar()
      expect(onAviso).toHaveBeenCalledWith(`Teste encerrado. O YouTube recusou a troca ${frase}: veja o aviso no topo.`)
      expect(fraseDoAviso(campos)).toContain(frase)
    }
  })

  it('Y-B2: resultado parcial só fala do campo recusado, nunca "voltou ao original"', async () => {
    encerrar.mockResolvedValue(feito({ title: { estado: 'ok' }, thumbnail: { estado: 'pulado_drift' } }))
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    const frase = onAviso.mock.calls[0]![0] as string
    expect(frase).toContain('da miniatura')
    expect(frase).not.toContain('título')
    expect(frase).not.toMatch(/voltou ao original/)
  })

  it('feito com campo falhou: ainda fecha e atualiza a página (a faixa mostra a verdade)', async () => {
    encerrar.mockResolvedValue(feito({ title: { estado: 'falhou' } }))
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(onFechar).toHaveBeenCalledTimes(1)
  })
})

describe('AbEndTestDialog: precisa_confirmar', () => {
  const pc = (campos: Array<{ campo: 'title' | 'thumbnail'; valor_atual: string }>): ResultadoAcaoSaida =>
    ({ ok: true, resultado: 'precisa_confirmar', campos })

  it('E7: alertdialog com foco em Voltar; Voltar mantém B; Trocar envia forcar: true; a 1ª chamada nunca força', async () => {
    encerrar.mockResolvedValueOnce(pc([{ campo: 'title', valor_atual: 'Título por fora' }]))
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    const d = await screen.findByRole('alertdialog', { name: 'Trocar mesmo assim?' })
    expect(document.activeElement).toBe(within(d).getByRole('button', { name: 'Cancelar' }))
    expect(within(d).getByText('Título por fora')).toBeTruthy()
    expect(within(d).getByText('Título de B')).toBeTruthy()
    expect(within(d).getByText('O título no YouTube não é de nenhuma versão: alguém editou por fora.')).toBeTruthy()
    await userEvent.click(within(d).getByRole('button', { name: 'Cancelar' }))
    expect((screen.getByLabelText(/Variante B/) as HTMLInputElement).checked).toBe(true)
    expect(encerrar).toHaveBeenCalledTimes(1)
    encerrar.mockResolvedValueOnce(pc([{ campo: 'title', valor_atual: 'Título por fora' }]))
    await clicarEncerrar()
    const d2 = await screen.findByRole('alertdialog')
    encerrar.mockResolvedValueOnce(feito({ title: { estado: 'ok' } }))
    await userEvent.click(within(d2).getByRole('button', { name: 'Trocar pelo título de B e encerrar' }))
    expect(encerrar).toHaveBeenLastCalledWith({ destino: 'variante', varianteId: 'v2', forcar: true })
    expect((encerrar.mock.calls[0]![0] as { forcar?: boolean }).forcar).not.toBe(true)
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it('thumbnail: botão e frase próprios, imagens pela URL', async () => {
    encerrar.mockResolvedValueOnce(pc([{ campo: 'thumbnail', valor_atual: 'https://yt/fora.jpg' }]))
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    const d = await screen.findByRole('alertdialog')
    expect(within(d).getByRole('button', { name: 'Trocar pela miniatura de B e encerrar' })).toBeTruthy()
    expect(within(d).getByAltText('Miniatura editada por fora').getAttribute('src')).toBe('https://yt/fora.jpg')
    expect(within(d).getByAltText('Miniatura da versão B').getAttribute('src')).toBe('https://x/b.jpg')
  })

  it('os dois campos: um só diálogo, um só botão', async () => {
    encerrar.mockResolvedValueOnce(pc([{ campo: 'title', valor_atual: 'T fora' }, { campo: 'thumbnail', valor_atual: 'https://yt/fora.jpg' }]))
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    const d = await screen.findByRole('alertdialog')
    expect(within(d).getByRole('button', { name: 'Trocar título e miniatura por B e encerrar' })).toBeTruthy()
    expect(within(d).getByText('O título e a miniatura no YouTube não são de nenhuma versão: alguém editou os dois por fora.')).toBeTruthy()
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
  })
})

describe('encerrar-props', () => {
  it('Phil: "1280x720" não avisa, "480x360" avisa, null avisa (e ilegível também)', () => {
    expect(originalBaixaResolucao('1280x720')).toBe(false)
    expect(originalBaixaResolucao('480x360')).toBe(true)
    expect(originalBaixaResolucao(null)).toBe(true)
    expect(originalBaixaResolucao(undefined)).toBe(true)
    expect(originalBaixaResolucao('lixo')).toBe(true)
  })

  it('monta opções com original primeiro, título do vídeo quando a variante não tem, e "desde" em São Paulo', () => {
    const d = dadosDoDialogoEncerrar({
      videoTitle: 'Vídeo', activeNow: 'B', noArAgora: { label: 'B', desde: '2026-10-07T08:00:00Z' },
      variantDb: [
        { id: 'v2', label: 'B', is_original: false, blob_url: null, title_text: null, dimensions: null },
        { id: 'v1', label: 'A', is_original: true, blob_url: 'u', title_text: 'Orig', dimensions: '1280x720' },
      ],
    })
    expect(d.opcoes.map(o => o.rotulo)).toEqual(['A (original)', 'B'])
    expect(d.opcoes[1]!.titulo).toBe('Vídeo')
    expect(d.noArAgora).toEqual({ rotulo: 'B', desde: '07/10 05:00' })
    expect(d.originalBaixaResolucao).toBe(false)
  })
})

describe('guarda do Opera', () => {
  const dir = join(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components')
  for (const f of ['faixa-restauracao.css', 'faixa-restauracao.tsx', 'ab-end-test-dialog.css', 'ab-end-test-dialog.tsx', 'ab-confirmar-troca-dialog.tsx', 'ab-pause-dialog.tsx']) {
    it(`${f}: nenhum color-mix() em cor que carrega sentido`, () => {
      expect(readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/color-mix\s*\(/)
    })
  }
})


// ---- Tarefa 15, rodada 1 (Yannis D1, D3, D4, D5, P1) ----
import { useState as useStateR1 } from 'react'

describe('T15 r1', () => {
  const pc = (campos: Array<{ campo: 'title' | 'thumbnail'; valor_atual: string }>): ResultadoAcaoSaida =>
    ({ ok: true, resultado: 'precisa_confirmar', campos })

  /** Pai que re-renderiza (como o poll de 60 s) passando `onFechar` novo a cada render. */
  function Pai({ expor }: { expor: (bump: () => void) => void }) {
    const [n, setN] = useStateR1(0)
    expor(() => setN(x => x + 1))
    void n
    return <AbEndTestDialog {...props({ onFechar: () => { onFechar() } })} />
  }

  it('D1: re-render do pai com onFechar novo não tira o foco da opção B nem de "Voltar"', async () => {
    let bump: () => void = () => {}
    render(<Pai expor={b => { bump = b }} />)
    await marcarB()
    const radio = screen.getByLabelText(/Variante B/)
    radio.focus()
    act(() => bump())
    expect(document.activeElement).toBe(radio)
    encerrar.mockResolvedValueOnce(pc([{ campo: 'title', valor_atual: 'Por fora' }]))
    await clicarEncerrar()
    const d = await screen.findByRole('alertdialog')
    const voltar = within(d).getByRole('button', { name: 'Cancelar' })
    expect(document.activeElement).toBe(voltar)
    act(() => bump())
    expect(document.activeElement).toBe(voltar)
  })

  it('D3: fechar no meio e o servidor devolver precisa_confirmar -> aviso de página e refresh', async () => {
    let resolver: (r: ResultadoAcaoSaida) => void = () => {}
    encerrar.mockReturnValue(new Promise<ResultadoAcaoSaida>(res => { resolver = res }))
    const { rerender } = render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    rerender(<div />) // o pai fechou e desmontou o diálogo
    await act(async () => { resolver(pc([{ campo: 'title', valor_atual: 'Por fora' }])) })
    expect(onAviso).toHaveBeenCalledTimes(1)
    expect(onAviso.mock.calls[0]![0]).toMatch(/^O teste ainda não foi encerrado: o título ou a miniatura foi alterado no YouTube por fora\. Clique em Encerrar de novo/)
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it('D3: fechar no meio e vir em_andamento -> aviso com a mensagem do servidor', async () => {
    let resolver: (r: ResultadoAcaoSaida) => void = () => {}
    encerrar.mockReturnValue(new Promise<ResultadoAcaoSaida>(res => { resolver = res }))
    const { rerender } = render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    rerender(<div />)
    await act(async () => { resolver({ ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO }) })
    expect(onAviso).toHaveBeenCalledWith(`O teste ainda não foi encerrado: ${MSG_EM_ANDAMENTO}`)
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it('D3: fechar no meio e vir feito ok -> sem aviso de "não encerrado"', async () => {
    let resolver: (r: ResultadoAcaoSaida) => void = () => {}
    encerrar.mockReturnValue(new Promise<ResultadoAcaoSaida>(res => { resolver = res }))
    const { rerender } = render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    rerender(<div />)
    await act(async () => { resolver(feito({ title: { estado: 'ok' } })) })
    expect(onAviso).not.toHaveBeenCalled()
  })

  it('D4: forbidden cru não aparece; frase em pt-BR, sem ida ao login', async () => {
    encerrar.mockResolvedValue({ ok: false, resultado: 'sem_permissao', error: 'forbidden' })
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect(await screen.findByText('Você não tem permissão para encerrar este teste.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/forbidden/)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('D5: sem_permissao com a frase de variante vai ao alert, não ao login, e o diálogo segue aberto', async () => {
    const frase = 'Só quem administra o site pode deixar uma variante no ar.'
    encerrar.mockResolvedValue({ ok: false, resultado: 'sem_permissao', error: frase })
    render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    expect((await screen.findByRole('alert')).textContent).toContain(frase)
    expect(router.push).not.toHaveBeenCalled()
    expect(onFechar).not.toHaveBeenCalled()
  })

  it('P1: resposta que chega depois dos 45 s é ignorada (sem fechar, sem refresh, "Sem resposta" fica)', async () => {
    vi.useFakeTimers()
    let resolver: (r: ResultadoAcaoSaida) => void = () => {}
    encerrar.mockReturnValue(new Promise<ResultadoAcaoSaida>(res => { resolver = res }))
    render(<AbEndTestDialog {...props()} />)
    fireEvent.click(screen.getByLabelText(/Variante B/))
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar e ficar com B' }))
    await act(async () => { vi.advanceTimersByTime(45_001) })
    expect(screen.getByText('Sem resposta')).toBeTruthy()
    await act(async () => { resolver(feito({ title: { estado: 'ok' } })) })
    expect(onFechar).not.toHaveBeenCalled()
    expect(router.refresh).not.toHaveBeenCalled()
    expect(screen.getByText('Sem resposta')).toBeTruthy()
  })
})

describe('T18 R1 (Yannis)', () => {
  it('D-1: mudou com o diálogo já fechado -> aviso de página e refresh', async () => {
    let resolver!: (r: ResultadoAcaoSaida) => void
    encerrar.mockReturnValue(new Promise<ResultadoAcaoSaida>(res => { resolver = res }))
    const { unmount } = render(<AbEndTestDialog {...props()} />)
    await marcarB(); await clicarEncerrar()
    unmount()
    await act(async () => { resolver({ ok: false, resultado: 'mudou', error: 'x' }) })
    expect(onAviso).toHaveBeenCalledTimes(1)
    expect(onAviso).toHaveBeenCalledWith('O teste mudou em outra aba antes de encerrar. Nada foi alterado.')
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it('D-2: HEAD preso é abortado em 5 s -> "Sem resposta", não fica em Encerrando', async () => {
    encerrar.mockRejectedValue(new Error('rede'))
    vi.stubGlobal('fetch', vi.fn((_u: string, init?: RequestInit) => new Promise((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')))
    })))
    render(<AbEndTestDialog {...props()} />)
    await marcarB()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fireEvent.click(screen.getByRole('button', { name: /^Encerrar e ficar com/ }))
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByText('Sem resposta')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(5_100) })
    expect(screen.getByText('Sem resposta')).toBeTruthy()
    expect(screen.queryByText('Sessão expirada')).toBeNull()
    vi.unstubAllGlobals()
  })
})
