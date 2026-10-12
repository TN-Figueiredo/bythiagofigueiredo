// @vitest-environment jsdom
// A4 Tarefa 13.3: "Como o canal está" na tela, o que é novo (mockups 1 e 2): o bloco "Taxa de clique do canal" (valor em negrito, faixa em SVG, nota, ⓘ),
// o gráfico "Views por dia, soma dos vídeos" e "O que ainda não é medido" só com a curva de retenção e a origem do tráfego. Quem só lê o site vê a frase, sem número.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComoEsta } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta'
import { montarComoEsta } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta-model'
import { buildProprioHeader } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { concorrentesDoSite, posicaoDoSite } from '@/app/cms/(authed)/youtube/competitors/_proprio/posicao-do-site'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import { proprioWorld } from './proprio-fixture'

const W = proprioWorld()
const { posicao } = posicaoDoSite(W.obs, W.canalId)
const HEADER = buildProprioHeader(W.obs, W.canalId, W.dados, { hoje: W.hoje, dm: W.dm, posicao, muitosProprios: false })!
const VIDEOS = W.obs.videos.filter(x => x.ch === W.canalId).map(x => ({ id: x.id, ytId: x.ytId, title: x.title, thumb: null }))
function montar(dados: DadosDoCanal = W.dados) {
  const s = montarComoEsta({ dados, hoje: W.hoje, dm: W.dm, posicao, posicaoItens: HEADER.posicaoItens, videos: VIDEOS, concorrentes: concorrentesDoSite(W.obs, W.canalId), canalId: W.canalId })
  return { ...s, ...render(<ComoEsta view={s.view} grafico={s.grafico} graficoViews={s.graficoViews} painel="1" canalId={W.canalId} />) }
}
const corpo = () => document.querySelector<HTMLElement>('.pn-b')!
beforeEach(() => { vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} }); window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.getElementById('flut')?.remove() })

describe('13.3 bloco "Taxa de clique do canal" na tela', () => {
  it('título, frase com o valor e os limites em negrito, faixa em SVG com nome acessível e a nota; fica entre os dois gráficos', () => {
    const { view } = montar()
    const bloco = within(corpo()).getByRole('region', { name: /Taxa de clique do canal/ })
    expect(bloco.querySelectorAll('.pn-fr b')).toHaveLength(3)
    expect(bloco.querySelector('.pn-fr')!.textContent).toBe(view.taxa.frase!.map(x => x.t).join(''))
    expect(bloco.querySelector('[role="img"][aria-label^="Taxa de clique do canal:"]')).not.toBeNull()
    expect(bloco.querySelector('.tf svg')).not.toBeNull()
    expect(bloco.querySelector('.pn-nt')!.textContent).toBe(view.taxa.nota)
    const ordem = [...corpo().querySelectorAll('.pn-c > *')].map(e => e.matches('.pn-taxa') ? 'taxa' : e.matches('.ic') ? (e.querySelector('.ic-t')!.textContent) : '?')
    expect(ordem).toEqual(['Impressões por dia do canal', 'taxa', 'Views por dia, soma dos vídeos'])
  })
  it('o ⓘ "Como a taxa é calculada" abre o método (Wilson) e fecha', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Como a taxa é calculada' }))
    const dica = await screen.findByRole('dialog', { name: 'Como a taxa é calculada' })
    expect(dica.textContent).toContain('método de Wilson')
  })
  it('sem permissão ou sem relatório: só a frase do motivo; nenhum SVG da faixa, nenhuma nota', () => {
    const { view } = montar({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } })
    const bloco = within(corpo()).getByRole('region', { name: /Taxa de clique do canal/ })
    expect(bloco.querySelector('.pn-vazio')!.textContent).toBe(view.taxa.vazio)
    expect(bloco.querySelector('.tf')).toBeNull()
    expect(bloco.querySelector('.pn-nt')).toBeNull()
  })
})

describe('13.3 views por dia e "O que ainda não é medido"', () => {
  it('o gráfico de views tem as 28 colunas, o seu ⓘ e a tabela; o das impressões continua com a faixa de cliques', () => {
    const { graficoViews } = montar()
    const g = [...corpo().querySelectorAll<HTMLElement>('.pn-c .ic')].find(e => e.querySelector('.ic-t')!.textContent === 'Views por dia, soma dos vídeos')!
    expect(g.querySelectorAll('svg.ic-svg g[data-situacao]')).toHaveLength(graficoViews.colunas.length)
    expect(graficoViews.colunas).toHaveLength(28)
    expect(within(g).getByText('Ver como tabela')).toBeTruthy()
  })
  it('só a curva de retenção e a origem do tráfego; some a frase "o desenho delas nesta tela ainda não existe"', () => {
    montar()
    const dts = [...corpo().querySelectorAll('dl.pn-nm dt')].map(e => e.textContent)
    expect(dts).toEqual(['Curva de retenção', 'Origem do tráfego'])
    expect(corpo().textContent).not.toContain('desenho delas')
  })
  it('usuário só de leitura: nenhum dígito do dado privado em todo o corpo aberto (nem a taxa, nem as views)', () => {
    montar({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } })
    const taxa = corpo().querySelector('.pn-taxa')!
    expect(taxa.textContent).not.toMatch(/\d/)
    const views = [...corpo().querySelectorAll('.pn-c .ic')][1]!
    expect(views.querySelector('svg.ic-svg')).toBeNull()
    expect(views.textContent).toBe('Views por dia, soma dos vídeosSó quem edita o site vê as views.')
  })
})
