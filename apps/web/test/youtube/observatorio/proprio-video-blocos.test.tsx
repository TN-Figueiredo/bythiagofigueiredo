// @vitest-environment jsdom
// A4 13.4: os blocos da tela do VÍDEO próprio renderizados (jsdom): views por dia, impressões e cliques, taxa de clique, % assistido, retenção, forja e "o que
// ainda não há". O modelo é o real (`buildVideoBlocos`, dado sintético com sentinelas); aqui se prova o que a PESSOA lê: formas, frases, ausência de cor de
// direção na taxa, nada de curva, nada de troca, o cartão da forja apagado.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { VideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos'
import { buildVideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { DadosDoVideo } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { mundoVideo, temSentinela, TEXTOS_PRIVADOS, type MundoVideo } from './proprio-video-fixture'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))

afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const umaFaixa = (ds: Dataset) => { for (const v of ds.videos) if (v.fmt === 'long') v.dur = 600 }
const dadoDe = (w: MundoVideo): DadosDoVideo => {
  const { alcance, diario } = w.dados
  if (alcance.acesso !== 'ok' || diario.acesso !== 'ok') throw new Error('a fixture esperava dado lido')
  return { alcance: alcance.dado, diario: diario.dado }
}
const ok = (w: MundoVideo, troca: Partial<DadosDoVideo> = {}): Privado<DadosDoVideo> => ({ acesso: 'ok', dado: { ...dadoDe(w), ...troca } })
const W = mundoVideo({ mut: umaFaixa })
const novoId = W.obs.videos.filter(v => v.ch === W.canalId).sort((a, b) => b.pub - a.pub)[0]!.id
const montar = (w: MundoVideo = W, dados: Privado<DadosDoVideo> = ok(w), id = w.foco.id) =>
  render(<div data-obs-screen="video-proprio"><VideoBlocos view={buildVideoBlocos({ obs: w.obs, videoId: id, dados, hoje: w.hoje, dm: dmDia })} /></div>)
const secao = (c: HTMLElement, h: string) => [...c.querySelectorAll('section')].find(s => s.querySelector('h2, h3')?.textContent?.startsWith(h))!
const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ')

describe('a ordem e os títulos', () => {
  it('Views por dia → Impressões e cliques → Quanto do vídeo as pessoas assistem → Retenção → Este vídeo no canal → forja → "O que ainda não há"', () => {
    const { container } = montar()
    expect([...container.querySelectorAll('section')].map(s => s.querySelector('h2, h3')!.textContent!.replace(/ⓘ.*$/, '').trim())).toEqual([
      'Views por dia', 'Impressões e cliques', 'Quanto do vídeo as pessoas assistem', 'Retenção', 'Este vídeo no canal', 'Leitura da forjaainda não disponível para o seu canal', 'O que ainda não há deste vídeo',
    ])
  })
})

describe('views por dia', () => {
  it('com dado: um gráfico (um só componente de gráfico), a frase de relance, e as legendas de views: zero medido e não medido têm formas diferentes', () => {
    const { container } = montar()
    const s = secao(container, 'Views por dia')
    expect(s.querySelectorAll('figure').length).toBe(1)
    expect(texto(s)).toContain('24.680 views em 20 dias medidos (1.234 por dia).')
    expect(texto(s)).toContain('zero medido (caixa vazada): ninguém viu neste dia')
    expect(texto(s)).toContain('não medido (hachura): o YouTube não entregou o dia')
    expect(s.querySelector('.ic-sw.zero')).not.toBeNull()
    expect(s.querySelector('.ic-sw.nm')).not.toBeNull()
    expect(texto(s)).not.toMatch(/cliques estimados do dia/)
  })

  it('vídeo novo e coleta que não rodou: frase própria com a pastilha, nenhum gráfico', () => {
    for (const [dados, id, frase] of [
      [ok(W), novoId, /^não medidoVídeo novo: o YouTube entrega as views/],
      [ok(W, { diario: { canalId: W.canalId, ultimoDia: null, linhas: [], descartados: 0 } }), W.foco.id, /^não medidoA coleta diária de views ainda não rodou/],
    ] as const) {
      const { container } = montar(W, dados, id)
      const s = secao(container, 'Views por dia')
      expect(s.querySelector('svg, figure')).toBeNull()
      expect(texto(s.querySelector('.vb-nml'))).toMatch(frase)
      expect(s.querySelector('.obs-ch-nm')!.textContent).toBe('não medido')
      cleanup()
    }
  })
})

describe('impressões, cliques e taxa de clique', () => {
  it('caso cheio: o gráfico de impressões, a frase-resumo, e a taxa com a faixa do canal por baixo da do vídeo e o veredito', () => {
    const { container } = montar()
    const s = secao(container, 'Impressões e cliques')
    expect(texto(s)).toContain('7.919 impressões e 1.584 cliques estimados em 19 dias')
    const taxa = s.querySelector('.vb-ctr')!
    expect(taxa.querySelector('h3')!.textContent).toContain('Taxa de clique deste vídeo')
    expect(texto(taxa.querySelector('.vb-fr'))).toMatch(/^20,0% das impressões viraram clique \(1\.584 de 7\.919\)\. A taxa real fica entre .* Fica acima da taxa do canal/)
    expect([...taxa.querySelectorAll('.tf-lab')].map(x => x.textContent)).toEqual(['O canal inteiro', 'Este vídeo'])
    expect(taxa.querySelector('[role="img"]')!.getAttribute('aria-label')).toMatch(/^Taxa de clique do vídeo 20,0%/)
  })

  it('caso magro (2 de 18): 3,1% a 32,8% e "faixa tracejada: ainda não conclui" (a faixa do vídeo cinza e tracejada)', () => {
    const w = mundoVideo({ mut: umaFaixa, alcance: { impFoco: 18, ctrFoco: 2 / 18 } })
    const { container } = montar(w)
    const taxa = secao(container, 'Impressões e cliques').querySelector('.vb-ctr')!
    expect(texto(taxa.querySelector('.vb-fr'))).toContain('A taxa real fica entre 3,1% e 32,8%. Pode ser igual à taxa do canal')
    expect(texto(taxa)).toContain('faixa tracejada: ainda não conclui')
    expect(taxa.querySelector('.tf-int.inc')).not.toBeNull()
    expect(secao(container, 'Impressões e cliques').textContent).toContain('É pouco para dizer se a capa funciona: leia como contagem.')
  })

  it('nenhuma frase diz que a capa é boa ou ruim; nenhuma classe de direção (verde/âmbar) no bloco da taxa', () => {
    for (const w of [W, mundoVideo({ mut: umaFaixa, alcance: { impFoco: 18, ctrFoco: 2 / 18 } })]) {
      const { container } = montar(w)
      const taxa = secao(container, 'Impressões e cliques')
      expect(texto(taxa)).not.toMatch(/capa (boa|ruim)|funciona bem|funciona mal/i)
      expect(taxa.innerHTML).not.toMatch(/vb-dir-|dir-up|dir-dn|dir-eq/)
      cleanup()
    }
  })

  it('sem impressões do vídeo o bloco da taxa não existe; com CTR nulo ele diz "não medido" e nunca 0%', () => {
    const a = montar(mundoVideo({ mut: umaFaixa, alcance: { impFoco: 0 } }))
    expect(a.container.querySelector('.vb-ctr')).toBeNull()
    cleanup()
    const b = montar(mundoVideo({ mut: umaFaixa, alcance: { impFoco: 500, ctrFoco: null } }))
    const s = secao(b.container, 'Impressões e cliques')
    expect(s.querySelector('.vb-ctr')).toBeNull()
    expect(texto(s)).toContain('Não dá para calcular a taxa de clique deste vídeo')
    expect(texto(s)).not.toMatch(/0,0%/)
  })

  it('sem relatório: a pastilha e a frase, nenhum gráfico', () => {
    const { container } = montar(W, ok(W, { alcance: { canalId: W.canalId, relatorios: [], linhas: [], ultimoRelatorio: null, descartados: 0 } }))
    const s = secao(container, 'Impressões e cliques')
    expect(s.querySelector('figure')).toBeNull()
    expect(texto(s)).toContain('Ainda não há relatório de alcance deste canal.')
  })
})

describe('% assistido', () => {
  it('com dado: a frase, a barra do tamanho do vídeo com a marca do normal e a leitura contra ele (com forma e palavra)', () => {
    const w = mundoVideo({ mut: umaFaixa, diario: { pctFoco: 77.7, pctOutros: 60 } })
    const { container } = montar(w)
    const s = secao(container, 'Quanto do vídeo as pessoas assistem')
    expect(texto(s.querySelector('.vb-fr'))).toBe('Quem assiste vê em média 78% do vídeo (07:46 de 10:00). Baseado em 24.680 views.')
    expect(s.querySelector('.vb-as-barra')!.getAttribute('role')).toBe('img')
    expect(s.querySelector('.vb-as-barra i')!.getAttribute('style')).toContain('width: 78%')
    expect(s.querySelector('.vb-as-barra s')!.getAttribute('style')).toContain('left: 60%')
    expect(s.querySelector('.vb-as-med')!.textContent).toContain('normal do canal: 60%')
    const contra = s.querySelector('.vb-dir-acima')!
    expect(texto(contra)).toBe('▲ Acima do normal do canal (60%): +18 pontos.')
  })

  it('"Perto do normal do canal" só até 2 pontos (símbolo ＝); 3 pontos já diz acima/abaixo (▲ ▼)', () => {
    const casos: Array<[number, RegExp, string]> = [[62, /^＝ Perto do normal do canal/, 'vb-dir-na-media'], [63, /^▲ Acima do normal do canal/, 'vb-dir-acima'], [57, /^▼ Abaixo do normal do canal/, 'vb-dir-abaixo']]
    for (const [pct, esperado, classe] of casos) {
      const { container } = montar(mundoVideo({ mut: umaFaixa, diario: { pctFoco: pct, pctOutros: 60 } }))
      const nota = secao(container, 'Quanto do vídeo as pessoas assistem').querySelector('.vb-nt')!
      expect(texto(nota), String(pct)).toMatch(esperado)
      expect(nota.classList.contains(classe), String(pct)).toBe(true)
      cleanup()
    }
  })

  it('abaixo de 10 views: valor cinza, barra tracejada, "São só N views…", sem a marca do normal e sem comparar', () => {
    const { container } = montar(mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 1, diasFoco: 4 } }))
    const s = secao(container, 'Quanto do vídeo as pessoas assistem')
    expect(s.querySelector('.vb-as-barra.pouco')).not.toBeNull()
    expect(s.querySelector('.vb-num-pouco')).not.toBeNull()
    expect(texto(s.querySelector('.vb-fr'))).toContain('São só 4 views: cada pessoa muda o resultado e não dá para comparar com o normal do canal.')
    expect(s.querySelector('.vb-as-barra s')).toBeNull()
    expect(s.querySelector('.vb-as-med')).toBeNull()
    expect(s.querySelector('[class*="vb-dir-"]')).toBeNull()
  })

  it('acima de 100% não estoura a barra, o número é o real e a frase diz que acontece quando muita gente revê trechos (nada de "13:56 de 10:00")', () => {
    const { container } = montar(mundoVideo({ mut: umaFaixa, diario: { pctFoco: 139.38 } }))
    const s = secao(container, 'Quanto do vídeo as pessoas assistem')
    expect(texto(s.querySelector('.vb-fr'))).toBe('Quem assiste vê em média 139% do vídeo (13:56 num vídeo de 10:00): acontece quando muita gente revê trechos. Baseado em 24.680 views.')
    expect(s.querySelector('.vb-as-barra i')!.getAttribute('style')).toContain('width: 100%')
  })

  it('o rótulo "normal do canal" perto das pontas ancora na ponta (classe e nenhum left); no meio fica sob a marca', () => {
    const rotulo = (pctOutros: number) => {
      const { container } = montar(mundoVideo({ mut: umaFaixa, diario: { pctOutros } }))
      const el = secao(container, 'Quanto do vídeo as pessoas assistem').querySelector<HTMLElement>('.vb-as-med span')!
      const r = { classe: el.className, left: el.style.left, texto: el.textContent }
      cleanup()
      return r
    }
    expect(rotulo(60)).toMatchObject({ classe: 'vb-as-med-meio', left: '60%', texto: 'normal do canal: 60%' })
    expect(rotulo(3)).toMatchObject({ classe: 'vb-as-med-inicio', left: '', texto: 'normal do canal: 3%' })
    expect(rotulo(97)).toMatchObject({ classe: 'vb-as-med-fim', left: '', texto: 'normal do canal: 97%' })
  })

  it('o botão ⓘ não mora dentro do título (o nome acessível do h2 é só o título)', () => {
    const { container } = montar()
    for (const h of container.querySelectorAll('h2, h3')) expect(h.querySelector('button'), h.textContent ?? '').toBeNull()
    expect(secao(container, 'Quanto do vídeo as pessoas assistem').querySelector('button[aria-label="De onde vem o % assistido"]')).not.toBeNull()
    expect(secao(container, 'Impressões e cliques').querySelector('button[aria-label="Como a taxa é calculada"]')).not.toBeNull()
    expect(container.querySelector('#vb-as-h')!.textContent).toBe('Quanto do vídeo as pessoas assistem')
  })

  it('sem views, vídeo novo e coleta que não rodou: pastilha e a frase de cada um, sem barra', () => {
    for (const [dados, id, frase] of [
      [undefined, W.foco.id, null],
      [ok(W), novoId, /Vídeo novo: o YouTube só entrega o % assistido/],
      [ok(W, { diario: { canalId: W.canalId, ultimoDia: null, linhas: [], descartados: 0 } }), W.foco.id, /A coleta diária ainda não rodou: sem ela não há % assistido/],
    ] as const) {
      const w = dados === undefined ? mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 0 } }) : W
      const { container } = montar(w, dados ?? ok(w), id)
      const s = secao(container, 'Quanto do vídeo as pessoas assistem')
      expect(s.querySelector('.vb-as-barra')).toBeNull()
      expect(s.querySelector('.obs-ch-nm')!.textContent).toBe('não medido')
      if (frase) expect(texto(s)).toMatch(frase)
      else expect(texto(s)).toMatch(/Nenhuma view nos 28 dias até \d\d\/\d\d: sem views não há % assistido\./)
      cleanup()
    }
  })
})

describe('retenção, forja e o que falta', () => {
  it('retenção: "Ainda não coletamos esta curva", pastilha, ⓘ; nenhum <svg> de curva e nenhum número', () => {
    const { container } = montar()
    const s = secao(container, 'Retenção')
    expect(texto(s.querySelector('.vb-nml'))).toBe('não medidoAinda não coletamos esta curva. Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam.')
    expect(s.querySelector('b')!.textContent).toBe('Ainda não coletamos esta curva.')
    expect([...s.querySelectorAll('svg')].filter(x => !x.closest('button'))).toHaveLength(0) // só o ícone do ⓘ; nenhuma curva
    expect(s.querySelector('button[aria-label="De onde vem a curva"]')).not.toBeNull()
    expect(texto(s.querySelector('.vb-nml')).replace('não medido', '')).not.toMatch(/\d/)
  })

  it('cartão da forja: ainda não disponível, botão com aria-disabled="true" (sem disabled), o porquê, sem etapas; não diz que a coleta diária ainda não está no ar', () => {
    const { container } = montar()
    const f = container.querySelector('.vb-forja')!
    expect(f.querySelector('h3')!.textContent).toBe('Leitura da forjaainda não disponível para o seu canal')
    const b = f.querySelector('button')!
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.hasAttribute('disabled')).toBe(false)
    expect(b.textContent).toBe('Pedir leitura deste vídeo à forja')
    expect(b.getAttribute('aria-describedby')).toBe(f.querySelector('.vb-forja-pq')!.id)
    expect(f.querySelector('.vb-forja-pq')!.textContent).toBe('A forja só recebe dados públicos de concorrente; a leitura de vídeo do seu canal ainda não existe.')
    expect(f.querySelector('ol, ul, li')).toBeNull()
    expect(f.textContent).not.toMatch(/coleta diária/)
  })

  it('"O que ainda não há deste vídeo": origem do tráfego e trocas de título e thumbnail; NÃO lista views por dia nem % assistido', () => {
    const { container } = montar()
    const t = texto(secao(container, 'O que ainda não há').querySelector('p'))
    expect(t).toMatch(/Origem do tráfego/)
    expect(t).toMatch(/trocas de título e thumbnail \(ainda não registradas; gráfico sem marca não quer dizer que não houve troca\)/)
    expect(t).not.toMatch(/views por dia|% assistido|retenção/i)
  })

  it('nada de troca: nenhum losango, triângulo nem "Trocas deste vídeo" e a palavra "troca" só no parágrafo "o que ainda não há"', () => {
    const { container } = montar()
    const ainda = secao(container, 'O que ainda não há')
    const resto = texto(container).replace(texto(ainda), '')
    expect(resto).not.toMatch(/troca|losango|triângulo|Trocas deste/i)
    expect(container.querySelector('.tr-mk, .tr-vazia, #trocas')).toBeNull()
  })

  it('alcanceNota saiu: nenhum [data-alcance-nota] em nenhum estado', () => {
    for (const dados of [ok(W), { acesso: 'negado' } as const, { acesso: 'erro' } as const]) {
      const { container } = montar(W, dados)
      expect(container.querySelector('[data-alcance-nota]')).toBeNull()
      cleanup()
    }
  })
})

describe('usuário só de leitura e leitura que falhou', () => {
  it('com acesso negado o HTML não tem nenhum dígito das sentinelas privadas, só a nota única, a retenção, as réguas públicas e a forja', () => {
    const { container } = montar(W, { acesso: 'negado' })
    for (const s of TEXTOS_PRIVADOS) expect(temSentinela(container.innerHTML, s), s).toBe(false)
    expect(container.querySelector('[data-privado-nota]')!.textContent).toMatch(/^Só quem edita o site vê as views por dia/)
    expect([...container.querySelectorAll('section')].map(s => s.querySelector('h2, h3')!.textContent!.replace(/ⓘ.*$/, '').trim())).toEqual([
      'Retenção', 'Este vídeo no canal', 'Leitura da forjaainda não disponível para o seu canal', 'O que ainda não há deste vídeo',
    ])
    expect(container.querySelector('.vb-ctr, .vb-as, figure')).toBeNull()
  })

  it('negado e erro: a nota única e a frase do diário vêm com a pastilha "não medido" (regra 5), e não só como texto solto', () => {
    for (const dados of [{ acesso: 'negado' } as const, { acesso: 'erro' } as const]) {
      const { container } = montar(W, dados)
      const nota = container.querySelector('[data-privado-nota]')!
      expect(nota.closest('.vb-nml')!.querySelector('.obs-ch-nm')!.textContent, dados.acesso).toBe('não medido')
      const canal = secao(container, 'Este vídeo no canal')
      expect(canal.querySelector(':scope > .vb-nml .obs-ch-nm')!.textContent, dados.acesso).toBe('não medido')
      cleanup()
    }
  })

  it('controle positivo: com acesso o mesmo componente mostra as sentinelas', () => {
    const { container } = montar()
    for (const s of TEXTOS_PRIVADOS) expect(temSentinela(container.innerHTML, s), s).toBe(true)
  })

  it('leitura que falhou: a nota diz que falhou (nunca uma tela vazia nem zero)', () => {
    const { container } = montar(W, { acesso: 'erro' })
    expect(container.querySelector('[data-privado-nota]')!.textContent).toBe('A leitura dos números deste vídeo falhou agora; recarregue a página.')
    expect(container.querySelector('figure, .vb-as')).toBeNull()
  })
})
