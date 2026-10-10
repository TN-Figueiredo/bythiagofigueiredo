import { describe, it, expect } from 'vitest'
import { montarLista, norm } from '@/app/cms/(authed)/youtube/competitors/_canal/lista'
import type { ChannelVideoView, Grupo } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'
import { CANAL_DEFAULT, LOTE, type CanalState } from '@/app/cms/(authed)/youtube/competitors/_canal/params'

const DIA = 864e5
const AGORA = Date.UTC(2026, 9, 10)
let seq = 0

/** Um vídeo válido; `over` muda o que o caso precisa. Por padrão: acompanhado, longo, publicado há `seq` dias. */
function vid(over: Partial<ChannelVideoView> = {}): ChannelVideoView {
  const i = ++seq
  return {
    id: 'v' + i, ytId: 'yt' + i, title: 'Vídeo ' + i, url: 'https://youtu.be/yt' + i, grupo: 'acompanhado',
    pub: AGORA - i * DIA, views: null, vpd7: null, mult: null,
    isShort: false, pinned: false, tracked: true, dur: 600, likes: null, comments: null, swaps: 0,
    thumbSrc: null, durText: null, ageText: null, pubISO: null, pubTitle: null,
    viewsText: null, viewsMissing: null, vpdText: null, multText: null, multTier: null, multWord: null,
    semMedida: null, likesText: null, commentsText: null, badges: [], notas: [], pin: null,
    ...over,
  }
}
const grupo = (g: Grupo, n: number, over: Partial<ChannelVideoView> = {}) => Array.from({ length: n }, () => vid({
  grupo: g, tracked: g === 'acompanhado', pinned: g === 'fixado-antigo' || !!over.pinned, ...(g === 'sem-data' ? { pub: null } : {}), ...over,
}))
/** Antigos: mais velhos que tudo, com pub decrescente na ordem de criação. */
const antigos = (n: number, over: Partial<ChannelVideoView> = {}) => Array.from({ length: n }, (_, k) => vid({ grupo: 'antigo', tracked: false, pub: AGORA - (500 + k) * DIA, ...over }))
const st = (over: Partial<CanalState> = {}): Pick<CanalState, 'fmt' | 'sort' | 'dir' | 'q' | 'n'> => ({ fmt: 'todos', sort: 'recentes', dir: 'desc', q: '', n: 0, ...CANAL_DEFAULT, ...over })
const ids = (l: ReturnType<typeof montarLista>) => l.secoes.flatMap(s => s.itens.map(v => v.id))
const rot = (l: ReturnType<typeof montarLista>) => l.secoes.map(s => (s.divisor ? `${s.divisor.label} (${s.divisor.count})` : null))

describe('lista do canal', () => {
  it('abre só com acompanhados, fixados e sem data; antigos só entram por n', () => {
    const all = [...grupo('acompanhado', 3), ...grupo('fixado-antigo', 1), ...antigos(90), ...grupo('sem-data', 2)]
    expect(montarLista(all, st({ n: 0 })).visiveis).toHaveLength(6)
    expect(montarLista(all, st({ n: 40 })).visiveis).toHaveLength(46)
    expect(montarLista(all, st({ n: 80 })).visiveis).toHaveLength(86)
    expect(montarLista(all, st({ n: 120 })).visiveis).toHaveLength(96)
  })
  it('"Longos + Shorts + formato não confirmado = Todos"', () => {
    const all = [...grupo('acompanhado', 4, { isShort: false }), ...grupo('acompanhado', 3, { isShort: true }), ...grupo('acompanhado', 2, { isShort: null }), ...antigos(5, { isShort: true })]
    const c = montarLista(all, st()).counts
    expect(c).toMatchObject({ todos: 14, longos: 4, shorts: 8, naoConfirmado: 2 })
    expect(c.longos + c.shorts + c.naoConfirmado).toBe(c.todos)
  })
  it('isShort nulo conta em Todos e fica fora de Longos e de Shorts', () => {
    const nulo = vid({ isShort: null, title: 'sem marca' })
    const all = [nulo, vid({ isShort: false }), vid({ isShort: true })]
    expect(montarLista(all, st({ fmt: 'longos' })).visiveis).not.toContain(nulo.id)
    expect(montarLista(all, st({ fmt: 'shorts' })).visiveis).not.toContain(nulo.id)
    expect(montarLista(all, st({ fmt: 'todos' })).visiveis).toContain(nulo.id)
  })
  it('fmt=fixados mostra só fixados, de qualquer grupo', () => {
    const a = vid({ pinned: true }), b = vid({ grupo: 'fixado-antigo', tracked: false, pinned: true }), c = vid({ grupo: 'sem-data', pub: null, pinned: true })
    const all = [a, b, c, vid(), vid(), ...antigos(3)]
    expect(new Set(montarLista(all, st({ fmt: 'fixados' })).visiveis)).toEqual(new Set([a.id, b.id, c.id]))
    expect(montarLista(all, st({ fmt: 'fixados' })).counts.fixados).toBe(3)
  })
  it('ordem das seções: acompanhados e fixados antigos, depois o divisor da ordenação, "Sem data de publicação (N)", "Mais antigos, sem contagem diária (N)"', () => {
    const com = [vid({ mult: 3 }), vid({ mult: 1 })], fix = vid({ grupo: 'fixado-antigo', tracked: false, pinned: true, mult: 2 })
    const sem = vid({ mult: null }), sd = grupo('sem-data', 2), old = antigos(4)
    const l = montarLista([...old, ...sd, sem, fix, ...com], st({ sort: 'multiplo', n: 40 }))
    expect(rot(l)).toEqual([null, 'Sem múltiplo ainda (1)', 'Sem data de publicação (2)', 'Mais antigos, sem contagem diária (4)'])
    expect(l.secoes[0]!.itens.map(v => v.mult)).toEqual([3, 2, 1])
  })
  it('antigos ficam sempre abaixo dos acompanhados, em qualquer ordenação', () => {
    const front = [vid({ views: 10, vpd7: 1, mult: 1 }), vid({ views: 5, vpd7: 9, mult: 9 })]
    const old = antigos(3, { views: 1_000_000, vpd7: null, mult: 50 })
    for (const sort of ['recentes', 'vistos', 'multiplo', 'vpd'] as const) for (const dir of ['asc', 'desc'] as const) {
      const out = ids(montarLista([...old, ...front], st({ sort, dir, n: 40 })))
      expect(out.slice(0, 2).sort()).toEqual(front.map(v => v.id).sort())
      expect(out.slice(2)).toEqual(old.map(v => v.id))
    }
  })
  it('ordenação "vistos": quem não tem views vai para "Sem contagem de views (N)"', () => {
    const a = vid({ views: 100 }), b = vid({ views: 900 }), c = vid({ views: null })
    const l = montarLista([a, c, b], st({ sort: 'vistos' }))
    expect(rot(l)).toEqual([null, 'Sem contagem de views (1)'])
    expect(l.secoes[0]!.itens.map(v => v.id)).toEqual([b.id, a.id]); expect(l.secoes[1]!.itens.map(v => v.id)).toEqual([c.id])
  })
  it('ordenação "multiplo" e "vpd": quem não tem o número vai para "Sem múltiplo ainda (N)" / "Sem views por dia ainda (N)"', () => {
    const a = vid({ mult: 2, vpd7: null }), b = vid({ mult: null, vpd7: 4 }), c = vid({ mult: 0, vpd7: 0 })
    expect(rot(montarLista([a, b, c], st({ sort: 'multiplo' })))).toEqual([null, 'Sem múltiplo ainda (1)'])
    const v = montarLista([a, b, c], st({ sort: 'vpd' }))
    expect(rot(v)).toEqual([null, 'Sem views por dia ainda (1)'])
    expect(v.secoes[0]!.itens.map(x => x.id)).toEqual([b.id, c.id]) // zero medido tem valor: fica na grade
    expect(v.secoes[1]!.itens.map(x => x.id)).toEqual([a.id])
  })
  it('ordenação sem nenhum valor: todos sob o divisor, grade nunca vazia', () => {
    const all = Array.from({ length: 5 }, () => vid({ mult: null }))
    const l = montarLista(all, st({ sort: 'multiplo' }))
    expect(l.secoes).toHaveLength(1)
    expect(l.secoes[0]!.divisor).toMatchObject({ label: 'Sem múltiplo ainda', count: 5 }); expect(l.secoes[0]!.itens).toHaveLength(5)
    expect(l.vazio).toBeNull()
  })
  it('dir=asc inverte só quem tem valor; os divisores ficam no fim', () => {
    const a = vid({ views: 1 }), b = vid({ views: 2 }), c = vid({ views: 3 }), n = vid({ views: null }), sd = vid({ grupo: 'sem-data', pub: null })
    const l = montarLista([n, c, sd, a, b], st({ sort: 'vistos', dir: 'asc' }))
    expect(ids(l)).toEqual([a.id, b.id, c.id, n.id, sd.id])
    expect(rot(l)).toEqual([null, 'Sem contagem de views (1)', 'Sem data de publicação (1)'])
  })
  it('empate mantém a ordem por data, mais recente primeiro (ordenação estável)', () => {
    const novo = vid({ views: 7, pub: AGORA - 1 * DIA }), meio = vid({ views: 7, pub: AGORA - 5 * DIA }), velho = vid({ views: 7, pub: AGORA - 9 * DIA }), topo = vid({ views: 70 })
    expect(ids(montarLista([velho, novo, topo, meio], st({ sort: 'vistos' })))).toEqual([topo.id, novo.id, meio.id, velho.id])
    expect(ids(montarLista([velho, novo, topo, meio], st({ sort: 'vistos', dir: 'asc' })))).toEqual([novo.id, meio.id, velho.id, topo.id])
  })
  it('busca ignora acento e caixa', () => {
    const alvo = vid({ title: 'São João na Paraíba' }), outro = vid({ title: 'Outra coisa' })
    for (const q of ['sao joao', 'SÃO JOÃO', 'paraiba']) expect(montarLista([alvo, outro], st({ q })).visiveis).toEqual([alvo.id])
    expect(norm('São João')).toBe('sao joao')
  })
  it('busca com caracteres especiais não quebra', () => {
    const t = ['promo <b>negrito</b>', 'abre ( parêntese', 'colchete [x]', 'barra \\ invertida', 'tour 東京 de noite', 'ponto.* regex']
    const all = t.map(title => vid({ title }))
    for (const q of ['<b>', '(', '[', '\\', '.*', '+', '?', '$^']) expect(() => montarLista(all, st({ q }))).not.toThrow()
    expect(montarLista(all, st({ q: '<b>' })).visiveis).toEqual([all[0]!.id])
    expect(montarLista(all, st({ q: '(' })).visiveis).toEqual([all[1]!.id])
    expect(montarLista(all, st({ q: '\\' })).visiveis).toEqual([all[3]!.id])
    expect(montarLista(all, st({ q: '.*' })).visiveis).toEqual([all[5]!.id]) // texto, nunca RegExp
    expect(montarLista(all, st({ q: '東京' })).visiveis).toEqual([all[4]!.id])
  })
  it('busca vazia dentro de um filtro oferece "Buscar em Todos" com a contagem', () => {
    const all = [vid({ title: 'Lisboa de manhã', isShort: false }), vid({ title: 'Passeio por Lisboa', isShort: false }), vid({ title: 'Um short', isShort: true })]
    const l = montarLista(all, st({ fmt: 'shorts', q: 'lisboa' }))
    expect(l.vazio).toEqual({ text: 'Nenhum Short com “lisboa”. Há 2 em Todos.', acao: 'buscar-em-todos' })
    expect(l.secoes).toEqual([]); expect(l.visiveis).toEqual([])
    expect(montarLista(all, st({ fmt: 'longos', q: 'xyz' })).vazio).toEqual({ text: 'Nenhum vídeo com “xyz”.', acao: 'limpar-busca' })
  })
  it('filtros sem resultado: as frases do spec', () => {
    const longos = [vid({ isShort: false })], shorts = [vid({ isShort: true })]
    expect(montarLista(longos, st({ fmt: 'shorts' })).vazio).toEqual({ text: 'Nenhum Short neste canal.', acao: null })
    expect(montarLista(shorts, st({ fmt: 'longos' })).vazio).toEqual({ text: 'Nenhum vídeo longo neste canal.', acao: null })
    expect(montarLista(longos, st({ fmt: 'fixados' })).vazio).toEqual({ text: 'Nenhum vídeo fixado. Fixe um vídeo para acompanhá-lo mesmo quando sair dos mais recentes.', acao: null })
    expect(montarLista(longos, st({ q: 'x' })).vazio).toEqual({ text: 'Nenhum vídeo com “x”.', acao: 'limpar-busca' })
  })
  it('busca que só casa antigos não carregados: a frase com a contagem e o bloco aparece', () => {
    const all = [...grupo('acompanhado', 3), ...antigos(3, { title: 'Viagem ao Japão' }), ...antigos(5)]
    const l = montarLista(all, st({ q: 'japão', n: 0 }))
    expect(l.visiveis).toEqual([]); expect(l.vazio).toBeNull()
    expect(l.mais).not.toBeNull()
    expect(l.mais!.soAntigos).toBe('Nenhum dos vídeos acompanhados tem “japão”. Há 3 vídeos antigos, sem contagem diária.')
    expect(l.mais!.total).toBe(3); expect(l.mais!.mostrando).toBe(0)
    // com um deles carregado a frase some: há o que mostrar
    const carregado = montarLista(all, st({ q: 'japão', n: 40 }))
    expect(carregado.visiveis).toHaveLength(3); expect(carregado.mais).toBeNull()
  })
  it('bloco "Carregar mais": frases e rótulo do botão em cada ponta', () => {
    const all = [...grupo('acompanhado', 51), ...antigos(82)]
    const a = montarLista(all, st({ n: 0 })).mais!
    expect(a).toMatchObject({ mostrando: 51, total: 133, proximo: 40, faltam: 82 })
    expect(a.frase).toBe('Mais 40 vídeos antigos, sem contagem diária. Depois deste lote faltam 42.'); expect(a.botao).toBe('Carregar mais 40 vídeos')
    const b = montarLista(all, st({ n: 40 })).mais!
    expect(b).toMatchObject({ mostrando: 91, total: 133, proximo: 40, faltam: 42 })
    expect(b.frase).toBe('Mais 40 vídeos antigos, sem contagem diária. Depois deste lote faltam 2.'); expect(b.botao).toBe('Carregar mais 40 vídeos')
    const c = montarLista(all, st({ n: 80 })).mais!
    expect(c).toMatchObject({ mostrando: 131, proximo: 2, faltam: 2 })
    expect(c.frase).toBe('Mais 2 vídeos antigos, sem contagem diária. Depois deste lote não falta nenhum.'); expect(c.botao).toBe('Carregar os últimos 2 vídeos')
    const d = montarLista([...grupo('acompanhado', 51), ...antigos(81)], st({ n: 80 })).mais!
    expect(d.botao).toBe('Carregar o último vídeo'); expect(d.frase).toBe('Mais 1 vídeo antigo, sem contagem diária. Depois deste lote não falta nenhum.')
    const e = montarLista([...grupo('acompanhado', 51), ...antigos(82)], st({ n: 40 })).mais!
    expect(e.frase).toContain('faltam 2.')
    const f = montarLista([...grupo('acompanhado', 51), ...antigos(41)], st({ n: 0 })).mais!
    expect(f.frase).toBe('Mais 40 vídeos antigos, sem contagem diária. Depois deste lote falta 1.')
    expect(montarLista(all, st({ n: 120 })).mais).toBeNull()
    expect(montarLista(grupo('acompanhado', 5), st()).mais).toBeNull()
    expect(LOTE).toBe(40)
  })
  it('os divisores contam só o que está na tela; os antigos não carregados entram só na frase do bloco', () => {
    const all = [vid({ mult: 2 }), vid({ mult: null }), ...grupo('sem-data', 2), ...antigos(60, { mult: null })]
    const l = montarLista(all, st({ sort: 'multiplo', n: 0 }))
    expect(rot(l)).toEqual([null, 'Sem múltiplo ainda (1)', 'Sem data de publicação (2)']) // os 60 antigos mult null não entram em "Sem múltiplo"
    expect(l.mais!.faltam).toBe(60); expect(l.mais!.frase).toContain('faltam 20.')
    const carregado = montarLista(all, st({ sort: 'multiplo', n: 40 }))
    expect(rot(carregado)).toEqual([null, 'Sem múltiplo ainda (1)', 'Sem data de publicação (2)', 'Mais antigos, sem contagem diária (60)'])
    expect(carregado.secoes.at(-1)!.itens).toHaveLength(40)
  })
  it('resultado: "133 vídeos: 61 longos, 71 Shorts, 1 com formato não confirmado." e, com busca, "5 vídeos com “lisboa”"', () => {
    const all = [...grupo('acompanhado', 51, { isShort: false }), ...antigos(10, { isShort: false }), ...antigos(71, { isShort: true }), ...grupo('acompanhado', 1, { isShort: null })]
    expect(all).toHaveLength(133)
    expect(montarLista(all, st()).resultado).toBe('133 vídeos: 61 longos, 71 Shorts, 1 com formato não confirmado.')
    const com = [...Array.from({ length: 5 }, (_, k) => vid({ title: 'Lisboa ' + k })), vid({ title: 'Porto' })]
    expect(montarLista(com, st({ q: 'lisboa' })).resultado).toBe('5 vídeos com “lisboa”')
    expect(montarLista([com[0]!], st({ q: 'lisboa' })).resultado).toBe('1 vídeo com “lisboa”')
    expect(montarLista(com, st({ q: 'nada' })).resultado).toBe('Nenhum vídeo com “nada”')
  })
  it('visiveis traz os ids na ordem da tela, antigos carregados inclusive', () => {
    const a = vid({ views: 1 }), b = vid({ views: 9 }), sd = vid({ grupo: 'sem-data', pub: null }), old = antigos(3)
    const l = montarLista([...old, sd, a, b], st({ sort: 'vistos', n: 40 }))
    expect(l.visiveis).toEqual([b.id, a.id, sd.id, ...old.map(v => v.id)])
    expect(l.visiveis).toEqual(ids(l))
    expect(montarLista([...old, sd, a, b], st({ sort: 'vistos', n: 0 })).visiveis).toEqual([b.id, a.id, sd.id])
  })
})
