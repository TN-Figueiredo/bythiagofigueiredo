// @vitest-environment jsdom
// Composição da página (M7 T11): ordem das seções, Concluídos, Sugestões, painel e diálogo do dia 14 ligados.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import { painelDoAtivo } from '@/lib/youtube/ab-lab-pagina/painel-decisao'
import { painelEscolhaDoConcluido } from '@/lib/youtube/ab-lab-pagina/painel-do-concluido'
import type { CartaoEmTeste, LinhaConcluida, PaginaDoLab, PainelDecisao } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { makeCardView, makeTestWithVariants } from './helpers/ab-fixtures'
import { propsDoLab, paginaVazia, listaDe } from './helpers/ab-lab-pagina-props'

const push = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('lucide-react', () => new Proxy({} as Record<string, unknown>, {
  get: (_t, prop) => (typeof prop !== 'string' || prop === 'then' ? undefined : () => null),
  has: (_t, prop) => typeof prop === 'string' && prop !== 'then',
}))
vi.mock('next/link', () => ({ default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => <a href={href} className={className}>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({ updateAbSiteSettings: vi.fn(), batchStartTests: vi.fn() }))

afterEach(() => { cleanup(); push.mockClear() })

const agora = new Date('2026-10-26T15:00:00Z')
const mk = (id: string, label: 'A' | 'B', isOriginal: boolean) => ({ id, label, color: '#000', thumbUrl: null, title: `Título ${label}`, isOriginal })
const vars = [mk('va', 'A', true), mk('vb', 'B', false)]
const card = (id: string) => makeCardView({ id, type: 'title', variants: vars, videoTitle: 'Aladdin', restoreSeq: 3 })
type Conc = Extract<TelaV2, { fase: 'concluido' }>
const telaConc = (o: Partial<Conc>): Conc => ({
  fase: 'concluido', selo: { tipo: 'vence', provisorio: false, letra: 'B' }, frase: { principal: '', apoio: null }, prazo: null,
  noAr: { tipo: 'original' }, aplicar: null, voltar: false, aplicarDeNovo: null, bloqueio: null, n: null, pisos: null, tentarDeNovo: false, ...o,
})
const painelAtivo = (): PainelDecisao => painelDoAtivo(card('t1'), { ctrs: {}, noArLetra: 'A', sugeridaId: 'vb', regraV2: true, podeDeixarVariante: true })
const painelConc = () => painelEscolhaDoConcluido({
  card: card('c1'), bruto: { ...makeTestWithVariants(), id: 'c1', test_type: 'title', status: 'completed' }, tela: telaConc({ aplicar: { variant_id: 'vb', letra: 'B' } }), ctrs: {},
}, true)!

function linhaStudio(o: Partial<LinhaDoCaminho> = {}): LinhaDoCaminho {
  return {
    videoId: 'v9', ytId: 'yt900000009', titulo: 'Vídeo do Studio', miniaturaUrl: null, publicadoEm: '2026-09-01T00:00:00Z', estado: 'resultado_pronto',
    caminho: { tipo: 'nativo' } as LinhaDoCaminho['caminho'], fichaId: null, labPausadoAte: null, nosso: null, impressoesPorDia: null,
    registro: {
      id: 'r1', updatedAt: '2026-10-25T00:00:00Z', confirmadoEm: '2026-10-10T00:00:00Z', primeiraVista: null, diaDe14: 15,
      variantes: [{ n: 1, titulo: 'Original', imagem: null }, { n: 2, titulo: 'Nova', imagem: null }], variantesTitulo: null, campos: ['titulo'],
      respostaDono: null, tituloAntes: null, varianteVencedora: null, respondidoEm: null, respostaMudadaEm: null, vencedorFonte: null,
      vencedorTitulo: null, desfechoEm: null, inicio: '2026-10-10T00:00:00Z',
    },
    ...o,
  } as LinhaDoCaminho
}

const cartaoLab = (): CartaoEmTeste => ({ tipo: 'lab', card: card('t1'), lider: null, semLider: 'CTR não medido', proximaTroca: '~20h', painel: painelAtivo() })
const linhaConc = (o: Partial<LinhaConcluida> = {}): LinhaConcluida => ({
  chave: 'lab:c1', origem: 'lab', testId: 'c1', ytId: 'yt1', titulo: 'Vídeo concluído', miniaturaUrl: 'https://img/c1.jpg', tipo: 'Título',
  resultado: 'B sugerido pelo teste', apoio: 'falta aplicar no vídeo', painel: painelConc(), selos: null, concluidoEm: '20/10', ordem: '2026-10-20T00:00:00Z', ...o,
})
const paginaCheia = (): PaginaDoLab => ({
  topo: { frase: 'Um teste rodando. Uma coisa com você: aplicar B.' },
  comVoce: { itens: [{ tipo: 'aplicar', testId: 'c1', titulo: 'Aladdin', letra: 'B', motivo: 'sugerida pelo teste', painel: painelConc() }], vazio: null },
  emTeste: [cartaoLab()],
  concluidos: { linhas: [linhaConc()], total: 1, regua: { feitos: 1, meta: 3 } },
  temHistorico: true,
})
const sugestoes = <p>bloco de sugestões</p>

describe('página do A/B Lab: composição', () => {
  it('ordem das seções por data-secao, incluindo o slot de Sugestões', () => {
    const { container } = render(<AbLabDashboard {...propsDoLab({ pagina: paginaCheia(), blocoSugestoes: sugestoes })} />)
    const secoes = [...container.querySelectorAll('[data-secao]')].map(n => n.getAttribute('data-secao'))
    expect(secoes).toEqual(['com-voce', 'em-teste', 'sugestoes', 'concluidos', 'videos-do-canal'])
    expect(screen.getByText('bloco de sugestões')).toBeTruthy()
  })
  it('estado b2 (sem história): sem a seção Concluídos e sem Em teste agora', () => {
    const { container } = render(<AbLabDashboard {...propsDoLab({ pagina: paginaVazia({ comVoce: { itens: [{ tipo: 'primeiro_teste' }], vazio: null } }), blocoSugestoes: sugestoes })} />)
    const secoes = [...container.querySelectorAll('[data-secao]')].map(n => n.getAttribute('data-secao'))
    expect(secoes).toEqual(['com-voce', 'sugestoes', 'videos-do-canal'])
  })
  it('topo: h1, frase do modelo, Biblioteca, Ajustes e Novo teste; sem faixa de KPIs e sem Candidatos', () => {
    const { container } = render(<AbLabDashboard {...propsDoLab({ pagina: paginaCheia() })} />)
    expect(screen.getByRole('heading', { level: 1, name: 'A/B Lab' })).toBeTruthy()
    expect(container.querySelector('.resumo')!.textContent).toBe('Um teste rodando. Uma coisa com você: aplicar B.')
    expect(screen.getByRole('link', { name: 'Biblioteca' }).getAttribute('href')).toBe('/cms/youtube/ab-lab/library')
    expect(screen.getByLabelText('Configurações')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Novo teste' })).toBeTruthy()
    expect(container.querySelector('[data-kpi-strip]')).toBeNull()
    expect(container.textContent).not.toMatch(/Candidatos|Nossos testes ativos|Vencedores escolhidos/)
    expect(container.textContent).not.toMatch(/thumbnail/i)
  })
  it('Concluídos: linha com miniatura real, resultado, apoio e a régua "Coletando dados: 1 de 3"', () => {
    const { container } = render(<AbLabDashboard {...propsDoLab({ pagina: paginaCheia() })} />)
    const sec = container.querySelector('[data-secao="concluidos"]') as HTMLElement
    expect(within(sec).getByText('1 teste')).toBeTruthy()
    expect(sec.querySelector('img')!.getAttribute('src')).toBe('https://img/c1.jpg')
    expect(within(sec).getByText('B sugerido pelo teste')).toBeTruthy()
    expect(within(sec).getByText('falta aplicar no vídeo')).toBeTruthy()
    expect(within(sec).getByText('Coletando dados: 1 de 3 testes concluídos')).toBeTruthy()
    expect(within(sec).getByText('Com 3 testes o Lab começa a mostrar o que funciona no seu canal.')).toBeTruthy()
  })
  it('com 3 ou mais concluídos (regua nula) o painel de aprendizados ocupa o lugar da régua', () => {
    const p = paginaCheia()
    p.concluidos = { ...p.concluidos, total: 3, regua: null }
    const { container } = render(<AbLabDashboard {...propsDoLab({ pagina: p })} />)
    expect(container.textContent).not.toContain('Coletando dados')
  })
  it('"Ver testes anteriores" é aria-disabled, tem o selo "Em breve" e clicar não navega', () => {
    render(<AbLabDashboard {...propsDoLab({ pagina: paginaCheia() })} />)
    const b = screen.getByRole('button', { name: 'Ver testes anteriores' })
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(within(b.parentElement as HTMLElement).getByText('Em breve')).toBeTruthy()
    fireEvent.click(b)
    expect(push).not.toHaveBeenCalled()
  })
  it('linha de Concluídos quebra a 390: wrap, miniatura menor e resultado em linha inteira (Logan C2)', () => {
    const { container } = render(<AbLabDashboard {...propsDoLab({ pagina: paginaCheia() })} />)
    const linha = container.querySelector('[data-concluido]') as HTMLElement
    expect(linha.className).toContain('flex-wrap')
    expect(linha.querySelector('.lab-th')!.className).toContain('max-sm:!w-16')
    expect(linha.querySelector('b.text-\\[13px\\]')!.parentElement!.className).toContain('max-sm:basis-full')
  })
  it('item "Aplicar B" da faixa e a linha do Concluído abrem o mesmo painel de escolha', () => {
    const { container } = render(<AbLabDashboard {...propsDoLab({ pagina: paginaCheia() })} />)
    const abrir = [screen.getByRole('button', { name: 'Aplicar B' }), container.querySelector('button[data-concluido]') as HTMLElement]
    for (const b of abrir) {
      fireEvent.click(b)
      expect(screen.getByRole('dialog', { name: 'O que fica no vídeo?' })).toBeTruthy()
      fireEvent.click(screen.getAllByRole('button', { name: 'Fechar' })[0]!)
      expect(screen.queryByRole('dialog')).toBeNull()
    }
  })
  it('"Encerrar e escolher" do cartão ativo abre o painel do cartão', () => {
    render(<AbLabDashboard {...propsDoLab({ pagina: { ...paginaCheia(), comVoce: { itens: [], vazio: null } } })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar e escolher' }))
    expect(screen.getByRole('dialog', { name: 'O que fica no vídeo?' })).toBeTruthy()
  })
  it('filtro de tipo esconde cartões e concluídos de outro tipo', () => {
    render(<AbLabDashboard {...propsDoLab({ pagina: paginaCheia() })} />)
    fireEvent.click(screen.getByRole('button', { name: /Todos os tipos/ }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Miniatura' }).pop()!)
    expect(screen.queryByRole('button', { name: 'Encerrar e escolher' })).toBeNull()
    expect(screen.queryByText('Vídeo concluído')).toBeNull()
  })
  it('buscar texto sem resultado e clicar "Dizer o que o Studio escolheu" na faixa abre o diálogo com as versões (a linha vem do item)', () => {
    const l = linhaStudio()
    const p = paginaVazia({ comVoce: { itens: [{ tipo: 'dia14', titulo: l.titulo, linha: l, ytId: l.ytId, prazo: '08/11', vencido: false }], vazio: null } })
    // a lista inicial NÃO tem a linha: o diálogo usa a do item
    render(<AbLabDashboard {...propsDoLab({ pagina: p })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dizer o que o Studio escolheu' }))
    expect(screen.getByRole('dialog', { name: FRASES.dia14.tituloDialogo })).toBeTruthy()
    expect(screen.getByText('Nova')).toBeTruthy()
  })
  it('Vídeos do canal fica por último e recolhido', () => {
    const { container } = render(<AbLabDashboard {...propsDoLab({ pagina: paginaCheia(), listaInicial: listaDe([linhaStudio({ estado: 'em_teste_studio' })]) })} />)
    const d = container.querySelector('[data-secao="videos-do-canal"] details') as HTMLDetailsElement
    expect(d.open).toBe(false)
    expect(within(d).getByText('Vídeos do canal')).toBeTruthy()
  })
})

describe('página do A/B Lab: regras lidas na fonte', () => {
  const raiz = join(process.cwd(), 'src/app/cms/(authed)/youtube/ab-lab/_components')
  const fonte = (f: string): string => readFileSync(join(raiz, f), 'utf8')
  const arquivosDaPagina = ['ab-lab-dashboard.tsx', ...readdirSync(join(raiz, 'pagina')).filter(f => f.endsWith('.tsx')).map(f => `pagina/${f}`)]
  it('nada abaixo de 12 px: sem text-[9px], text-[10px] nem text-[11px] no dashboard e nos componentes da página', () => {
    for (const f of arquivosDaPagina) expect(fonte(f).match(/text-\[(9|10|11)px\]/g), f).toBeNull()
  })
  it('o dashboard (client) não importa a action de ajustes: ela chega por prop', () => {
    expect(fonte('ab-lab-dashboard.tsx')).not.toMatch(/from '\.\.\/actions'/)
  })
})

describe('estilo da página do Lab (CSS como texto)', () => {
  it('chip com aria-pressed tem estado visual por forma (sublinhado e peso), não só cor (Naksu C1)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/cms/(authed)/youtube/ab-lab/_components/pagina/pagina-lab.css'), 'utf8')
    expect(css).toMatch(/\.lab-btn\[aria-pressed="true"\][^}]*box-shadow: inset 0 -2px 0/)
    expect(css).toMatch(/\.lab-btn\[aria-pressed="true"\][^}]*font-weight: 600/)
    expect(css).toMatch(/\.lab-btn\[aria-pressed="false"\]/)
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('color-mix')
  })
  it('.lab-acoes usa tokens, não literais soltos (Naksu S6), e a busca tem borda de controle (S4)', () => {
    const base = resolve(process.cwd(), 'src/app/cms/(authed)/youtube/ab-lab/_components/pagina')
    const css = readFileSync(resolve(base, 'pagina-lab.css'), 'utf8')
    const linha = css.split('\n').find(l => l.includes('.lab-acoes {') && l.includes('sticky'))!
    expect(linha).toContain('var(--lab-surface)')
    expect(linha).not.toMatch(/#221E1A|#332D25/)
    expect(readFileSync(resolve(base, 'videos-do-canal.tsx'), 'utf8')).toContain('border-[#6B6252]')
  })
})
