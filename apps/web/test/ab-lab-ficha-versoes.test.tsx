// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act, within, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { FichaLida } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { FichaTeste, type AcoesFicha, type FichaTesteProps } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/ficha-teste'
import { fichaLida, AGORA_FICHA, TITULO_100, TITULO_101, URL_IMG, SHA } from './helpers/ficha-fixture'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
afterEach(() => cleanup())

const IMG = (nome: string, largura = 1280, altura = 720) => ({ url: URL_IMG(nome), sha256: SHA, largura, altura })
const T = (n: number): string => `2026-10-22T14:${String(40 + n).padStart(2, '0')}:00.000Z`
const duas = (o: Partial<FichaLida> = {}): FichaLida => fichaLida({
  variantes: [
    { n: 1, tipo: 'combo', titulo: 'Título da A', imagem: IMG('a') },
    { n: 2, tipo: 'combo', titulo: 'Título da B', imagem: IMG('b') },
  ], ...o,
})
const linha = { titulo: 'Rota 66', miniaturaUrl: null, nosso: null }

function acoesMock(): { [K in keyof AcoesFicha]: ReturnType<typeof vi.fn> } {
  return { salvarFicha: vi.fn(), enviarImagemDaFicha: vi.fn(), recomecarFicha: vi.fn() }
}
function montar(inicial: FichaLida, a = acoesMock(), extra: Partial<FichaTesteProps> = {}) {
  const fechar = vi.fn()
  const r = render(<FichaTeste linha={linha} inicial={inicial} acoes={a as unknown as AcoesFicha} fechar={fechar} agora={() => AGORA_FICHA} largura="larga" {...extra} />)
  return { a, fechar, ...r }
}
const okCom = (f: FichaLida) => ({ ok: true as const, ficha: f })
const campoB = (): HTMLTextAreaElement => screen.getByLabelText(/Título da versão B/) as HTMLTextAreaElement

describe('FichaTeste: campos e versões', () => {
  it('radiogroup troca os campos: só título some a imagem; só miniatura some o título', async () => {
    const a = acoesMock()
    a.salvarFicha.mockImplementation(async (_i: string, _l: string, d: { campos: string[] }) => okCom(duas({ campos: d.campos as FichaLida['campos'], atualizada_em: T(1) })))
    montar(duas(), a)
    const grupo = screen.getByRole('radiogroup', { name: FRASES.ficha.oQueTestar })
    expect(within(grupo).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Título', 'Miniatura', 'Os dois'].map((t) => expect.stringContaining(t)))
    expect(screen.getAllByText(FRASES.ficha.baixarImagem).length).toBe(1)
    await act(async () => { fireEvent.click(within(grupo).getByRole('radio', { name: 'Título' })) })
    expect(a.salvarFicha.mock.calls[0]![2].campos).toEqual(['titulo'])
    expect(screen.queryByText(FRASES.ficha.baixarImagem)).toBeNull()
    expect(document.querySelectorAll('img').length).toBe(0)
    expect(screen.getByText(FRASES.ficha.copiarTitulo)).toBeTruthy()
    await act(async () => { fireEvent.click(within(grupo).getByRole('radio', { name: 'Miniatura' })) })
    expect(a.salvarFicha.mock.calls[1]![2].campos).toEqual(['miniatura'])
    expect(screen.queryByLabelText(/Título da versão B/)).toBeNull()
    expect(screen.queryByText(FRASES.ficha.copiarTitulo)).toBeNull()
    expect(screen.getByText(FRASES.ficha.baixarImagem)).toBeTruthy()
  })

  it('contador por grafema: 100 com emoji conta 100 e grava; 101 mostra o limite e não grava', async () => {
    const a = acoesMock()
    a.salvarFicha.mockResolvedValue(okCom(duas({ atualizada_em: T(2) })))
    montar(duas(), a)
    fireEvent.change(campoB(), { target: { value: TITULO_100 } })
    expect(screen.getByText('100/100')).toBeTruthy()
    await act(async () => { fireEvent.blur(campoB()) })
    expect(a.salvarFicha).toHaveBeenCalledTimes(1)
    fireEvent.change(campoB(), { target: { value: TITULO_101 } })
    expect(screen.getByText('101/100')).toBeTruthy()
    await act(async () => { fireEvent.blur(campoB()) })
    expect(a.salvarFicha).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText(FRASES.ficha.tituloAcima(100)).length).toBeGreaterThan(0)
  })

  it('Copiar título escreve exatamente o gravado (aspas e <script> como texto) e Baixar imagem usa ?download=1', async () => {
    const hostil = `"Aspas" & <script>alert(1)</script> ${'x'.repeat(90)}`
    const escrever = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true })
    montar(duas({ variantes: [{ n: 1, tipo: 'combo', titulo: 'A' }, { n: 2, tipo: 'combo', titulo: hostil, imagem: IMG('b') }] }))
    expect(document.querySelector('script')).toBeNull()
    expect(campoB().value).toBe(hostil)
    fireEvent.click(screen.getByText(FRASES.ficha.copiarTitulo))
    expect(escrever).toHaveBeenCalledWith(hostil)
    const baixar = screen.getByText(FRASES.ficha.baixarImagem).closest('a')!
    expect(baixar.getAttribute('href')).toBe(`${URL_IMG('b')}?download=1`)
  })

  it('título longo sem espaço não alarga: overflow-wrap:anywhere no CSS dos campos e do texto da A', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/cms/(authed)/youtube/ab-lab/_components/ficha-teste.css'), 'utf8')
    expect(css).toMatch(/\.cn-fld textarea\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(css).toMatch(/\.cn-ro\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(css).toMatch(/\.cn-fhd h2\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(css).not.toMatch(/color-mix|opacity/)
  })

  it('Adicionar versão C acrescenta a n=3', async () => {
    const a = acoesMock()
    a.salvarFicha.mockImplementation(async (_i: string, _l: string, d: { variantes: FichaLida['variantes'] }) => okCom(duas({ variantes: [...duas().variantes, ...d.variantes.filter((v) => v.n === 3)], atualizada_em: T(3) })))
    montar(duas(), a)
    await act(async () => { fireEvent.click(screen.getByText(FRASES.ficha.adicionarC)) })
    expect(a.salvarFicha.mock.calls[0]![2].variantes.map((v: { n: number }) => v.n)).toEqual([2, 3])
    expect(screen.getByLabelText(/Título da versão C/)).toBeTruthy()
    expect(screen.queryByText(FRASES.ficha.adicionarC)).toBeNull()
  })

  it('a versão A nunca é editável e não regrava título nem imagem', async () => {
    const a = acoesMock()
    a.salvarFicha.mockResolvedValue(okCom(duas({ atualizada_em: T(4) })))
    montar(duas(), a)
    expect(screen.queryByLabelText(/Título da versão A/)).toBeNull()
    fireEvent.change(campoB(), { target: { value: 'Novo B' } })
    await act(async () => { fireEvent.blur(campoB()) })
    expect(a.salvarFicha.mock.calls[0]![2].variantes.every((v: { n: number }) => v.n !== 1)).toBe(true)
  })
})

describe('FichaTeste: imagens', () => {
  it('envio chama enviarImagemDaFicha, grava pela salvarFicha e a C em 854 x 480 mostra o selo âmbar', async () => {
    const a = acoesMock()
    const base = duas({ variantes: [...duas().variantes, { n: 3, tipo: 'combo', titulo: 'C' }] })
    const img = IMG('c', 854, 480)
    a.enviarImagemDaFicha.mockResolvedValue({ ok: true, ficha: { ...base, atualizada_em: T(5) }, imagem: img })
    a.salvarFicha.mockResolvedValue(okCom({ ...base, atualizada_em: T(6), variantes: [...base.variantes.filter((v) => v.n !== 3), { n: 3, tipo: 'combo', titulo: 'C', imagem: img }] }))
    montar(base, a)
    const arquivo = new File([new Uint8Array([1, 2, 3])], 'c.png', { type: 'image/png' })
    await act(async () => { fireEvent.change(screen.getByLabelText(FRASES.ficha.enviarImagem('C')), { target: { files: [arquivo] } }) })
    await waitFor(() => expect(a.salvarFicha).toHaveBeenCalled())
    expect(a.enviarImagemDaFicha.mock.calls[0]![0]).toBe(base.id)
    expect((a.enviarImagemDaFicha.mock.calls[0]![1] as FormData).get('file')).toBeInstanceOf(File)
    // a gravação da imagem parte do atualizada_em que o envio devolveu (fila)
    expect(a.salvarFicha.mock.calls[0]![1]).toBe(T(5))
    expect(a.salvarFicha.mock.calls[0]![2].variantes.find((v: { n: number }) => v.n === 3).imagem).toEqual(img)
    const selo = await screen.findByText(FRASES.resolucao.baixa('854 × 480'))
    expect(selo.closest('[data-selo]')?.getAttribute('data-selo')).toBe('resb')
  })

  it('imagem que não carrega vira placeholder com aviso e "Enviar de novo"', () => {
    montar(duas())
    const img = document.querySelectorAll('img.cn-th')[1]!
    fireEvent.error(img)
    expect(screen.getByRole('img', { name: FRASES.ficha.imagemNaoCarregou })).toBeTruthy()
    expect(screen.getByText(FRASES.ficha.enviarDeNovo)).toBeTruthy()
    expect(screen.getByText(FRASES.ficha.imagemFalhou('B').frase)).toBeTruthy()
  })

  it('A sem imagem: placeholder "não medido", nunca a miniatura viva', () => {
    montar(duas({ variantes: [{ n: 1, tipo: 'combo', titulo: 'A' }, { n: 2, tipo: 'combo', titulo: 'B' }] }), acoesMock(), { linha: { ...linha, miniaturaUrl: 'https://i.ytimg.com/vi/x/maxresdefault.jpg' } })
    expect(screen.getByText(FRASES.ficha.naoMedidoOriginal)).toBeTruthy()
    expect(document.querySelectorAll('.cn-vimg img').length).toBe(0)
  })

  it('envio recusado mostra frase da ficha, não o texto cru', async () => {
    const a = acoesMock()
    a.enviarImagemDaFicha.mockResolvedValue({ ok: false, error: 'sharp: Input buffer contains unsupported image format' })
    montar(duas({ variantes: [{ n: 1, tipo: 'combo', titulo: 'A' }, { n: 2, tipo: 'combo', titulo: 'B' }] }), a)
    await act(async () => { fireEvent.change(screen.getByLabelText(FRASES.ficha.enviarImagem('B')), { target: { files: [new File(['x'], 'x.png')] } }) })
    expect(await screen.findByText(FRASES.ficha.erroImagem)).toBeTruthy()
    expect(screen.queryByText(/sharp/)).toBeNull()
  })
})

describe('FichaTeste: gravação e fila', () => {
  it('"Salvando…" aparece durante a gravação, numa linha de altura reservada (role=status)', async () => {
    const a = acoesMock()
    let solta: (v: unknown) => void = () => undefined
    a.salvarFicha.mockReturnValue(new Promise((r) => { solta = r }))
    montar(duas(), a)
    fireEvent.change(campoB(), { target: { value: 'Outro' } })
    await act(async () => { fireEvent.blur(campoB()) })
    const linhas = screen.getAllByRole('status')
    expect(linhas.some((l) => l.textContent === FRASES.ficha.salvando && l.className.includes('cn-save'))).toBe(true)
    await act(async () => { solta(okCom(duas({ atualizada_em: T(7) }))) })
    expect(screen.queryByText(FRASES.ficha.salvando)).toBeNull()
  })

  it('save com marcarStudioAberto pendente espera a fila e grava sem "mudou em outro lugar"', async () => {
    const a = acoesMock()
    a.salvarFicha.mockResolvedValue(okCom(duas({ atualizada_em: T(9) })))
    let solta: (f: FichaLida) => void = () => undefined
    montar(duas(), a, {
      encaixes: {
        confirmar: (c) => (
          <button type="button" onClick={() => { void c.executar(() => new Promise<{ ficha: FichaLida }>((r) => { solta = (ficha) => r({ ficha }) })) }}>Abrir Studio (cópia lenta)</button>
        ),
      },
    })
    fireEvent.click(screen.getByText('Abrir Studio (cópia lenta)'))
    fireEvent.change(campoB(), { target: { value: 'Durante a cópia' } })
    await act(async () => { fireEvent.blur(campoB()) })
    expect(a.salvarFicha).not.toHaveBeenCalled()
    await act(async () => { solta(duas({ atualizada_em: T(8) })) })
    await waitFor(() => expect(a.salvarFicha).toHaveBeenCalled())
    expect(a.salvarFicha.mock.calls[0]![1]).toBe(T(8))
    expect(screen.queryByText(FRASES.mudouEmOutroLugar)).toBeNull()
  })

  it('depois de uma action que troca atualizada_em (Lembrar), editar e sair grava "salvo"', async () => {
    const a = acoesMock()
    a.salvarFicha.mockResolvedValue(okCom(duas({ atualizada_em: T(12) })))
    montar(duas(), a, {
      encaixes: { rodape: undefined, confirmar: (c) => <button type="button" onClick={() => { void c.executar(async () => ({ ficha: duas({ atualizada_em: T(11) }) })) }}>Lembrar</button> },
    })
    await act(async () => { fireEvent.click(screen.getByText('Lembrar')) })
    fireEvent.change(campoB(), { target: { value: 'Depois do lembrete' } })
    await act(async () => { fireEvent.blur(campoB()) })
    expect(a.salvarFicha.mock.calls[0]![1]).toBe(T(11))
    expect(screen.queryByText(FRASES.mudouEmOutroLugar)).toBeNull()
    expect(screen.getByText(/^Salvo /)).toBeTruthy()
  })

  it('erro de validação do servidor vira frase de FRASES, nunca o texto do Zod', async () => {
    const a = acoesMock()
    a.salvarFicha.mockResolvedValue({ ok: false, error: 'variantes.1.titulo: título acima de 100 caracteres' })
    montar(duas(), a)
    fireEvent.change(campoB(), { target: { value: 'x' } })
    await act(async () => { fireEvent.blur(campoB()) })
    expect(screen.getByText(FRASES.ficha.erroSalvar)).toBeTruthy()
    expect(screen.queryByText(/variantes\.1/)).toBeNull()
  })

  it('rede caída: mensagem, texto intacto e "Tentar agora" grava', async () => {
    const a = acoesMock()
    a.salvarFicha.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce(okCom(duas({ atualizada_em: T(13), variantes: [duas().variantes[0]!, { ...duas().variantes[1]!, titulo: 'Escrito sem rede' }] })))
    montar(duas(), a)
    fireEvent.change(campoB(), { target: { value: 'Escrito sem rede' } })
    await act(async () => { fireEvent.blur(campoB()) })
    expect(screen.getByText(FRASES.ficha.naoSalvo)).toBeTruthy()
    expect(screen.getByText(FRASES.ficha.naoSalvoApoio, { exact: false })).toBeTruthy()
    expect(campoB().value).toBe('Escrito sem rede')
    await act(async () => { fireEvent.click(screen.getByText(FRASES.ficha.tentarAgora)) })
    expect(a.salvarFicha).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(FRASES.ficha.naoSalvo)).toBeNull()
    expect(campoB().value).toBe('Escrito sem rede')
  })

  it('CAS perdido: avisa, troca para a ficha atual, regrava sem 2º blur e mantém o foco no campo', async () => {
    const a = acoesMock()
    const atual = duas({ atualizada_em: T(14), variantes: [...duas().variantes, { n: 3, tipo: 'combo', titulo: 'C do outro aparelho' }] })
    a.salvarFicha.mockResolvedValueOnce({ ok: false, error: FRASES.mudouEmOutroLugar, fichaAtual: atual }).mockResolvedValueOnce(okCom({ ...atual, atualizada_em: T(15), variantes: atual.variantes.map((v) => (v.n === 2 ? { ...v, titulo: 'Meu B digitado' } : v)) }))
    montar(duas(), a)
    act(() => { campoB().focus() })
    fireEvent.change(campoB(), { target: { value: 'Meu B digitado' } })
    await act(async () => { fireEvent.blur(campoB()) })
    act(() => { campoB().focus() })
    expect(document.activeElement).toBe(campoB())
    expect(screen.getByText(FRASES.mudouEmOutroLugar, { exact: false })).toBeTruthy()
    expect(campoB().value).toBe('Meu B digitado')
    expect((screen.getByLabelText(/Título da versão C/) as HTMLTextAreaElement).value).toBe('C do outro aparelho')
    expect(a.salvarFicha).toHaveBeenCalledTimes(2)
    expect(a.salvarFicha.mock.calls[1]![1]).toBe(T(14))
    expect(a.salvarFicha.mock.calls[1]![2].variantes.find((v: { n: number }) => v.n === 2).titulo).toBe('Meu B digitado')
  })

  it('CAS perdido de novo: a linha diz "Não salvo", nunca "Salvo em"', async () => {
    const a = acoesMock()
    a.salvarFicha.mockResolvedValue({ ok: false, error: 'x', fichaAtual: duas({ atualizada_em: T(14) }) })
    montar(duas(), a)
    fireEvent.change(campoB(), { target: { value: 'Meu B' } })
    await act(async () => { fireEvent.blur(campoB()) })
    expect(a.salvarFicha).toHaveBeenCalledTimes(2)
    expect(screen.getByText(FRASES.ficha.naoSalvoConflito, { exact: false })).toBeTruthy()
    expect(screen.queryByText(/Salvo em/)).toBeNull()
    expect(campoB().value).toBe('Meu B')
  })

  it('título de 100 com espaço no fim mostra 100/100; clipboard rejeitado mostra a frase de falha', async () => {
    const a = acoesMock()
    a.salvarFicha.mockResolvedValue(okCom(duas({ atualizada_em: T(2), variantes: [duas().variantes[0]!, { n: 2, tipo: 'combo', titulo: TITULO_100 }] })))
    montar(duas(), a)
    fireEvent.change(campoB(), { target: { value: `${TITULO_100}  ` } })
    expect(screen.getByText('100/100')).toBeTruthy()
    await act(async () => { fireEvent.blur(campoB()) })
    const rej = vi.fn().mockRejectedValue(new Error('negado'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: rej }, configurable: true })
    await act(async () => { fireEvent.click(screen.getByText(FRASES.ficha.copiarTitulo)) })
    expect(rej).toHaveBeenCalled()
    expect(screen.getByText(FRASES.ficha.erroCopiar)).toBeTruthy()
  })
})

describe('FichaTeste: idade da ficha', () => {
  it('ficha-13d: "Salvo em 08/10, 14:32" e o aviso de parada', () => {
    montar(duas({ criada_em: '2026-10-01T12:00:00.000Z', atualizada_em: '2026-10-08T17:32:00.000Z' }))
    expect(screen.getByText('Salvo em 08/10, 14:32')).toBeTruthy()
    expect(screen.getByText(FRASES.ficha.parada(13).frase)).toBeTruthy()
  })

  it('ficha-15d: só leitura, botões desabilitados e "Começar outra ficha" chama recomecarFicha', async () => {
    const a = acoesMock()
    const nova = fichaLida({ id: '22222222-2222-4222-8222-222222222222', atualizada_em: T(19) })
    a.recomecarFicha.mockResolvedValue(okCom(nova))
    const aoRecomecar = vi.fn()
    montar(duas({ criada_em: '2026-10-01T12:00:00.000Z', atualizada_em: '2026-10-06T17:32:00.000Z' }), a, { aoRecomecar })
    expect(campoB().readOnly).toBe(true)
    expect((screen.getByText(FRASES.ficha.copiarTitulo).closest('button') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByText(FRASES.ficha.baixarImagem).closest('button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(FRASES.ficha.adicionarC)).toBeNull()
    expect(screen.queryByText('Salvo', { exact: false })).toBeNull()
    for (const r of screen.getAllByRole('radio')) expect((r as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { fireEvent.click(screen.getByText(FRASES.ficha.comecarOutra)) })
    expect(a.recomecarFicha).toHaveBeenCalledWith(duas().id)
    expect(aoRecomecar).toHaveBeenCalledWith(nova)
  })
})

describe('ListaCaminhoComPaineis: abertura da ficha', () => {
  const linhaLista = {
    videoId: 'uuid-1', ytId: 'vid00000001', titulo: 'Vídeo 1', miniaturaUrl: null, publicadoEm: '2026-10-10T12:00:00.000Z',
    estado: 'sugerido_youtube', caminho: { tipo: 'nativo', portao: true, motivo: 'Vídeo longo com volume.' },
    fichaId: duas().id, registro: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300,
  } as unknown as import('@/lib/youtube/teste-youtube/nativo/lista').LinhaDoCaminho

  async function abrir(lida: unknown, aberta?: unknown) {
    const { ListaCaminhoComPaineis } = await import('@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho-paineis')
    const acoes = {
      lerFichaDoVideo: vi.fn().mockResolvedValue(lida), abrirFicha: vi.fn().mockResolvedValue(aberta), recomecarFicha: vi.fn(),
      salvarFicha: vi.fn(), enviarImagemDaFicha: vi.fn(), marcarStudioAberto: vi.fn(), lembrarNoComputador: vi.fn(), jaIniciei: vi.fn(),
      confirmarDetectado: vi.fn(), naoETeste: vi.fn(), responderTesteDoYouTube: vi.fn(), pauseAbTest: vi.fn(), retryRestore: vi.fn(),
    }
    render(<ListaCaminhoComPaineis linhas={[linhaLista]} videoInicial="vid00000001" acoes={acoes as never} agora={() => AGORA_FICHA} />)
    return acoes
  }

  it('ficha vencida lida: abre em consulta e NÃO cria ficha nova sozinha', async () => {
    const vencida = duas({ criada_em: '2026-10-01T12:00:00.000Z', atualizada_em: '2026-10-06T17:32:00.000Z' })
    const acoes = await abrir({ ok: true, ficha: vencida, vencida: true })
    expect(await screen.findByText(FRASES.ficha.comecarOutra)).toBeTruthy()
    expect(acoes.abrirFicha).not.toHaveBeenCalled()
  })

  it('sem ficha aberta: cria pela abrirFicha; erro de leitura mostra a frase e "Tentar de novo"', async () => {
    const acoes = await abrir({ ok: true, ficha: null, vencida: false }, { ok: true, ficha: duas({ atualizada_em: T(1) }) })
    expect(await screen.findByLabelText(/Título da versão B/)).toBeTruthy()
    expect(acoes.abrirFicha).toHaveBeenCalledTimes(1)
    cleanup()
    await abrir({ ok: false, error: 'x' })
    expect(await screen.findByText(FRASES.ficha.erroAbrir)).toBeTruthy()
    expect(screen.getByText(FRASES.ficha.tentarDeNovo)).toBeTruthy()
  })
})
