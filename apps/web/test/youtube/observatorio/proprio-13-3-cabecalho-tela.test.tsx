// @vitest-environment jsdom
// A4 Tarefa 13.3: o cabeçalho do canal próprio na tela (mockups 1 e 2): a linha-resumo com a palavra e a forma do "parado", a segunda linha de cada
// célula, o quadradinho hachurado de "não medido" com UMA frase sob a faixa, o "ainda não dá para dizer" do % assistido com poucos dias, e a prova de
// que o usuário só de leitura não recebe nenhum número privado no HTML.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { proprioWorld, CHEIO } from './proprio-fixture'
import { comDiario, diarioComPct, ultimoVideoHa } from './proprio-assistido-fixture'
import { mountProprio } from './proprio-mount'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/x',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const raiz = () => document.querySelector<HTMLElement>('[data-obs-screen="canal"][data-own="1"]')!
const cel = (rotulo: string) => [...raiz().querySelectorAll('.chead .nc')].find(e => e.querySelector('dt')!.textContent === rotulo)!

describe('13.3 linha-resumo e "parado"', () => {
  it('canal parado: a linha-resumo diz a palavra e leva a forma (duas barras); a célula leva a etiqueta "parado" com a forma', () => {
    mountProprio({ world: proprioWorld({ mut: ultimoVideoHa(666) }) })
    const r = raiz().querySelector('.chead .resumo-canal')!
    expect(r.textContent).toBe(`Canal parado há 666 dias; ${CHEIO.imp} impressões em 21 dias.`)
    expect(r.querySelector('.dn .pausa')).not.toBeNull()
    expect(r.querySelector('.dn')!.textContent).toBe('Canal parado há 666 dias')
    const c = cel('desde o último vídeo')
    expect(c.classList.contains('parado')).toBe(true)
    expect(c.querySelector('.parado-tag')!.textContent).toBe('parado')
  })
  it('canal ativo: "Último vídeo há N dias" sem destaque e sem a forma', () => {
    mountProprio({ world: proprioWorld({ mut: ultimoVideoHa(12) }) })
    const r = raiz().querySelector('.chead .resumo-canal')!
    expect(r.textContent).toContain('Último vídeo há 12 dias;')
    expect(r.querySelector('.dn')).toBeNull()
    expect(cel('desde o último vídeo').querySelector('.parado-tag')).toBeNull()
  })
})

describe('13.3 segunda linha das células e "Todos os números"', () => {
  it('impressões leva o período na segunda linha; a taxa, o intervalo; as views por dia, a base', async () => {
    const user = userEvent.setup()
    mountProprio({ world: proprioWorld({ mut: ultimoVideoHa(12) }) })
    expect(cel('impressões').querySelector('.nsub')!.textContent).toMatch(/^de \d\d\/\d\d a \d\d\/\d\d$/)
    await user.click(screen.getByRole('button', { name: /Todos os números/ }))
    expect(cel('taxa de clique do canal').querySelector('.nsub')!.textContent).toMatch(/^entre \d+,\d% e \d+,\d%$/)
    expect(cel('views/dia por vídeo').querySelector('.nsub')!.textContent).toBe('mediana dos longos, 28 dias')
    expect(cel('cliques estimados no período').querySelector('.nsub')!.textContent).toBe('impressões × taxa de cada dia')
  })
  it('retenção (curva): o quadradinho "não medido" e, na segunda linha, "a curva ainda não é coletada"', async () => {
    const user = userEvent.setup()
    mountProprio({ world: proprioWorld({ mut: ultimoVideoHa(12) }) })
    await user.click(screen.getByRole('button', { name: /Todos os números/ }))
    const c = cel('retenção (curva)')
    expect(c.querySelector('.nm-q')!.getAttribute('aria-label')).toBe('não medido')
    expect(c.querySelector('.nsub')!.textContent).toBe('a curva ainda não é coletada')
  })
  it('% assistido: com 7 dias ou mais, o número e a base; com poucos dias, "ainda não dá para dizer" com os dias, sem número', async () => {
    const user = userEvent.setup()
    const w = proprioWorld({ mut: ultimoVideoHa(12) })
    const bom = { ...w, dados: comDiario(w.dados, diarioComPct(w.canalId, w.ytIds, w.hoje, [{ dias: 10, views: 5, pct: 45 }])) }
    const r = mountProprio({ world: bom }); await user.click(screen.getByRole('button', { name: /Todos os números/ }))
    expect(cel('% assistido').querySelector('dd b')!.textContent).toBe('45%')
    expect(cel('% assistido').querySelector('.nsub')!.textContent).toBe('média pelas views, 28 dias')
    r.unmount(); cleanup()
    const fino = { ...w, dados: comDiario(w.dados, diarioComPct(w.canalId, w.ytIds, w.hoje, [{ dias: 3, views: 40, pct: 61 }])) }
    mountProprio({ world: fino }); await user.click(screen.getByRole('button', { name: /Todos os números/ }))
    const c = cel('% assistido')
    expect(c.querySelector('dd b')).toBeNull()
    expect(c.querySelector('dd.nf')!.textContent).toBe('ainda não dá para dizer')
    expect(c.querySelector('.nsub')!.textContent).toBe('só 3 dias com dado; precisa de 7')
    expect(c.querySelector('.nm-q')).toBeNull()   // não é "não medido": há dado, pouco demais
  })
})

describe('13.3 não medido: pastilha curta e UMA frase', () => {
  it('sem relatório: as células de alcance levam só o quadradinho e a frase aparece uma vez, sob a faixa', () => {
    mountProprio({ world: proprioWorld({ cenario: 'vazio', mut: ultimoVideoHa(12) }) })
    const faixa = raiz().querySelector('dl[aria-label="Números do canal"]')!
    expect(faixa.querySelectorAll('.nm-q')).toHaveLength(2)
    for (const q of faixa.querySelectorAll('.nm-q')) expect(q.textContent).toBe('')
    const frases = raiz().querySelectorAll('.chead > .nm-fr')
    expect(frases).toHaveLength(1)
    expect(frases[0]!.textContent).toBe('Não medido: ainda sem relatório de alcance deste canal. Nenhum destes números é zero, só falta medir.')
    expect(faixa.textContent).not.toContain('ainda sem relatório')   // nenhuma célula repete o motivo
  })
})

describe('13.3 usuário só de leitura: nenhum número privado no HTML', () => {
  it('com acesso negado o cabeçalho não leva impressões, cliques, taxa, views por dia nem % assistido do dado da fixture', async () => {
    const user = userEvent.setup()
    const w = proprioWorld({ mut: ultimoVideoHa(12) })
    const dadosCheios = { ...w, dados: comDiario(w.dados, diarioComPct(w.canalId, w.ytIds, w.hoje, [{ dias: 10, views: 7919, pct: 54.3 }])) }
    const cheio = mountProprio({ world: dadosCheios })
    await user.click(screen.getByRole('button', { name: /Todos os números/ }))
    const valor = (k: string) => cheio.view.header.todos.concat(cheio.view.header.faixa).find(c => c.key === k)!.value!
    // só valores com mais de um caractere útil: um "24" solto apareceria em qualquer atributo do HTML
    const privados = [valor('taxaClique'), valor('assistido'), `${valor('impressoes')} impressões`]
    expect(privados).toEqual([expect.stringMatching(/^\d+,\d%$/), '54%', `${CHEIO.imp} impressões`])
    cheio.unmount(); cleanup()
    const neg = mountProprio({ world: proprioWorld({ cenario: 'negado', mut: ultimoVideoHa(12) }) })
    await user.click(screen.getByRole('button', { name: /Todos os números/ }))
    const html = neg.container.innerHTML
    for (const v of privados) expect(html, v).not.toContain(v)
    expect(html).not.toContain('7919')
    expect(raiz().querySelector('.chead .resumo-canal')!.textContent).toBe('Último vídeo há 12 dias; só quem edita o site vê os números de alcance.')
    expect(raiz().querySelector('.chead > .nm-fr')!.textContent).toBe('Só quem edita o site vê este número.')
  })
})
