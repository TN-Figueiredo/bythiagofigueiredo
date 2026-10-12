// @vitest-environment jsdom
// A4 Tarefa 13.3, aba Retenção = "% assistido" na tela (mockup 5): as duas tabelas com legenda e cabeçalhos de escopo, ordenadas por views em 28 dias, os
// cartões do 390 px, a legenda da régua, a barra com a marca do normal e a forma do "acima de 100%", os estados sem número e a prova de que quem só lê o site
// não recebe nenhum número. Os estados vêm da fixture do canal próprio.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import { proprioWorld, type CenarioDados } from './proprio-fixture'
import { comDiario, diarioComPct, duracoesDosLongos, ultimoVideoHa, type PlanoDoVideo } from './proprio-assistido-fixture'
import { mountProprio } from './proprio-mount'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/x',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const DUR = [200, 200, 200, 200, 200, 200, 600, 600, 600, 600, 600, 1000, 1000, 1000]
const PCT = [40, 42, 44, 46, 48, 50, 30, 32, 34, 36, 60, 50, 55, 60]
const VPD = [9, 8, 7, 6, 5, 4, 12, 3, 2, 1, 20, 6, 5, 4]
const BASE = proprioWorld({ mut: ds => { duracoesDosLongos(DUR)(ds); ultimoVideoHa(12)(ds) } })
const plano = (pcts: Array<number | null> = PCT, vpd: number[] = VPD): PlanoDoVideo[] => pcts.map((pct, i) => ({ dias: 10, views: vpd[i] ?? 0, pct }))
const mundo = (p: PlanoDoVideo[]) => ({ ...BASE, dados: comDiario(BASE.dados, diarioComPct(BASE.canalId, BASE.ytIds, BASE.hoje, p)) })
const abrir = (w = mundo(plano())) => mountProprio({ world: w, sp: { tab: 'retencao' } })
const raiz = () => document.querySelector<HTMLElement>('[data-obs-screen="canal"][data-own="1"]')!
const secao = () => raiz().querySelector<HTMLElement>('section.ret')!

describe('13.3 aba Retenção: a tela', () => {
  it('o título é "% assistido", leva o id que recebe o foco ao trocar de aba, e a nota diz o período e onde fica a curva', () => {
    const r = abrir()
    const h2 = secao().querySelector('h2')!
    expect(h2.id).toBe('pr-h2')
    expect(h2.getAttribute('tabindex')).toBe('-1')
    expect(h2.textContent).toBe('% assistido')
    expect(secao().querySelector('.ret-nota')!.textContent).toBe(r.view.retencao.nota)
    expect(secao().querySelector('.ret-nota')!.textContent).toContain('A curva de retenção por minuto fica na página de cada vídeo.')
    // a frase antiga da aba sem conteúdo não aparece mais
    expect(raiz().textContent).not.toContain('Retenção ainda não coletada.')
  })

  it('tabela do normal por faixa: legenda (caption), cabeçalhos de coluna e de linha com escopo, e as três frases dos estados', () => {
    abrir()
    const t = within(secao()).getByRole('table', { name: 'Normal de % assistido por faixa de duração' })
    expect(t.querySelector('caption')).not.toBeNull()
    expect([...t.querySelectorAll('thead th')].map(e => e.getAttribute('scope'))).toEqual(['col', 'col', 'col'])
    expect([...t.querySelectorAll('tbody th')].map(e => [e.textContent, e.getAttribute('scope')])).toEqual([['Até 5 min', 'row'], ['5 a 15 min', 'row'], ['Acima de 15 min', 'row']])
    const linhas = [...t.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent))
    expect(linhas).toEqual([['6', '45%'], ['5', '34%'], ['3', 'poucos vídeos para comparar (3; precisa de 5)']])
  })

  it('tabela por vídeo ordenada por views em 28 dias, com legenda e escopo; o vídeo alvo leva o destaque e a frase em texto', () => {
    const r = abrir()
    const t = within(secao()).getByRole('table', { name: 'Vídeos com % assistido, contra o normal da faixa de duração' })
    expect([...t.querySelectorAll('thead th')].map(e => e.textContent)).toEqual(['Vídeo', 'Faixa', 'Views, 28 dias', '% assistido', 'Contra a faixa'])
    expect([...t.querySelectorAll('thead th')].every(e => e.getAttribute('scope') === 'col')).toBe(true)
    const viewsCol = [...t.querySelectorAll('tbody tr')].map(tr => tr.querySelectorAll('td')[2]!.textContent)
    expect(viewsCol).toEqual(r.view.retencao.videos.map(v => v.views28))
    expect(viewsCol[0]).toBe('200')
    const alvos = t.querySelectorAll('tbody tr.alvo')
    expect(alvos).toHaveLength(3)
    expect(alvos[0]!.textContent).toContain('views acima do normal do canal e % assistido abaixo do normal da faixa')   // em texto (leitor de tela), não só o fundo
    expect(secao().querySelector('.ret-lead')!.textContent).toMatch(/^3 vídeos têm views acima do normal do canal e % assistido abaixo do normal da faixa: “/)
    expect(secao().querySelector('.ret-lead b')!.textContent).toBe('3 vídeos têm')
  })

  it('"contra a faixa": acima com +, abaixo com −, na média com = e o texto; cada um com forma e palavra', () => {
    abrir()
    const t = secao().querySelector('table.tb-v')!
    const cmp = (cls: string) => [...t.querySelectorAll(`.cmp.${cls}`)]
    expect(cmp('up').length).toBeGreaterThan(0)
    for (const c of cmp('up')) { expect(c.querySelector('.pt')!.textContent).toMatch(/^\+\d+ pontos?$/); expect(c.querySelector('.w')!.textContent).toMatch(/^acima do normal da faixa \(\d+%\)$/) }
    for (const c of cmp('dn')) { expect(c.querySelector('.pt')!.textContent).toMatch(/^−\d+ pontos?$/); expect(c.querySelector('.w')!.textContent).toMatch(/^abaixo do normal da faixa \(\d+%\)$/) }
    for (const c of cmp('eq')) { expect(c.querySelector('.pt')!.textContent).toBe('='); expect(c.querySelector('.w')!.textContent).toMatch(/^na média da faixa \(\d+%\)/) }
    expect(cmp('eq').length).toBeGreaterThan(0)
  })

  it('a barra leva o % real e a marca do normal; a que passa de 100% mostra o número real, a barra cheia e a marca em forma', () => {
    const p = plano(); p[10] = { dias: 10, views: 20, pct: 112.4 }
    abrir(mundo(p))
    const linha = [...secao().querySelectorAll('table.tb-v tbody tr')].find(tr => tr.textContent!.includes('112%'))!
    const mini = linha.querySelector('.mini')!
    expect(mini.classList.contains('over')).toBe(true)
    expect((mini.querySelector('i') as HTMLElement).style.width).toBe('100%')
    expect(linha.querySelector('.mini ~ .num')!.textContent).toBe('112%')
    expect(linha.querySelector('.obs-ch-sr')!.textContent).toContain('acima de 100%')
    const normal = [...secao().querySelectorAll('table.tb-v tbody tr')].find(tr => tr.textContent!.includes('30%'))!
    expect((normal.querySelector('.mini s') as HTMLElement).style.left).toBe('34%')
    expect(secao().querySelectorAll('.mini.over')).toHaveLength(2)   // uma na tabela e uma no cartão do 390 px (o CSS mostra um dos dois)
  })

  it('poucas views: o % vem com "(8 views)" em cinza e a frase "poucas views para comparar"', () => {
    const p = plano(); p[0] = { dias: 8, views: 1, pct: 70 }
    abrir(mundo(p))
    const linha = [...secao().querySelectorAll('table.tb-v tbody tr')].find(tr => tr.textContent!.includes('(8 views)'))!
    expect(linha.textContent).toContain('70%')
    expect(linha.textContent).toContain('poucas views para comparar')
    expect(linha.querySelector('.cmp')).toBeNull()
  })

  it('os cartões do 390 px têm o mesmo conteúdo, com o link para a página do vídeo', () => {
    const r = abrir()
    const cards = [...secao().querySelectorAll('ul.rcards > li')]
    expect(cards).toHaveLength(r.view.retencao.videos.length)
    expect(cards[0]!.querySelector('a')!.getAttribute('href')).toBe(r.view.retencao.videos[0]!.href)
    expect(cards[0]!.textContent).toContain('200 views em 28 dias')
    expect(cards.filter(c => c.classList.contains('alvo'))).toHaveLength(3)
    expect(secao().querySelector('ul.rcards')!.getAttribute('aria-label')).toBe('Vídeos com % assistido')
  })

  it('a legenda: a barra e a marca, e a régua "na média = até 2 pontos para cima ou para baixo; acima/abaixo = 3 pontos ou mais"', () => {
    abrir()
    const leg = secao().querySelector('.rleg')!.textContent!
    expect(leg).toContain('a barra é o % assistido; a marca é o normal da faixa')
    expect(leg).toContain('acima (3 pontos ou mais)')
    expect(leg).toContain('na média (até 2 pontos para cima ou para baixo)')
    expect(leg).toContain('abaixo (3 pontos ou mais)')
  })

  it('o ⓘ "De onde vem o % assistido" abre o método', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(within(secao()).getByRole('button', { name: 'De onde vem o % assistido' }))
    const dica = await screen.findByRole('dialog', { name: 'De onde vem o % assistido' })
    expect(dica.querySelectorAll('li')).toHaveLength(4)
    expect(dica.textContent).toContain('Acima de 100%: trecho que muita gente voltou para rever')
  })
})

describe('13.3 aba Retenção: estados sem número', () => {
  const cenario = (c: CenarioDados) => ({ ...BASE, dados: proprioWorld({ cenario: c, mut: duracoesDosLongos(DUR) }).dados })
  it('nenhum vídeo com views: a frase com o último dia; sem tabela, sem "0"', () => {
    const r = abrir(mundo(plano(PCT, VPD.map(() => 0))))
    expect(secao().querySelector('.ret-vazio')!.textContent).toBe(r.view.retencao.vazio)
    expect(secao().querySelector('.ret-vazio')!.textContent).toMatch(/^Nenhum vídeo teve views nos 28 dias até \d\d\/\d\d\./)
    expect(secao().querySelector('table')).toBeNull()
  })
  it('diário vazio e leitura com erro: a frase de cada um', () => {
    abrir(cenario('vazio'))
    expect(secao().querySelector('.ret-vazio')!.textContent).toBe('A coleta diária ainda não rodou para este canal: não há % assistido de nenhum vídeo.')
    cleanup()
    abrir(cenario('erro'))
    expect(secao().querySelector('.ret-vazio')!.textContent).toBe('A leitura do % assistido falhou agora; recarregue a página.')
  })
  it('vídeos com views sem % entregue: a nota diz quantos ficaram de fora', () => {
    const p = plano(); p[3] = { dias: 10, views: 6, pct: null }
    abrir(mundo(p))
    expect(secao().querySelector('.ret-sempct')!.textContent).toBe('1 vídeo teve views, mas o YouTube ainda não entregou o % assistido dele.')
  })
  it('usuário só de leitura: só a frase; nenhum dígito do dado privado na aba (sentinelas 7919 e 54,3)', () => {
    const w = mundo(plano(PCT, PCT.map(() => 7919)).map(x => ({ ...x, pct: 54.3 })))
    const cheio = abrir(w)
    const privados = cheio.view.retencao.videos.map(v => v.views28).concat(cheio.view.retencao.videos.map(v => v.pct))
    expect(privados.length).toBeGreaterThan(0)
    cheio.unmount(); cleanup()
    abrir(cenario('negado'))
    expect(secao().textContent).toBe('% assistidoDado do diário do YouTube, dia do YouTube. A curva de retenção por minuto fica na página de cada vídeo.Só quem edita o site vê o % assistido.')
    expect(secao().innerHTML).not.toContain('7919')
    expect(secao().querySelector('table')).toBeNull()
  })
})

describe('13.3 retenção.css: varredura', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_proprio/retencao.css'), 'utf8')
  it('sem color-mix, sem z-index numérico, texto de 12 px ou mais, e os cartões entram a 700 px', () => {
    expect(css).not.toMatch(/color-mix\(/)
    expect(css).not.toMatch(/z-index:\s*\d/)
    for (const m of css.matchAll(/font:\s*[0-9]+\s+([0-9.]+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    for (const m of css.matchAll(/font-size:\s*([0-9.]+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    expect(css).toMatch(/@media \(max-width:700px\)/)
  })
})
