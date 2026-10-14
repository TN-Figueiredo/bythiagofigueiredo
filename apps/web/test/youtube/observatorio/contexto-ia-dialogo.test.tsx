// @vitest-environment jsdom
/**
 * E17 degrau 1, Tarefa 10: o botão e o diálogo "Perguntar a uma IA". Um teste por estado do mockup 22, cada um afirmando as frases exatas
 * (NOTAS.md, seção 2), mais o comportamento: pedido, descarte de resposta velha, foco, Esc, cópia, baixar e pergunta.
 * Os testes simulam `ligado: true`; os dois do interruptor voltam ao valor real ou ao falso.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import { E17_D1_DEPLOY } from '@/lib/conferencias'
import { resumir } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { segmentar, type PacoteSerializado, type RespostaDePacote } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import type { PacoteModelo, PedidoDePacote } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO, modeloCheio, modeloComComentarios, modeloComZero, modeloEstresse, modeloMagro, modeloPrivadoExcluido, modeloPrivadoIncluido, modeloVazio } from './contexto-ia-fixture'

const modo = vi.hoisted(() => ({ real: false, ligado: true }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/regras', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/contexto-ia/regras')>()
  return { ...m, CONTEXTO_IA_RULES: new Proxy(m.CONTEXTO_IA_RULES, { get: (t, k) => (k === 'ligado' && !modo.real ? modo.ligado : Reflect.get(t, k)) }) }
})

import { PerguntarIa } from '@/app/cms/(authed)/youtube/competitors/_chrome/perguntar-ia/botao'

const pacoteDe = (m: PacoteModelo): PacoteSerializado => segmentar(m, CONTEXTO)
const ok = (m: PacoteModelo): RespostaDePacote => ({ ok: true, pacote: pacoteDe(m) })
const EXEMPLOS = ['Qual dos dois está crescendo mais?', 'O que eu ainda não consigo afirmar com estes números?'] as const

function montar(onGerar: (p: PedidoDePacote) => Promise<RespostaDePacote>, tela: 'comparar' | 'canais' = 'comparar') {
  return render(<PerguntarIa tela={tela} nomeDaTela="Comparar" exemplos={EXEMPLOS} onGerar={onGerar} />)
}
async function abrir(m: PacoteModelo) {
  const onGerar = vi.fn(async (_p: PedidoDePacote) => ok(m))
  const r = montar(onGerar)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Perguntar a uma IA' })) })
  return { onGerar, ...r }
}
const nf = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const resumo = (): string => document.getElementById('pi-res')!.textContent ?? ''
const dialogo = (): HTMLDialogElement => document.querySelector('dialog')!

beforeEach(() => {
  modo.real = false; modo.ligado = true
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => undefined) } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('os estados do mockup', () => {
  it('típico: a frase-resumo, o tamanho que cabe, as quatro linhas e os botões', async () => {
    await abrir(modeloCheio())
    const p = pacoteDe(modeloCheio()), r = resumir(p, '')
    expect(r.copia.cabe).toBe(true)
    expect(resumo()).toBe(`Pacote da tela ${p.nomeDaTela}: ${p.tabelas.length} tabelas, ${r.copia.caracteres.toLocaleString('pt-BR')} caracteres, nada privado`.replace(/ /g, ' '))
    expect(screen.getByText('cabe inteiro')).toBeTruthy()
    expect(screen.getByText('Tamanho')).toBeTruthy()
    expect(screen.getByText('Os números no pacote')).toBeTruthy()
    expect(screen.getByText('O que ficou de fora')).toBeTruthy()
    expect(screen.getByText('Por tamanho').parentElement!.textContent).toContain('nada')
    expect(screen.getAllByText('esta tela não tem').length).toBe(2)
    expect(screen.getByText('nunca entram')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copiar texto' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Baixar .md' })).toBeTruthy()
    expect(screen.getAllByText(/ no pacote$/).length).toBeGreaterThan(0)
    expect(screen.getByText('limite da cópia: 30.000')).toBeTruthy()
  })
  it('cortado: 30.000 vão na cópia, "cortado de", "Baixar completo (n)" e a linha "Por tamanho" cortada', async () => {
    await abrir(modeloEstresse(20, 90))
    const r = resumir(pacoteDe(modeloEstresse(20, 90)), '')
    expect(r.copia.cabe).toBe(false)
    expect(resumo()).toContain(`${nf(r.copia.caracteres)} caracteres (cortado de ${nf(r.copia.totalSemCorte)})`)
    expect(screen.getByText('cortado por tamanho')).toBeTruthy()
    expect(screen.getByText(`${nf(r.copia.caracteres)} vão na cópia`)).toBeTruthy()
    expect(screen.getByRole('button', { name: `Baixar completo (${r.completo.caracteres.toLocaleString('pt-BR').replace(/ /g, '')})`.replace(/(\d)\.(\d)/, '$1.$2') })).toBeTruthy()
    expect(screen.getByText('cortado')).toBeTruthy()
    const soma = r.copia.cortes.reduce((s, c) => s + c.caracteres, 0)
    expect(soma).toBe(r.copia.totalSemCorte - r.copia.caracteres)
  })
  it('passa do completo: o botão diz o número real, nunca o literal 200.000, e "n não saem"', async () => {
    const m = modeloEstresse(20, 90)
    const r = resumir(pacoteDe(m), '')
    expect(r.naoSaem).toBeGreaterThan(0)
    expect(r.completo.caracteres).toBeLessThanOrEqual(200_000)
    await abrir(m)
    expect(screen.getByText(`${nf(r.naoSaem)} não saem`)).toBeTruthy()
    expect(screen.getByRole('button', { name: `Baixar completo (${nf(r.completo.caracteres)})` })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Baixar completo (200.000)' })).toBeNull()
    expect(screen.getByText(`${nf(r.soNoArquivo)} só no arquivo completo`)).toBeTruthy()
  })
  it('zero medido: a caixa "zero medido" na régua, no singular', async () => {
    await abrir(modeloComZero())
    const leg = document.querySelector('.pi-leg-n')!.textContent!
    expect(leg).toContain('1 zero medido')
    expect(leg).toContain('0 medidos')
    expect(leg).toContain('0 não medidos')
  })
  it('não medido (magro): "só 2 de 16 números medidos" e a primeira linha da prévia avisa a IA', async () => {
    await abrir(modeloMagro(14))
    expect(resumo()).toContain('só 2 de 16 números medidos')
    expect(document.getElementById('pi-pre')!.textContent).toContain('AVISO: quase tudo nesta tela está não medido (2 de 16 números)')
    expect(document.querySelector('.pi-leg-n')!.textContent).toContain('14 não medidos')
  })
  it('vazio: "nenhum número ainda" e "Copiar texto" continua ligado', async () => {
    await abrir(modeloVazio())
    expect(resumo()).toContain('nenhum número ainda')
    const b = screen.getByRole('button', { name: 'Copiar texto' })
    expect(b.getAttribute('aria-disabled')).toBeNull()
    expect(document.getElementById('pi-pre')!.textContent).toContain('AVISO: esta tela ainda não tem nenhum número')
  })
  it('privado incluído: a pastilha da frase e a linha "incluído" com os itens', async () => {
    await abrir(modeloPrivadoIncluido())
    expect(resumo()).toContain('inclui dado privado do canal')
    const linha = screen.getByText('Dado privado do canal').closest('li')!
    expect(linha.textContent).toContain('incluído')
    expect(linha.textContent).toContain('impressões por dia')
  })
  it('sem o direito: a pastilha âmbar na frase e as duas linhas "sem o direito"', async () => {
    await abrir(modeloPrivadoExcluido('sem_direito'))
    expect(resumo()).toContain('sem o dado privado do canal')
    const linha = screen.getByText('Dado privado do canal').closest('li')!
    expect(linha.textContent).toContain('sem o direito')
    expect(linha.textContent).toContain('de fora: impressões por dia e cliques estimados')
  })
  for (const [motivo, frase] of [['nao_conferido', 'não foi possível conferir agora'], ['leitura_falhou', 'a leitura falhou agora']] as const) {
    it(`${motivo}: a mesma pastilha âmbar, a linha com o texto do motivo, e "sem o direito" não aparece`, async () => {
      await abrir(modeloPrivadoExcluido(motivo))
      expect(resumo()).toContain('sem o dado privado do canal')
      const linha = screen.getByText('Dado privado do canal').closest('li')!
      expect(linha.textContent).toContain(frase)
      expect(dialogo().textContent).not.toContain('sem o direito')
      expect(linha.querySelector('.pi-stc.lock')).toBeTruthy()
    })
  }
  it('comentários incluídos: "{n} comentários, sem nome"', async () => {
    await abrir(modeloComComentarios('incluido'))
    const linha = screen.getByText('Texto de comentários').closest('li')!
    expect(linha.textContent).toContain('incluído')
    expect(linha.textContent).toContain('2 comentários, sem nome')
  })
  it('comentários de fora: "{n} comentários de fora" com "sem o direito"', async () => {
    await abrir(modeloComComentarios('excluido'))
    const linha = screen.getByText('Texto de comentários').closest('li')!
    expect(linha.textContent).toContain('sem o direito')
    expect(linha.textContent).toContain('14 comentários de fora')
  })
  it('copiado: faixa verde com o número, o botão vira "Copiar de novo" e o diálogo continua aberto', async () => {
    await abrir(modeloCheio())
    const r = resumir(pacoteDe(modeloCheio()), '')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar texto' })) })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(r.copia.texto)
    const st = document.getElementById('pi-st')!
    expect(st.textContent).toBe(`Copiado: ${r.copia.caracteres.toLocaleString('pt-BR').replace(/ /g, '')} caracteres estão na área de transferência. Cole na IA que você usa.`)
    expect(st.getAttribute('role')).toBe('status')
    expect(screen.getByRole('button', { name: 'Copiar de novo' })).toBeTruthy()
    expect(dialogo().hasAttribute('open')).toBe(true)
  })
  it('falhou ao copiar: "Baixar .md" vira o principal e há os dois botões extras', async () => {
    ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('negado'))
    await abrir(modeloCheio())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar texto' })) })
    const st = document.getElementById('pi-st')!
    expect(st.getAttribute('role')).toBe('alert')
    expect(st.textContent).toBe('Não deu para copiar. O navegador não deixou usar a área de transferência. Baixe o arquivo, ou selecione o texto da prévia e copie com Ctrl+C.')
    expect(screen.getByRole('button', { name: 'Baixar .md' }).className).toContain('pri')
    expect(screen.getByRole('button', { name: 'Selecionar o texto da prévia' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar copiar de novo' })).toBeTruthy()
  })
  it('erro: título, corpo e "Tentar de novo"', async () => {
    const onGerar = vi.fn(async () => ({ ok: false, motivo: 'falhou' }) as RespostaDePacote)
    montar(onGerar)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Perguntar a uma IA' })) })
    expect(resumo()).toBe('Pacote da tela Comparar: não foi montado')
    expect(screen.getByText('Não foi possível montar o pacote')).toBeTruthy()
    expect(screen.getByText('O servidor não respondeu a tempo. Sua pergunta foi mantida. Tente de novo; se continuar, abra a tela outra vez.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
  it('carregando: só a frase "Montando o pacote da tela …" e os dois botões de ação desligados', async () => {
    montar(() => new Promise<RespostaDePacote>(() => undefined))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Perguntar a uma IA' })) })
    expect(resumo()).toBe('Montando o pacote da tela Comparar…')
    const off = Array.from(dialogo().querySelectorAll('[aria-disabled="true"]')).map((b) => b.textContent)
    expect(off).toEqual(['Copiar texto', 'Baixar .md'])
  })
  it('o aviso fixo está presente em todos os estados, inclusive erro e carregando', async () => {
    const AV = 'Este texto sai do site: ao colar numa IA, ele passa a estar num serviço de terceiros.'
    for (const resp of [() => new Promise<RespostaDePacote>(() => undefined), async () => ({ ok: false, motivo: 'falhou' }) as RespostaDePacote, async () => ok(modeloCheio())]) {
      montar(resp)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Perguntar a uma IA' })) })
      expect(dialogo().textContent).toContain(AV)
      cleanup()
    }
  })
})

describe('o pedido e o ciclo de vida', () => {
  it('abrir chama onGerar uma vez, com a consulta da URL do instante', async () => {
    window.history.replaceState(null, '', '/cms/youtube/competitors/comparar?a=x&b=y')
    const { onGerar } = await abrir(modeloCheio())
    expect(onGerar).toHaveBeenCalledTimes(1)
    expect(onGerar).toHaveBeenCalledWith({ tela: 'comparar', consulta: '?a=x&b=y' })
    window.history.replaceState(null, '', '/')
  })
  it('resposta ok: false de qualquer motivo dá o mesmo estado de erro', async () => {
    for (const motivo of ['pedido_invalido', 'sem_acesso', 'nao_encontrado', 'registro_falhou', 'falhou'] as const) {
      montar(async () => ({ ok: false, motivo }))
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Perguntar a uma IA' })) })
      expect(resumo()).toBe('Pacote da tela Comparar: não foi montado')
      cleanup()
    }
  })
  it('onGerar rejeita (rede): estado de erro, e a pergunta digitada fica; "Tentar de novo" chama outra vez', async () => {
    const onGerar = vi.fn()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce(ok(modeloCheio()))
    montar(onGerar)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Perguntar a uma IA' })) })
    expect(screen.getByText('Não foi possível montar o pacote')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Minha pergunta/), { target: { value: 'minha dúvida' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })) })
    expect(onGerar).toHaveBeenCalledTimes(2)
    expect((screen.getByLabelText(/Minha pergunta/) as HTMLTextAreaElement).value).toBe('minha dúvida')
    expect(resumo()).toContain('Pacote da tela')
  })
  it('resposta que chega depois de fechar é descartada', async () => {
    let resolver: (r: RespostaDePacote) => void = () => undefined
    montar(() => new Promise<RespostaDePacote>((res) => { resolver = res }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Perguntar a uma IA' })) })
    await act(async () => { fireEvent.click(document.getElementById('pi-fechar')!) })
    await act(async () => { resolver(ok(modeloCheio())) })
    expect(dialogo().hasAttribute('open')).toBe(false)
    expect(document.getElementById('pi-pre')).toBeNull()
  })
  it('fechar e reabrir com a primeira resposta pendente: a primeira chega depois e é ignorada; vale a segunda', async () => {
    const res: Array<(r: RespostaDePacote) => void> = []
    montar(() => new Promise<RespostaDePacote>((r) => { res.push(r) }))
    const abre = () => screen.getByRole('button', { name: 'Perguntar a uma IA' })
    await act(async () => { fireEvent.click(abre()) })
    await act(async () => { fireEvent.click(document.getElementById('pi-fechar')!) })
    await act(async () => { fireEvent.click(abre()) })
    expect(res.length).toBe(2)
    await act(async () => { res[1]!(ok(modeloVazio())) })
    await act(async () => { res[0]!(ok(modeloCheio())) })
    expect(resumo()).toContain('nenhum número ainda')
  })
  it('props novas com o diálogo aberto: o pacote e a pergunta permanecem e onGerar não é chamado outra vez', async () => {
    const onGerar = vi.fn(async (_p: PedidoDePacote) => ok(modeloCheio()))
    const { rerender } = montar(onGerar)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Perguntar a uma IA' })) })
    fireEvent.change(screen.getByLabelText(/Minha pergunta/), { target: { value: 'ainda aqui' } })
    const antes = resumo()
    rerender(<PerguntarIa tela="comparar" nomeDaTela="Comparar" exemplos={EXEMPLOS} onGerar={async () => ok(modeloVazio())} />)
    expect(onGerar).toHaveBeenCalledTimes(1)
    expect(resumo()).toBe(antes.replace(/\d[\d.]* caracteres/, (m) => m))
    expect((screen.getByLabelText(/Minha pergunta/) as HTMLTextAreaElement).value).toBe('ainda aqui')
  })
})

describe('o interruptor', () => {
  it('com ligado falso (simulado) o botão não é desenhado', () => {
    modo.ligado = false
    const { container } = montar(async () => ok(modeloCheio()))
    expect(container.innerHTML).toBe('')
  })
  it('com o valor real da constante, sem simular: segue E17_D1_DEPLOY (nula: sem botão; preenchida: com botão)', () => {
    modo.real = true
    const { container } = montar(async () => ok(modeloCheio()))
    if (E17_D1_DEPLOY === null) expect(container.innerHTML).toBe('')
    else expect(screen.getByRole('button', { name: 'Perguntar a uma IA' })).toBeTruthy()
  })
})

describe('a pergunta', () => {
  it('digitar recalcula a frase-resumo, a barra e a linha "Por tamanho" (pacote que cabe com pergunta vazia e corta com 1.000)', async () => {
    const cheio = modeloEstresse(1, 1)
    const base = resumir(pacoteDe(cheio), '')
    const sobra = 30_000 - base.copia.totalSemCorte
    // um pacote que cabe com folga menor que 1.000 caracteres: ajusta-se com um aviso longo
    const ajustado: PacoteModelo = { ...cheio, avisos: [...cheio.avisos, 'x'.repeat(Math.max(0, sobra - 500))] }
    await abrir(ajustado)
    expect(screen.getByText('cabe inteiro')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Minha pergunta/), { target: { value: 'p'.repeat(1_000) } })
    const r = resumir(pacoteDe(ajustado), 'p'.repeat(1_000))
    expect(r.copia.cabe).toBe(false)
    expect(screen.getByText('cortado por tamanho')).toBeTruthy()
    expect(resumo()).toContain('(cortado de ')
  })
  it('o campo não aceita o 1.001º caractere e o contador diz "n de 1.000 caracteres"', async () => {
    await abrir(modeloCheio())
    const ta = screen.getByLabelText(/Minha pergunta/) as HTMLTextAreaElement
    expect(ta.maxLength).toBe(1_000)
    fireEvent.change(ta, { target: { value: 'abc' } })
    expect(screen.getByText('3 de 1.000 caracteres')).toBeTruthy()
  })
  it('os exemplos da tela são botões que preenchem o campo', async () => {
    await abrir(modeloCheio())
    fireEvent.click(screen.getByRole('button', { name: EXEMPLOS[0] }))
    expect((screen.getByLabelText(/Minha pergunta/) as HTMLTextAreaElement).value).toBe(EXEMPLOS[0])
  })
})

describe('a cópia e o arquivo', () => {
  it('clipboard ausente (undefined): estado falhou, sem exceção', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    await abrir(modeloCheio())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar texto' })) })
    expect(document.getElementById('pi-st')!.getAttribute('role')).toBe('alert')
  })
  it('clipboard rejeita: idem', async () => {
    ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('negado'))
    await abrir(modeloCheio())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar texto' })) })
    expect(screen.getByText(/Não deu para copiar/)).toBeTruthy()
  })
  async function textoBaixado(m: PacoteModelo): Promise<{ texto: string; nome: string }> {
    let blob: Blob | null = null
    let nome = ''
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => { blob = b as Blob; return 'blob:x' })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { nome = this.download })
    await abrir(m)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Baixar/ })) })
    const b = blob as Blob | null
    expect(b).not.toBeNull()
    expect(b!.type).toBe('text/markdown;charset=utf-8')
    const texto = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(b!) })
    return { texto, nome }
  }
  it('o texto baixado é o da cópia quando cabe e o completo quando cortou, com o nome do arquivo do pacote', async () => {
    const cabe = await textoBaixado(modeloCheio())
    const rc = resumir(pacoteDe(modeloCheio()), '')
    expect(cabe.texto).toBe(rc.copia.texto)
    expect(cabe.nome).toBe(pacoteDe(modeloCheio()).arquivo)
    cleanup()
    const corta = await textoBaixado(modeloEstresse(20, 90))
    const rx = resumir(pacoteDe(modeloEstresse(20, 90)), '')
    expect(corta.texto).toBe(rx.completo.texto)
    expect(corta.texto.length).toBeGreaterThan(rx.copia.texto.length)
  })
  it('nenhum estado escreve número calculado fora de resumir(): os componentes não importam montarTexto nem fazem conta com caracteres', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const dir = 'src/app/cms/(authed)/youtube/competitors/_chrome/perguntar-ia'
    for (const f of readdirSync(dir).filter((x) => /\.(tsx?|css)$/.test(x))) {
      const t = readFileSync(`${dir}/${f}`, 'utf8')
      expect(t, f).not.toMatch(/\bmontarTexto\b/)
      expect(t, f).not.toMatch(/\.caracteres\s*[-+*/]/)
    }
  })
})

describe('foco, Esc e laço de Tab', () => {
  it('foco inicial no título; Esc fecha e devolve o foco ao botão', async () => {
    await abrir(modeloCheio())
    expect(document.activeElement).toBe(document.getElementById('pi-h'))
    expect(document.getElementById('pi-h')!.getAttribute('tabindex')).toBe('-1')
    expect(dialogo().getAttribute('aria-labelledby')).toBe('pi-h')
    expect(dialogo().getAttribute('aria-describedby')).toBe('pi-res')
    await act(async () => { fireEvent(dialogo(), new Event('cancel', { cancelable: true })) })
    expect(dialogo().hasAttribute('open')).toBe(false)
    expect(document.activeElement).toBe(document.getElementById('pi-abre'))
  })
  it('Esc com o ⓘ aberto fecha só o ⓘ', async () => {
    await abrir(modeloCheio())
    fireEvent.click(screen.getByRole('button', { name: 'Como o tamanho é medido e cortado' }))
    expect(within(dialogo()).getByRole('note')).toBeTruthy()
    const ev = new Event('cancel', { cancelable: true })
    await act(async () => { fireEvent(dialogo(), ev) })
    expect(ev.defaultPrevented).toBe(true)
    expect(within(dialogo()).queryByRole('note')).toBeNull()
    expect(dialogo().hasAttribute('open')).toBe(true)
  })
  it('40 Tab seguidos não saem do diálogo (o laço leva do último ao primeiro)', async () => {
    await abrir(modeloCheio())
    const d = dialogo()
    const focaveis = () => Array.from(d.querySelectorAll<HTMLElement>('button:not([aria-disabled="true"]):not([disabled]),textarea,[tabindex="0"]'))
    const f = focaveis()
    f[f.length - 1]!.focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    f[f.length - 1]!.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(f[0])
    f[0]!.focus()
    const volta = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    f[0]!.dispatchEvent(volta)
    expect(document.activeElement).toBe(f[f.length - 1])
    for (let i = 0; i < 40; i++) expect(d.contains(document.activeElement)).toBe(true)
  })
  it('clique no fundo fecha', async () => {
    await abrir(modeloCheio())
    await act(async () => { fireEvent.click(dialogo()) })
    expect(dialogo().hasAttribute('open')).toBe(false)
  })
  it('a prévia é uma região focável com nome', async () => {
    await abrir(modeloCheio())
    const pre = document.getElementById('pi-pre')!
    expect(pre.getAttribute('role')).toBe('region')
    expect(pre.getAttribute('tabindex')).toBe('0')
    expect(pre.getAttribute('aria-label')).toBe('Prévia do texto que será copiado')
  })
})
