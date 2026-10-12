// @vitest-environment node
// A4 Tarefa 8, parte pura: os consertos herdados (revisão das Tarefas 6 e 7), a posição no nicho com itens e links, o concorrente "logo
// acima", o modelo da página (`buildProprioView`) e a segurança do estado `negado` (nenhum dado privado nas props).
// Este sistema falha em VERDE: cada caso afirma o valor nulo E a frase, nunca um padrão.
import { afterEach, describe, it, expect } from 'vitest'
import { proprioWorld, DADOS, CHEIO, alcanceComLinhas, semVideos, umCanal, type CenarioDados } from './proprio-fixture'
import { buildProprioHeader, type PosicaoNoNicho } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { buildProprioView, ABAS_PROPRIO, ABAS_PROPRIO_NOTA } from '@/app/cms/(authed)/youtube/competitors/_proprio/view-model'
import { posicaoDoSite } from '@/app/cms/(authed)/youtube/competitors/_proprio/posicao-do-site'
import { notaDoDivisor } from '@/app/cms/(authed)/youtube/competitors/_canal/grade'
import { buildCompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { VIEWS_POR_DIA_BASE } from '@/app/cms/(authed)/youtube/competitors/_proprio/videos-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { posicoes } from '@/lib/youtube/observatorio/posicao'
import { median, quant } from '@/lib/youtube/observatorio/stats'
import { link, type CanalSort } from '@/lib/youtube/observatorio/links'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))

const BASE = proprioWorld()
const d = (n: number) => addDays(BASE.hoje, -n)
const O = { hoje: BASE.hoje, dm: BASE.dm }

/* ---------------------------------------------------------------- consertos herdados */

describe('T8 estatística: NaN e infinito nunca entram na mediana nem no quantil', () => {
  it('median e quant ignoram valor não finito; só com não finitos devolvem null (nunca NaN)', () => {
    expect(median([1, Number.NaN, 3])).toBe(2)
    expect(median([Number.NaN, 5, 1, Number.POSITIVE_INFINITY, 3])).toBe(3)
    expect(median([Number.NaN])).toBeNull()
    expect(median([Number.NEGATIVE_INFINITY, Number.NaN])).toBeNull()
    expect(median([])).toBeNull()
    expect(quant([4, Number.NaN, 2, 6], 0.5)).toBe(4)
    expect(quant([Number.NaN, Number.POSITIVE_INFINITY], 0.5)).toBeNull()
  })
  it('um vídeo com curtidas NaN nunca escreve "NaN%" no engajamento: sai da conta e a base o conta como sem medida', () => {
    const w = proprioWorld({ mut: ds => { const v = ds.videos.find(x => x.ch === ds.channels.find(c => c.own)!.id)!; v.likes = Number.NaN } })
    const h = buildProprioHeader(w.obs, w.canalId, w.dados, { ...O, posicao: null })!
    const todas = [...h.faixa, ...h.todos]
    for (const c of todas) for (const t of [c.value, c.missing, c.base, c.n]) expect(t ?? '', c.key).not.toMatch(/NaN|Infinity/)
    const e = h.todos.find(c => c.key === 'engajamentoTodos')!
    expect(e.value).toMatch(/^\d+(,\d)?%$/)
    expect(e.base).toContain('1 sem curtidas ou comentários medidos ficam fora')
  })
})

describe('T8 a base do engajamento diz o motivo certo (M4 da Tarefa 7)', () => {
  const comZeroViews = proprioWorld({ mut: ds => { const v = ds.videos.find(x => x.ch === ds.channels.find(c => c.own)!.id)!; v.views = 0; v.likes = 0; v.comments = 0 } })
  it('vídeo com 0 views (curtidas e comentários medidos) NÃO é "sem curtidas ou comentários medidos": a frase diz "com 0 views"', () => {
    const h = buildProprioHeader(comZeroViews.obs, comZeroViews.canalId, comZeroViews.dados, { ...O, posicao: null })!
    const base = h.todos.find(c => c.key === 'engajamentoTodos')!.base
    expect(base).toContain('1 com 0 views')
    expect(base).not.toContain('sem curtidas ou comentários medidos')
    expect(base).toContain('ficam fora')
  })
  it('os dois motivos juntos: cada um com a sua contagem; um vídeo sem views conta só no motivo das views', () => {
    const w = proprioWorld({ mut: ds => {
      const id = ds.channels.find(c => c.own)!.id
      const vs = ds.videos.filter(x => x.ch === id)
      vs[0]!.views = 0; vs[0]!.comments = null // 0 views E sem comentário: conta em "0 views", uma vez
      vs[1]!.comments = null
    } })
    const base = buildProprioHeader(w.obs, w.canalId, w.dados, { ...O, posicao: null })!.todos.find(c => c.key === 'engajamentoTodos')!.base
    expect(base).toContain('1 com 0 views e 1 sem curtidas ou comentários medidos ficam fora')
  })
  it('sem nenhum vídeo fora da conta: "nenhum fica de fora"', () => {
    const base = buildProprioHeader(BASE.obs, BASE.canalId, BASE.dados, { ...O, posicao: null })!.todos.find(c => c.key === 'engajamentoTodos')!.base
    expect(base).toContain('nenhum fica de fora')
  })
})

describe('T8 o total do cabeçalho inclui vídeos que não estão entre os guardados do canal, e diz o fato e quantos (M3 da Tarefa 7)', () => {
  const orfao = (ytId: string) => ({ ytId, dia: d(5), imp: 99, ctr: 0.1 })
  const comOrfaos = (n: number): DadosDoCanal => {
    const base = DADOS.cheio(BASE.canalId, BASE.ytIds, BASE.hoje)
    const a = alcanceComLinhas(BASE.canalId, BASE.hoje, [...(base.alcance.acesso === 'ok' ? base.alcance.dado.linhas : []), ...Array.from({ length: n }, (_, i) => orfao('saiu' + i))])
    return { ...base, alcance: { acesso: 'ok', dado: a } }
  }
  const h = (dados: DadosDoCanal) => buildProprioHeader(BASE.obs, BASE.canalId, dados, { ...O, posicao: null })!
  it('o total de impressões é o do relatório (soma as linhas órfãs) e o ⓘ diz o fato: "2 vídeos com impressões no relatório não estão entre os vídeos guardados deste canal"', () => {
    const x = h(comOrfaos(2))
    const imp = x.faixa.find(c => c.key === 'impressoes')!
    expect(imp.value).toBe(BASE.obs.fmt.num(CHEIO.imp + 2 * 99))
    expect(imp.base).toContain('2 vídeos com impressões no relatório não estão entre os vídeos guardados deste canal.')
    expect(imp.base).not.toMatch(/saíram|saiu|apagad|privad/)
    const cl = x.todos.find(c => c.key === 'cliques')!
    expect(cl.base).toContain('2 vídeos com impressões no relatório não estão entre os vídeos guardados deste canal.')
  })
  it('com um só: singular; sem nenhum: a frase não aparece', () => {
    expect(h(comOrfaos(1)).faixa.find(c => c.key === 'impressoes')!.base).toContain('1 vídeo com impressões no relatório não está entre os vídeos guardados deste canal.')
    for (const c of [...h(BASE.dados).faixa, ...h(BASE.dados).todos]) expect(c.base, c.key).not.toMatch(/guardados deste canal|saíram|saiu/)
  })
})

describe('T8 grade.tsx: a nota do divisor conhece cada ordenação (I1 da Tarefa 7)', () => {
  const sem = { key: 'sem-valor', label: 'Sem impressão medida no período', count: 54 }
  it('ordenando por impressões a frase miúda não é a dos concorrentes: diz que o vídeo não apareceu nos relatórios lidos ou que o alcance não foi lido', () => {
    const t = notaDoDivisor(sem, 'imp')
    expect(t).toBe('o vídeo não apareceu nos relatórios de alcance lidos, ou o alcance do canal não pôde ser lido')
    expect(t).not.toContain('fixado antigo')
  })
  it('cada ordenação tem a sua frase e a de impressões é só dela', () => {
    const sorts: CanalSort[] = ['recentes', 'vistos', 'multiplo', 'vpd', 'imp']
    const frases = sorts.map(s => notaDoDivisor(sem, s))
    for (const f of frases) expect(f.length).toBeGreaterThan(10)
    expect(frases.filter(f => f.includes('relatórios de alcance'))).toHaveLength(1)
  })
  it('os dois divisores fixos (antigos, sem data) continuam com a frase de sempre em qualquer ordenação', () => {
    for (const s of ['recentes', 'imp'] as CanalSort[]) {
      expect(notaDoDivisor({ key: 'antigos', label: 'x', count: 1 }, s)).toBe('a contagem de views deles é antiga; não há views por dia, e o múltiplo é o de quando foram contados')
      expect(notaDoDivisor({ key: 'sem-data', label: 'x', count: 1 }, s)).toBe('o YouTube não devolveu a data; ficam no fim em qualquer ordenação')
    }
  })
})

/* ---------------------------------------------------------------- posição no nicho e concorrente logo acima */

describe('T8 posicaoDoSite: as posições saem dos MESMOS números da comparação', () => {
  it('as quatro posições conferem com as do pacote da comparação (numerosDoCanal), no conjunto do nicho do canal', () => {
    const { posicao } = posicaoDoSite(BASE.obs, BASE.canalId)
    expect(posicao).not.toBeNull()
    const pack = buildCompararPack(BASE.obs, () => undefined)
    const ch = BASE.obs.channel(BASE.canalId)!
    const doConjunto = ch.niche ? pack.canais.filter(c => c.niche === ch.niche) : pack.canais
    for (const [chave, id] of [['inscritos', 'inscritos'], ['medianaViews', 'medianaViews'], ['longos90', 'longos90'], ['vpdPorMil', 'vpdPorMil']] as const) {
      const esperado = posicoes(doConjunto.map(c => ({ id: c.id, x: c.numeros[id].x, chave: c.numeros[id].texto ?? undefined }))).get(BASE.canalId) ?? null
      expect(posicao![chave], chave).toEqual(esperado)
    }
    expect(posicao!.conjunto).toEqual(ch.niche ? { tipo: 'nicho', niche: ch.niche, label: BASE.obs.nicheLabel(ch.niche) } : { tipo: 'geral' })
  })
  it('canal sem nicho: o conjunto é "no geral" e conta todos os canais do site', () => {
    const w = proprioWorld({ mut: ds => { const c = ds.channels.find(x => x.own)!; c.niche = null } })
    const { posicao } = posicaoDoSite(w.obs, w.canalId)
    expect(posicao!.conjunto).toEqual({ tipo: 'geral' })
    expect(posicao!.inscritos!.de).toBe(w.obs.channels.filter(c => c.subs != null).length)
  })
  it('id de concorrente ou desconhecido: nada calculado (null nos dois), nunca um canal escolhido por engano', () => {
    const conc = BASE.obs.channels.find(c => !c.own)!.id
    for (const id of [conc, 'nao-existe']) expect(posicaoDoSite(BASE.obs, id)).toEqual({ posicao: null, concorrenteAcima: null })
  })
})

describe('T8 o concorrente logo acima em inscritos', () => {
  it('é o de menos inscritos entre os que têm MAIS que o canal, do mesmo conjunto; o título do botão diz qual', () => {
    const subs = BASE.obs.channel(BASE.canalId)!.subs!
    const { concorrenteAcima: c } = posicaoDoSite(BASE.obs, BASE.canalId)
    expect(c).not.toBeNull()
    const ch = BASE.obs.channel(BASE.canalId)!
    const cand = BASE.obs.channels.filter(x => !x.own && x.subs != null && x.subs > subs && (ch.niche ? x.niche === ch.niche : true))
    const menor = Math.min(...cand.map(x => x.subs!))
    expect(c!.acima).toBe(true)
    expect(BASE.obs.channel(c!.id)!.subs).toBe(menor)
  })
  it('ninguém acima: cai no concorrente com mais inscritos e o modelo diz que NÃO está acima (o título não mente)', () => {
    const w = proprioWorld({ mut: ds => { ds.channels.find(x => x.own)!.subs = 10_000_000 } })
    const { concorrenteAcima: c } = posicaoDoSite(w.obs, w.canalId)
    expect(c).not.toBeNull()
    expect(c!.acima).toBe(false)
    const maior = Math.max(...w.obs.channels.filter(x => !x.own && x.subs != null).map(x => x.subs!))
    expect(w.obs.channel(c!.id)!.subs).toBe(maior)
  })
  it('inscritos ocultos no canal: ninguém é "acima"; sem concorrente nenhum: null', () => {
    const oculto = proprioWorld({ mut: ds => { ds.channels.find(x => x.own)!.subs = null } })
    expect(posicaoDoSite(oculto.obs, oculto.canalId).concorrenteAcima?.acima).toBe(false)
    const sem = proprioWorld({ mut: ds => { ds.channels = ds.channels.filter(c => c.own); ds.videos = ds.videos.filter(v => ds.channels.some(c => c.id === v.ch)) } })
    expect(posicaoDoSite(sem.obs, sem.canalId).concorrenteAcima).toBeNull()
  })
})

describe('T8 a linha de posição vira itens estruturados (pendência (b) da Tarefa 6)', () => {
  const pos = (w = BASE) => posicaoDoSite(w.obs, w.canalId).posicao
  const h = (w = BASE) => buildProprioHeader(w.obs, w.canalId, w.dados, { ...O, posicao: pos(w) })!
  it('sem posição calculada: posicaoItens e posicaoLinha são null juntos', () => {
    const x = buildProprioHeader(BASE.obs, BASE.canalId, BASE.dados, { ...O, posicao: null })!
    expect(x.posicaoItens).toBeNull()
    expect(x.posicaoLinha).toBeNull()
  })
  it('quatro itens, na ordem: inscritos, mediana de views, longos em 90 dias, views/dia por mil inscritos', () => {
    const x = h()
    expect(x.posicaoItens!.itens.map(i => i.chave)).toEqual(['inscritos', 'medianaViews', 'longos90', 'vpdPorMil'])
  })
  it('a linha inteira é a junção dos itens (uma fonte só): intro + três itens + o quarto', () => {
    const x = h(), p = x.posicaoItens!
    const [a, b, c, e] = p.itens as [typeof p.itens[0], typeof p.itens[0], typeof p.itens[0], typeof p.itens[0]]
    expect(x.posicaoLinha).toBe(`${p.intro} ${a.texto}, ${b.texto}, ${c.texto}. ${e.texto}.`)
  })
  it('só inscritos e views/dia por mil têm a lista ordenada por eles; os outros dois não têm link (a lista de Canais não ordena por eles)', () => {
    const x = h(), p = x.posicaoItens!
    const nicho = BASE.obs.channel(BASE.canalId)!.niche
    const alvo = (sort: 'subs' | 'vpd') => link.canais({ niche: nicho ?? 'todos', sort })
    expect(p.itens.find(i => i.chave === 'inscritos')!.href).toBe(alvo('subs'))
    // T9 (M1): o link do item de views/dia por mil só existe COM posição (aqui não há: os concorrentes não entram sem as views por dia); o caso com posição está em proprio-t9-cabecalho.test.ts
    expect(p.itens.find(i => i.chave === 'vpdPorMil')!.href).toBeNull()
    expect(alvo('vpd')).toMatch(/sort=vpd/)
    expect(p.itens.find(i => i.chave === 'medianaViews')!.href).toBeNull()
    expect(p.itens.find(i => i.chave === 'longos90')!.href).toBeNull()
  })
  it('o texto de cada item é a posição e o nome: "14º em inscritos"; empate e "(nenhum)" continuam', () => {
    const x = h(), p = x.posicaoItens!
    const q = pos()!
    expect(p.itens[0]!.texto).toMatch(new RegExp(`^${q.inscritos!.pos}º( de \\d+)? em inscritos`))
    expect(p.itens[3]!.texto.startsWith('Views/dia por mil inscritos: ')).toBe(true)
  })
  it('posição sem valor: o item diz o motivo, sem "0º" e sem número inventado', () => {
    const q: PosicaoNoNicho = { conjunto: { tipo: 'geral' }, inscritos: null, medianaViews: null, longos90: null, vpdPorMil: null }
    const x = buildProprioHeader(BASE.obs, BASE.canalId, BASE.dados, { ...O, posicao: q })!
    const p = x.posicaoItens!
    expect(p.intro).toBe('Sem posição calculada no geral:')
    expect(p.itens[0]!.texto).toMatch(/^sem posição em inscritos/)
    expect(p.itens[1]!.texto).toBe('sem posição em mediana de views (sem contagem)')
    expect(p.itens[2]!.texto).toBe('sem posição em longos em 90 dias')
    for (const i of p.itens) expect(i.texto).not.toMatch(/\b0º/)
  })
})

/* ---------------------------------------------------------------- o modelo da página */

const sp = (o: Record<string, string> = {}) => o
const view = (w = BASE, query: Record<string, string> = {}, extra: Partial<Parameters<typeof buildProprioView>[4]> = {}) =>
  buildProprioView(w.obs, w.canalId, sp(query), w.dados, { ...O, posicao: null, concorrenteAcima: null, muitosProprios: true, ...extra })

describe('T8 buildProprioView', () => {
  it('só o canal próprio tem página: concorrente e id desconhecido devolvem null', () => {
    const conc = BASE.obs.channels.find(c => !c.own)!.id
    for (const id of [conc, 'nao-existe']) expect(buildProprioView(BASE.obs, id, {}, BASE.dados, { ...O, posicao: null, concorrenteAcima: null, muitosProprios: true }), id).toBeNull()
  })
  it('junta cabeçalho, vídeos e o estado da URL lido COMO canal próprio (sort=imp e tab=retencao valem)', () => {
    const v = view(BASE, { sort: 'imp', tab: 'retencao', fmt: 'fixados' })!
    expect(v.state.sort).toBe('imp')
    expect(v.state.tab).toBe('retencao')
    expect(v.state.fmt).toBe('todos') // canal próprio não tem fixados
    expect(v.header.id).toBe(BASE.canalId)
    expect(v.videos.videos.length).toBeGreaterThan(0)
  })
  it('abas vazias: as frases do spec 16.4, sem "lote" nem "L3" (D12 b)', () => {
    const v = view()!
    expect(v.abas).toEqual({
      trocas: 'Trocas dos seus vídeos ainda não são lidas nesta tela.',
      leitura: 'A leitura da forja para o seu canal ainda não existe.',
      retencao: 'Retenção ainda não coletada.',
    })
    expect(v.abas).toEqual(ABAS_PROPRIO)
    for (const t of [...Object.values(v.abas), ...Object.values(ABAS_PROPRIO_NOTA)]) expect(t).not.toMatch(/\bL[0-9]\b|lote/i)
    expect(ABAS_PROPRIO_NOTA.trocas).toBe('Os testes de título e thumbnail do seu canal ficam no A/B Lab.')
  })
  it('"Comparar com…": com concorrente logo acima o link leva à comparação (a = canal, b = concorrente) e o title diz qual', () => {
    const v = view(BASE, {}, { concorrenteAcima: { id: 'luke-damant', name: 'Luke Damant', acima: true } })!
    expect(v.compararHref).toBe(link.comparar(BASE.canalId, 'luke-damant'))
    expect(v.compararTitulo).toBe('Abre a comparação com Luke Damant, o concorrente logo acima de você em inscritos')
  })
  it('ninguém acima: o title diz que é o concorrente com mais inscritos, não "logo acima"', () => {
    const v = view(BASE, {}, { concorrenteAcima: { id: 'luke-damant', name: 'Luke Damant', acima: false } })!
    expect(v.compararTitulo).toBe('Abre a comparação com Luke Damant, o concorrente com mais inscritos (nenhum está acima de você)')
  })
  it('sem concorrente: nem link nem title (o botão não existe)', () => {
    const v = view()!
    expect(v.compararHref).toBeNull()
    expect(v.compararTitulo).toBeNull()
  })
  it('a frase das views por dia vem uma vez (13.3: a base, com o diário cheio)', () => {
    expect(view()!.videos.viewsPorDiaFrase).toBe(VIEWS_POR_DIA_BASE)
  })
})

describe('T8 estado negado: nenhum dado privado vai nas props (a tela é client component)', () => {
  const cheio = view(proprioWorld({ cenario: 'cheio' }))!
  /** Os pares `"campo":"valor"` do dado privado, como a serialização os escreveria (um número curto aparece por acaso em outro lugar; o par não). */
  const par = (k: string, t: string) => `"${k}":${JSON.stringify(t)}`
  const privados = (v: NonNullable<typeof cheio>): string[] => [
    ...v.videos.videos.flatMap(x => (['impText', 'cliquesText', 'terceira', 'vpdDiarioText'] as const).flatMap(k => (typeof x[k] === 'string' && x[k] !== '' ? [par(k, x[k] as string)] : []))),
    ...v.header.faixa.filter(c => ['impressoes', 'diasComImpressao'].includes(c.key) && c.value != null).map(c => `{"key":"${c.key}","value":${JSON.stringify(c.value)}`),
    ...v.header.todos.filter(c => ['cliques', 'videosComImpressao', 'vpdVideo'].includes(c.key) && c.value != null).map(c => `{"key":"${c.key}","value":${JSON.stringify(c.value)}`),
  ]
  it('a série cheia tem o que procurar (o teste não passa por vazio)', () => {
    expect(privados(cheio).length).toBeGreaterThan(5)
  })
  for (const c of ['negado', 'erro'] as CenarioDados[]) {
    it(`${c}: as props serializadas não têm número, série nem frase do dado privado; todo número privado é null com a frase do motivo`, () => {
      const w = proprioWorld({ cenario: c })
      const v = view(w)!
      const json = JSON.stringify(v)
      for (const t of privados(cheio)) expect(json, t).not.toContain(t)
      for (const x of v.videos.videos) {
        expect(x.imp).toBeNull(); expect(x.cliques).toBeNull(); expect(x.vpdDiario).toBeNull()
        expect(x.impMissing, x.id).not.toBeNull()
        expect(x.terceira).toBe('')
      }
      const imp = v.header.faixa.find(k => k.key === 'impressoes')!
      expect(imp.value).toBeNull()
      expect(imp.missing).toBe(c === 'negado' ? 'só quem edita o site vê este número' : 'a leitura do alcance falhou agora; recarregue a página')
    })
  }
  it('o token nunca está no modelo: a view serializa sem campo de edição', () => {
    expect(JSON.stringify(cheio)).not.toMatch(/edicao|EdicaoDoSite|siteId/)
  })
})

describe('T8 sem vídeos e canal novo: o modelo não inventa nada', () => {
  it('canal sem vídeo algum: a view existe, sem cartões, e a frase de "sem vídeos" vem do modelo dos vídeos', () => {
    const w = proprioWorld({ mut: semVideos })
    const v = view(w)!
    expect(v.videos.videos).toHaveLength(0)
    expect(v.videos.semVideos).toBe('Este canal ainda não tem vídeos sincronizados.')
  })
  it('dmDia é o formatador do relógio da página', () => {
    expect(dmDia(d(1))).toMatch(/^\d\d\/\d\d$/)
  })
})

describe('T8 o conjunto de UM canal (o que a página lê em produção) monta tudo sem tocar o que agrega entre canais', () => {
  const um = proprioWorld({ mut: umCanal })
  it('o conjunto é mesmo o de um canal: ownChannels() lança (a guarda do motor existe)', () => {
    expect(() => um.obs.ownChannels()).toThrow(/aggregates across the site's channels/)
  })
  it('cabeçalho, vídeos e a view montam; o selo de idioma vem do que o menu sabe (muitosProprios), não do conjunto', () => {
    const base = { hoje: um.hoje, dm: um.dm, posicao: null, concorrenteAcima: null, muitosProprios: false }
    const sozinho = buildProprioView(um.obs, um.canalId, {}, um.dados, base)!
    expect(sozinho.header.lang).toBeNull()
    expect(sozinho.videos.videos.length).toBeGreaterThan(0)
    const varios = buildProprioView(um.obs, um.canalId, {}, um.dados, { ...base, muitosProprios: true })!
    expect(varios.header.lang).toEqual({ code: 'PT', title: 'Canal em português' })
    expect(buildProprioView(um.obs, um.canalId, {}, um.dados, { ...base, muitosProprios: false })!.header.lang).toBeNull()
  })
  it('todos os cenários de dado montam no conjunto de um canal', () => {
    for (const cenario of Object.keys(DADOS) as CenarioDados[]) {
      const w = proprioWorld({ mut: umCanal, cenario })
      expect(() => buildProprioView(w.obs, w.canalId, { sort: 'imp', tab: 'retencao' }, w.dados, { hoje: w.hoje, dm: w.dm, posicao: null, concorrenteAcima: null, muitosProprios: false }), cenario).not.toThrow()
    }
  })
})
