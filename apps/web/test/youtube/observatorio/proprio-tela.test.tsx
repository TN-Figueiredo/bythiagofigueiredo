// @vitest-environment jsdom
// A4 Tarefa 8: a TELA da página do canal próprio. Os modelos já têm os seus testes (header, vídeos, view-model); aqui se prova o que o
// navegador desenha: o cabeçalho com o selo e a posição em links, as abas, os controles, o cartão de três colunas com a terceira linha,
// a Lista, os links de cada vídeo, o estado que segue a URL (Next 16 não remonta) e os estados sem dado (0, 1, 2 e N canais, parado,
// série cheia, curta e vazia, negado, erro). Nenhum teste "passa por vazio": cada um afirma o texto e o valor nulo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, cleanup, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import { proprioWorld, semVideos, parado, type CenarioDados } from './proprio-fixture'
import { mountProprio, cartoes, norm, viewDe } from './proprio-mount'
import { link } from '@/lib/youtube/observatorio/links'
import { SEM_VIEWS_DIARIAS } from '@/app/cms/(authed)/youtube/competitors/_proprio/videos-model'
import { ABAS_PROPRIO, ABAS_PROPRIO_NOTA } from '@/app/cms/(authed)/youtube/competitors/_proprio/view-model'
import { canalQuery } from '@/app/cms/(authed)/youtube/competitors/_canal/params'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/x',
  useSearchParams: () => new URLSearchParams(''),
}))

beforeEach(() => { push.mockReset(); replace.mockReset(); refresh.mockReset(); window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const MUNDO = proprioWorld() // a base do oráculo é lida uma vez por arquivo
const raiz = () => document.querySelector<HTMLElement>('[data-obs-screen="canal"][data-own="1"]')!
const tabs = () => within(screen.getByRole('navigation', { name: 'Seções do canal' }))
const urlAtual = () => new URLSearchParams(window.location.search)

describe('T8 a raiz e o cabeçalho', () => {
  it('é a tela do canal (mesmo CSS) marcada como própria; o título é o nome, com o selo "seu canal" no lugar do nicho', () => {
    mountProprio()
    expect(raiz()).not.toBeNull()
    expect(raiz().getAttribute('data-obs-screen')).toBe('canal')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(MUNDO.obs.channel(MUNDO.canalId)!.name)
    expect(raiz().querySelector('.own-seal')!.textContent).toBe('seu canal')
    expect(raiz().querySelector('select#nicho, .niche')).toBeNull() // nada de seletor de nicho do concorrente
  })

  it('a faixa: 6 células na ordem inscritos, vídeos, views somadas, impressões, dias com impressão, desde o último vídeo', () => {
    const { view } = mountProprio()
    const dl = raiz().querySelector('dl[aria-label="Números do canal"]')!
    const rotulos = [...dl.querySelectorAll('.nc dt')].map(e => e.textContent)
    expect(rotulos).toEqual(view.header.faixa.map(c => c.label))
    expect(rotulos).toHaveLength(6)
    expect(rotulos[3]).toMatch(/^impressões de \d\d\/\d\d a \d\d\/\d\d$/)
  })

  it('"Todos os números" abre as outras onze células sem navegar; o ⓘ lista a base de cada uma', async () => {
    const user = userEvent.setup()
    const { view } = mountProprio()
    const mais = raiz().querySelector<HTMLElement>('#canal-nums2')!
    expect(mais.hidden).toBe(true)
    await user.click(screen.getByRole('button', { name: /Todos os números/ }))
    expect(mais.hidden).toBe(false)
    expect([...mais.querySelectorAll('.nc dt')].map(e => e.textContent)).toEqual(view.header.todos.map(c => c.label))
    expect(view.header.todos).toHaveLength(11)
    expect(urlAtual().get('nums')).toBe('1')
    expect(push).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'De onde vêm os números do canal' }))
    const dica = await screen.findByRole('dialog', { name: 'De onde vêm os números do canal' })
    expect(within(dica).getAllByRole('listitem')).toHaveLength(17)
  })

  it('a linha de posição: os itens com link vão à lista de Canais ordenada; os sem ordenação equivalente são texto, não link', () => {
    const { view } = mountProprio()
    const pos = raiz().querySelector('p.pos')!
    expect(pos).not.toBeNull()
    expect(norm(pos.textContent)).toBe(norm(view.header.posicaoLinha))
    const links = [...pos.querySelectorAll('a')]
    expect(links.map(a => a.getAttribute('href'))).toEqual(view.header.posicaoItens!.itens.map(i => i.href).filter((h): h is string => h != null))
    // T9 (M1): o item só liga quando tem posição; sem as views por dia dos concorrentes a posição em views/dia por mil não existe, e então não é link
    expect(links.length).toBe(1)
    expect(links[0]!.getAttribute('href')).toMatch(/sort=subs/)
    expect(view.header.posicaoItens!.itens.find(i => i.chave === 'vpdPorMil')!.href).toBeNull()
  })

  it('"Comparar com…" fica ao lado de "Abrir no YouTube"; leva à comparação com o concorrente logo acima; o title diz qual', () => {
    const { view } = mountProprio()
    const acts = raiz().querySelector('.chead .acts')!
    const a = within(acts as HTMLElement).getByRole('link', { name: 'Comparar com…' })
    expect(a.getAttribute('href')).toBe(view.compararHref)
    const u = new URL(a.getAttribute('href')!, 'http://x')
    expect(u.pathname).toBe('/cms/youtube/competitors/comparar')
    expect(u.searchParams.get('a')).toBe(MUNDO.canalId)
    expect(u.searchParams.get('b')).not.toBeNull()
    expect(a.getAttribute('href')).toBe(link.comparar(MUNDO.canalId, u.searchParams.get('b')!))
    expect(a.getAttribute('title')).toBe(view.compararTitulo)
    expect(a.hasAttribute('data-comparar-canal')).toBe(true)
    const nomes = [...acts.querySelectorAll('a.obs-ch-btn')].map(e => norm(e.textContent))
    expect(nomes[0]).toBe('Comparar com…')
    expect(nomes[1]).toMatch(/^Abrir no YouTube/)
  })

  it('sem concorrente o botão "Comparar com…" não existe', () => {
    mountProprio({ semConcorrente: true })
    expect(screen.queryByRole('link', { name: 'Comparar com…' })).toBeNull()
    expect(raiz().querySelector('[data-comparar-canal]')).toBeNull()
    expect(screen.getByRole('link', { name: /Abrir no YouTube/ })).toBeTruthy()
  })

  it('o canal próprio não tem menu de remover nem sincronizar (ele sincroniza pelo Painel): o ⋯ do canal não existe', () => {
    mountProprio()
    expect(screen.queryByRole('button', { name: 'Ações do canal' })).toBeNull()
    expect(raiz().textContent).not.toMatch(/Remover canal|Sincronizar só este canal/)
  })

  it('"Como o canal está" encaixa acima das abas (slot da Tarefa 10)', () => {
    mountProprio({ comoEsta: <section data-testid="ce">Como o canal está</section> })
    const ce = screen.getByTestId('ce')
    const nav = screen.getByRole('navigation', { name: 'Seções do canal' })
    expect(ce.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(raiz().querySelector('.chead')!.compareDocumentPosition(ce) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('T8 abas: Vídeos, Trocas, Leitura e Retenção', () => {
  it('as quatro abas, nessa ordem, com a contagem só na de Vídeos; Retenção só existe no canal próprio', () => {
    const { view } = mountProprio()
    const itens = [...raiz().querySelectorAll('nav.ctabs li a')].map(a => norm(a.textContent))
    expect(itens).toEqual([`Vídeos ${view.videos.videos.length}`, 'Trocas', 'Leitura', 'Retenção'])
    expect(raiz().querySelector('nav.ctabs a[aria-current="page"]')!.textContent).toMatch(/^Vídeos/)
  })

  it('cada aba vazia diz a frase do spec 16.4 (sem "lote" nem "L3") e a nota; a aba Vídeos some', async () => {
    const user = userEvent.setup()
    mountProprio()
    const casos: Array<['Trocas' | 'Leitura' | 'Retenção', keyof typeof ABAS_PROPRIO, string]> = [
      ['Trocas', 'trocas', 'Trocas dos seus vídeos ainda não são lidas nesta tela.'],
      ['Leitura', 'leitura', 'A leitura da forja para o seu canal ainda não existe.'],
      ['Retenção', 'retencao', 'Retenção ainda não coletada.'],
    ]
    for (const [nome, chave, frase] of casos) {
      await user.click(tabs().getByRole('link', { name: nome }))
      expect(ABAS_PROPRIO[chave]).toBe(frase)
      const painel = raiz().querySelector('.cv-empty')!
      expect(painel.querySelector('p')!.textContent).toBe(frase)
      expect(painel.querySelector('p.m')!.textContent).toBe(ABAS_PROPRIO_NOTA[chave])
      expect(painel.textContent).not.toMatch(/\bL3\b|lote/i)
      expect(raiz().querySelector('ul.cv-grid, table.cv-lst')).toBeNull()
      expect(tabs().getByRole('link', { name: nome }).getAttribute('aria-current')).toBe('page')
    }
    expect(urlAtual().get('tab')).toBe('retencao')
  })

  it('a aba é navegação do navegador: o clique simples troca no cliente (push do histórico), o Ctrl+clique segue o link', async () => {
    const user = userEvent.setup()
    mountProprio()
    const a = tabs().getByRole('link', { name: 'Retenção' })
    expect(a.getAttribute('href')).toMatch(/tab=retencao/)
    await user.click(a)
    expect(push).not.toHaveBeenCalled() // troca no cliente
    expect(urlAtual().get('tab')).toBe('retencao')
    window.history.back()
  })

  it('a frase das views por dia aparece UMA vez, na linha das abas, não em cada cartão', () => {
    mountProprio()
    expect(screen.getAllByText(/Views por dia de cada vídeo/)).toHaveLength(1)
    expect(raiz().querySelector('nav.ctabs p.res')!.textContent).toBe(SEM_VIEWS_DIARIAS)
    for (const c of cartoes()) expect(c.textContent).not.toMatch(/Views por dia de cada vídeo|views\/dia/)
  })

  it('com busca, a linha das abas diz o resultado e a frase das views por dia dá lugar a ele', async () => {
    const user = userEvent.setup()
    const { all } = mountProprio()
    const t = all[0]!.title.split(' ')[0]!
    await user.type(screen.getByRole('searchbox', { name: 'Buscar por título' }), t)
    await waitFor(() => expect(raiz().querySelector('nav.ctabs p.res')!.textContent).toMatch(/com “/))
    expect(screen.queryAllByText(/Views por dia de cada vídeo/)).toHaveLength(0)
  })
})

describe('T8 controles do canal próprio', () => {
  it('ordenação: "Mais impressões no período" no lugar de "Mais views por dia"; as outras três continuam', () => {
    mountProprio()
    const sel = screen.getByRole('combobox', { name: 'Ordenar' }) as HTMLSelectElement
    expect([...sel.options].map(o => [o.value, o.textContent])).toEqual([
      ['recentes', 'Mais recentes'], ['vistos', 'Mais vistos'], ['multiplo', 'Maior múltiplo'], ['imp', 'Mais impressões no período'],
    ])
    expect([...sel.options].some(o => /views por dia/i.test(o.textContent ?? ''))).toBe(false)
  })

  it('formato: Todos, Longos e Shorts; sem "Fixados" (canal próprio não tem fixados)', () => {
    mountProprio()
    const seg = screen.getByRole('group', { name: 'Formato' })
    expect(within(seg).getAllByRole('button').map(b => b.getAttribute('aria-label')!.split(',')[0])).toEqual(['Todos', 'Longos', 'Shorts'])
    expect(within(seg).queryByRole('button', { name: /Fixados/ })).toBeNull()
  })

  it('ordenar por impressões: os vídeos com impressão vêm primeiro, do maior ao menor; o divisor e a nota miúda dizem a verdade', async () => {
    const user = userEvent.setup()
    mountProprio()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar' }), 'imp')
    expect(urlAtual().get('sort')).toBe('imp')
    const ids = cartoes().map(c => c.dataset.id)
    const imps = ids.map(id => { const c = cartoes().find(x => x.dataset.id === id)!; return c.querySelector('.cv-c.on b')?.textContent ?? null })
    expect(imps.slice(0, 2).every(t => t != null)).toBe(true) // a fixture tem dois vídeos com impressão
    const div = raiz().querySelector('li.cv-div')!
    expect(div.querySelector('h3')!.textContent).toMatch(/^Sem impressão medida no período \(\d+\)$/)
    expect(div.querySelector('small')!.textContent).toBe('o vídeo não apareceu nos relatórios de alcance lidos, ou o alcance do canal não pôde ser lido')
    expect(screen.getByRole('status').textContent).toMatch(/Ordenado por Impressões, decrescente/)
  })
})

describe('T8 o cartão (Capas) do canal próprio', () => {
  it('três colunas (views, impressões, múltiplo) e a terceira linha; nenhuma coluna de views/dia; o cartão não leva "Trocas" nem cliques em coluna', () => {
    const { all } = mountProprio()
    const comImp = all.find(v => v.imp != null && v.multText != null)!
    const c = cartoes().find(x => x.dataset.id === comImp.id)!
    const cols = [...c.querySelectorAll('.cv-nums > .cv-c')]
    expect(cols).toHaveLength(3)
    expect(norm(cols[0]!.textContent)).toBe(norm(`${comImp.viewsText} views`))
    expect(norm(cols[1]!.textContent)).toBe(`${comImp.impText} ${comImp.imp === 1 ? 'impressão' : 'impressões'}`)
    expect(norm(cols[2]!.textContent)).toContain(comImp.multText!)
    expect(norm(c.querySelector('p.cv-n3')!.textContent)).toBe(comImp.terceira)
    expect(comImp.terceira).toMatch(/^(\d+ cliques?|nenhum clique) em \d+ dias?$/)
    expect(c.textContent).not.toMatch(/%|views\/dia/)
  })

  it('vídeo sem impressão: a coluna do meio diz "sem impressão" em .obs-ch-nm (nunca 0) e a terceira linha "sem impressão no período"', () => {
    const { all } = mountProprio()
    const sem = all.find(v => v.imp == null && v.impMissing === 'sem impressão')!
    const c = cartoes().find(x => x.dataset.id === sem.id)!
    const nd = c.querySelector('.cv-c.nd')!
    expect(nd.querySelector('.obs-ch-nm')!.textContent).toBe('sem impressão')
    expect(norm(c.querySelector('p.cv-n3')!.textContent)).toBe('sem impressão no período')
    expect(c.textContent).not.toMatch(/\b0 impress/)
  })

  it('"menos de 1" e "nenhum clique" nunca aparecem lado a lado no mesmo cartão: o cartão mostra só a terceira linha', () => {
    mountProprio()
    for (const c of cartoes()) expect(/menos de 1/.test(c.textContent ?? '') && /nenhum clique/.test(c.textContent ?? '')).toBe(false)
    for (const c of cartoes()) expect(c.textContent).not.toMatch(/menos de 1/)
  })

  it('o link do cartão leva ao vídeo com canal=, back=, ids=, pos= e tot= na ordem em que a grade está (D11)', () => {
    const { all, view } = mountProprio()
    const lista = cartoes()
    const esperadoIds = lista.map(c => c.dataset.id!)
    lista.slice(0, 5).forEach((c, i) => {
      const a = c.querySelector<HTMLAnchorElement>('a.cv-lnk')!
      const u = new URL(a.getAttribute('href')!, 'http://x')
      expect(u.pathname).toBe('/cms/youtube/competitors/video/' + c.dataset.id)
      expect(u.searchParams.get('from')).toBe('canais')
      expect(u.searchParams.get('canal')).toBe(MUNDO.canalId)
      expect(u.searchParams.get('back')).toBe(canalQuery(view.state) || null)
      expect(u.searchParams.get('pos')).toBe(String(i + 1))
      expect(u.searchParams.get('tot')).toBe(String(esperadoIds.length))
      expect(u.searchParams.get('ids')!.split(',')).toEqual(esperadoIds.slice(Math.max(0, Math.min(i - 50, esperadoIds.length - 100)), Math.max(0, Math.min(i - 50, esperadoIds.length - 100)) + 100))
    })
    expect(all.length).toBe(esperadoIds.length)
  })

  it('depois de ordenar por impressões, os links seguem a nova ordem (pos= acompanha a grade)', async () => {
    const user = userEvent.setup()
    mountProprio()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar' }), 'imp')
    const lista = cartoes()
    lista.slice(0, 4).forEach((c, i) => {
      const u = new URL(c.querySelector<HTMLAnchorElement>('a.cv-lnk')!.getAttribute('href')!, 'http://x')
      expect(u.searchParams.get('pos')).toBe(String(i + 1))
      expect(u.searchParams.get('back')).toContain('sort=imp')
      expect(u.searchParams.get('ids')!.split(',')[0]).toBe(lista[0]!.dataset.id)
    })
  })

  it('o menu ⋯ do vídeo próprio: notas, Ampliar e Abrir no YouTube; sem Fixar e sem Ver trocas', async () => {
    const user = userEvent.setup()
    const { all } = mountProprio()
    const v = all[0]!
    await user.click(screen.getByRole('button', { name: 'Ações do vídeo: ' + v.title }))
    const menu = await screen.findByRole('menu')
    const itens = within(menu).getAllByRole('menuitem').map(i => norm(i.textContent))
    expect(itens.map(t => t.replace(/ \(abre em nova aba\)/, ''))).toEqual(['Ampliar thumbnail', 'Abrir no YouTube'])
    expect(menu.textContent).toMatch(/Views por dia:/) // a frase de cada vídeo mora aqui
  })
})

describe('T8 a Lista do canal próprio', () => {
  it('colunas: Impressões e Cliques no lugar de Views/dia e Trocas; Curtidas e Comentários ficam', async () => {
    const user = userEvent.setup()
    mountProprio({ sp: { ver: 'lista' } })
    const heads = [...raiz().querySelectorAll('table.cv-lst thead th')].map(th => norm(th.textContent))
    expect(heads).toEqual(['Vídeo', 'Publicado', 'Views', 'Impressões', 'Múltiplo', 'Curtidas', 'Comentários', 'Cliques', 'Ações'])
    expect(heads).not.toContain('Views/dia')
    expect(heads).not.toContain('Trocas')
    await user.click(within(raiz().querySelector('table.cv-lst thead')!).getByRole('button', { name: 'Impressões' }))
    expect(urlAtual().get('sort')).toBe('imp')
    expect(raiz().querySelector('th[aria-sort]')!.textContent).toMatch(/Impressões/)
  })

  it('cada linha: impressões e cliques com número ou a palavra do motivo em .obs-ch-nm, nunca 0 nem traço', () => {
    const { all } = mountProprio({ sp: { ver: 'lista' } })
    for (const v of all) {
      const tr = raiz().querySelector(`tr.cv-row[data-id="${v.id}"]`)!
      const imp = tr.querySelector('td[data-label="Impressões"]')!, cl = tr.querySelector('td[data-label="Cliques"]')!
      if (v.impText != null) expect(norm(imp.textContent)).toBe(v.impText)
      else expect(imp.querySelector('.obs-ch-nm')!.textContent).toBe(v.impMissing)
      if (v.cliquesText != null) expect(norm(cl.textContent)).toBe(v.cliquesText)
      else expect(cl.querySelector('.obs-ch-nm')!.textContent).toBe(v.cliquesMissing)
      expect(norm(imp.textContent)).not.toBe('0')
      expect(norm(imp.textContent)).not.toBe('—')
    }
  })
})

describe('T8 o estado segue a URL e a query do canal próprio (Next 16 não remonta)', () => {
  it('rerender só com outra query (sort=imp) atualiza a ordenação sem remontar a árvore', () => {
    const r = mountProprio()
    const antes = raiz()
    const sel = screen.getByRole('combobox', { name: 'Ordenar' }) as HTMLSelectElement
    expect(sel.value).toBe('recentes')
    r.rerenderCom({ sort: 'imp' })
    expect(raiz()).toBe(antes)
    expect((screen.getByRole('combobox', { name: 'Ordenar' }) as HTMLSelectElement).value).toBe('imp')
    expect(screen.getByRole('combobox', { name: 'Ordenar' })).toBe(sel)
  })

  it('I2: abrir com ?sort=imp&tab=retencao e mudar outra opção: a URL mantém as duas (o hook lê como canal próprio)', async () => {
    const user = userEvent.setup()
    mountProprio({ sp: { sort: 'imp', tab: 'retencao' } })
    expect(tabs().getByRole('link', { name: 'Retenção' }).getAttribute('aria-current')).toBe('page')
    await user.click(tabs().getByRole('link', { name: /^Vídeos/ }))
    expect(urlAtual().get('sort')).toBe('imp')
    expect((screen.getByRole('combobox', { name: 'Ordenar' }) as HTMLSelectElement).value).toBe('imp')
    await user.click(within(screen.getByRole('group', { name: 'Formato' })).getByRole('button', { name: /^Longos/ }))
    expect(urlAtual().get('sort')).toBe('imp')
    expect(urlAtual().get('fmt')).toBe('longos')
    await user.click(tabs().getByRole('link', { name: 'Retenção' }))
    expect(urlAtual().get('tab')).toBe('retencao')
    expect(urlAtual().get('sort')).toBe('imp')
    expect(urlAtual().get('fmt')).toBe('longos')
  })

  it('I2: o servidor manda outra query (só mudou o q) e a ordenação por impressões e a aba Retenção não voltam ao padrão', () => {
    const r = mountProprio({ sp: { sort: 'imp', tab: 'retencao' } })
    r.rerenderCom({ sort: 'imp', tab: 'retencao', q: 'abc' })
    expect(tabs().getByRole('link', { name: 'Retenção' }).getAttribute('aria-current')).toBe('page')
    expect(urlAtual().get('sort')).toBe('imp')
    expect(urlAtual().get('tab')).toBe('retencao')
    r.rerenderCom({ sort: 'imp' })
    expect((screen.getByRole('combobox', { name: 'Ordenar' }) as HTMLSelectElement).value).toBe('imp')
  })

  it('I2: o Voltar do navegador (popstate) relê a URL com as regras do canal próprio', () => {
    mountProprio()
    window.history.pushState(null, '', window.location.pathname + '?sort=imp&tab=retencao')
    fireEvent(window, new PopStateEvent('popstate'))
    expect(tabs().getByRole('link', { name: 'Retenção' }).getAttribute('aria-current')).toBe('page')
    window.history.pushState(null, '', window.location.pathname + '?sort=imp')
    fireEvent(window, new PopStateEvent('popstate'))
    expect((screen.getByRole('combobox', { name: 'Ordenar' }) as HTMLSelectElement).value).toBe('imp')
  })

  it('valores que o canal próprio não aceita (fmt=fixados, sort=vpd) caem no padrão, como no servidor', () => {
    mountProprio({ sp: { fmt: 'fixados', sort: 'vpd' } })
    expect((screen.getByRole('combobox', { name: 'Ordenar' }) as HTMLSelectElement).value).toBe('recentes')
    expect(within(screen.getByRole('group', { name: 'Formato' })).getByRole('button', { name: /^Todos/ }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('T8 os estados sem dado: 1, 2 e N canais, parado, série cheia, curta e vazia, negado, erro', () => {
  const cenarios: CenarioDados[] = ['cheio', 'curto', 'vazio', 'parado', 'negado', 'erro']
  for (const cenario of cenarios) {
    it(`cenário ${cenario}: a página abre, nenhum número é "0" no lugar de "não medido", nenhuma palavra interna aparece`, () => {
      const w = proprioWorld({ cenario })
      const { view } = mountProprio({ world: w })
      const txt = raiz().textContent ?? ''
      expect(txt).not.toMatch(/NaN|undefined|\bnull\b|L2|L3|lote|dataset|day_pt|Reporting|Analytics API/)
      for (const c of view.header.faixa) {
        const dd = [...raiz().querySelectorAll('dl[aria-label="Números do canal"] .nc')].find(e => e.querySelector('dt')!.textContent === c.label)!
        if (c.value == null) {
          expect(dd.querySelector('.obs-ch-nm')!.textContent, c.key).toBe(c.missing)
          expect(c.missing, c.key).not.toBe('')
        } else expect(norm(dd.querySelector('dd')!.textContent), c.key).toContain(c.value)
      }
    })
  }

  it('série vazia (tabela vazia, o banco local de hoje): impressões e cliques dizem "ainda sem relatório"; o cartão diz a palavra curta; nenhum 0', () => {
    const { all, view } = mountProprio({ world: proprioWorld({ cenario: 'vazio' }) })
    const imp = view.header.faixa.find(c => c.key === 'impressoes')!
    expect(imp.value).toBeNull()
    expect(imp.missing).toBe('ainda sem relatório de alcance deste canal')
    for (const c of cartoes()) {
      expect(c.querySelector('.cv-c.nd .obs-ch-nm')!.textContent).toBe('sem relatório')
      expect(c.querySelector('p.cv-n3')).toBeNull() // o motivo mora uma vez, na nota
    }
    expect(raiz().querySelector('.cv-foot')!.textContent).toContain('Impressões e cliques: ainda sem relatório de alcance deste canal.')
    expect(all.length).toBeGreaterThan(0)
  })

  it('negado: cada número privado diz "só quem edita o site vê este número" e o cartão "só quem edita vê"', () => {
    mountProprio({ world: proprioWorld({ cenario: 'negado' }) })
    const nm = [...raiz().querySelectorAll('dl[aria-label="Números do canal"] .obs-ch-nm')].map(e => e.textContent)
    expect(nm.filter(t => t === 'só quem edita o site vê este número').length).toBe(2) // impressões e dias com impressão
    for (const c of cartoes()) expect(c.querySelector('.cv-c.nd .obs-ch-nm')!.textContent).toBe('só quem edita vê')
  })

  it('erro de leitura: a tela abre (a página não cai) e diz "a leitura do alcance falhou agora; recarregue a página"', () => {
    mountProprio({ world: proprioWorld({ cenario: 'erro' }) })
    expect(raiz().textContent).toContain('a leitura do alcance falhou agora; recarregue a página')
  })

  it('canal parado: o cabeçalho diz "parado: nenhum em 13 semanas" como valor (zero medido) e a série fica em zero medido, não "não medido"', async () => {
    const user = userEvent.setup()
    const w = proprioWorld({ mut: parado, cenario: 'parado' })
    mountProprio({ world: w })
    await user.click(screen.getByRole('button', { name: /Todos os números/ }))
    const ritmo = [...raiz().querySelectorAll('#canal-nums2 .nc')].find(e => e.querySelector('dt')!.textContent === 'longos + Shorts por semana')!
    expect(norm(ritmo.querySelector('dd')!.textContent)).toBe('parado: nenhum em 13 semanas')
    expect(ritmo.querySelector('.obs-ch-nm')).toBeNull()
  })

  it('um vídeo só: a página abre com um cartão, a contagem na aba e sem "Carregar mais"', () => {
    const w = proprioWorld({ mut: ds => { const id = ds.channels.find(c => c.own)!.id; const ficam = ds.videos.filter(v => v.ch === id).slice(0, 1); ds.videos = ds.videos.filter(v => v.ch !== id).concat(ficam) } })
    const { all } = mountProprio({ world: w })
    expect(all).toHaveLength(1)
    expect(cartoes()).toHaveLength(1)
    expect(norm(tabs().getByRole('link', { name: /^Vídeos/ }).textContent)).toBe('Vídeos 1')
    expect(screen.queryByRole('button', { name: /Carregar/ })).toBeNull()
  })

  for (const preset of ['1', '2', '5'] as const) {
    it(`preset ${preset} (${preset === '1' ? 'um' : preset === '2' ? 'dois' : 'cinco'} canais próprios): o selo de idioma só aparece com mais de um`, () => {
      mountProprio({ world: proprioWorld({ preset }) })
      const lang = raiz().querySelector('.chead abbr.langtag, .chead .lang')
      if (preset === '1') expect(lang).toBeNull()
      else expect(lang!.textContent).toMatch(/^(PT|EN)$/)
    })
  }

  it('canal sem vídeos (se a tela fosse montada assim): a caixa de vazio, sem botão de sincronizar e sem controles', () => {
    mountProprio({ world: proprioWorld({ mut: semVideos }) })
    expect(raiz().querySelector('.cv-empty p')!.textContent).toBe('Este canal ainda não tem vídeos sincronizados.')
    expect(screen.queryByRole('button', { name: /Sincronizar/ })).toBeNull()
    expect(raiz().querySelector('.cv-ctl')).toBeNull()
  })
})

describe('T8 ProprioScreen: segurança e CSS', () => {
  it('estado negado: as props que a tela recebe, serializadas, não carregam número privado (é client component)', () => {
    const cheio = viewDe(proprioWorld({ cenario: 'cheio' }))
    const negado = viewDe(proprioWorld({ cenario: 'negado' }))
    const json = JSON.stringify(negado)
    for (const v of cheio.videos.videos) for (const [k, t] of [['impText', v.impText], ['cliquesText', v.cliquesText], ['vpdDiarioText', v.vpdDiarioText]] as const) if (t) expect(json).not.toContain(`"${k}":"${t}"`)
    const imp = cheio.header.faixa.find(c => c.key === 'impressoes')!
    expect(json).not.toContain(`{"key":"impressoes","value":"${imp.value}"`)
    expect(imp.value).not.toBeNull() // a série cheia tem o que procurar
  })

  const css = fs.readFileSync(path.join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio/proprio.css'), 'utf8')
  it('proprio.css: preso à tela própria, sem color-mix, sem z-index numérico, texto de 12 px ou mais', () => {
    expect(css).not.toMatch(/color-mix\(/)
    expect(css).not.toMatch(/z-index\s*:\s*-?\d/)
    for (const m of css.matchAll(/font(?:-size)?\s*:\s*(?:[0-9]+\s+)?(\d+(?:\.\d+)?)px/g)) expect(Number(m[1]), m[0]).toBeGreaterThanOrEqual(12)
    // toda regra começa pela raiz da tela própria (ou é @media / comentário)
    const semMedia = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '')
    for (const seletor of semMedia.split('}').map(s => s.split('{')[0]!.trim()).filter(Boolean)) {
      for (const parte of seletor.split(',').map(p => p.trim())) expect(parte, parte).toMatch(/^(\[data-theme="light"\] )?\[data-obs-screen="canal"\]\[data-own="1"\]/)
    }
  })
})
