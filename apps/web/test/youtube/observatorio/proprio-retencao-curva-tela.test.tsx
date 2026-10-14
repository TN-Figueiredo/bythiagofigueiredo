// @vitest-environment jsdom
// A5 · E8 · Tarefa 13: a seção "Retenção" da página do vídeo próprio (mockup 6). O modelo é o real (`buildRetencaoView`) e a seção sai de
// `VideoBlocos`; aqui se prova o que a PESSOA lê: a frase com o minuto certo, os cinco estados, a data com o fuso da tela, e que nenhuma curva
// é desenhada sem pontos. Pergunta que guia os testes: "o que acontece quando o dado não existe?".
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { VideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos'
import { buildVideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { buildRetencaoView, METODO_RETENCAO, type RetencaoView } from '@/app/cms/(authed)/youtube/competitors/_proprio/retencao-curva-model'
import { RetencaoCurva } from '@/app/cms/(authed)/youtube/competitors/_proprio/retencao-curva'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { DadosDoVideo, RetencaoDoVideo } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { mundoVideo, type MundoVideo } from './proprio-video-fixture'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))

afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

// ───────────────────────── curvas e leituras de teste ─────────────────────────
interface Ponto { t: number; ratio: number; relative: number | null }
/** `n` pontos da grade 0,01..1,00 (n = 100 é a completa) com o `ratio` dado pela função de `t`. */
const curvaDe = (f: (t: number) => number, n = 100): Ponto[] => Array.from({ length: n }, (_, k) => ({ t: (k + 1) / 100, ratio: f((k + 1) / 100), relative: 0.5 }))
/** O primeiro ponto abaixo de 0,5 é o de t = 0,35 (antes dele a curva fica acima de 0,66): a metade sai aos 35% do vídeo. */
const cruzaEm35 = (t: number): number => (t < 0.345 ? 1 - t : 0.4 - (t - 0.35) * 0.4)
/** Nunca cai abaixo de 0,6. */
const nuncaCruza = (t: number): number => 1 - 0.4 * t
/** Plana: não há queda nem subida em ponto nenhum. */
const plana = (): number => 0.8

const D = (n: number): string => { const x = new Date(Date.now() - n * 86_400_000); return x.toISOString().slice(0, 10) }
const lida = (pontos: Ponto[], over: Partial<RetencaoDoVideo['curvas'] & object> = {}, coletadaEm = D(1) + 'T15:00:00.000Z') => ({
  janela: 'vida' as const, windowStart: D(60), windowEnd: D(2), coletadaEm, pontos, metricas: ['audienceWatchRatio', 'relativeRetentionPerformance'], viewsAtRead: 1234, ...over,
})
const retencao = (o: Partial<RetencaoDoVideo> = {}): Privado<RetencaoDoVideo> => ({
  acesso: 'ok',
  dado: { ytId: 'vid00000001', curvas: {}, leituras: [], leiturasCortadas: false, ultimaTentativa: null, ultimaResposta: null, descartados: 0, tabelaAusente: false, janelasIlegiveis: [], ...o },
})
const comCurva = (pontos: Ponto[], coletadaEm?: string): Privado<RetencaoDoVideo> => retencao({ curvas: { vida: lida(pontos, {}, coletadaEm) } })
const view = (r: Privado<RetencaoDoVideo> | undefined | null, duracaoSeg: number | null = 360): RetencaoView => buildRetencaoView({ retencao: r, duracaoSeg, dm: dmDia })

/** O SVG sozinho (a seção inteira vem de VideoBlocos). */
function RetencaoSvg({ v }: { v: RetencaoView }) { return v.curva ? <RetencaoCurva curva={v.curva} /> : null }

const NAO_COLETADA = 'Ainda não coletamos esta curva. Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam.'

// ───────────────────────── a página inteira, com o modelo real ─────────────────────────
const umaFaixa = (ds: Dataset) => { for (const v of ds.videos) if (v.fmt === 'long') v.dur = 600 }
const W = mundoVideo({ mut: umaFaixa })
const dadoDe = (w: MundoVideo, ret?: Privado<RetencaoDoVideo>): Privado<DadosDoVideo> => {
  const { alcance, diario } = w.dados
  if (alcance.acesso !== 'ok' || diario.acesso !== 'ok') throw new Error('a fixture esperava dado lido')
  return { acesso: 'ok', dado: { alcance: alcance.dado, diario: diario.dado, ...(ret ? { retencao: ret } : {}) } }
}
const montar = (ret?: Privado<RetencaoDoVideo>, dados: Privado<DadosDoVideo> = dadoDe(W, ret)) =>
  render(<div data-obs-screen="video-proprio"><VideoBlocos view={buildVideoBlocos({ obs: W.obs, videoId: W.foco.id, dados, hoje: W.hoje, dm: dmDia })} /></div>)
const secao = (c: HTMLElement) => [...c.querySelectorAll('section')].find(s => s.querySelector('h2')?.textContent?.startsWith('Retenção'))!
const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const svgsDaCurva = (s: Element) => [...s.querySelectorAll('svg')].filter(x => !x.closest('button'))

describe('o modelo: estado "coletada"', () => {
  it('a frase traz o minuto certo para uma curva e uma duração conhecidas: 35% de 6:00 = 2:06', () => {
    const v = view(comCurva(curvaDe(cruzaEm35)), 360)
    expect(v.estado).toBe('coletada')
    expect(v.frase).toBe('Metade das pessoas já saiu aos 2:06 (35% do vídeo).')
  })
  it('a hora passa de 59:59: h:mm:ss', () => {
    expect(view(comCurva(curvaDe(cruzaEm35)), 7200).frase).toBe('Metade das pessoas já saiu aos 42:00 (35% do vídeo).')
    expect(view(comCurva(curvaDe(cruzaEm35)), 14400).frase).toBe('Metade das pessoas já saiu aos 1:24:00 (35% do vídeo).')
  })
  it('nunca cruza: "Mais da metade das pessoas ficou até o fim."', () => {
    expect(view(comCurva(curvaDe(nuncaCruza))).frase).toBe('Mais da metade das pessoas ficou até o fim.')
  })
  it('curva incompleta (37 pontos): "não dá para dizer", nunca "ficou até o fim", e nenhuma saída, trecho revisto nem pico', () => {
    const v = view(comCurva(curvaDe(nuncaCruza, 37)))
    expect(v.estado).toBe('coletada')
    expect(v.frase).toMatch(/não dá para dizer/i)
    expect(JSON.stringify(v)).not.toMatch(/ficou até o fim/)
    expect(v.saidas).toBeNull()
    expect(v.revistos).toBeNull()
    expect(v.curva?.legenda).toEqual({ saidas: false, revistos: false, pico: null })
    expect(v.curva?.meioT).toBeNull()
    expect(v.curva?.saidas).toEqual([])
    expect(v.curva?.revistos).toEqual([])
  })
  it('curva incompleta que passou de 100%: ainda não afirma pico (o que falta pode ter mais)', () => {
    const v = view(comCurva(curvaDe(() => 1.4, 37)))
    expect(v.curva?.legenda.pico).toBeNull()
  })
  it('a data da leitura vem do fuso de São Paulo, não do corte do texto ISO (item 64)', () => {
    // 01:30 UTC do dia 9 é 22:30 do dia 8 em São Paulo
    const v = view(comCurva(curvaDe(cruzaEm35), '2026-10-09T01:30:00.000Z'))
    expect(v.aviso).toContain('coletada em 08/10.')
    expect(v.aviso).not.toContain('09/10')
    const v2 = view(comCurva(curvaDe(cruzaEm35), '2026-10-09T15:30:00.000Z'))
    expect(v2.aviso).toContain('coletada em 09/10.')
  })
  it('o aviso explica que a curva é da vida inteira e o % assistido é dos últimos dias', () => {
    expect(view(comCurva(curvaDe(cruzaEm35))).aviso).toBe('Curva da vida inteira do vídeo, coletada em ' + dmDia(D(1)) + '. O % assistido da seção anterior é dos últimos dias.')
  })
  it('curva completa com saídas e trechos revistos: as duas linhas aparecem, no formato do mockup', () => {
    // queda forte entre 20% e 30% e uma subida (replay) entre 60% e 70%
    const f = (t: number): number => (t < 0.2 ? 1 - t : t < 0.3 ? 0.8 - (t - 0.2) * 3 : t < 0.6 ? 0.5 - (t - 0.3) * 0.1 : t < 0.7 ? 0.47 + (t - 0.6) * 1 : 0.57 - (t - 0.7) * 0.2)
    const v = view(comCurva(curvaDe(f)), 600)
    expect(v.saidas).toMatch(/^Maiores saídas: \d+:\d\d a \d+:\d\d, de \d+% para \d+%/)
    expect(v.saidas).toMatch(/\.$/)
    expect(v.revistos).toMatch(/^Trechos revistos: \d+:\d\d a \d+:\d\d/)
    expect(v.revistos).toMatch(/\.$/)
    expect(v.curva!.legenda.saidas).toBe(true)
    expect(v.curva!.legenda.revistos).toBe(true)
  })
  it('sem saídas e sem revistos: as duas linhas não existem (nada de "Maiores saídas: .")', () => {
    const v = view(comCurva(curvaDe(plana)))
    expect(v.saidas).toBeNull()
    expect(v.revistos).toBeNull()
    expect(JSON.stringify(v)).not.toMatch(/Maiores saídas|Trechos revistos/)
  })
  it('menos de 100 pontos: "Curva com N pontos."', () => {
    expect(view(comCurva(curvaDe(cruzaEm35, 37))).aviso).toMatch(/ Curva com 37 pontos\.$/)
    expect(view(comCurva(curvaDe(cruzaEm35, 100))).aviso).not.toMatch(/Curva com/)
  })
  it('duração desconhecida ou zero: tudo em % do vídeo, nenhum "0:00"', () => {
    for (const dur of [null, 0]) {
      const v = view(comCurva(curvaDe(cruzaEm35)), dur)
      expect(v.frase).toBe('Metade das pessoas já saiu com 35% do vídeo.')
      expect(JSON.stringify(v)).not.toMatch(/0:00/)
      expect(v.curva!.eixo).toEqual(['0%', '25%', '50%', '75%', '100%'])
      expect(v.saidas ?? '').not.toMatch(/\d:\d\d/)
    }
  })
  it('com duração: o eixo do tempo vai de 0:00 à duração em cinco marcas', () => {
    expect(view(comCurva(curvaDe(cruzaEm35)), 360).curva!.eixo).toEqual(['0:00', '1:30', '3:00', '4:30', '6:00'])
  })
  it('ratio 1,3: a legenda diz o pico, e o desenho não passa do teto de 120%', () => {
    const v = view(comCurva(curvaDe(t => (t < 0.05 ? 1.3 : 1 - t * 0.5))))
    expect(v.curva!.legenda.pico).toBe('pico de 130% no começo')
    const { container } = render(<RetencaoSvg v={v} />)
    expect(container.textContent).toContain('pico de 130% no começo')
  })
  it('ratio até 1,2: sem legenda de pico', () => {
    expect(view(comCurva(curvaDe(t => (t < 0.05 ? 1.2 : 1 - t * 0.5)))).curva!.legenda.pico).toBeNull()
  })
})

describe('o modelo: os outros quatro estados', () => {
  it('sem-curva: o texto com a data da ÚLTIMA RESPOSTA', () => {
    const v = view(retencao({ ultimaResposta: { dia: D(3), resultado: 'sem_dado_na_janela' }, ultimaTentativa: { dia: D(3), resultado: 'sem_dado_na_janela' } }))
    expect(v.estado).toBe('sem-curva')
    expect(v.frase).toBe('O YouTube não devolveu curva para este vídeo (poucas views). Tentamos de novo quando o vídeo ganhar views. Última resposta: ' + dmDia(D(3)) + '.')
    expect(v.curva).toBeNull()
  })
  it('sem-curva com um erro MAIS NOVO que a resposta vazia: continua sem-curva, com a data da resposta (não cai em "Ainda não coletamos")', () => {
    const v = view(retencao({ ultimaResposta: { dia: D(5), resultado: 'sem_dado_na_janela' }, ultimaTentativa: { dia: D(1), resultado: 'erro_http' } }))
    expect(v.estado).toBe('sem-curva')
    expect(v.frase).toContain('Última resposta: ' + dmDia(D(5)) + '.')
    expect(v.frase).not.toContain(dmDia(D(1)))
  })
  it('nao-coletada: o texto de hoje, palavra por palavra (nenhuma resposta nunca)', () => {
    for (const r of [retencao(), retencao({ ultimaTentativa: { dia: D(1), resultado: 'erro_http' } }), undefined, null]) {
      const v = view(r)
      expect(v.estado).toBe('nao-coletada')
      expect(v.frase).toBe(NAO_COLETADA)
    }
  })
  it('tabela da curva ausente (migration não aplicada): "ainda não coletamos"', () => {
    expect(view(retencao({ tabelaAusente: true })).estado).toBe('nao-coletada')
  })
  it('curva ilegível na janela da vida: ERRO de leitura, nunca "ainda não coletamos", mesmo com a última resposta `ok`', () => {
    const v = view(retencao({ janelasIlegiveis: ['vida'], descartados: 1, ultimaResposta: { dia: D(1), resultado: 'ok' } }))
    expect(v.estado).toBe('erro')
    expect(v.frase).toBe('A leitura da curva falhou agora; recarregue a página.')
  })
  it('a última resposta foi `ok` mas não há curva nem curva ilegível: é incoerência do banco, e a tela diz que a leitura falhou', () => {
    expect(view(retencao({ ultimaResposta: { dia: D(1), resultado: 'ok' } })).estado).toBe('erro')
  })
  it('ilegível só nas janelas de 7 e 30 dias não derruba a vida (a tela só mostra a vida)', () => {
    expect(view(retencao({ janelasIlegiveis: ['primeiros_7_dias'], curvas: { vida: lida(curvaDe(cruzaEm35)) } })).estado).toBe('coletada')
  })
  it('erro da leitura da retenção: a frase do erro', () => {
    const v = view({ acesso: 'erro' })
    expect(v.estado).toBe('erro')
    expect(v.frase).toBe('A leitura da curva falhou agora; recarregue a página.')
  })
  it('negado: a frase de acesso, nenhuma data e nenhum número', () => {
    const v = view({ acesso: 'negado' })
    expect(v.estado).toBe('negado')
    expect(v.frase).toBe('Só quem edita o site vê a curva de retenção deste vídeo.')
    // o método do ⓘ fala de "100%"; o que não pode ter número é tudo o mais
    expect(JSON.stringify({ ...v, metodo: [] })).not.toMatch(/\d/)
    expect(v.curva).toBeNull()
    expect(v.aviso).toBeNull()
  })
  it('curva com pontos que o modelo recusa (fora de ordem): erro de leitura, nunca um desenho', () => {
    const ruim: Ponto[] = [{ t: 0.5, ratio: 1, relative: null }, { t: 0.2, ratio: 0.9, relative: null }]
    expect(view(comCurva(ruim)).estado).toBe('erro')
  })
})

describe('a seção na página do vídeo', () => {
  it('a ordem não muda: Retenção continua entre "Quanto do vídeo as pessoas assistem" e "Este vídeo no canal"', () => {
    const { container } = montar(comCurva(curvaDe(cruzaEm35)))
    const titulos = [...container.querySelectorAll('section')].map(s => s.querySelector('h2, h3')!.textContent!.replace(/ⓘ.*$/, '').trim())
    expect(titulos.indexOf('Retenção')).toBe(titulos.indexOf('Quanto do vídeo as pessoas assistem') + 1)
    expect(titulos.indexOf('Este vídeo no canal')).toBe(titulos.indexOf('Retenção') + 1)
  })
  it('coletada: a frase em negrito no número, o gráfico com role=img e a frase no aria-label, a lista e o aviso', () => {
    const { container } = montar(comCurva(curvaDe(cruzaEm35)))
    const s = secao(container)
    expect(texto(s.querySelector('.vb-fr'))).toBe('Metade das pessoas já saiu aos 3:30 (35% do vídeo).') // o vídeo da fixture tem 600 s
    expect(s.querySelector('.vb-fr b')!.textContent).toBe('3:30')
    const img = s.querySelector('svg[role="img"]')!
    expect(img.getAttribute('aria-label')).toContain('Metade das pessoas já saiu aos 3:30')
    expect(texto(s)).toContain('Curva da vida inteira do vídeo, coletada em')
    expect(s.querySelector('button[aria-label="De onde vem a curva"]')).not.toBeNull()
  })
  it('coletada: o gráfico tem a linha da metade, o rótulo "metade já saiu aqui", a grade em 0, 50 e 100% e o eixo do tempo em cinco marcas', () => {
    const { container } = montar(comCurva(curvaDe(cruzaEm35)))
    const svg = secao(container).querySelector('svg[role="img"]')!
    expect(svg.querySelector('.rc-meio')).not.toBeNull()
    expect(texto(svg)).toContain('metade já saiu aqui')
    expect([...svg.querySelectorAll('.rc-gy')].map(x => x.textContent)).toEqual(['0%', '50%', '100%'])
    expect([...svg.querySelectorAll('.rc-gx')].map(x => x.textContent)).toEqual(['0:00', '2:30', '5:00', '7:30', '10:00'])
  })
  it('coletada: um triângulo por maior saída e uma faixa por trecho revisto, e a legenda só diz o que existe', () => {
    const f = (t: number): number => (t < 0.2 ? 1 - t : t < 0.3 ? 0.8 - (t - 0.2) * 3 : t < 0.6 ? 0.5 - (t - 0.3) * 0.1 : t < 0.7 ? 0.47 + (t - 0.6) * 1 : 0.57 - (t - 0.7) * 0.2)
    const v = view(comCurva(curvaDe(f)), 600)
    const { container } = montar(comCurva(curvaDe(f)))
    const svg = secao(container).querySelector('svg[role="img"]')!
    expect(svg.querySelectorAll('.rc-saida')).toHaveLength(v.curva!.saidas.length)
    expect(svg.querySelectorAll('.rc-revisto')).toHaveLength(v.curva!.revistos.length)
    expect(v.curva!.saidas.length).toBeGreaterThan(0)
    const leg = texto(secao(container).querySelector('.rc-leg'))
    expect(leg).toContain('parte do público que ainda assiste')
    expect(leg).toContain('maior saída')
    expect(leg).toContain('trecho revisto (muita gente voltou)')
    // uma curva sem saída nem revisto não fala deles na legenda
    const c2 = montar(comCurva(curvaDe(plana))).container
    const leg2 = texto([...c2.querySelectorAll('.rc-leg')].at(-1))
    expect(leg2).not.toContain('maior saída')
    expect(leg2).not.toContain('revisto')
  })
  it('o caminho da linha nunca sai da área do gráfico, mesmo com ratio 1,3 (cortado em 120%)', () => {
    const { container } = montar(comCurva(curvaDe(t => (t < 0.05 ? 1.3 : 1 - t * 0.5))))
    const d = container.querySelector('.rc-linha')!.getAttribute('d')!
    const ys = [...d.matchAll(/[ML]\s*[\d.]+\s+(-?[\d.]+)/g)].map(m => Number(m[1]))
    // a grade vem em 0%, 50% e 100%; o teto do desenho é a linha de 120%, que fica acima da de 100% na mesma escala
    const [y0, , y100] = [...container.querySelectorAll('.rc-grade')].map(x => Number(x.getAttribute('y1')))
    const teto = y0! - 1.2 * (y0! - y100!)
    expect(ys.length).toBeGreaterThan(50)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(teto - 0.01)
    expect(Math.min(...ys)).toBeLessThan(y100!) // o pico de 130% passa da linha de 100% e para no teto
  })
  it('curva incompleta: o gráfico existe só com os pontos que existem (termina em t = 0,37, não vai até o fim) e não há linha de metade', () => {
    const { container } = montar(comCurva(curvaDe(nuncaCruza, 37)))
    const s = secao(container)
    expect(s.querySelector('.rc-meio')).toBeNull()
    expect(texto(s)).toMatch(/não dá para dizer/i)
    expect(texto(s)).toContain('Curva com 37 pontos.')
    expect(texto(s)).not.toMatch(/Maiores saídas|Trechos revistos|ficou até o fim/)
    const svg = s.querySelector('svg[role="img"]')!
    const ds = svg.querySelector('.rc-linha')!.getAttribute('d')!
    const xs = [...ds.matchAll(/[ML]\s*([\d.]+)\s/g)].map(m => Number(m[1]))
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
    const largura = Number(svg.getAttribute('width'))
    expect(x1).toBeLessThan(x0 + (largura - x0) * 0.5) // 37% do eixo, bem antes do meio
  })
  it('nenhuma curva é desenhada sem pontos: os quatro estados sem curva não têm gráfico', () => {
    const casos: Array<[string, Privado<RetencaoDoVideo> | undefined]> = [
      ['nao-coletada', undefined],
      ['sem-curva', retencao({ ultimaResposta: { dia: D(2), resultado: 'sem_dado_na_janela' } })],
      ['erro', { acesso: 'erro' }],
      ['negado', { acesso: 'negado' }],
    ]
    for (const [nome, r] of casos) {
      const { container } = montar(r)
      const s = secao(container)
      expect(svgsDaCurva(s), nome).toHaveLength(0)
      expect(s.querySelector('svg[role="img"]'), nome).toBeNull()
      expect(s.querySelector('.rc-leg'), nome).toBeNull()
      cleanup()
    }
  })
  it('nao-coletada: o texto de hoje na pastilha (como era antes desta tarefa)', () => {
    const { container } = montar(undefined)
    const s = secao(container)
    expect(texto(s.querySelector('.vb-nml'))).toBe('não medido' + NAO_COLETADA)
    expect(s.querySelector('b')!.textContent).toBe('Ainda não coletamos esta curva.')
  })
  it('sem-curva: pastilha, a frase em duas partes e a data da última resposta', () => {
    const { container } = montar(retencao({ ultimaResposta: { dia: D(4), resultado: 'sem_dado_na_janela' } }))
    const s = secao(container)
    expect(s.querySelector('b')!.textContent).toBe('O YouTube não devolveu curva para este vídeo (poucas views).')
    expect(texto(s.querySelector('.vb-nml'))).toContain('Tentamos de novo quando o vídeo ganhar views. Última resposta: ' + dmDia(D(4)) + '.')
  })
  it('erro só na retenção: as outras seções aparecem normalmente e a retenção diz que a leitura falhou', () => {
    const { container } = montar({ acesso: 'erro' })
    const titulos = [...container.querySelectorAll('section')].map(s => s.querySelector('h2, h3')!.textContent!.replace(/ⓘ.*$/, '').trim())
    expect(titulos).toEqual(expect.arrayContaining(['Views por dia', 'Impressões e cliques', 'Quanto do vídeo as pessoas assistem', 'Este vídeo no canal']))
    expect(texto(secao(container))).toContain('A leitura da curva falhou agora; recarregue a página.')
    // frase de uma frase só: vai inteira em negrito, sem ponto duplicado
    expect(secao(container).querySelector('b')!.textContent).toBe('A leitura da curva falhou agora; recarregue a página.')
    expect(texto(secao(container))).not.toContain('..')
  })
  it('negado (página inteira sem acesso): a seção continua, com o ⓘ e a frase de acesso; nenhum número, nenhuma data, nenhum SVG de curva', () => {
    const { container } = montar(undefined, { acesso: 'negado' })
    const s = secao(container)
    expect(s).toBeDefined()
    expect(texto(s)).toContain('Só quem edita o site vê a curva de retenção deste vídeo.')
    expect(s.querySelector('button[aria-label="De onde vem a curva"]')).not.toBeNull()
    expect(svgsDaCurva(s)).toHaveLength(0)
    expect(texto(s).replace('De onde vem a curva', '')).not.toMatch(/\d/)
    expect(texto(s)).not.toContain('Ainda não coletamos')
  })
  it('a pessoa que só lê o site NUNCA recebe a curva no que desce ao cliente (o modelo de negado não carrega pontos)', () => {
    const v = buildVideoBlocos({ obs: W.obs, videoId: W.foco.id, dados: { acesso: 'negado' }, hoje: W.hoje, dm: dmDia })
    expect(v.retencao.curva).toBeNull()
    expect(v.retencao.aviso).toBeNull()
    expect(JSON.stringify({ ...v.retencao, metodo: [] })).not.toMatch(/\d|pontos/)
    expect(v.retencao.estado).toBe('negado')
  })
  it('o método do ⓘ fica como estava e fala da vida inteira × os últimos dias', () => {
    expect(METODO_RETENCAO.join(' ')).toContain('a curva é da vida inteira do vídeo; o % assistido da seção anterior é dos últimos dias')
    expect(METODO_RETENCAO.join(' ')).toContain('Acima de 100%: trecho que muita gente voltou para rever.')
  })
  it('sem cor de direção e sem estilo inline de cor: a cor da curva vem de token', () => {
    const { container } = montar(comCurva(curvaDe(cruzaEm35)))
    const html = secao(container).innerHTML
    expect(html).not.toMatch(/color-mix/)
    expect(html).not.toMatch(/vb-dir-/)
  })
})
