// @vitest-environment jsdom
/** A3 Tarefa 9: os cinco mais vistos, a publicação em 90 dias, o cartão da forja "ainda não disponível" e os estados vazios da comparação. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canalDe, pacoteDe, type OpcoesCanal } from './par-helpers'
import { NUMEROS } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import type { CanalPack, CompararPack, Pub90Item, Top5Item } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { buildPar } from '@/app/cms/(authed)/youtube/competitors/_comparar/par-model'
import { CompararScreen } from '@/app/cms/(authed)/youtube/competitors/_comparar/comparar-screen'
import { MaisVistos } from '@/app/cms/(authed)/youtube/competitors/_comparar/mais-vistos'
import { Publicacao } from '@/app/cms/(authed)/youtube/competitors/_comparar/publicacao'
import { ForjaIndisponivel } from '@/app/cms/(authed)/youtube/competitors/_comparar/forja-indisponivel'
import { link } from '@/lib/youtube/observatorio/links'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => { throw new Error('a tela não usa o router') } }))

const DIA = 86_400_000
const ALL = (v: number): OpcoesCanal['n'] => Object.fromEntries(NUMEROS.map(k => [k, v])) as OpcoesCanal['n']
const top = (id: string, titulo: string, o: Partial<Top5Item> = {}): Top5Item => ({
  id, abre: true, titulo, thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, viewsTexto: '12 mil views', idadeTexto: 'há 3 dias', short: false, ...o,
})
const base = pacoteDe([])
const pub = (dias: number, fmt: Pub90Item['fmt'], dataTexto = '10/03 14:00'): Pub90Item => ({ t: base.now - dias * DIA, fmt, dataTexto })

/** Um canal com vídeos: cinco mais vistos e publicação em 90 dias. */
function comVideos(id: string, o: OpcoesCanal = {}, extra: Partial<CanalPack> = {}): CanalPack {
  return {
    ...canalDe(id, { n: ALL(10), subs: 1000, ...o }), comDatas: true,
    top5: [top(`${id}-1`, `Primeiro de ${id}`), top(`${id}-2`, `Segundo de ${id}`, { short: true, viewsTexto: '1 view', idadeTexto: 'há 2 meses' }), top(`${id}-3`, `Terceiro de ${id}`)],
    top5Nota: 'Só 3 vídeos com contagem de views.',
    pub90: [pub(80, 'long', '12/01 09:00'), pub(40, 'short', '21/02 18:30'), pub(10, null, '23/03 08:15'), pub(2, 'long', '30/03 20:00')],
    pub90Nota: '2 longos e 1 Short nos últimos 90 dias e 1 de formato não confirmado.',
    ...extra,
  }
}
/** Um canal sem nenhum vídeo guardado. */
const semVideos = (id: string, o: OpcoesCanal = {}): CanalPack => ({
  ...canalDe(id, { semVideos: true, comDatas: false, n: { inscritos: 10 }, motivos: Object.fromEntries(NUMEROS.map(k => [k, 'sem vídeos'])), ...o }),
  top5: [], top5Nota: 'Este canal não tem vídeos.', pub90: [], pub90Nota: 'ainda sem vídeos sincronizados',
})

const pacote = (...canais: CanalPack[]): CompararPack => pacoteDe(canais)
const PACK = pacote(
  comVideos('eu', { own: true, name: 'tnFigueiredo' }), comVideos('c1', { name: 'Leo Khev', subs: 5000 }), comVideos('c2', { name: 'Ana Viaja', subs: 3000 }),
  comVideos('c3', { name: 'Beto Rota', subs: 120 }),
)
const par = (p: CompararPack, a: string, b: string) => buildPar(p, a, b)
const dentro = (el: React.ReactElement) => render(<div data-obs="" data-obs-screen="comparar">{el}</div>)
const wrap = (p: CompararPack, a: string, b: string) => (window.history.replaceState(null, '', `/cms/youtube/competitors/comparar?a=${a}&b=${b}`), render(<div data-obs=""><CompararScreen pack={p} inicial={{ a, b }} /></div>))
const secao = (nome: string | RegExp) => screen.getByRole('heading', { level: 2, name: nome }).closest('section') as HTMLElement
const leftDe = (el: Element) => parseFloat((el as HTMLElement).style.left)

beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/comparar?a=eu&b=c1') })
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.getElementById('flut')?.remove() })

describe('Os 5 vídeos mais vistos de cada canal', () => {
  it('duas colunas com o chip do lado; cada item é um link com capa, título, views, idade e a marca "Short"', () => {
    const { container } = dentro(<MaisVistos par={par(PACK, 'eu', 'c1')} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Os 5 vídeos mais vistos de cada canal' })).toBeTruthy()
    const cols = [...container.querySelectorAll<HTMLElement>('.cp-vc')]
    expect(cols).toHaveLength(2)
    expect(within(cols[0]!).getByText('Lado A').className).toContain('lm')
    expect(within(cols[1]!).getByText('Lado B').className).toContain('lm')
    expect(within(cols[0]!).getByRole('heading', { level: 3 }).textContent).toContain('tnFigueiredo')
    expect(within(cols[1]!).getByRole('heading', { level: 3 }).textContent).toContain('Leo Khev')
    const itens = [...cols[0]!.querySelectorAll('li')]
    expect(itens).toHaveLength(3)
    const segundo = itens[1]!
    expect(segundo.querySelector('a')).not.toBeNull()
    expect(segundo.querySelector('img')).not.toBeNull()
    expect(segundo.textContent).toContain('Segundo de eu')
    expect(segundo.textContent).toContain('1 view')
    expect(segundo.textContent).toContain('há 2 meses')
    expect(segundo.textContent).toContain('Short')
    expect(itens[0]!.textContent).not.toContain('Short')
    expect(itens[0]!.textContent).toContain('12 mil views')
  })

  it('a capa tem alt="" (o título está no link); o link do vídeo é o Histórico do vídeo (D19), de volta a ESTA comparação com o mesmo par', () => {
    const { container } = dentro(<MaisVistos par={par(PACK, 'eu', 'c1')} />)
    for (const img of container.querySelectorAll('img')) expect(img.getAttribute('alt')).toBe('')
    const links = [...container.querySelectorAll<HTMLAnchorElement>('.cp-t5 a')]
    expect(links).toHaveLength(6)
    // concorrente (lado B) e canal próprio (lado A): o mesmo destino, D19
    for (const [id, a] of [['c1-1', links[3]!], ['eu-1', links[0]!]] as const) {
      const href = a.getAttribute('href')!
      expect(href).toBe(link.historico(id, { from: 'comparar', back: '?a=eu&b=c1' }))
      const q = new URL(href, 'http://x').searchParams
      expect(q.get('from')).toBe('comparar')
      expect(q.get('back')!.startsWith('?')).toBe(true)
      expect(q.get('back')).toBe('?a=eu&b=c1')
    }
    // o título está no nome do link
    expect(links[0]!.textContent).toContain('Primeiro de eu')
  })

  it('com os lados trocados o back leva o par na ordem nova', () => {
    const { container } = dentro(<MaisVistos par={par(PACK, 'c1', 'eu')} />)
    const a = container.querySelector<HTMLAnchorElement>('.cp-t5 a')!
    expect(new URL(a.getAttribute('href')!, 'http://x').searchParams.get('back')).toBe('?a=c1&b=eu')
  })

  it('canal com menos de cinco vídeos com contagem diz quantos; canal sem vídeos diz "Este canal não tem vídeos."', () => {
    const p = pacote(comVideos('a1', { name: 'Ana' }), semVideos('b1', { name: 'Beto' }), comVideos('c1', { name: 'Cris' }, { top5: [top('c1-1', 'Único')], top5Nota: 'Só 1 vídeo com contagem de views.' }))
    const { container, rerender } = dentro(<MaisVistos par={par(p, 'a1', 'b1')} />)
    const cols = [...container.querySelectorAll<HTMLElement>('.cp-vc')]
    expect(cols[0]!.textContent).toContain('Só 3 vídeos com contagem de views.')
    expect(cols[1]!.textContent).toContain('Este canal não tem vídeos.')
    expect(cols[1]!.querySelector('ol')).toBeNull()
    expect(cols[1]!.querySelector('img')).toBeNull()
    rerender(<div data-obs="" data-obs-screen="comparar"><MaisVistos par={par(p, 'c1', 'a1')} /></div>)
    expect(container.querySelector('.cp-vc')!.textContent).toContain('Só 1 vídeo com contagem de views.')
    expect(container.querySelector('.cp-vc')!.querySelectorAll('li')).toHaveLength(1)
  })

  it('os dois sem vídeos: cada coluna diz a sua frase, nenhuma lista vazia', () => {
    const p = pacote(semVideos('a1', { name: 'Ana' }), semVideos('b1', { name: 'Beto' }))
    const { container } = dentro(<MaisVistos par={par(p, 'a1', 'b1')} />)
    const cols = [...container.querySelectorAll<HTMLElement>('.cp-vc')]
    expect(cols).toHaveLength(2)
    for (const c of cols) { expect(c.textContent).toContain('Este canal não tem vídeos.'); expect(c.querySelector('ol')).toBeNull() }
  })

  it('canal em primeira sincronização sem vídeos: a frase fala de sincronização, não de "não tem vídeos"', () => {
    const p = pacote(comVideos('a1', { name: 'Ana' }), { ...semVideos('b1', { name: 'Beto' }), top5Nota: 'A primeira sincronização ainda não terminou: os vídeos aparecem quando ela terminar.' })
    const { container } = dentro(<MaisVistos par={par(p, 'a1', 'b1')} />)
    const b = container.querySelectorAll('.cp-vc')[1]!
    expect(b.textContent).toContain('A primeira sincronização ainda não terminou')
    expect(b.textContent).not.toContain('não tem vídeos')
  })

  it('thumbnail sem imagem: texto honesto, nunca <img> quebrada; e uma imagem que falha ao carregar vira o mesmo texto', () => {
    const p = pacote(comVideos('a1', { name: 'Ana' }, { top5: [top('a1-1', 'Sem capa', { thumb: null }), top('a1-2', 'Com capa')] }), comVideos('b1', { name: 'Beto' }))
    const { container } = dentro(<MaisVistos par={par(p, 'a1', 'b1')} />)
    const itens = [...container.querySelectorAll('.cp-vc')[0]!.querySelectorAll('li')]
    expect(itens[0]!.querySelector('img')).toBeNull()
    expect(itens[0]!.textContent).toContain('sem capa')
    const img = itens[1]!.querySelector('img')!
    expect(itens[1]!.textContent).not.toContain('sem capa')
    fireEvent.error(img)
    expect(itens[1]!.querySelector('img')).toBeNull()
    expect(itens[1]!.textContent).toContain('sem capa')
  })

  it('título com HTML ou emoji aparece escapado, como texto', () => {
    const feio = '<img src=x onerror=alert(1)> & <b>negrito</b> 🎬🔥'
    const p = pacote(comVideos('a1', { name: 'Ana' }, { top5: [top('a1-1', feio)] }), comVideos('b1', { name: 'Beto' }))
    const { container } = dentro(<MaisVistos par={par(p, 'a1', 'b1')} />)
    const li = container.querySelector('.cp-vc li')!
    expect(li.textContent).toContain(feio)
    expect(li.querySelectorAll('b')).toHaveLength(1) // só o <b> do título, com o "<b>negrito</b>" como letras
    expect(li.querySelector('b')!.textContent).toBe(feio)
    expect(li.querySelectorAll('img')).toHaveLength(1) // só a capa
    expect(container.innerHTML).not.toContain('<img src="x"')
  })

  it('nome do canal com HTML também é escapado', () => {
    const p = pacote(comVideos('a1', { name: '<script>x</script>Ana' }), comVideos('b1', { name: 'Beto' }))
    const { container } = dentro(<MaisVistos par={par(p, 'a1', 'b1')} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>x</script>Ana')
  })
})

describe('Publicação nos últimos 90 dias', () => {
  it('uma faixa por canal, um traço por vídeo, alto para longo e baixo para Short (e outra forma para o não confirmado), e as quatro datas do eixo', () => {
    const { container } = dentro(<Publicacao par={par(PACK, 'eu', 'c1')} pack={PACK} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Publicação nos últimos 90 dias' })).toBeTruthy()
    const faixas = [...container.querySelectorAll<HTMLElement>('.cp-strip')]
    expect(faixas).toHaveLength(2)
    for (const f of faixas) {
      expect(f.querySelectorAll('i.t')).toHaveLength(4)
      expect(f.querySelectorAll('i.t.lg')).toHaveLength(2)
      expect(f.querySelectorAll('i.t.sh')).toHaveLength(1)
      expect(f.querySelectorAll('i.t.nc')).toHaveLength(1)
    }
    const eixo = container.querySelector('.cp-axis')!
    expect([...eixo.querySelectorAll('span')].map(s => s.textContent)).toEqual(PACK.eixo)
    // a cor não é o único sinal: o lado tem letra e nome ao lado da faixa
    const linhas = [...container.querySelectorAll<HTMLElement>('.cp-pr')].filter(l => l.querySelector('.cp-strip'))
    expect(within(linhas[0]!).getByText('Lado A')).toBeTruthy(); expect(linhas[0]!.textContent).toContain('tnFigueiredo')
    expect(within(linhas[1]!).getByText('Lado B')).toBeTruthy(); expect(linhas[1]!.textContent).toContain('Leo Khev')
  })

  it('os traços dos dois canais usam o mesmo eixo: o mesmo instante dá o mesmo left nas duas faixas, e o início/hoje ficam em 0% e 100%', () => {
    const mesmo = pub(30, 'long', '20/02 10:00')
    const p = pacote(
      comVideos('a1', { name: 'Ana' }, { pub90: [mesmo, { t: base.inicio90, fmt: 'long', dataTexto: 'início' }, { t: base.now, fmt: 'short', dataTexto: 'hoje' }] }),
      comVideos('b1', { name: 'Beto' }, { pub90: [{ ...mesmo }, pub(60, 'long')] }),
    )
    const { container } = dentro(<Publicacao par={par(p, 'a1', 'b1')} pack={p} />)
    const [fa, fb] = [...container.querySelectorAll<HTMLElement>('.cp-strip')] as [HTMLElement, HTMLElement]
    const esperado = ((mesmo.t - base.inicio90) / (90 * DIA)) * 100
    const lefts = (f: HTMLElement) => [...f.querySelectorAll('i.t')].map(leftDe)
    expect(lefts(fa)).toContainEqual(expect.closeTo(esperado, 1))
    expect(lefts(fb)).toContainEqual(expect.closeTo(esperado, 1))
    expect(leftDe(fa.querySelectorAll('i.t')[0]!)).toBeCloseTo(lefts(fb)[lefts(fb).length === 2 ? 0 : 0]!, 5) // o primeiro de cada um é o mesmo instante
    expect(Math.min(...lefts(fa))).toBe(0)
    expect(Math.max(...lefts(fa))).toBe(100)
    for (const f of [fa, fb]) for (const l of lefts(f)) { expect(l).toBeGreaterThanOrEqual(0); expect(l).toBeLessThanOrEqual(100) }
  })

  it('a faixa é role="img" com as datas, a contagem e o mais recente no aria-label; a frase conta longos, Shorts e os de formato não confirmado', () => {
    const { container } = dentro(<Publicacao par={par(PACK, 'eu', 'c1')} pack={PACK} />)
    const faixa = container.querySelector('.cp-strip')!
    expect(faixa.getAttribute('role')).toBe('img')
    const aria = faixa.getAttribute('aria-label')!
    expect(aria).toContain('tnFigueiredo')
    expect(aria).toContain('4 vídeos')
    for (const d of ['12/01 09:00', '21/02 18:30', '23/03 08:15', '30/03 20:00']) expect(aria).toContain(d)
    expect(aria).toMatch(/mais recente.*30\/03 20:00/)
    expect(container.textContent).toContain('2 longos e 1 Short nos últimos 90 dias e 1 de formato não confirmado.')
  })

  it('canal com datas e nenhum vídeo em 90 dias: a faixa fica, a frase diz quando foi o último, e o aria-label não inventa datas', () => {
    const p = pacote(
      comVideos('a1', { name: 'Ana' }, { pub90: [], pub90Nota: 'Nenhum vídeo nos últimos 90 dias; o último foi em 02/05, há 150 dias.' }), comVideos('b1', { name: 'Beto' }),
    )
    const { container } = dentro(<Publicacao par={par(p, 'a1', 'b1')} pack={p} />)
    const f = container.querySelector('.cp-strip')!
    expect(f.querySelectorAll('i.t')).toHaveLength(0)
    expect(f.getAttribute('aria-label')).toContain('nenhum vídeo')
    expect(container.textContent).toContain('Nenhum vídeo nos últimos 90 dias; o último foi em 02/05, há 150 dias.')
  })

  it('um lado sem datas: a frase do spec 18.7 para produção ("ainda sem vídeos sincronizados") e só a contagem de longos em 90 dias, sem faixa', () => {
    const p = pacote(comVideos('a1', { name: 'Ana' }), semVideos('b1', { name: 'Beto' }))
    const { container } = dentro(<Publicacao par={par(p, 'a1', 'b1')} pack={p} />)
    expect(container.querySelectorAll('.cp-strip')).toHaveLength(1)
    const lado = [...container.querySelectorAll<HTMLElement>('.cp-pr')].find(l => l.textContent!.includes('Beto'))!
    expect(lado.querySelector('.cp-strip')).toBeNull()
    expect(lado.textContent).toContain('ainda sem vídeos sincronizados')
    expect(lado.textContent).toMatch(/Longos publicados em 90 dias: não medido \(sem vídeos\)/)
    expect(lado.textContent).not.toMatch(/Longos publicados em 90 dias: 0/)
    // a contagem de um canal sem datas mas com a medida mostra o número (nunca inventa)
    const q = pacote(comVideos('a1', { name: 'Ana' }), { ...semVideos('b1', { name: 'Beto' }), numeros: { ...semVideos('b1').numeros, longos90: { x: 0, texto: '0', motivo: null, nota: null } } })
    cleanup()
    const r = dentro(<Publicacao par={par(q, 'a1', 'b1')} pack={q} />)
    expect(r.container.textContent).toMatch(/Longos publicados em 90 dias: 0/)
  })

  it('I-B: canal COM vídeos, mas nenhum com data: a frase do pacote e "não medido (nenhum vídeo com data de publicação)", nunca "0"', () => {
    const semData: CanalPack = {
      ...canalDe('b1', { name: 'Beto', comDatas: false, motivos: { longos90: 'nenhum vídeo com data de publicação' }, n: { inscritos: 10 } }),
      semVideos: false, pub90Nota: 'Os vídeos deste canal ainda não têm data de publicação.',
    }
    const p = pacote(comVideos('a1', { name: 'Ana' }), semData)
    const { container } = dentro(<Publicacao par={par(p, 'a1', 'b1')} pack={p} />)
    const lado = [...container.querySelectorAll<HTMLElement>('.cp-pr')].find(l => l.textContent!.includes('Beto'))!
    expect(lado.textContent).toContain('Os vídeos deste canal ainda não têm data de publicação.')
    expect(lado.textContent).toMatch(/Longos publicados em 90 dias: não medido \(nenhum vídeo com data de publicação\)/)
    expect(lado.textContent).not.toMatch(/Longos publicados em 90 dias: 0/)
  })

  it('nenhum dos dois com datas: o bloco não existe (nem o título nem um eixo vazio) e o rodapé da tela diz', () => {
    const p = pacote(semVideos('a1', { name: 'Ana' }), semVideos('b1', { name: 'Beto' }))
    const { container } = dentro(<Publicacao par={par(p, 'a1', 'b1')} pack={p} />)
    expect(container.querySelector('.cp-sec')).toBeNull()
    expect(container.textContent).toBe('')
    cleanup()
    wrap(p, 'a1', 'b1')
    expect(screen.queryByRole('heading', { name: 'Publicação nos últimos 90 dias' })).toBeNull()
    expect(document.querySelector('.cp-axis')).toBeNull()
    expect(document.body.textContent).toContain('O bloco de publicação não aparece: nenhum dos dois canais tem datas de publicação.')
  })

  it('a faixa e o eixo não dependem da cor: o eixo tem as quatro datas e as linhas de 30 e 60 dias', () => {
    const { container } = dentro(<Publicacao par={par(PACK, 'eu', 'c1')} pack={PACK} />)
    expect(container.querySelectorAll('.cp-strip')[0]!.querySelectorAll('i.gl')).toHaveLength(2)
    expect(container.querySelector('.cp-axis')!.getAttribute('aria-hidden')).toBe('true') // as datas existem no aria-label e na frase de cada faixa
  })
})

describe('Os 5 mais vistos: vídeo que o Histórico não sabe abrir (I-A)', () => {
  it('o item sem data aparece SEM link, com o motivo; os outros continuam links', () => {
    const c = comVideos('c1', { name: 'Leo Khev', subs: 5000 }, {
      top5: [top('c1-1', 'Com data'), top('sd-1', 'Sem data nenhuma', { idadeTexto: 'sem data', abre: false }), top('c1-3', 'Outro com data')],
      top5Nota: '3 de 3 vídeos guardados, por views.',
    })
    const { container } = dentro(<MaisVistos par={par(pacote(comVideos('eu', { own: true, name: 'tnFigueiredo' }), c), 'eu', 'c1')} />)
    const itens = [...container.querySelectorAll('.cp-vc')[1]!.querySelectorAll('li')]
    expect(itens).toHaveLength(3) // a contagem continua: ele está na lista
    expect(itens[0]!.querySelector('a')).not.toBeNull()
    expect(itens[2]!.querySelector('a')).not.toBeNull()
    expect(itens[1]!.querySelector('a')).toBeNull()
    expect(itens[1]!.textContent).toContain('Sem data nenhuma')
    expect(itens[1]!.textContent).toContain('sem data de publicação: o histórico não abre')
    // nenhum link da coluna promete o Histórico de um vídeo que ele não acha
    const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('.cp-vc:nth-child(2) a')].map(a => a.getAttribute('href')!)
    expect(hrefs.some(h => h.includes('sd-1'))).toBe(false)
  })
  it('o texto do motivo não aparece em itens que abrem', () => {
    const { container } = dentro(<MaisVistos par={par(PACK, 'eu', 'c1')} />)
    expect(container.textContent).not.toContain('o histórico não abre')
  })
})

describe('Cartão da forja: ainda não disponível', () => {
  const FRASE_PACOTE = 'A leitura de comparação é um pacote novo para a forja e ainda não existe.'
  const botao = () => screen.getByRole('button', { name: /Pedir leitura desta comparação à forja/ })

  it('com canal próprio no par: "ainda não disponível para o seu canal", o que ela leria, o botão apagado e o porquê', () => {
    dentro(<ForjaIndisponivel par={par(PACK, 'eu', 'c1')} />)
    const r = screen.getByRole('region', { name: 'Leitura da forja' })
    expect(r.textContent).toContain('ainda não disponível para o seu canal')
    expect(r.textContent).toContain('A leitura desta comparação seria sobre os números dos dois canais lado a lado, com as mesmas cautelas das outras leituras: só diz o que está nos números, sem afirmar causa.')
    const b = botao()
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.hasAttribute('disabled')).toBe(false) // apagado, mas focável
    const porque = document.getElementById(b.getAttribute('aria-describedby')!)!
    expect(porque.textContent).toBe('Ainda não dá: a forja ainda não escreve leitura de comparação entre canais.')
    expect(porque.textContent).not.toMatch(/coleta/i) // a mesma tela diz que a coleta diária do seu canal já roda
    expect(r.textContent).toContain(FRASE_PACOTE)
    // com o canal próprio do lado B também
    cleanup()
    dentro(<ForjaIndisponivel par={par(PACK, 'c1', 'eu')} />)
    expect(screen.getByRole('region', { name: 'Leitura da forja' }).textContent).toContain('ainda não disponível para o seu canal')
  })

  it('sem canal próprio: o estado de D4 (e), o mesmo botão apagado; nenhuma etapa, nenhuma leitura de exemplo', () => {
    dentro(<ForjaIndisponivel par={par(PACK, 'c1', 'c2')} />)
    const r = screen.getByRole('region', { name: 'Leitura da forja' })
    expect(r.textContent).toContain('ainda não disponível')
    expect(r.textContent).not.toContain('para o seu canal')
    const b = botao()
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(document.getElementById(b.getAttribute('aria-describedby')!)!.textContent).toBe(FRASE_PACOTE)
    expect(r.textContent).toContain('Leo Khev'); expect(r.textContent).toContain('Ana Viaja')
    expect(r.querySelector('ol')).toBeNull()
    expect(r.querySelector('[aria-current="step"]')).toBeNull()
    expect(r.textContent).not.toMatch(/exemplo|Na fila|Escrevendo|Pronta|Simulação|em andamento/i)
  })

  it('o botão apagado não chama nada no clique nem no Enter (não há ação nesta fase)', () => {
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
    const submit = vi.fn()
    const { container } = dentro(<ForjaIndisponivel par={par(PACK, 'eu', 'c1')} />)
    container.addEventListener('submit', submit)
    const b = botao()
    b.focus()
    expect(document.activeElement).toBe(b)
    fireEvent.click(b); fireEvent.keyDown(b, { key: 'Enter' }); fireEvent.keyDown(b, { key: ' ' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(submit).not.toHaveBeenCalled()
    expect(b.getAttribute('aria-busy')).toBeNull()
    expect(b.textContent).toContain('Pedir leitura desta comparação à forja')
    expect(window.location.search).toBe('?a=eu&b=c1')
    vi.unstubAllGlobals()
  })

  it('não importa nem chama server action: nenhum dos três arquivos novos', () => {
    const dir = resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_comparar')
    for (const f of ['mais-vistos.tsx', 'publicacao.tsx', 'forja-indisponivel.tsx']) {
      const src = readFileSync(resolve(dir, f), 'utf8')
      expect(src, f).not.toMatch(/use server|forja-actions|from '\.\.\/actions'|from '@\/app\/cms\/\(authed\)\/youtube\/competitors\/actions'/)
      expect(src, f).not.toMatch(/useRouter|fetch\(/)
    }
  })

  it('o cartão é uma region rotulada "Leitura da forja"', () => {
    dentro(<ForjaIndisponivel par={par(PACK, 'eu', 'c1')} />)
    const r = screen.getByRole('region', { name: 'Leitura da forja' })
    expect(r.tagName).toBe('SECTION')
    expect(screen.getAllByRole('region', { name: 'Leitura da forja' })).toHaveLength(1)
  })
})

describe('a tela: ordem das seções e estados vazios', () => {
  it('lados, "Número a número", os cinco mais vistos, publicação, cartão da forja; o cartão fica no fim da página', () => {
    const { container } = wrap(PACK, 'eu', 'c1')
    const raiz = container.querySelector('[data-obs-screen="comparar"]')!
    const marcas = [
      raiz.querySelector('.cp-sides'), secao('Número a número'), secao('Os 5 vídeos mais vistos de cada canal'), secao('Publicação nos últimos 90 dias'),
      screen.getByRole('region', { name: 'Leitura da forja' }),
    ] as HTMLElement[]
    for (let i = 0; i < marcas.length - 1; i++) {
      expect(marcas[i]!.compareDocumentPosition(marcas[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING, `seção ${i}`).toBeTruthy()
    }
    // o cartão é o último filho da tela
    expect(raiz.lastElementChild).toBe(marcas[4])
  })

  it('trocar o seletor troca também os cinco mais vistos e a publicação, sem navegar', () => {
    wrap(PACK, 'eu', 'c1')
    expect(secao('Os 5 vídeos mais vistos de cada canal').textContent).toContain('Primeiro de c1')
    fireEvent.change(screen.getByLabelText('Lado B'), { target: { value: 'c2' } })
    const s = secao('Os 5 vídeos mais vistos de cada canal')
    expect(s.textContent).toContain('Primeiro de c2'); expect(s.textContent).not.toContain('Primeiro de c1')
    const hrefs = [...s.querySelectorAll<HTMLAnchorElement>('a')].map(a => new URL(a.getAttribute('href')!, 'http://x').searchParams.get('back'))
    expect(new Set(hrefs)).toEqual(new Set(['?a=eu&b=c2'])) // o link acompanha o par da URL
  })

  it('um lado sem vídeos: a coluna diz a frase, a publicação mostra "ainda sem vídeos sincronizados" e a tela não tem bloco vazio sem explicação', () => {
    const p = pacote(comVideos('a1', { name: 'Ana' }), semVideos('b1', { name: 'Beto' }), comVideos('c1', { name: 'Cris' }))
    wrap(p, 'a1', 'b1')
    expect(secao('Os 5 vídeos mais vistos de cada canal').textContent).toContain('Este canal não tem vídeos.')
    expect(secao('Publicação nos últimos 90 dias').textContent).toContain('ainda sem vídeos sincronizados')
    for (const s of document.querySelectorAll('.cp-sec')) expect(s.textContent!.trim().length, s.className).toBeGreaterThan(20)
  })

  it('os dois sem vídeos: duas frases nos mais vistos, nenhuma publicação, o cartão da forja continua e o rodapé explica', () => {
    const p = pacote(semVideos('a1', { name: 'Ana' }), semVideos('b1', { name: 'Beto' }))
    wrap(p, 'a1', 'b1')
    expect(secao('Os 5 vídeos mais vistos de cada canal').textContent!.match(/Este canal não tem vídeos\./g)).toHaveLength(2)
    expect(screen.queryByRole('heading', { name: 'Publicação nos últimos 90 dias' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Leitura da forja' })).toBeTruthy()
    expect(document.body.textContent).toContain('O bloco de publicação não aparece')
  })

  it('site com menos de dois canais: só a frase e o caminho de volta; nenhum dos três blocos', () => {
    window.history.replaceState(null, '', '/cms/youtube/competitors/comparar')
    render(<div data-obs=""><CompararScreen pack={pacote(comVideos('so', { name: 'Só' }))} inicial={null} /></div>)
    expect(screen.getByText('Para comparar é preciso ter dois canais.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /mais vistos|Publicação nos últimos/ })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Leitura da forja' })).toBeNull()
  })

  it('canal em primeira sincronização com vídeos: a frase de cada bloco avisa que pode haver mais', () => {
    const aviso = ' A sincronização do canal ainda não terminou: pode haver mais vídeos.'
    const p = pacote(
      comVideos('a1', { name: 'Ana' }, { top5Nota: `5 de 40 vídeos guardados, por views.${aviso}`, pub90Nota: `2 longos e 1 Short nos últimos 90 dias.${aviso}` }), comVideos('b1', { name: 'Beto' }),
    )
    wrap(p, 'a1', 'b1')
    expect(secao('Os 5 vídeos mais vistos de cada canal').textContent).toContain('pode haver mais vídeos')
    expect(secao('Publicação nos últimos 90 dias').textContent).toContain('pode haver mais vídeos')
  })

  it('nenhum texto dos blocos novos usa palavra interna', () => {
    wrap(PACK, 'eu', 'c1')
    const textos = [secao('Os 5 vídeos mais vistos de cada canal'), secao('Publicação nos últimos 90 dias'), screen.getByRole('region', { name: 'Leitura da forja' })].map(s => s.textContent! + [...s.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).join(' ')).join(' ')
    expect(textos).not.toMatch(/\b(dataset|sentinela|motor|ranking|R73)\b|conjunto do site|escala √/i)
    // "pacote" só no cartão da forja, onde o spec 18.8 usa "pacote novo"
    expect(secao('Os 5 vídeos mais vistos de cada canal').textContent).not.toMatch(/pacote|pack/i)
    expect(secao('Publicação nos últimos 90 dias').textContent).not.toMatch(/pacote|pack/i)
  })
})
