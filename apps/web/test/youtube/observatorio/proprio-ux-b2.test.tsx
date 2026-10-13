// @vitest-environment jsdom
/**
 * Onda de consertos de UX da A4 (revisão de 12/10), B2 e V1: o MESMO estado tem UM nome e UMA forma.
 *  - dia com relatório MEDIDO em que o vídeo não aparece = ZERO MEDIDO (caixa vazada com "0", como no gráfico);
 *  - só o dia SEM relatório é "não medido" (hachura);
 *  - régua, cartões e tabela não põem mais hachura/"não medido" junto de "sem impressão".
 * Este sistema falha em VERDE: cada caso afirma o valor E a frase, e o "o que acontece quando o dado não existe" (nada lido, negado, erro).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { proprioWorld, alcanceNadaLido, type CenarioDados } from './proprio-fixture'
import { mountProprio, cartoes, norm } from './proprio-mount'
import { buildProprioVideos } from '@/app/cms/(authed)/youtube/competitors/_proprio/videos-model'
import { buildReguas, type EntradaReguas } from '@/app/cms/(authed)/youtube/competitors/_proprio/reguas-model'
import { Reguas } from '@/app/cms/(authed)/youtube/competitors/_proprio/reguas'
import { buildImpressoes } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'
import type { DiaAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import { addDays } from '@/lib/youtube/coleta/day-pt'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/x',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

/* ---------------------------------------------------------------- a régua do vídeo */

const videos = Array.from({ length: 6 }, (_, k) => ({ id: 'v' + k, ytId: 'y' + k, titulo: `Vídeo ${k}`, views: (k + 1) * 100, likes: k + 1, comments: k + 1, dur: 600 + k * 60 }))
const imp = (...xs: Array<[string, number]>) => new Map(xs.map(([y, n]) => [y, { imp: n, cliques: 0, diasComImpressao: 1 }] as const))
const entrada = (o: Partial<EntradaReguas> & { videoId: string }): EntradaReguas => ({
  videos, porVideo: imp(['y1', 9], ['y2', 2], ['y3', 7], ['y4', 5], ['y5', 1]), alcanceLido: true, periodoTexto: 'de 23/09 a 21/10', hrefs: { vistos: '/v', imp: '/i' },
  dias: { medidos: 19, semRelatorio: 10 }, ...o,
})
const impLinha = (e: EntradaReguas) => buildReguas(e).linhas.find(l => l.numero === 'impressoes')!

describe('B2 régua: vídeo ausente de relatório medido é ZERO MEDIDO', () => {
  it('valor "0" (zero medido), com a frase dos dias medidos e dos dias sem relatório, e a base dos vídeos com impressão', () => {
    const l = impLinha(entrada({ videoId: 'v0' }))
    expect(l.valor).toBe('0')
    expect(l.zeroMedido).toBe(true)
    expect(l.pos).toBeNull()
    expect(l.semRegua).toBe('Nenhuma impressão nos 19 dias medidos (10 dias sem dado). Os 5 vídeos com impressão ficam acima dele.')
    // os outros vídeos que também não aparecem são zero, não "sem medida"
    expect(l.semMedida).toBe('1 sem impressão no período')
  })
  it('sem dia sem relatório: sem parêntese; um dia só: singular', () => {
    expect(impLinha(entrada({ videoId: 'v0', dias: { medidos: 29, semRelatorio: 0 } })).semRegua).toBe('Nenhuma impressão nos 29 dias medidos. Os 5 vídeos com impressão ficam acima dele.')
    expect(impLinha(entrada({ videoId: 'v0', dias: { medidos: 1, semRelatorio: 1 } })).semRegua).toBe('Nenhuma impressão em 1 dia medido (1 dia sem dado). Os 5 vídeos com impressão ficam acima dele.')
  })
  it('nenhum vídeo com impressão: a frase não inventa "abaixo dos 0 vídeos"', () => {
    const l = impLinha(entrada({ videoId: 'v0', porVideo: new Map() }))
    expect(l).toMatchObject({ valor: '0', zeroMedido: true, semRegua: 'Nenhuma impressão nos 19 dias medidos (10 dias sem dado).' })
  })
  it('nada lido (relatórios existem, nenhum foi medido): NÃO é zero. valor nulo, sem zeroMedido, e a frase diz que falta medir', () => {
    const l = impLinha(entrada({ videoId: 'v0', porVideo: new Map(), dias: { medidos: 0, semRelatorio: 3 } }))
    expect(l).toMatchObject({ valor: null, zeroMedido: false, semRegua: 'ainda não há dia de alcance medido' })
  })
  it('alcance não lido (negado, erro, sem relatório): nulo, sem zeroMedido, e a frase é a do motivo', () => {
    const l = impLinha(entrada({ videoId: 'v0', alcanceLido: false, porVideo: new Map(), periodoTexto: null, dias: { medidos: 0, semRelatorio: 0 }, motivoImpressoes: 'só quem edita o site vê as impressões' }))
    expect(l).toMatchObject({ valor: null, zeroMedido: false, semRegua: 'só quem edita o site vê as impressões', semMedida: null })
  })
  it('vídeo COM impressão: não é zero e a posição diz a base ("5º de 5 com impressão")', () => {
    const l = impLinha(entrada({ videoId: 'v5' }))
    expect(l.zeroMedido).toBe(false)
    expect(l.valor).toBe('1')
    expect(l.posTexto).toBe('5º de 5 com impressão')
  })
  it('outras linhas sem dado seguem "não medido" (valor nulo, sem zeroMedido): o conserto é só das impressões', () => {
    const r = buildReguas(entrada({ videoId: 'v0', videos: videos.map((v, k) => (k === 0 ? { ...v, comments: null } : v)) }))
    expect(r.linhas.find(l => l.numero === 'comentarios')).toMatchObject({ valor: null, zeroMedido: false })
  })
  it('a frase de topo continua "Sem impressão no período." quando é zero medido, e não fala de impressão quando nada foi lido', () => {
    expect(buildReguas(entrada({ videoId: 'v0' })).frase.startsWith('Sem impressão no período.')).toBe(true)
    const nada = buildReguas(entrada({ videoId: 'v0', porVideo: new Map(), dias: { medidos: 0, semRelatorio: 3 } })).frase
    expect(nada).not.toMatch(/impress/i)
  })
})

describe('V1 régua: "o menor" só entre os vídeos COM impressão', () => {
  it('5º de 5 com 53 vídeos sem medida: a frase diz entre quantos, nunca "o menor do canal em impressões"', () => {
    const muitos = [...videos, ...Array.from({ length: 53 }, (_, k) => ({ id: 'w' + k, ytId: 'w' + k, titulo: 'W' + k, views: null, likes: null, comments: null, dur: null }))]
    const r = buildReguas(entrada({ videoId: 'v5', videos: muitos }))
    expect(r.frase).toContain('▼ O que menos teve impressões entre os 5 vídeos com impressão.')
    expect(r.frase).not.toContain('O menor do canal em impressões')
    expect(r.linhas[0]!.posTexto).toBe('5º de 5 com impressão')
  })
  it('o último em OUTRO número continua "O menor do canal" (a base lá é o canal todo)', () => {
    const r = buildReguas(entrada({ videoId: 'v0' }))
    expect(r.frase).toMatch(/▼ O menor do canal em [a-zç, ]*views/)
  })
})

describe('B2 régua na tela: zero medido é caixa vazada, não pastilha hachurada', () => {
  it('a célula do valor tem a caixa .obs-ch-zero com "0" e NENHUM .obs-ch-nm; a linha sem dado de verdade mantém a hachura', () => {
    const v = buildReguas(entrada({ videoId: 'v0', videos: videos.map((x, k) => (k === 0 ? { ...x, comments: null } : x)) }))
    const { container } = render(<Reguas view={v} />)
    const celula = container.querySelector('tr[data-numero="impressoes"] td.vb-rg-v')!
    expect(celula.querySelector('.obs-ch-zero')!.textContent).toMatch(/^0/)
    expect(celula.querySelector('.obs-ch-nm')).toBeNull()
    expect(norm(container.querySelector('tr[data-numero="impressoes"] .vb-rg-sem')!.textContent)).toContain('Nenhuma impressão nos 19 dias medidos (10 dias sem dado).')
    expect(container.querySelector('tr[data-numero="comentarios"] td.vb-rg-v .obs-ch-nm')!.textContent).toBe('não medido')
  })
  it('nada lido: a célula mantém a hachura "não medido" (não há zero a mostrar)', () => {
    const v = buildReguas(entrada({ videoId: 'v0', porVideo: new Map(), dias: { medidos: 0, semRelatorio: 3 } }))
    const { container } = render(<Reguas view={v} />)
    const celula = container.querySelector('tr[data-numero="impressoes"] td.vb-rg-v')!
    expect(celula.querySelector('.obs-ch-nm')!.textContent).toBe('não medido')
    expect(celula.querySelector('.obs-ch-zero')).toBeNull()
  })
})

/* ---------------------------------------------------------------- a frase do gráfico (V3) */

describe('V3 e B2 frase do gráfico: um nome para o mesmo dia, sem repetir', () => {
  const O = { escopo: 'video' as const, alturaArea: 180, dm: (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7), acesso: 'ok' as const, hoje: '2026-10-03' }
  const dia = (d: string, imp: number | null): DiaAlcance => ({ dia: d, situacao: imp == null ? 'nao-medido' : imp > 0 ? 'com-impressoes' : 'zero-medido', motivo: imp == null ? 'sem-relatorio' : null, imp, cliques: imp == null ? null : 0 })
  const per = { de: '2026-09-24', ate: '2026-10-01', dias: 8 }

  it('nenhuma impressão nos dias medidos: só a contagem dos dias, sem "0 dias com impressão e N medidos em zero"', () => {
    const dias = [dia('2026-09-24', 0), dia('2026-09-25', 0), dia('2026-09-26', null)]
    expect(buildImpressoes(dias, per, O).resumo).toBe('Nenhuma impressão nos 2 dias medidos (1 dia sem dado).')
    expect(buildImpressoes([dia('2026-09-24', 0), dia('2026-09-25', null)], per, O).resumo).toBe('Nenhuma impressão em 1 dia medido (1 dia sem dado).')
    expect(buildImpressoes([dia('2026-09-24', 0), dia('2026-09-25', 0)], per, O).resumo).toBe('Nenhuma impressão em 2 dias.')
  })
  it('com impressão e com buracos: "dias medidos", "outros N sem relatório" e "N sem impressão"', () => {
    const dias = [dia('2026-09-24', 18), ...[25, 26, 27, 28, 29].map(n => dia('2026-09-' + n, 0)), ...[30].map(() => dia('2026-09-30', null))]
    const r = buildImpressoes(dias, per, O).resumo!
    expect(r).toBe('18 impressões e nenhum clique estimado em 6 dias medidos (outro dia sem dado): 1 dia com impressão e 5 sem impressão.')
    expect(r).not.toMatch(/relatório lido|medidos em zero/)
  })
  it('vários buracos: "(outros 10 sem dado)"', () => {
    const dias = [dia('2026-09-24', 18), ...Array.from({ length: 10 }, (_, k) => dia(`2026-10-${String(k + 1).padStart(2, '0')}`, null))]
    expect(buildImpressoes(dias, { de: '2026-09-24', ate: '2026-10-10', dias: 17 }, O).resumo).toBe('18 impressões e nenhum clique estimado em 1 dia medido (outros 10 sem dado): 1 dia com impressão.')
  })
  it('todos os dias medidos têm impressão: "impressão em todos"', () => {
    expect(buildImpressoes([dia('2026-09-24', 3), dia('2026-09-25', 4)], per, O).resumo).toBe('7 impressões e nenhum clique estimado em 2 dias medidos: impressão em todos.')
  })
  it('views (C3): a contagem zerada não é recitada', () => {
    const v = { ...O, escopo: 'canal' as const, unidade: 'views' as const }
    expect(buildImpressoes([dia('2026-09-24', 5), dia('2026-09-25', 4)], per, v).resumo).toBe('9 views em 2 dias: todos com view.')
    expect(buildImpressoes([dia('2026-09-24', 5), dia('2026-09-25', 0)], per, v).resumo).toBe('5 views em 2 dias: 1 dia com view e 1 sem view.')
  })
  it('legendas do gráfico sem jargão (S2): o que o YouTube enviou e o que não entregou', () => {
    const l = (escopo: 'canal' | 'video') => buildImpressoes([dia('2026-09-24', 0)], per, { ...O, escopo }).legenda.map(x => x.texto)
    expect(l('canal')).toContain('zero medido (caixa vazada): o YouTube enviou o dia sem impressões')
    expect(l('canal')).toContain('não medido (hachura): o dia ainda não chegou')
    expect(l('video')).toContain('zero medido (caixa vazada): o YouTube enviou o dia sem impressões deste vídeo')
    expect(l('video')).toContain('não medido (hachura): o dia ainda não chegou')
  })
})

/* ---------------------------------------------------------------- os cartões e a tabela da lista */

const mundo = (c: CenarioDados) => proprioWorld({ cenario: c })

describe('B2 modelo dos vídeos: sem impressão em dia medido é zero medido, nunca hachura', () => {
  it('cheio: o vídeo que não aparece no relatório tem semImpressao, nenhuma palavra de motivo e a nota dos dias medidos', () => {
    const w = mundo('cheio')
    const m = buildProprioVideos(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm })!
    // um vídeo já publicado no primeiro dia do período (hoje-21): o mais novo (1 dia de vida) não tem dia que valha e NÃO é zero medido (ver proprio-zero-medido.test.ts)
    const sem = m.videos.find(v => v.imp == null && v.pub != null && v.pub <= w.obs.NOW - 23 * 86_400_000)!
    expect(sem).toMatchObject({ semImpressao: true, impText: null, impMissing: null, cliquesText: null, cliquesMissing: null, terceira: 'sem impressão no período' })
    expect(sem.notas).toContain('Impressões: nenhuma nos 19 dias medidos (2 dias sem dado), de ' + w.dm(addDays(w.hoje, -21)) + ' a ' + w.dm(addDays(w.hoje, -1)) + '.')
    const com = m.videos.find(v => v.imp != null)!
    expect(com.semImpressao).toBe(false)
  })
  it.each([
    ['negado', 'só quem edita vê'], ['erro', 'leitura falhou'],
  ] as const)('%s: ninguém é zero (semImpressao falso) e a palavra do motivo fica em todos', (c, palavra) => {
    const w = mundo(c)
    const m = buildProprioVideos(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm })!
    expect(m.videos.every(v => !v.semImpressao && v.impText == null && v.impMissing === palavra)).toBe(true)
  })
  it('nada lido: não é zero (semImpressao falso) e a palavra é "ainda não lido"', () => {
    const w = proprioWorld()
    const dados = { ...w.dados, alcance: { acesso: 'ok' as const, dado: alcanceNadaLido(w.canalId, w.hoje) } }
    const m = buildProprioVideos(w.obs, w.canalId, dados, { hoje: w.hoje, dm: w.dm })!
    expect(m.videos.every(v => !v.semImpressao && v.impMissing === 'ainda não lido')).toBe(true)
  })
})

describe('B2 cartões e lista: zero medido na caixa vazada, "não medido" só sem dia medido', () => {
  it('cartão do vídeo sem impressão: a coluna do meio é "0 impressões" com a caixa vazada, sem hachura; a terceira linha diz "sem impressão no período"', () => {
    const { all } = mountProprio()
    const sem = all.find(v => v.semImpressao)!
    const c = cartoes().find(x => x.dataset.id === sem.id)!
    const cols = [...c.querySelectorAll('.cv-nums3 > .cv-c')]
    const meio = cols[1]!
    expect(meio.querySelector('.obs-ch-zero')!.textContent).toMatch(/^0/)
    expect(norm(meio.textContent)).toMatch(/^0.*impressões$/)
    expect(meio.querySelector('.obs-ch-nm')).toBeNull()
    expect(norm(c.querySelector('p.cv-n3')!.textContent)).toBe('sem impressão no período')
    // nenhuma pastilha "sem impressão" em lugar nenhum do cartão
    expect(c.textContent).not.toMatch(/não medidosem impressão|sem impressãoimpress/)
    expect([...c.querySelectorAll('.obs-ch-nm')].some(n => /sem impressão/.test(n.textContent ?? ''))).toBe(false)
  })
  it('lista: impressões e cliques do vídeo sem impressão são a caixa vazada "0"; vídeo com número mostra o número', () => {
    const { all } = mountProprio({ sp: { ver: 'lista' } })
    const sem = all.find(v => v.semImpressao)!
    const tr = document.querySelector(`tr.cv-row[data-id="${sem.id}"]`)!
    for (const rot of ['Impressões', 'Cliques']) {
      const td = tr.querySelector(`td[data-label="${rot}"]`)!
      expect(td.querySelector('.obs-ch-zero')!.textContent, rot).toMatch(/^0/)
      expect(td.querySelector('.obs-ch-nm'), rot).toBeNull()
    }
  })
  it('sem leitura do alcance (negado): a hachura com a palavra do motivo continua nos cartões e na lista', () => {
    mountProprio({ world: mundo('negado') })
    for (const c of cartoes()) {
      expect(c.querySelector('.cv-nums3 > .cv-c:nth-child(2) .obs-ch-nm')!.textContent).toBe('só quem edita vê')
      expect(c.querySelector('.obs-ch-zero')).toBeNull()
    }
  })
})
