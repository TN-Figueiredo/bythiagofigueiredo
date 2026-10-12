// @vitest-environment jsdom
/** A3 Tarefa 8: a tela de comparação (jsdom): lados, seletores, "Número a número", Leitura rápida, ⓘ e rodapé. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, cleanup, act } from '@testing-library/react'
import { canalDe, pacoteDe, type OpcoesCanal } from './par-helpers'
import { a3World } from './a3-fixture'
import { buildCompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { buildPar, resolverPar } from '@/app/cms/(authed)/youtube/competitors/_comparar/par-model'
import { NUMEROS, NO_NICHO } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { CompararScreen } from '@/app/cms/(authed)/youtube/competitors/_comparar/comparar-screen'
import { link } from '@/lib/youtube/observatorio/links'
import { reguaDaLinha } from '@/app/cms/(authed)/youtube/competitors/_comparar/regua-da-linha'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => { throw new Error('a tela não usa o router') } }))

const mk = (id: string, subs: number | null, o: OpcoesCanal = {}) => canalDe(id, { subs, ...o })
const ALL = (v: number): OpcoesCanal['n'] => Object.fromEntries(NUMEROS.map(k => [k, v])) as OpcoesCanal['n']

/** Um site pequeno: o canal do dono, quatro de Viagem (um com muitos inscritos), um de IA, um sem nicho, e o segundo canal do dono sem vídeos. */
function pacote() {
  return pacoteDe([
    mk('eu', 1000, { own: true, name: 'tnFigueiredo', n: { ...ALL(10), inscritos: 1000, vpd: null, vpdPorMil: null, inscritos30: null, trocas30: null }, motivos: { vpd: 'as views por dia do seu canal ainda não aparecem nesta tela', inscritos30: 'sem contagem de 30 dias atrás', trocas30: 'as trocas do seu canal ficam no A/B Lab', vpdPorMil: 'as views por dia do seu canal ainda não aparecem nesta tela' } }),
    mk('c1', 5000, { name: 'Leo Khev', n: { ...ALL(20), inscritos: 5000 } }),
    mk('c2', 3000, { name: 'Ana Viaja', n: { ...ALL(10), inscritos: 3000 } }),
    mk('c3', 120, { name: 'Beto Rota', n: { ...ALL(12), inscritos: 120 } }),
    mk('c4', 110, { name: 'Cris Mala', n: { ...ALL(11), inscritos: 110 } }),
    mk('c5', 100, { name: 'Dani Voo', n: { ...ALL(13), inscritos: 100 } }),
    mk('ia1', 2000, { name: 'Edu IA', niche: 'ia', nicheLabel: 'IA', n: { ...ALL(30), inscritos: 2000 } }),
    mk('sn', 500, { name: 'Fabi Sem Nicho', niche: null, n: { ...ALL(40), inscritos: 500 } }),
    { ...mk('eu2', 10, { own: true, name: 'Thiago Figueiredo', semVideos: true, n: { inscritos: 10 }, motivos: Object.fromEntries(NUMEROS.map(k => [k, 'sem vídeos'])) }), href: null }, // canal próprio sem vídeos: sem página
  ])
}
const PACK = pacote()

/** A URL do navegador já é a do par quando o servidor monta a tela (a URL é a fonte da verdade do hook). */
const wrap = (pack = PACK, inicial: { a: string; b: string } | null = { a: 'eu', b: 'c1' }) => (inicial && window.history.replaceState(null, '', `/cms/youtube/competitors/comparar?a=${inicial.a}&b=${inicial.b}`), render(<div data-obs=""><CompararScreen pack={pack} inicial={inicial} /></div>))
const selA = () => screen.getByLabelText('Lado A') as HTMLSelectElement
const selB = () => screen.getByLabelText('Lado B') as HTMLSelectElement
const tabela = () => screen.getByRole('table')
const escolher = (s: HTMLSelectElement, v: string) => fireEvent.change(s, { target: { value: v } })
const linhaDe = (nome: string) => [...tabela().querySelectorAll<HTMLElement>('th.rl')].find(h => h.firstChild?.textContent === nome)!.closest('tr') as HTMLElement

beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/comparar?a=eu&b=c1') })
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.getElementById('flut')?.remove() })

describe('a tela não se contradiz sobre a coleta diária (I-C)', () => {
  it('com o canal próprio no par: nenhuma frase diz que a coleta diária ainda vai chegar, enquanto outra diz que ela já roda', () => {
    const { container } = wrap()
    const texto = container.textContent!
    expect(texto).toContain('as views por dia do seu canal ainda não aparecem nesta tela') // o motivo do "não medido"
    expect(texto).not.toMatch(/depois que a coleta/i)
    expect(texto).not.toMatch(/coleta[^.]*(estiver no ar|ainda não (está|esta)|chega)/i)
    // o cartão da forja diz o motivo verdadeiro, sem prometer data e sem citar a coleta
    const porque = screen.getByText(/Ainda não dá:/)
    expect(porque.textContent).toBe('Ainda não dá: a forja não sabe escrever uma leitura que compare dois canais.')
  })
})

describe('cabeçalho', () => {
  it('h1 "Comparar canais", o subtítulo do par e o botão "Inverter lados"', () => {
    wrap()
    expect(screen.getByRole('heading', { level: 1, name: 'Comparar canais' })).toBeTruthy()
    const par = buildPar(PACK, 'eu', 'c1')
    expect(screen.getByText(par.subtitulo)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Inverter lados/ })).toBeTruthy()
    expect(document.querySelector('[data-obs-screen="comparar"]')).not.toBeNull()
  })
  it('foco: ao abrir, no h1; depois de trocar o seletor, continua no seletor', () => {
    wrap()
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
    const s = selB(); s.focus()
    escolher(s, 'c2')
    expect(document.activeElement).toBe(selB())
  })
})

describe('os dois lados', () => {
  it('um cartão por lado: avatar, nome (h2), selo "seu canal" só no canal próprio, nicho, inscritos, chip "Lado A" / "Lado B"', () => {
    const { container } = wrap()
    const lados = [...container.querySelectorAll<HTMLElement>('.cp-side')]
    expect(lados).toHaveLength(2)
    const [a, b] = lados as [HTMLElement, HTMLElement]
    expect(within(a).getByRole('heading', { level: 2, name: 'tnFigueiredo' })).toBeTruthy()
    expect(within(b).getByRole('heading', { level: 2, name: 'Leo Khev' })).toBeTruthy()
    expect(within(a).getByText('seu canal')).toBeTruthy()
    expect(within(b).queryByText('seu canal')).toBeNull()
    expect(within(a).getByText('Viagem')).toBeTruthy(); expect(within(b).getByText('Viagem')).toBeTruthy()
    expect(a.textContent).toContain('1000'); expect(a.textContent).toContain('inscritos')
    expect(b.textContent).toContain('5000')
    expect(a.querySelector('.av')).not.toBeNull(); expect(b.querySelector('.av')).not.toBeNull()
    expect(within(a).getByText('Lado A').tagName).toBe('LABEL'); expect(within(b).getByText('Lado B').tagName).toBe('LABEL')
  })
  it('seletores rotulados "Lado A" e "Lado B": optgroup "Seus canais" e um por nicho ("Concorrentes de Viagem, do maior ao menor"), mais "Concorrentes sem nicho"; o canal do outro lado vem disabled; canal sem vídeos diz "(sem vídeos)"', () => {
    wrap()
    expect(selA().tagName).toBe('SELECT')
    const grupos = [...selA().querySelectorAll('optgroup')].map(g => g.label)
    expect(grupos).toEqual(['Seus canais', 'Concorrentes de Viagem, do maior ao menor', 'Concorrentes de IA, do maior ao menor', 'Concorrentes sem nicho'])
    const viagem = [...selA().querySelectorAll('optgroup')[1]!.querySelectorAll('option')].map(o => o.textContent)
    expect(viagem).toEqual(['Leo Khev', 'Ana Viaja', 'Beto Rota', 'Cris Mala', 'Dani Voo']) // do maior ao menor
    const opt = (s: HTMLSelectElement, v: string) => [...s.options].find(o => o.value === v)!
    expect(opt(selA(), 'c1').disabled).toBe(true) // o canal do lado B
    expect(opt(selA(), 'eu').disabled).toBe(false)
    expect(opt(selB(), 'eu').disabled).toBe(true); expect(opt(selB(), 'c1').disabled).toBe(false)
    expect(opt(selA(), 'eu2').textContent).toBe('Thiago Figueiredo (sem vídeos)')
    expect(selA().value).toBe('eu'); expect(selB().value).toBe('c1')
  })
  it('"Abrir o canal <nome>" só quando o canal tem destino; canal sem vídeos diz "Sem vídeos: ainda sem página."', () => {
    wrap()
    const l = screen.getByRole('link', { name: 'Abrir o canal Leo Khev' }) as HTMLAnchorElement
    expect(l.getAttribute('href')).toBe('/cms/youtube/competitors/c1')
    expect(screen.getByRole('link', { name: 'Abrir o canal tnFigueiredo' })).toBeTruthy()
    act(() => { escolher(selB(), 'eu2') })
    expect(screen.queryByRole('link', { name: /Abrir o canal Thiago/ })).toBeNull()
    expect(screen.getByText('Sem vídeos: ainda sem página.')).toBeTruthy()
  })
  it('a cor segue o canal: depois de "Inverter lados" o canal próprio continua laranja e passa a ser o lado B', () => {
    const { container } = wrap()
    const cor = (lado: 'A' | 'B') => container.querySelector<HTMLElement>(`.cp-side[data-lado="${lado}"]`)!
    expect(cor('A').getAttribute('aria-labelledby')).toBeTruthy()
    expect(cor('A').style.getPropertyValue('--c')).toBe('var(--lado-o)'); expect(cor('B').style.getPropertyValue('--c')).toBe('var(--lado-b)')
    fireEvent.click(screen.getByRole('button', { name: /Inverter lados/ }))
    expect(within(cor('B')).getByRole('heading', { level: 2 }).textContent).toBe('tnFigueiredo')
    expect(cor('B').style.getPropertyValue('--c')).toBe('var(--lado-o)')
    expect(cor('A').style.getPropertyValue('--c')).toBe('var(--lado-b)')
    expect(new URLSearchParams(window.location.search).get('a')).toBe('c1')
    expect(selA().value).toBe('c1'); expect(selB().value).toBe('eu')
  })
  it('trocar o seletor: a tabela, o título do documento e o role="status" mudam sem navegação', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
    wrap()
    const cabecalho = () => within(tabela()).getAllByRole('columnheader').map(c => c.textContent)
    expect(cabecalho().join('|')).toContain('Leo Khev')
    act(() => { escolher(selB(), 'c2') })
    expect(cabecalho().join('|')).toContain('Ana Viaja'); expect(cabecalho().join('|')).not.toContain('Leo Khev')
    expect(document.title).toBe('Comparar: tnFigueiredo e Ana Viaja · Competidores')
    expect(screen.getByRole('status').textContent).toContain('Comparando tnFigueiredo e Ana Viaja.')
    expect(new URLSearchParams(window.location.search).get('b')).toBe('c2')
    expect(push).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('"Número a número"', () => {
  it('é uma table com caption, th scope col/row/rowgroup e role explícito em cada elemento', () => {
    wrap()
    const t = tabela()
    expect(t.getAttribute('role')).toBe('table')
    expect(t.querySelector('caption')).not.toBeNull()
    expect(t.querySelector('caption')!.textContent).toContain('tnFigueiredo'); expect(t.querySelector('caption')!.textContent).toContain('Leo Khev')
    for (const e of t.querySelectorAll('thead,tbody,tr,th,td')) expect(e.getAttribute('role'), e.tagName + ' ' + e.textContent?.slice(0, 20)).toBeTruthy()
    expect(t.querySelectorAll('th[scope="col"]').length).toBe(5)
    expect(t.querySelectorAll('th[scope="row"]').length).toBeGreaterThan(5)
    expect(t.querySelectorAll('th[scope="rowgroup"]').length).toBe(3)
    expect(within(t).getByRole('columnheader', { name: /Relação/ })).toBeTruthy() // D12: a coluna se chama "Relação"
  })
  it('três grupos (Tamanho, Publicação, Desempenho) com ícone; cada linha tem nome, base, valor de A, valor de B, eixo e relação', () => {
    wrap(pacoteDe([...PACK.canais.filter(c => c.id !== 'eu').map(c => c), mk('eu', 1000, { own: true, name: 'tnFigueiredo', n: ALL(10) })]), { a: 'eu', b: 'c1' })
    const grupos = within(tabela()).getAllByRole('rowheader').filter(h => h.getAttribute('scope') === 'rowgroup')
    expect(grupos.map(g => g.textContent)).toEqual(['Tamanho', 'Publicação', 'Desempenho'])
    for (const g of grupos) expect(g.querySelector('svg')).not.toBeNull()
    const linhas = [...tabela().querySelectorAll('tbody tr')].filter(r => !r.classList.contains('grp'))
    expect(linhas).toHaveLength(13)
    const par = buildPar(PACK, 'eu', 'c1')
    for (const [i, l] of linhas.entries()) {
      const head = l.querySelector('th[scope="row"]')!
      expect(head.textContent).toContain(par.linhas[i]!.nome); expect(head.querySelector('small')!.textContent).toBe(par.linhas[i]!.base)
      expect(l.querySelectorAll('td')).toHaveLength(4) // A, B, eixo, relação
    }
  })
  it('lado não medido: pastilha com a hachura (.obs-ch-nm), a palavra "não medido" e o motivo na segunda linha; a célula de relação tem o texto para leitor de tela', () => {
    wrap()
    const l = linhaDe('Views por dia nos longos')
    const [a, , , rel] = [...l.querySelectorAll('td')] as HTMLElement[]
    const nm = a!.querySelector('.obs-ch-nm')!
    expect(nm.textContent).toBe('não medido')
    expect(a!.querySelector('small')!.textContent).toBe('as views por dia do seu canal ainda não aparecem nesta tela')
    expect(a!.textContent).not.toMatch(/^0|\b0\b/)
    expect(rel!.textContent).toContain('sem relação: um dos lados não foi medido')
    expect(rel!.querySelector('.obs-ch-sr')).not.toBeNull()
  })
  it('símbolos ▲ ＝ ● têm texto equivalente; a coluna se chama "Relação" (D12)', () => {
    const simbolos = () => [...tabela().querySelectorAll<HTMLElement>('.sy')]
    wrap(PACK, { a: 'c2', b: 'c1' })
    expect(simbolos().some(s => s.textContent === '▲')).toBe(true)
    expect(simbolos().some(s => s.textContent === '●')).toBe(true) // dias desde o último vídeo
    cleanup(); wrap(PACK, { a: 'eu', b: 'c2' })
    expect(simbolos().some(s => s.textContent === '＝')).toBe(true)
    for (const s of simbolos()) {
      expect(s.getAttribute('aria-hidden')).toBe('true')
      expect(s.parentElement!.querySelector('.obs-ch-sr')!.textContent!.trim().length).toBeGreaterThan(3)
    }
  })
  it('a relação começa com maiúscula; o nome do canal que começa em minúscula não é mexido', () => {
    wrap(PACK, { a: 'eu', b: 'c2' }) // eu (10) × Ana Viaja (10): praticamente igual nas linhas com valor
    const l = linhaDe('Inscritos')
    const rel = l.querySelectorAll('td')[3]!
    expect(rel.querySelector('.rt')!.textContent).toMatch(/^[A-ZÀ-Ú]/)
    // tnFigueiredo × Leo: zero de longos em 90 dias do lado dele não existe aqui; a frase com o nome em minúscula mantém o nome
    const zeros = pacoteDe([mk('eu', 1000, { own: true, name: 'tnFigueiredo', n: { ...ALL(10), longos90: 0 } }), mk('c1', 5000, { name: 'Leo Khev', n: { ...ALL(10), longos90: 7 } }), mk('c2', 100, { name: 'tnLeo', n: { ...ALL(10), longos90: 0 } })])
    cleanup(); wrap(zeros, { a: 'c2', b: 'c1' })
    expect(linhaDe('Longos publicados em 90 dias').querySelectorAll('td')[3]!.textContent).toContain('tnLeo não publicou longos em 90 dias')
  })
  it('a maiúscula da relação tem teste que morde: o modelo entrega em minúscula e a tela escreve a frase exata com a maiúscula', () => {
    // "praticamente igual": eu (10) × Ana Viaja (10) na mediana de views
    const igual = buildPar(PACK, 'eu', 'c2').linhas.find(l => l.id === 'medianaViews')!.relacao!
    expect(igual.texto).toBe('praticamente igual') // o modelo continua entregando em minúscula
    wrap(PACK, { a: 'eu', b: 'c2' })
    expect(linhaDe('Mediana de views dos longos').querySelectorAll('td')[3]!.querySelector('.rt')!.textContent).toBe('Praticamente igual')
    // zero do canal próprio, dois zeros, e um canal chamado "os" (o nome não impede a maiúscula de "os dois em 0")
    const p = pacoteDe([
      mk('eu', 1000, { own: true, name: 'tnFigueiredo', n: { ...ALL(10), longos90: 0, ritmo: 0 } }),
      mk('c1', 5000, { name: 'Leo Khev', n: { ...ALL(10), longos90: 7, ritmo: 0 } }),
      mk('os', 100, { name: 'os', n: { ...ALL(10), longos90: 0, ritmo: 0, engajamento: 0 } }),
      mk('c3', 90, { name: 'Zeca', n: { ...ALL(10), engajamento: 0 } }),
    ])
    expect(buildPar(p, 'eu', 'c1').linhas.find(l => l.id === 'longos90')!.relacao!.texto).toBe('você não publicou longos em 90 dias')
    cleanup(); wrap(p, { a: 'eu', b: 'c1' })
    expect(linhaDe('Longos publicados em 90 dias').querySelectorAll('td')[3]!.querySelector('.rt')!.textContent).toBe('Você não publicou longos em 90 dias')
    expect(linhaDe('Longos + Shorts por semana').querySelectorAll('td')[3]!.querySelector('.rt')!.textContent).toBe('Nenhum dos dois publicou em 13 semanas')
    cleanup(); wrap(p, { a: 'os', b: 'c3' })
    expect(buildPar(p, 'os', 'c3').linhas.find(l => l.id === 'engajamento')!.relacao!.texto).toBe('os dois em 0')
    expect(linhaDe('Engajamento nos longos').querySelectorAll('td')[3]!.querySelector('.rt')!.textContent).toBe('Os dois em 0')
  })
  it('a 390 px cada valor leva o rótulo do lado (letra A/B, na cor e no chip do lado); o rótulo existe também na célula "não medido"', () => {
    wrap()
    for (const tr of tabela().querySelectorAll('tbody tr:not(.grp)')) {
      const a = tr.querySelector('td.cA')!, b = tr.querySelector('td.cB')!
      const la = a.querySelector('.cp-lb')!, lb = b.querySelector('.cp-lb')!
      expect(la.textContent).toBe('A'); expect(lb.textContent).toBe('B')
      expect(la.getAttribute('aria-hidden')).toBe('true') // a tabela já tem os cabeçalhos de coluna para o leitor de tela
      expect(a.firstElementChild).toBe(la)
    }
    // a célula sem medida (inscritos em 30 dias do canal próprio) também diz de que lado é
    expect(linhaDe('Inscritos em 30 dias').querySelector('td.cA.nd .cp-lb')!.textContent).toBe('A')
  })
  it('posição escrita sob o valor nas seis linhas do nicho; nunca percentil', () => {
    wrap()
    const par = buildPar(PACK, 'eu', 'c1')
    for (const [i, l] of par.linhas.entries()) {
      const tr = [...tabela().querySelectorAll('tbody tr')].filter(r => !r.classList.contains('grp'))[i]!
      const tds = [...tr.querySelectorAll('td')]
      for (const lado of [0, 1] as const) {
        const pos = tds[lado]!.querySelector('.pos')
        if (NO_NICHO.has(l.id) && l.pos[lado]) { expect(pos?.textContent, l.id).toContain(l.pos[lado]!.texto) }
        else expect(pos, l.id).toBeNull()
      }
    }
    expect(tabela().textContent).not.toMatch(/percentil/i)
    expect(linhaDe('Inscritos').textContent).toMatch(/\dº de \d+ em Viagem/)
  })
  it('a régua do nicho entra nas seis linhas do nicho e as barras finas nas outras; uma só parada de Tab por régua', () => {
    wrap()
    const reguas = tabela().querySelectorAll('[role="group"][aria-label^="Posição em"]')
    expect(reguas.length).toBeGreaterThanOrEqual(1)
    expect(reguas.length).toBeLessThanOrEqual(NO_NICHO.size)
    expect(linhaDe('Engajamento nos longos').querySelectorAll('.b2').length).toBe(2)
    expect(linhaDe('Dias desde o último vídeo').querySelectorAll('.b2').length).toBe(0)
  })
  it('linha sem dado em nenhum dos lados não aparece e o rodapé conta', () => {
    const p = pacoteDe([mk('a1', 100, { n: { inscritos: 100, longosAcomp: 3 } }), mk('b1', 200, { n: { inscritos: 200, longosAcomp: 5 } })])
    wrap(p, { a: 'a1', b: 'b1' })
    expect([...tabela().querySelectorAll('tbody tr')].filter(r => !r.classList.contains('grp'))).toHaveLength(2)
    expect(screen.getByText(/11 números ficaram de fora/)).toBeTruthy()
  })
  it('um valor não finito na régua não derruba a tela: o lado vira "sem traço" com o motivo', () => {
    const p = pacoteDe([
      mk('a1', 100, { n: { inscritos: 100 } }), mk('b1', 200, { n: { inscritos: 200 } }), mk('c1', 300, { n: { inscritos: 300 } }), mk('d1', 400, { n: { inscritos: 400 } }),
    ])
    p.canais[2]!.numeros.inscritos = { x: Number.POSITIVE_INFINITY, texto: '∞', motivo: null, nota: null }
    expect(() => wrap(p, { a: 'a1', b: 'c1' })).not.toThrow()
    expect(tabela().textContent).toContain('sem traço de')
  })
})

describe('a posição escrita ao lado e a da régua vêm da mesma conta (T7 M5)', () => {
  it('em todo par do fixture, a posição das seis linhas é a que a régua expõe (e a do aria dela)', () => {
    const pack = buildCompararPack(a3World().obs)
    let visto = 0
    for (const a of pack.canais) for (const b of pack.canais) {
      if (a.id === b.id) continue
      const par = buildPar(pack, a.id, b.id)
      for (const l of par.linhas) {
        if (l.eixo.tipo !== 'regua') continue
        const r = reguaDaLinha(pack, par, l.id)!
        expect(r.posicao.A?.texto ?? null, `${a.id}/${b.id}/${l.id}`).toBe(l.pos[0]?.texto ?? null)
        expect(r.posicao.B?.texto ?? null, `${a.id}/${b.id}/${l.id}`).toBe(l.pos[1]?.texto ?? null)
        if (r.posicao.A && !r.vazio) expect(r.aria).toContain(`Lado A, ${a.name}: ${r.posicao.A.texto}`)
        visto++
      }
    }
    expect(visto).toBeGreaterThan(500)
  })
  it('a célula escreve a posição que a régua expõe, também quando o nicho tem poucos canais (sem traços)', () => {
    const p = pacoteDe([
      mk('v1', 300, { name: 'Ana Viaja', n: { ...ALL(10), inscritos: 300 } }), mk('v2', 200, { name: 'Beto Rota', n: { ...ALL(11), inscritos: 200 } }),
      mk('i1', 900, { name: 'Edu IA', niche: 'ia', nicheLabel: 'IA', n: { ...ALL(30), inscritos: 900 } }),
    ])
    wrap(p, { a: 'v1', b: 'v2' })
    const tds = linhaDe('Inscritos').querySelectorAll('td')
    expect(tds[0]!.querySelector('.pos')?.textContent).toBe('1º de 2 em Viagem')
    expect(tds[1]!.querySelector('.pos')?.textContent).toBe('2º de 2 em Viagem')
    expect(linhaDe('Inscritos').textContent).toContain('só 2 canais em Viagem: a régua precisa de pelo menos 3')
  })
})

describe('Leitura rápida, ⓘ e rodapé', () => {
  it('Leitura rápida no topo da seção, com a nota "Calculada dos mesmos números da tabela, sem IA."; lista vazia → o bloco não existe', () => {
    wrap(PACK, { a: 'c1', b: 'c2' })
    const h = screen.getByRole('heading', { name: 'Leitura rápida' })
    const grupo = h.closest('[role="group"]')!
    expect(grupo.textContent).toContain('Calculada dos mesmos números da tabela, sem IA.')
    expect(grupo.compareDocumentPosition(tabela()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy() // antes da tabela
    expect(grupo.textContent).toContain('Leo Khev é maior em:')
    cleanup()
    const vazio = pacoteDe([mk('a1', null, {}), mk('b1', null, {})])
    wrap(vazio, { a: 'a1', b: 'b1' })
    expect(screen.queryByText('Leitura rápida')).toBeNull()
  })
  it('o ⓘ "Como ler esta tabela" abre na camada flutuante e lista as linhas em escala comprimida e as que ficaram de fora (D13)', () => {
    const p = pacoteDe([
      mk('a1', 100, { n: { ...ALL(1), inscritos: 100 } }), mk('b1', 110, { n: { ...ALL(1), inscritos: 110 } }), mk('c1', 120, { n: { ...ALL(1), inscritos: 120 } }),
      mk('d1', 130, { n: { ...ALL(1), inscritos: 130 } }), mk('e1', 140, { n: { ...ALL(1), inscritos: 140 } }), mk('f1', 5_000_000, { n: { ...ALL(1), inscritos: 5_000_000 } }),
    ])
    for (const c of p.canais) c.numeros.trocas30 = { x: null, texto: null, motivo: 'sem dado', nota: null } // fica de fora
    wrap(p, { a: 'a1', b: 'f1' })
    const botao = screen.getByRole('button', { name: 'Como ler esta tabela' })
    expect(botao.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(botao)
    const flut = document.getElementById('flut')!
    const caixa = within(flut).getByRole('dialog')
    expect(botao.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[data-obs-screen="comparar"]')!.contains(caixa)).toBe(false) // nunca filho da tela
    expect(within(caixa).getByRole('heading', { name: 'Como ler esta tabela' })).toBeTruthy()
    expect(caixa.textContent).toMatch(/Escala comprimida em .*inscritos/)
    expect(caixa.textContent).toContain('Ficaram de fora')
    expect(caixa.textContent).toContain('trocas de título e thumbnail em 30 dias')
    expect(caixa.textContent).not.toMatch(/raiz|escala √|ranking|pacote|dataset/i)
  })
  it('rodapé: "Maior não quer dizer melhor: são canais de tamanhos diferentes." e a contagem das linhas de fora', () => {
    const p = pacoteDe([mk('a1', 100, { n: { inscritos: 100 } }), mk('b1', 200, { n: { inscritos: 200 } })])
    wrap(p, { a: 'a1', b: 'b1' })
    const par = buildPar(p, 'a1', 'b1')
    expect(screen.getByText(par.rodape)).toBeTruthy()
    expect(par.rodape).toContain('Maior não quer dizer melhor: são canais de tamanhos diferentes.')
    expect(par.rodape).toContain('12 números ficaram de fora')
  })
  it('"Só o seu canal mede" não existe em par SEM canal próprio (D17; desde a A4 o cartão aparece quando um lado é canal seu)', () => {
    const donos = new Set(PACK.canais.filter(c => c.own).map(c => c.id))
    let semDono = 0
    for (const a of PACK.ordem) for (const b of PACK.ordem) {
      if (a === b || donos.has(a) || donos.has(b)) continue
      semDono++
      cleanup(); wrap(PACK, { a, b })
      expect(document.body.textContent, `${a}×${b}`).not.toMatch(/Só o seu canal mede/)
    }
    expect(semDono).toBeGreaterThan(10) // o laço tem o que olhar
  })
})

describe('inicial null e o fixture de verdade', () => {
  it('inicial null (menos de dois canais): a frase da 11c e o link "Adicionar canal" (o destino do botão das abas); sem seletores', () => {
    wrap(pacoteDe([mk('so', 100, {})]), null)
    expect(screen.getByText('Para comparar, o site precisa acompanhar pelo menos dois canais.')).toBeTruthy()
    expect((screen.getByRole('link', { name: 'Adicionar canal' }) as HTMLAnchorElement).getAttribute('href')).toBe(link.canais({ add: 1 }))
    expect(document.querySelectorAll('select')).toHaveLength(0)
    expect(screen.getByRole('heading', { level: 1, name: 'Comparar canais' })).toBeTruthy()
  })
  it('o par padrão do fixture de verdade abre, com 13 linhas, sem lançar, e trocar o seletor funciona', () => {
    const pack = buildCompararPack(a3World().obs)
    const ini = resolverPar(pack, undefined, undefined)!
    wrap(pack, ini)
    expect([...tabela().querySelectorAll('tbody tr')].filter(r => !r.classList.contains('grp')).length).toBeGreaterThan(5)
    const outro = pack.canais.find(c => c.id !== ini.a && c.id !== ini.b)!
    act(() => { escolher(selB(), outro.id) })
    expect(within(tabela()).getAllByRole('columnheader').map(c => c.textContent).join('|')).toContain(outro.name)
  })
})
