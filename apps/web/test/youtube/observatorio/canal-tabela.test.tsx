// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { mountCanal, comAntigos, norm } from './canal-mount'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))

const tabela = () => document.querySelector<HTMLTableElement>('table.cv-lst')!
const linhas = () => [...document.querySelectorAll<HTMLElement>('table.cv-lst tr.cv-row')]
const ths = () => [...tabela().querySelectorAll<HTMLElement>('thead th')]
const th = (nome: string) => ths().find(t => norm(t.textContent) === nome)!
const statusEl = () => document.querySelector<HTMLElement>('p.cv-status')!
const tracked = (ds: Dataset, id: string) => ds.videos.find(v => v.ch === id && v.tracked)!
const cssTxt = () => fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canal/canal.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const LISTA = { ver: 'lista' }

beforeEach(() => { push.mockReset(); replace.mockReset(); refresh.mockReset(); window.history.replaceState(null, '', '/cms/youtube/competitors/canal/matt-wolfe') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Lista: a tabela', () => {
  it('ver=lista mostra a tabela e não a grade; ver=capas, o contrário', () => {
    const a = mountCanal({ sp: LISTA })
    expect(tabela()).not.toBeNull()
    expect(document.querySelector('ul.cv-grid')).toBeNull()
    a.unmount()
    mountCanal()
    expect(document.querySelector('table.cv-lst')).toBeNull()
    expect(document.querySelector('ul.cv-grid')).not.toBeNull()
  })

  it('o botão Lista troca a vista e anuncia; o botão Capas devolve a grade', async () => {
    mountCanal()
    await userEvent.click(screen.getByRole('button', { name: /Lista/ }))
    expect(tabela()).not.toBeNull()
    expect(norm(statusEl().textContent)).toMatch(/^Vista Lista, \d+ vídeos$/)
    await userEvent.click(screen.getByRole('button', { name: /Capas/ }))
    expect(document.querySelector('table.cv-lst')).toBeNull()
  })

  it('é uma table com th scope="col" para Vídeo, Publicado, Views, Views/dia, Múltiplo, Curtidas, Comentários, Trocas (e Ações, só para leitor de tela)', () => {
    mountCanal({ sp: LISTA })
    const cab = ths()
    expect(cab.every(t => t.getAttribute('scope') === 'col')).toBe(true)
    expect(cab.map(t => norm(t.textContent))).toEqual(['Vídeo', 'Publicado', 'Views', 'Views/dia', 'Múltiplo', 'Curtidas', 'Comentários', 'Trocas', 'Ações'])
    expect(cab[8]!.querySelector('.obs-ch-sr')).not.toBeNull()
    expect(tabela().querySelector('caption')!.textContent).toBe('Vídeos de Matt Wolfe')
  })

  it('I-2: canal em backfill: Múltiplo, Views/dia e Trocas dizem a frase em .obs-ch-nm, nunca "0" nem número calculado', () => {
    mountCanal({ sp: LISTA, mut: (ds, id) => { const sy = ds.channels.find(x => x.id === id)!.sync; sy.state = 'backfill'; sy.backfill = { done: 12, total: 48 } } })
    const linha = tabela().querySelector<HTMLElement>('tr.cv-row')!
    for (const rot of ['Views/dia', 'Múltiplo', 'Trocas']) {
      const td = linha.querySelector<HTMLElement>(`td[data-label="${rot}"]`)!
      expect(norm(td.textContent), rot).toBe('quando a sincronização terminar')
      expect(td.querySelector('.obs-ch-nm'), rot).not.toBeNull()
    }
  })
  it('as colunas ordenáveis têm um botão dentro do th; aria-sort só na coluna ativa', () => {
    mountCanal({ sp: LISTA })
    for (const nome of ['Publicado', 'Views', 'Views/dia', 'Múltiplo']) expect(th(nome).querySelector('button'), nome).not.toBeNull()
    expect(ths().filter(t => t.hasAttribute('aria-sort'))).toHaveLength(1)
    expect(th('Publicado').getAttribute('aria-sort')).toBe('descending')
  })

  it('Publicado ordena como "Mais recentes"; Curtidas, Comentários, Trocas (e Vídeo) não ordenam (sem botão)', async () => {
    mountCanal({ sp: { ver: 'lista', sort: 'vistos' } })
    for (const nome of ['Vídeo', 'Curtidas', 'Comentários', 'Trocas']) expect(th(nome).querySelector('button'), nome).toBeNull()
    expect(th('Views').getAttribute('aria-sort')).toBe('descending')
    await userEvent.click(within(th('Publicado')).getByRole('button'))
    expect(screen.getByLabelText<HTMLSelectElement>('Ordenar').value).toBe('recentes')
    expect(th('Publicado').getAttribute('aria-sort')).toBe('descending')
    expect(window.location.search).not.toContain('sort=')   // recentes é o padrão
  })

  it('clicar no cabeçalho da coluna ativa inverte a direção; noutra coluna, ordena por ela em desc', async () => {
    mountCanal({ sp: LISTA })
    // Publicado já é a ativa (desc): inverte para asc
    await userEvent.click(within(th('Publicado')).getByRole('button'))
    expect(th('Publicado').getAttribute('aria-sort')).toBe('ascending')
    expect(window.location.search).toContain('dir=asc')
    const datas = linhas().map(r => r.querySelector('time')?.getAttribute('datetime')).filter((x): x is string => !!x)
    expect(datas.length).toBeGreaterThan(5)
    expect(datas).toEqual([...datas].sort())
    // outra coluna: Views em desc, e o asc de antes não vale
    await userEvent.click(within(th('Views')).getByRole('button'))
    expect(th('Views').getAttribute('aria-sort')).toBe('descending')
    expect(th('Publicado').hasAttribute('aria-sort')).toBe(false)
    expect(window.location.search).toContain('sort=vistos')
    expect(window.location.search).not.toContain('dir=asc')
    // a mesma coluna de novo: asc
    await userEvent.click(within(th('Views')).getByRole('button'))
    expect(th('Views').getAttribute('aria-sort')).toBe('ascending')
  })

  it('a coluna Views em desc começa pelo vídeo com mais views entre os acompanhados', async () => {
    const { all } = mountCanal({ sp: { ver: 'lista', sort: 'vistos' } })
    const top = all.filter(v => v.grupo === 'acompanhado' && v.views != null).sort((a, b) => b.views! - a.views!)[0]!
    expect(linhas()[0]!.dataset.id).toBe(top.id)
  })

  it('o status anuncia "Ordenado por Views, decrescente" e, ao inverter, "crescente"', async () => {
    mountCanal({ sp: LISTA })
    await userEvent.click(within(th('Views')).getByRole('button'))
    expect(norm(statusEl().textContent)).toMatch(/^Ordenado por Views, decrescente, \d+ vídeos$/)
    await userEvent.click(within(th('Views')).getByRole('button'))
    expect(norm(statusEl().textContent)).toMatch(/^Ordenado por Views, crescente, \d+ vídeos$/)
    // o foco continua no botão do cabeçalho
    expect(document.activeElement).toBe(within(th('Views')).getByRole('button'))
  })

  it('o select "Ordenar" e o cabeçalho da coluna mostram o mesmo estado', async () => {
    mountCanal({ sp: LISTA })
    const sel = screen.getByLabelText<HTMLSelectElement>('Ordenar')
    await userEvent.click(within(th('Múltiplo')).getByRole('button'))
    expect(sel.value).toBe('multiplo')
    expect(th('Múltiplo').getAttribute('aria-sort')).toBe('descending')
    await userEvent.selectOptions(sel, 'vpd')
    expect(th('Views/dia').getAttribute('aria-sort')).toBe('descending')
    expect(ths().filter(t => t.hasAttribute('aria-sort'))).toHaveLength(1)
    // direção invertida pelo cabeçalho: o select segue na mesma ordenação
    await userEvent.click(within(th('Views/dia')).getByRole('button'))
    expect(sel.value).toBe('vpd')
    expect(th('Views/dia').getAttribute('aria-sort')).toBe('ascending')
  })

  it('a ordenação inicial vem da URL (sort e dir) para o cabeçalho', () => {
    mountCanal({ sp: { ver: 'lista', sort: 'multiplo', dir: 'asc' } })
    expect(th('Múltiplo').getAttribute('aria-sort')).toBe('ascending')
    expect(screen.getByLabelText<HTMLSelectElement>('Ordenar').value).toBe('multiplo')
  })
})

describe('Lista: as células e o dado ausente', () => {
  it('o título leva ao Histórico (mesmo href e mesmo id da capa) e a thumbnail tem alt vazio', () => {
    const { all } = mountCanal({ sp: LISTA })
    const r = linhas()[0]!
    const a = r.querySelector<HTMLAnchorElement>('a.cv-tl')!
    expect(a.id).toBe('cv-lnk-' + r.dataset.id)
    expect(a.getAttribute('href')).toContain('/video/' + r.dataset.id)
    expect(a.getAttribute('href')).toContain('canal=matt-wolfe')
    const img = a.querySelector('img')!
    expect(img.getAttribute('alt')).toBe('')
    expect(norm(a.querySelector('.cv-ttl')!.textContent)).toBe(norm(all.find(v => v.id === r.dataset.id)!.title))
  })

  it('o texto das células é o do modelo: Publicado em <time datetime>, views, views/dia, múltiplo, curtidas, comentários, trocas', () => {
    const { all } = mountCanal({ sp: LISTA })
    const v = all.find(x => x.grupo === 'acompanhado' && x.viewsText && x.vpdText && x.multText && x.likesText && x.commentsText && x.swaps > 0)!
    expect(v).toBeTruthy()
    const r = linhas().find(x => x.dataset.id === v.id)!
    const cel = (l: string) => norm(r.querySelector(`td[data-label="${l}"]`)!.textContent)
    const t = r.querySelector('td[data-label="Publicado"] time')!
    expect(t.getAttribute('datetime')).toBe(v.pubISO)
    expect(norm(t.textContent)).toBe(norm(`${v.ageText} (${v.pubTitle})`))
    expect(cel('Views')).toBe(norm(v.viewsText))
    expect(cel('Views/dia')).toBe(norm(v.vpdText))
    expect(cel('Múltiplo')).toContain(norm(v.multText))
    if (v.multWord) expect(cel('Múltiplo')).toContain(v.multWord)
    expect(cel('Curtidas')).toBe(norm(v.likesText))
    expect(cel('Comentários')).toBe(norm(v.commentsText))
    expect(cel('Trocas')).toBe(String(v.swaps))
  })

  it('comentário nulo mostra "não medido" em obs-ch-nm; zero medido mostra "0"', () => {
    let nulo = '', zero = ''
    const { all } = mountCanal({
      sp: LISTA,
      mut: (ds, id) => {
        const xs = ds.videos.filter(v => v.ch === id && v.tracked)
        xs[0]!.comments = null; nulo = xs[0]!.id
        xs[1]!.comments = 0; zero = xs[1]!.id
      },
    })
    expect(all.find(v => v.id === nulo)!.comments).toBeNull()
    const cel = (id: string, l: string) => linhas().find(r => r.dataset.id === id)!.querySelector(`td[data-label="${l}"]`)!
    const n = cel(nulo, 'Comentários').querySelector('.obs-ch-nm')!
    expect(n.textContent).toBe('não medido')
    const z = cel(zero, 'Comentários')
    expect(z.querySelector('.obs-ch-nm')).toBeNull()
    expect(norm(z.textContent)).toBe('0')
    for (const r of linhas()) for (const nm of r.querySelectorAll('.obs-ch-nm')) expect(nm.textContent).not.toBe('0')
  })

  it('curtidas nulas: "não medido"; views nulas: a frase "sem contagem: <motivo>" em obs-ch-nm, views/dia sem valor também', () => {
    let a = '', b = ''
    const { all } = mountCanal({
      sp: LISTA,
      mut: (ds, id) => {
        const xs = ds.videos.filter(v => v.ch === id && v.tracked)
        xs[0]!.likes = null; a = xs[0]!.id
        const x = xs[1]!; b = x.id; x.views = null; x.series = []; x.firstIdx = null
      },
    })
    const row = (id: string) => linhas().find(r => r.dataset.id === id)!
    expect(row(a).querySelector('td[data-label="Curtidas"] .obs-ch-nm')!.textContent).toBe('não medido')
    const vb = all.find(v => v.id === b)!
    expect(row(b).querySelector('td[data-label="Views"] .obs-ch-nm')!.textContent).toBe(vb.viewsMissing)
    expect(row(b).querySelector('td[data-label="Views/dia"] .obs-ch-nm')).not.toBeNull()
    expect(row(b).querySelector('td[data-label="Múltiplo"] .obs-ch-nm')).not.toBeNull()
  })

  it('views/dia e múltiplo ausentes dizem "não medido"; fixado antigo diz "fixado antigo"', () => {
    const { all } = mountCanal({ sp: LISTA, mut: (ds, id) => { const x = tracked(ds, id); x.tracked = false; x.pinned = true; x.pinState = 'ativo'; x.series = []; x.firstIdx = null } })
    const fx = all.find(x => x.grupo === 'fixado-antigo')!
    const r = linhas().find(x => x.dataset.id === fx.id)!
    expect(r.querySelector('td[data-label="Views/dia"] .obs-ch-nm')!.textContent).toBe('fixado antigo')
    expect(r.querySelector('td[data-label="Múltiplo"] .obs-ch-nm')!.textContent).toBe('fixado antigo')
    expect(norm(r.querySelector('.cv-tags')!.textContent)).toContain('fixado antigo')
  })

  it('a coluna da ordenação ativa leva a classe on nas células', () => {
    mountCanal({ sp: { ver: 'lista', sort: 'multiplo' } })
    const r = linhas()[0]!
    expect(r.querySelector('td[data-label="Múltiplo"]')!.classList.contains('on')).toBe(true)
    expect(r.querySelector('td[data-label="Views"]')!.classList.contains('on')).toBe(false)
  })

  it('cada linha tem o menu "Ações do vídeo: <título>" (o mesmo da capa) e a lupa não é parada de Tab', async () => {
    const { all } = mountCanal({ sp: LISTA })
    const r = linhas()[0]!
    const btn = within(r).getByRole('button', { name: 'Ações do vídeo: ' + all.find(v => v.id === r.dataset.id)!.title })
    await userEvent.click(btn)
    expect(document.getElementById('flut')!.querySelector('[role="menu"]')).not.toBeNull()
    expect(within(document.getElementById('flut')!).getByRole('menuitem', { name: /Abrir no YouTube/ })).toBeTruthy()
  })

  it('"Ver trocas" no menu da linha vai para a aba Trocas daquele vídeo', async () => {
    const { all } = mountCanal({ sp: LISTA })
    const v = all.find(x => x.swaps > 0)!
    const r = linhas().find(x => x.dataset.id === v.id)!
    await userEvent.click(within(r).getByRole('button', { name: /Ações do vídeo/ }))
    await userEvent.click(within(document.getElementById('flut')!).getByRole('menuitem', { name: /Ver trocas/ }))
    expect(window.location.search).toContain('tab=trocas')
    expect(window.location.search).toContain('video=' + v.id)
  })
})

describe('Lista: grupos, "Carregar mais" e medidas', () => {
  it('os divisores viram linhas de grupo (tr com th colspan) com a contagem', () => {
    mountCanal({ sp: { ver: 'lista', sort: 'multiplo' }, mut: (ds, id) => { const x = tracked(ds, id); x.series = []; x.firstIdx = null } })
    const grp = [...tabela().querySelectorAll<HTMLElement>('tr.cv-grp')]
    expect(grp.length).toBeGreaterThan(0)
    for (const g of grp) {
      const h = g.querySelector('th')!
      expect(h.getAttribute('scope')).toBe('rowgroup')
      expect(h.getAttribute('colspan')).toBe('9')
      expect(h.textContent).toMatch(/\(\d+\)/)
    }
    expect(tabela().querySelector('tr.cv-grp h3')).toBeNull()   // linha de tabela, não o h3 da grade
    expect(norm(grp[0]!.textContent)).toContain('Sem múltiplo ainda (')
  })

  it('os vídeos sem data e os antigos entram sob o seu grupo, com a frase miúda do divisor', () => {
    const { all } = mountCanal({ sp: { ver: 'lista', n: '40' }, mut: comAntigos(60) })
    const g = [...tabela().querySelectorAll<HTMLElement>('tr.cv-grp')].find(x => x.textContent!.includes('Mais antigos, sem contagem diária'))!
    expect(g).toBeTruthy()
    expect(norm(g.textContent)).toContain('(60)')
    expect(norm(g.textContent)).toContain('a contagem de views deles é antiga')
    expect(all.filter(v => v.grupo === 'antigo')).toHaveLength(60)
    expect(linhas().length).toBe(120 + 40)
  })

  it('o bloco "Carregar mais" é o mesmo componente, depois da tabela, e carrega mais linhas e leva o foco ao primeiro novo', async () => {
    mountCanal({ sp: LISTA, mut: comAntigos(60) })
    const antes = linhas().length
    const grupo = screen.getByRole('group', { name: 'Carregar mais vídeos' })
    expect(tabela().compareDocumentPosition(grupo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(grupo.querySelector('button.obs-ch-btn.pri')).not.toBeNull()
    await userEvent.click(within(grupo).getByRole('button'))
    expect(linhas().length).toBe(antes + 40)
    const ativo = document.activeElement as HTMLElement
    expect(ativo.tagName).toBe('A')
    expect(ativo.id).toBe('cv-lnk-' + linhas()[antes]!.dataset.id)
    expect(tabela().closest('.cv-tw')).not.toBeNull()
  })

  it('a nota fixa continua no fim e descreve a tabela', () => {
    mountCanal({ sp: LISTA })
    const foot = document.querySelector('p.cv-foot')!
    expect(foot.id).toBeTruthy()
    expect(tabela().getAttribute('aria-describedby')).toBe(foot.id)
  })

  it('a linha tem 50 px e a thumbnail 80 px de largura (classes; a medida real é da Tarefa 10)', () => {
    mountCanal({ sp: LISTA })
    const r = linhas()[0]!
    expect(r.querySelector('td.v a.cv-tl .cv-tthumb img')).not.toBeNull()
    const css = cssTxt()
    expect(css).toMatch(/\.cv-lst td\{[^}]*height:50px/)
    expect(css).toMatch(/\.cv-lst \.cv-tthumb\{[^}]*width:80px/)
  })

  it('abaixo de 820 px cada célula carrega o rótulo (data-label) para a pilha', () => {
    mountCanal({ sp: LISTA })
    const r = linhas()[0]!
    const rotulos = [...r.querySelectorAll('td[data-label]')].map(td => td.getAttribute('data-label'))
    expect(rotulos).toEqual(['Publicado', 'Views', 'Views/dia', 'Múltiplo', 'Curtidas', 'Comentários', 'Trocas'])
    const css = cssTxt()
    expect(css).toMatch(/@media \(max-width:820px\)\{[\s\S]*attr\(data-label\)/)
    expect(css).toMatch(/@media \(max-width:480px\)\{[\s\S]*\.cv-lst tbody\{grid-template-columns:minmax\(0,1fr\)\}/)
  })

  it('o CSS da tabela não usa color-mix nem z-index numérico', () => {
    const css = cssTxt()
    const lst = css.slice(css.indexOf('VISTA LISTA') >= 0 ? css.indexOf('VISTA LISTA') : css.indexOf('.cv-lst'))
    expect(lst).not.toMatch(/color-mix/)
    expect(lst).not.toMatch(/z-index:\s*\d/)
  })

  it('dados vazios: a tabela não aparece (a tela vazia é a de sempre)', () => {
    mountCanal({ sp: { ver: 'lista', q: 'zzzz-sem-resultado' } })
    expect(document.querySelector('table.cv-lst')).toBeNull()
    expect(screen.getByText(/Nenhum vídeo com “zzzz-sem-resultado”/)).toBeTruthy()
  })
})
