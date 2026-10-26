// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FaixaComVoce, TEXTO_AUTOMATICO, type FaixaComVoceProps } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/faixa-com-voce'
import { SecaoEmTeste, type SecaoEmTesteProps } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/secao-em-teste'
import { painelDoAtivo } from '@/lib/youtube/ab-lab-pagina/painel-decisao'
import type { CartaoEmTeste, ItemComVoce, PainelDecisao } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { makeCardView } from './helpers/ab-fixtures'

afterEach(cleanup)

const mkv = (id: string, label: 'A' | 'B' | 'C', isOriginal: boolean, title: string | null) => ({ id, label, color: '#000', thumbUrl: null, title, isOriginal })
const variants = [mkv('va', 'A', true, 'Título A'), mkv('vb', 'B', false, 'Título B')]

function cartaoLab(o: { id?: string; status?: 'active' | 'queued'; type?: 'title' | 'thumbnail' | 'combo'; vars?: ReturnType<typeof mkv>[]; pendencia?: boolean; diaV2?: { dia: number; teto: number } } = {}): Extract<CartaoEmTeste, { tipo: 'lab' }> {
  const card = makeCardView({ id: o.id ?? 't1', status: o.status ?? 'active', type: o.type ?? 'title', variants: o.vars ?? variants, videoTitle: 'Vídeo do Lab', diaV2: o.diaV2 ?? { dia: 1, teto: 15 } })
  const ativo = card.status === 'active'
  const painel = ativo ? painelDoAtivo(card, { ctrs: {}, noArLetra: 'A', sugeridaId: null, regraV2: true, podeDeixarVariante: true }) : null
  return {
    tipo: 'lab', card, lider: null, semLider: 'CTR não medido', proximaTroca: ativo ? '~20h' : null, painel,
    ...(o.pendencia ? { pendencia: { verbo: 'aplicar B', botao: 'Aplicar B' } } : {}),
  }
}
const linhaStudio = (): LinhaDoCaminho => ({
  videoId: 'v9', ytId: 'yt9', titulo: 'Vídeo do Studio', miniaturaUrl: null, publicadoEm: '2026-09-01T00:00:00Z', estado: 'em_teste_studio',
  caminho: { tipo: 'nativo' } as LinhaDoCaminho['caminho'], fichaId: null, labPausadoAte: null, nosso: null, impressoesPorDia: null, registro: null,
}) as LinhaDoCaminho
const cartaoStudio = (): CartaoEmTeste => ({ tipo: 'studio', linha: linhaStudio(), titulos: [{ letra: 'A', titulo: 'Original' }, { letra: 'B', titulo: 'Nova' }], labPausadoAte: null, dia14: false })

function secao(cartoes: CartaoEmTeste[], o: Partial<SecaoEmTesteProps> = {}) {
  const p: SecaoEmTesteProps = { cartoes, onAbrirPainel: vi.fn(), onAbrirDia14: vi.fn(), ...o }
  return { p, ...render(<SecaoEmTeste {...p} />) }
}
function faixa(itens: ItemComVoce[], o: Partial<FaixaComVoceProps> = {}) {
  const p: FaixaComVoceProps = { itens, vazio: null, onAbrirPainel: vi.fn(), onAbrirDia14: vi.fn(), onContinuarRascunho: vi.fn(), onNovoTeste: vi.fn(), onAbrirTeste: vi.fn(), ...o }
  return { p, ...render(<FaixaComVoce {...p} />) }
}
const painelFake = (): PainelDecisao => painelDoAtivo(makeCardView({ id: 'c1', type: 'title', variants, videoTitle: 'Aladdin' }), { ctrs: {}, noArLetra: 'A', sugeridaId: 'vb', regraV2: true, podeDeixarVariante: true })

describe('Em teste agora', () => {
  it('estado a: cartão único ocupa a largura (classe um), mostra A e B em texto e "● no ar" em A', () => {
    const { container } = secao([cartaoLab()])
    expect(container.querySelector('.lab-cartao.um')).not.toBeNull()
    const a = container.querySelector('[data-versao="A"]')!
    const b = container.querySelector('[data-versao="B"]')!
    expect(a.textContent).toContain('Título A')
    expect(a.textContent).toContain('● no ar')
    expect(b.textContent).toContain('Título B')
    expect(b.textContent).not.toContain('● no ar')
    expect(screen.getByText('Título')).toBeTruthy()
    expect(container.textContent).not.toMatch(/TITLE|thumbnail/i)
    expect(screen.getByText('Ainda sem líder')).toBeTruthy()
    expect(screen.getByText('automática')).toBeTruthy()
  })
  it('nenhum cartão mostra caixa B vazia: versão sem título e sem miniatura escreve "sem título gravado"', () => {
    const { container } = secao([cartaoLab({ vars: [mkv('va', 'A', true, null), mkv('vb', 'B', false, null)] })])
    expect(container.querySelector('[data-versao="B"]')!.textContent).toContain('sem título gravado')
    const mini = secao([cartaoLab({ id: 'm', type: 'thumbnail' })]).container
    expect(mini.textContent).toContain('sem miniatura gravada')
  })
  it('cartão do Studio não tem Líder, CTR nem Próxima troca e tem o selo "No Studio"', () => {
    const { container } = secao([cartaoStudio()])
    expect(screen.getByText('No Studio')).toBeTruthy()
    expect(container.textContent).not.toMatch(/Líder|CTR|Próxima troca|no ar/)
    expect(container.querySelector('h3 a')).toBeNull()
  })
  it('selo do dia usa rotuloDoDia: dia passado 0 de teto 15 → "Dia 1/15"', () => {
    secao([cartaoLab({ diaV2: { dia: 0, teto: 15 } })])
    expect(screen.getByText('Dia 1/15')).toBeTruthy()
  })
  it('botão "Encerrar e escolher": ativo sem pendência = 1; ativo com pendência = 0; queued = 0; Studio = 0', () => {
    const n = (c: CartaoEmTeste) => { const r = secao([c]); const k = screen.queryAllByRole('button', { name: 'Encerrar e escolher' }).length; r.unmount(); return k }
    expect(n(cartaoLab())).toBe(1)
    expect(n(cartaoLab({ pendencia: true }))).toBe(0)
    expect(n(cartaoLab({ status: 'queued' }))).toBe(0)
    expect(n(cartaoStudio())).toBe(0)
  })
  it('cartão com pendência mostra "Com você: aplicar B" e o botão abre o painel do cartão', () => {
    const c = cartaoLab({ pendencia: true })
    const { p } = secao([c])
    expect(screen.getByText('Com você: aplicar B')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar B' }))
    expect(p.onAbrirPainel).toHaveBeenCalledWith(c.painel, expect.any(HTMLElement))
  })
  it('nenhum botão dentro de link: clicar no botão chama onAbrirPainel com o painel do cartão', () => {
    const c = cartaoLab()
    const { container, p } = secao([c])
    expect(container.querySelector('a button')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar e escolher' }))
    expect(p.onAbrirPainel).toHaveBeenCalledWith(c.painel, expect.any(HTMLElement))
    const link = container.querySelector('h3 a')!
    expect(link.getAttribute('href')).toBe('/cms/youtube/ab-lab/t1')
    expect(container.querySelector('a[href="#"]')).toBeNull()
  })
  it('layout: 2 a 4 em grade (sem classe um); 5 ou mais mostram 4 e "Ver todos (n)"; 0 some', () => {
    const cs = (n: number) => Array.from({ length: n }, (_, i) => cartaoLab({ id: `t${i}` }))
    expect(secao(cs(2)).container.querySelector('.lab-cartao.um')).toBeNull()
    cleanup()
    const { container } = secao(cs(6))
    expect(container.querySelectorAll('article').length).toBe(4)
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos (6)' }))
    expect(container.querySelectorAll('article').length).toBe(6)
    cleanup()
    expect(secao([]).container.innerHTML).toBe('')
  })
})

describe('Com você', () => {
  it('"O que é automático?" abre e fecha; Esc fecha e devolve o foco ao botão', () => {
    faixa([])
    const b = screen.getByRole('button', { name: 'O que é automático?' })
    expect(b.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(b)
    expect(b.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(TEXTO_AUTOMATICO)).toBeTruthy()
    screen.getByText('Nada com você agora.').focus()
    fireEvent.keyDown(b, { key: 'Escape' })
    expect(b.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(b)
    expect(b.getAttribute('aria-controls')).toBe(document.getElementById(b.getAttribute('aria-controls')!)!.id)
  })
  it('vazio: "Nada com você agora." + frase do modelo', () => {
    const { container } = faixa([], { vazio: 'Próxima decisão: 08/11.' })
    expect(container.textContent).toContain('Nada com você agora. Próxima decisão: 08/11.')
  })
  it('item aplicar chama onAbrirPainel com o painel do modelo; dia14 chama onAbrirDia14 com a linha inteira do item', () => {
    const painel = painelFake()
    const linha = linhaStudio()
    const { p, container } = faixa([
      { tipo: 'aplicar', titulo: 'Aladdin', letra: 'B', motivo: 'sugerida pelo teste', painel },
      { tipo: 'dia14', titulo: 'Sukhumvit', linha, ytId: 'yt9', prazo: '08/11', vencido: false },
    ])
    expect(container.textContent).toContain('Aplique B em “Aladdin”')
    expect(container.textContent).toContain('Prazo: hoje')
    expect(container.textContent).toContain('vence 08/11')
    expect(screen.getByText('(2)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar B' }))
    expect(p.onAbrirPainel).toHaveBeenCalledWith(painel, expect.any(HTMLElement))
    fireEvent.click(screen.getByRole('button', { name: 'Dizer o que o Studio escolheu' }))
    expect(p.onAbrirDia14).toHaveBeenCalledWith(linha, expect.any(HTMLElement))
    const link = screen.getByRole('link', { name: 'Abrir no Studio' })
    expect(link.getAttribute('href')).toBe('https://studio.youtube.com/video/yt9/edit')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener')
  })
  it('dia14 vencido diz "Prazo acabou em dd/mm"', () => {
    const { container } = faixa([{ tipo: 'dia14', titulo: 'S', linha: linhaStudio(), ytId: 'y', prazo: '08/11', vencido: true }])
    expect(container.textContent).toContain('Prazo acabou em 08/11')
  })
  it('rascunho, retomar, conferir_studio e primeiro_teste: texto e ação de cada um', () => {
    const { p } = faixa([
      { tipo: 'rascunho', draftId: 'd1', titulo: 'GB', passo: 2 },
      { tipo: 'retomar', titulo: 'TT', testId: 't9', pausadoHaDias: 5 },
      { tipo: 'conferir_studio', titulo: 'SK', ytId: 'y1' },
      { tipo: 'primeiro_teste' },
    ])
    expect(screen.getByText('Você parou no passo 2 de 3. O Lab não cria o teste sozinho.')).toBeTruthy()
    expect(screen.getByText('Pausado há 5 dias. O Lab não retoma sozinho.')).toBeTruthy()
    expect(screen.getByText('Teste criado no Studio, sem ficha no Lab. O Lab não lê o resultado do Studio.')).toBeTruthy()
    expect(screen.getByText('O Lab não escolhe vídeo nem escreve versões; você faz isso no assistente, em 3 passos.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar rascunho' }))
    expect(p.onContinuarRascunho).toHaveBeenCalledWith('d1')
    fireEvent.click(screen.getByRole('button', { name: 'Retomar' }))
    expect(p.onAbrirTeste).toHaveBeenCalledWith('t9')
    fireEvent.click(screen.getByRole('button', { name: 'Novo teste' }))
    expect(p.onNovoTeste).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Abrir no Studio' }).getAttribute('href')).toBe('https://studio.youtube.com/video/y1/edit')
  })
  it('todo botão de item e do cartão usa alvo de 44px (.lab-alvo) e nenhum texto usa classe abaixo de 12px', () => {
    const a = faixa([{ tipo: 'primeiro_teste' }, { tipo: 'retomar', titulo: 'TT', testId: 't', pausadoHaDias: 1 }])
    const b = secao([cartaoLab(), cartaoStudio()], {})
    const todos = [...a.container.querySelectorAll('button, a.lab-btn'), ...b.container.querySelectorAll('button')]
    for (const el of todos) expect(el.className, el.textContent ?? '').toContain('lab-alvo')
    for (const html of [a.container.innerHTML, b.container.innerHTML]) expect(html).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
    const css = readFileSync(join(__dirname, '../src/app/cms/(authed)/youtube/ab-lab/_components/pagina/pagina-lab.css'), 'utf8')
    expect(css).toMatch(/\.lab-alvo\s*\{\s*min-height:\s*44px/)
    expect(css).not.toMatch(/font-size:\s*(?:[0-9]|1[01])px/)
  })
})
