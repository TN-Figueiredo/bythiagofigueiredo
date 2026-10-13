// A4 Tarefa 10: o MODELO da seção "Como o canal está" (spec 16.5, D12 e D13). Puro: recebe o alcance já lido e a posição já calculada.
// Regra de ouro (este sistema falha em VERDE): cada frase diz só o que o dado sustenta. Dia não medido nunca é zero, soma ou média; série
// curta ou com buracos diz a base; coleta parada diz "parou em dd/mm"; sem relatório, sem permissão e relatório todo vazio dizem coisas diferentes.
import { describe, it, expect } from 'vitest'
import { link } from '@/lib/youtube/observatorio/links'
import { BACK_DO_TOP_IMP } from '@/app/cms/(authed)/youtube/competitors/_historico/origem-canal'
import { foraDosGuardadosFrase } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { Posicao } from '@/lib/youtube/observatorio/posicao'
import { alcancePorVideo, montarDias, resumir, type AlcanceVideo, type Periodo, type ResumoAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import type { PosicaoItens, PosicaoNoNicho } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { SEM_PERMISSAO, SEM_RELATORIO } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'
import { buildComoEsta, montarComoEsta, POUCO_VOLUME, type ComoEstaView } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta-model'
import { concorrentesDoSite, posicaoDoSite } from '@/app/cms/(authed)/youtube/competitors/_proprio/posicao-do-site'
import { buildProprioHeader } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { alcanceCheio, alcanceCurto, alcanceNadaLido, alcanceSoVazios, alcanceVazio, proprioWorld } from './proprio-fixture'

const dm = (d: DiaYt) => d.slice(8, 10) + '/' + d.slice(5, 7)
const CANAL = 'canal-1'
const HOJE: DiaYt = '2026-10-08'
const NICHO = { tipo: 'nicho', niche: 'viagem', label: 'Viagem' } as const
const pos = (p: number, de: number, empate = false): Posicao => ({ pos: p, de, empate })
const POSICAO: PosicaoNoNicho = { conjunto: NICHO, inscritos: pos(14, 14), medianaViews: pos(14, 14), longos90: pos(13, 14), vpdPorMil: null }
const ITENS: PosicaoItens = {
  intro: 'Entre 14 canais de Viagem:',
  itens: [
    { chave: 'inscritos', texto: '14º em inscritos', href: '/cms/youtube/competitors?niche=viagem&sort=subs' },
    { chave: 'medianaViews', texto: '14º em mediana de views', href: null },
    { chave: 'longos90', texto: '13º em longos em 90 dias (nenhum)', href: null },
    { chave: 'vpdPorMil', texto: 'Views/dia por mil inscritos: ainda não medido', href: null },
  ],
}
const PERIODO_MOCKUP: Periodo = { de: '2026-09-09', ate: '2026-10-07', dias: 29 }
/** O resumo do mockup: 29 dias, todos lidos, 140 impressões e ~3 cliques. */
const RESUMO_MOCKUP: ResumoAlcance = { imp: 140, cliques: 3.2, diasComImpressao: 11, diasLidos: 29, diasNaoMedidos: 0 }
const VIDEOS = Array.from({ length: 7 }, (_, i) => ({ id: `v${i + 1}`, ytId: `yt${i + 1}`, title: `Vídeo ${i + 1}`, thumb: `https://i.ytimg.com/vi/yt${i + 1}/mqdefault.jpg` }))
const VAZIO = new Map<string, AlcanceVideo>()

type Entrada = Parameters<typeof buildComoEsta>[0]
function entrada(o: Partial<Entrada> = {}): Entrada {
  return {
    resumo: RESUMO_MOCKUP, periodo: PERIODO_MOCKUP, acesso: 'ok', porVideo: VAZIO, videos: VIDEOS, posicao: POSICAO, posicaoItens: ITENS,
    concorrentes: [{ id: 'c1', name: 'Rota Livre', acima: true }, { id: 'c2', name: 'Mala Pronta' }], canalId: CANAL, dm, hoje: '2026-10-08', ...o,
  }
}
const v = (o: Partial<Entrada> = {}): ComoEstaView => buildComoEsta(entrada(o))
const comImp = (imp: number, cliques: number | null = 0, extra: Partial<ResumoAlcance> = {}): ResumoAlcance => ({ ...RESUMO_MOCKUP, imp, cliques, ...extra })

describe('T10 a linha recolhida e a frase do topo (spec 16.5, D13)', () => {
  it('recolhida: "140 impressões e 3 cliques estimados em 29 dias. 14º de 14 canais de Viagem em inscritos."', () => {
    expect(v().recolhida).toBe('140 impressões e 3 cliques estimados em 29 dias. 14º de 14 canais de Viagem em inscritos.')
  })

  it('abaixo de 1.000 impressões: a frase do spec 16.5 com os números calculados (nunca fixa)', () => {
    expect(v().frase).toBe('Com 140 impressões em 29 dias, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado.')
    // outro volume, outro período: a frase acompanha
    const r = comImp(87, 1, { diasLidos: 12, diasComImpressao: 5 })
    const x = v({ resumo: r, periodo: { de: '2026-09-26', ate: '2026-10-07', dias: 12 } })
    expect(x.frase).toBe('Com 87 impressões em 12 dias, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado.')
    expect(x.recolhida).toBe('87 impressões e 1 clique estimado em 12 dias. 14º de 14 canais de Viagem em inscritos.')
  })

  it('a partir de 1.000: a frase de D13, que não promete comparar capas (as duas bordas: 999 e 1000)', () => {
    expect(POUCO_VOLUME).toBe(1000)
    const abaixo = v({ resumo: comImp(999, 40) }).frase
    const igual = v({ resumo: comImp(1000, 40) }).frase
    expect(abaixo).toBe('Com 999 impressões em 29 dias, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado.')
    expect(igual).toBe('Com 1.000 impressões em 29 dias dá para ver em que dias e em quais vídeos o canal apareceu. Nenhum vídeo sozinho diz que uma capa funciona melhor.')
    expect(v({ resumo: comImp(12_345, 400) }).frase).toBe('Com 12.345 impressões em 29 dias dá para ver em que dias e em quais vídeos o canal apareceu. Nenhum vídeo sozinho diz que uma capa funciona melhor.')
    // nenhuma das duas frases promete comparar capas ou apontar a melhor
    for (const f of [abaixo, igual]) expect(f).not.toMatch(/a melhor capa|capa vencedora|compare as capas/i)
  })

  it('nenhum dia lido: a frase diz que ainda não há dia medido e a recolhida não escreve "0 impressões"', () => {
    const { dias, periodo } = montarDias(alcanceNadaLido(CANAL, HOJE), { hoje: HOJE })
    const r = resumir(dias)
    expect(r.imp).toBeNull()
    const x = v({ resumo: r, periodo })
    expect(periodo).not.toBeNull()
    expect(x.frase).toBe(`Ainda não há dia medido: nenhum dos ${periodo!.dias} dias do período tem impressões ou cliques medidos.`)
    expect(x.recolhida).toContain('Ainda não há dia medido')
    expect(x.recolhida).not.toMatch(/\b0 impress|nenhuma impress/i)
    expect(x.recolhida).not.toMatch(/\d+ impressões/)
    expect(x.topVazio).toBe('Nenhum dia do período foi medido ainda, então nenhum vídeo aparece aqui.')
  })

  it('sem relatório nenhum: a frase do gráfico ("Ainda não há relatório de alcance deste canal."), sem número e sem "0"', () => {
    const { dias, periodo } = montarDias(alcanceVazio(CANAL), { hoje: HOJE })
    expect(periodo).toBeNull()
    const x = v({ resumo: resumir(dias), periodo })
    expect(x.frase).toBe(SEM_RELATORIO)
    expect(x.recolhida).toBe(`${SEM_RELATORIO} 14º de 14 canais de Viagem em inscritos.`)
    expect(x.topVazio).toBe('Sem relatório de alcance, não há vídeo para listar.')
  })

  it('todos os dias lidos em zero: "Nenhuma impressão em D dias lidos." (zero medido, dito como zero)', () => {
    const { dias, periodo } = montarDias(alcanceSoVazios(CANAL, HOJE, 10), { hoje: HOJE })
    const r = resumir(dias)
    expect(r).toMatchObject({ imp: 0, diasLidos: 10, diasComImpressao: 0 })
    const x = v({ resumo: r, periodo })
    expect(x.frase).toBe('Nenhuma impressão em 10 dias medidos.')
    expect(x.recolhida).toBe('Nenhuma impressão em 10 dias medidos. 14º de 14 canais de Viagem em inscritos.')
    expect(x.topVazio).toBe('Nenhum vídeo teve impressão nos 10 dias medidos.')
  })

  it('um dia lido em zero: singular; zero com dias não medidos diz que eles ficam fora da conta', () => {
    const um = v({ resumo: { imp: 0, cliques: 0, diasComImpressao: 0, diasLidos: 1, diasNaoMedidos: 0 }, periodo: { de: '2026-10-07', ate: '2026-10-07', dias: 1 } })
    expect(um.frase).toBe('Nenhuma impressão em 1 dia medido.')
    // o vazio do topo concorda também: "em 1 dia lido", nunca "no 1 dia lido"
    expect(um.topVazio).toBe('Nenhum vídeo teve impressão em 1 dia medido.')
    const buraco = v({ resumo: { imp: 0, cliques: 0, diasComImpressao: 0, diasLidos: 6, diasNaoMedidos: 2 }, periodo: { de: '2026-09-30', ate: '2026-10-07', dias: 8 } })
    expect(buraco.frase).toBe('Nenhuma impressão em 6 dias medidos. Os 2 dias sem relatório não entram na conta.')
    expect(buraco.topVazio).toBe('Nenhum vídeo teve impressão nos 6 dias medidos.')
  })

  it('série com buracos diz a base: "em 19 dos 29 dias", e o dia não medido não entra como zero', () => {
    const r = comImp(140, 3.2, { diasLidos: 19, diasNaoMedidos: 10 })
    const x = v({ resumo: r })
    expect(x.recolhida).toBe('140 impressões e 3 cliques estimados em 19 dos 29 dias. 14º de 14 canais de Viagem em inscritos.')
    expect(x.frase).toBe('Com 140 impressões em 19 dos 29 dias, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado.')
    // com a série cheia da fixture (19 lidos, 2 não medidos): a base é a lida, nunca o período inteiro
    const { dias, periodo } = montarDias(alcanceCheio(CANAL, ['yt1', 'yt2'], HOJE), { hoje: HOJE })
    const cheio = v({ resumo: resumir(dias), periodo })
    expect(cheio.recolhida).toContain('187 impressões e 24 cliques estimados em 19 dos 21 dias.')
  })

  it('série curta (2 dias lidos): o número aparece com a base escrita, sem virar média do período', () => {
    const { dias, periodo } = montarDias(alcanceCurto(CANAL, ['yt1'], HOJE), { hoje: HOJE })
    const r = resumir(dias)
    expect(r.diasLidos).toBe(2)
    const x = v({ resumo: r, periodo })
    expect(x.recolhida).toBe('9 impressões e 1 clique estimado em 2 dias. 14º de 14 canais de Viagem em inscritos.')
    expect(x.frase).toBe('Com 9 impressões em 2 dias, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado.')
    expect(x.frase).not.toMatch(/por dia|média/)
  })

  it('coleta parada: a recolhida diz "A coleta parou em dd/mm." (o caso comum dos canais do dono); recente, não diz', () => {
    const parada = v({ hoje: '2026-10-20' })   // 07/10 -> 20/10: 13 dias
    expect(parada.recolhida).toBe('140 impressões e 3 cliques estimados em 29 dias. A coleta parou em 07/10. 14º de 14 canais de Viagem em inscritos.')
    expect(v({ hoje: '2026-10-09' }).recolhida).not.toContain('parou')   // 2 dias
    expect(v({ hoje: '2026-10-14' }).recolhida).not.toContain('parou')   // 7 dias: o limite é "mais de 7"
    expect(v({ hoje: '2026-10-15' }).recolhida).toContain('A coleta parou em 07/10.')
    expect(v().recolhida).not.toContain('parou')   // o dia do último relatório é ontem
    // também no zero medido e no nada lido
    const { dias, periodo } = montarDias(alcanceSoVazios(CANAL, '2026-10-01', 10), { hoje: '2026-10-01' })
    expect(v({ resumo: resumir(dias), periodo, hoje: '2026-10-30' }).recolhida).toMatch(/Nenhuma impressão em 10 dias medidos\. A coleta parou em \d\d\/\d\d\./)
  })

  it('cliques: não medidos (CTR ausente), nenhum e "menos de 1" nunca viram um número falso', () => {
    expect(v({ resumo: comImp(140, null) }).recolhida).toBe('140 impressões em 29 dias; cliques estimados não medidos em algum dia. 14º de 14 canais de Viagem em inscritos.')
    expect(v({ resumo: comImp(140, 0) }).recolhida).toBe('140 impressões e nenhum clique estimado em 29 dias. 14º de 14 canais de Viagem em inscritos.')
    expect(v({ resumo: comImp(140, 0.3) }).recolhida).toBe('140 impressões e menos de 1 clique estimado em 29 dias. 14º de 14 canais de Viagem em inscritos.')
    expect(v({ resumo: comImp(1, 0) }).recolhida).toBe('1 impressão e nenhum clique estimado em 29 dias. 14º de 14 canais de Viagem em inscritos.')
    expect(v({ resumo: comImp(2500, 41.4) }).recolhida).toBe('2.500 impressões e 41 cliques estimados em 29 dias. 14º de 14 canais de Viagem em inscritos.')
  })

  it('a posição em inscritos: empate, sem posição, conjunto geral e sem posição calculada', () => {
    expect(v({ posicao: { ...POSICAO, inscritos: pos(3, 14, true) } }).recolhida).toBe('140 impressões e 3 cliques estimados em 29 dias. 3º de 14 canais de Viagem em inscritos (empate).')
    expect(v({ posicao: { ...POSICAO, inscritos: null } }).recolhida).toBe('140 impressões e 3 cliques estimados em 29 dias. Sem posição em inscritos.')
    expect(v({ posicao: { ...POSICAO, conjunto: { tipo: 'geral' }, inscritos: pos(7, 75) } }).recolhida).toBe('140 impressões e 3 cliques estimados em 29 dias. 7º de 75 canais no geral em inscritos.')
    // posição não calculada: a linha não inventa uma
    expect(v({ posicao: null, posicaoItens: null }).recolhida).toBe('140 impressões e 3 cliques estimados em 29 dias.')
  })

  it('sem permissão: nada do dado privado na view, mesmo com o resumo e os vídeos na mão; a posição (dado público) fica', () => {
    const porVideo = new Map([['yt1', { imp: 90, cliques: 9, diasComImpressao: 4 }]])
    const x = v({ acesso: 'negado', porVideo })
    expect(x.frase).toBe(SEM_PERMISSAO)
    expect(x.recolhida).toBe('Só quem edita o site vê as impressões e os cliques. 14º de 14 canais de Viagem em inscritos.')
    expect(x.top).toEqual([])
    expect(x.topVazio).toBe('Só quem edita o site vê os vídeos que mais apareceram.')
    expect(x.topNota).toBeNull()
    const json = JSON.stringify(x)
    for (const privado of ['140', '90 impress', 'Vídeo 1', 'yt1', '3 cliques', 'dias lidos']) expect(json).not.toContain(privado)
    // igual a ter chamado sem nenhum dado
    expect(JSON.stringify(v({ acesso: 'negado' }))).toBe(json)
  })

  it('leitura que falhou: a frase diz que falhou, nunca "sem relatório" nem número', () => {
    const x = v({ acesso: 'erro', porVideo: new Map([['yt1', { imp: 90, cliques: 9, diasComImpressao: 4 }]]) })
    expect(x.frase).toBe('A leitura do alcance falhou agora; recarregue a página.')
    expect(x.recolhida).toBe('A leitura do alcance falhou agora; recarregue a página. 14º de 14 canais de Viagem em inscritos.')
    expect(x.top).toEqual([])
    expect(x.topVazio).toBe('A leitura do alcance falhou agora; recarregue a página.')
    expect(x.recolhida).not.toContain('Ainda não há relatório')
    expect(JSON.stringify(x)).not.toContain('140')
  })
})

describe('T10 "Vídeos que mais apareceram"', () => {
  const mapa = (...e: Array<[string, number, number | null, number]>) => new Map<string, AlcanceVideo>(e.map(([id, imp, cliques, dias]) => [id, { imp, cliques, diasComImpressao: dias }]))

  it('os 5 com mais impressões, com cliques e dias; ordem por impressões, depois cliques', () => {
    const porVideo = mapa(['yt1', 18, 2.1, 6], ['yt2', 71, 9.4, 9], ['yt3', 18, 4.4, 3], ['yt4', 5, 0, 2], ['yt5', 40, 0.4, 5], ['yt6', 9, 1, 4], ['yt7', 2, 0, 1])
    const x = v({ porVideo })
    expect(x.top.map(t => t.id)).toEqual(['v2', 'v5', 'v3', 'v1', 'v6'])
    expect(x.top.map(t => t.titulo)).toEqual(['Vídeo 2', 'Vídeo 5', 'Vídeo 3', 'Vídeo 1', 'Vídeo 6'])
    expect(x.top[0]).toMatchObject({ imp: '71 impressões', cliques: '9 cliques estimados', dias: 'em 9 dias com impressão' })
    expect(x.top[1]).toMatchObject({ imp: '40 impressões', cliques: 'menos de 1 clique estimado' })
    expect(x.top[3]).toMatchObject({ id: 'v1', imp: '18 impressões', cliques: '2 cliques estimados', dias: 'em 6 dias com impressão' })
    expect(x.topVazio).toBeNull()
    // cada um abre a tela do vídeo, na ordem da lista, voltando ao canal com a seção aberta; o back leva o marcador do top (T13.0 H1: o paginador diz a ordem verdadeira)
    const ids = x.top.map(t => t.id)
    x.top.forEach((t, i) => expect(t.href).toBe(link.historico(t.id, { from: 'canais', canal: CANAL, back: BACK_DO_TOP_IMP, ids, pos: i + 1, tot: 5 })))
    expect(BACK_DO_TOP_IMP).toMatch(/^\?painel=1&/)   // continua abrindo a seção
    expect(x.top[0]!.thumb).toBe('https://i.ytimg.com/vi/yt2/mqdefault.jpg')
  })

  it('menos de 5 mostra os que há; um dia no singular; nenhum clique e cliques não medidos têm frases próprias', () => {
    const x = v({ porVideo: mapa(['yt1', 1, 0, 1], ['yt2', 3, null, 2]) })
    expect(x.top).toHaveLength(2)
    expect(x.top[0]).toMatchObject({ id: 'v2', imp: '3 impressões', cliques: 'cliques não medidos', dias: 'em 2 dias com impressão' })
    expect(x.top[1]).toMatchObject({ id: 'v1', imp: '1 impressão', cliques: 'nenhum clique', dias: 'em 1 dia com impressão' })
    expect(x.top[1]!.href).toContain('pos=2')
    expect(x.top[1]!.href).toContain('tot=2')
  })

  it('empate total: a ordem é estável (pelo título, depois pelo id), nunca a do mapa', () => {
    const a = v({ porVideo: mapa(['yt3', 5, 1, 2], ['yt1', 5, 1, 2], ['yt2', 5, 1, 2]) })
    const b = v({ porVideo: mapa(['yt2', 5, 1, 2], ['yt3', 5, 1, 2], ['yt1', 5, 1, 2]) })
    expect(a.top.map(t => t.id)).toEqual(['v1', 'v2', 'v3'])
    expect(b.top.map(t => t.id)).toEqual(['v1', 'v2', 'v3'])
  })

  it('nenhum vídeo com impressão: a frase, sem lista e sem "0"', () => {
    const x = v({ porVideo: VAZIO })
    expect(x.top).toEqual([])
    expect(x.topVazio).toBe('Nenhum vídeo com impressão no período lido.')
  })

  it('vídeo com impressões que não está entre os guardados do canal não tem cartão: fica fora da lista e a nota diz o fato e quantos (sem afirmar a causa)', () => {
    const x = v({ porVideo: mapa(['yt-fora1', 500, 5, 3], ['yt-fora2', 20, 1, 1], ['yt1', 10, 1, 2]) })
    expect(x.top.map(t => t.id)).toEqual(['v1'])
    expect(x.topNota).toBe('2 vídeos com impressões no relatório não estão na lista de vídeos deste canal.')
    expect(v({ porVideo: mapa(['yt-fora1', 500, 5, 3], ['yt1', 10, 1, 2]) }).topNota).toBe('1 vídeo com impressões no relatório não está na lista de vídeos deste canal.')
    // só vídeos de fora: a frase de vazio não finge que o canal não teve impressão
    const so = v({ porVideo: mapa(['yt-fora1', 500, 5, 3]) })
    expect(so.top).toEqual([])
    // T13.0 H10: a frase é a da função única, com o singular de 1 (antes era um literal escrito à mão, sempre no plural)
    expect(so.topVazio).toBe(foraDosGuardadosFrase(1, v => String(v)))
    expect(so.topVazio).toBe('1 vídeo com impressões no relatório não está na lista de vídeos deste canal.')
    const tres = v({ porVideo: mapa(['yt-fora1', 500, 5, 3], ['yt-fora2', 20, 1, 1], ['yt-fora3', 7, 0, 1]) })
    expect(tres.topVazio).toBe(foraDosGuardadosFrase(3, v => String(v)))
    expect(tres.topVazio).toBe('3 vídeos com impressões no relatório não estão na lista de vídeos deste canal.')
    // nenhuma das frases afirma POR QUE o vídeo não está guardado (apagado? privado? só não sincronizado?)
    for (const t of [x.topNota!, so.topVazio ?? '']) expect(t).not.toMatch(/saíram|saiu|apagad|privad/)
  })

  it('canal sem nenhum vídeo guardado: a frase diz isso', () => {
    const x = v({ videos: [], porVideo: VAZIO })
    expect(x.top).toEqual([])
    expect(x.topVazio).toBe('Este canal não tem vídeos guardados.')
  })

  it('título vazio vira "vídeo sem título" (nunca um link sem nome)', () => {
    const x = v({ videos: [{ id: 'v1', ytId: 'yt1', title: '   ', thumb: null }], porVideo: mapa(['yt1', 4, 0, 1]) })
    expect(x.top[0]!.titulo).toBe('Vídeo sem título')
    expect(x.top[0]!.thumb).toBeNull()
  })
})

describe('T10 "No nicho"', () => {
  it('as posições vêm da linha do cabeçalho (uma fonte só); só o item com lista ordenada é link', () => {
    const n = v().noNicho!
    expect(n.intro).toBe('Entre 14 canais de Viagem:')
    expect(n.linhas.map(l => l.texto)).toEqual(ITENS.itens.map(i => i.texto))
    expect(n.linhas.map(l => l.href)).toEqual([ITENS.itens[0]!.href, null, null, null])
    expect(n.listaHref).toBe(link.canais({ niche: 'viagem' }))
  })

  it('item sem posição não é link (o cabeçalho já entrega href nulo)', () => {
    const semPos: PosicaoItens = { intro: 'Sem posição calculada em Viagem:', itens: ITENS.itens.map(i => ({ ...i, href: null })) }
    expect(v({ posicaoItens: semPos }).noNicho!.linhas.every(l => l.href === null)).toBe(true)
  })

  it('sem posição calculada o bloco não existe (nem o formulário)', () => {
    expect(v({ posicao: null, posicaoItens: null }).noNicho).toBeNull()
  })

  it('o formulário: GET para a comparação, o concorrente logo acima primeiro e dito; sem concorrente não existe', () => {
    const n = v().noNicho!
    expect(n.acao).toBe(link.comparar())
    expect(n.opcoes).toEqual([{ id: 'c1', name: 'Rota Livre (logo acima de você)' }, { id: 'c2', name: 'Mala Pronta' }])
    const sem = v({ concorrentes: [] }).noNicho!
    expect(sem.opcoes).toEqual([])
    expect(sem.linhas).toHaveLength(4)   // as posições continuam: só o formulário some
    // ninguém acima: o primeiro não leva o "logo acima de você" (seria falso)
    expect(v({ concorrentes: [{ id: 'c2', name: 'Mala Pronta' }] }).noNicho!.opcoes).toEqual([{ id: 'c2', name: 'Mala Pronta' }])
  })

  it('o conjunto geral aponta a lista de Canais sem nicho', () => {
    const x = v({ posicao: { ...POSICAO, conjunto: { tipo: 'geral' } } })
    expect(x.noNicho!.listaHref).toBe(link.canais({ niche: 'todos' }))
  })
})

describe('T10 "O que ainda não é medido"', () => {
  it('13.3: só a curva de retenção e a origem do tráfego (views por dia e % assistido já têm desenho)', () => {
    expect(v().naoMedido).toEqual([
      { rotulo: 'Curva de retenção', texto: 'ainda não é coletada.' },
      { rotulo: 'Origem do tráfego', texto: 'ainda não aparece aqui.' },
    ])
  })

  it('é o mesmo com ou sem permissão (não depende do dado privado)', () => {
    expect(v({ acesso: 'negado' }).naoMedido).toEqual(v().naoMedido)
  })
})

describe('T10 nenhum texto da seção usa palavra interna', () => {
  const INTERNAS = /\b(L2|L3|lote|pack|pacote|dataset|motor|diário|day_pt|Reporting|Analytics API|escala √)\b/i
  const cenarios: Array<[string, ComoEstaView]> = [
    ['cheio', v({ porVideo: new Map([['yt1', { imp: 18, cliques: 2, diasComImpressao: 3 }]]) })],
    ['negado', v({ acesso: 'negado' })], ['erro', v({ acesso: 'erro' })],
    ['sem relatório', v({ resumo: { imp: null, cliques: null, diasComImpressao: 0, diasLidos: 0, diasNaoMedidos: 0 }, periodo: null })],
    ['parado', v({ hoje: '2026-12-01' })], ['sem posição', v({ posicao: null, posicaoItens: null })],
  ]
  for (const [nome, x] of cenarios) {
    it(`cenário ${nome}`, () => {
      const textos = JSON.stringify(x, (k, val) => (k === 'href' || k === 'thumb' || k === 'acao' || k === 'listaHref' ? undefined : val))
      expect(textos).not.toMatch(INTERNAS)
    })
  }
})

describe('T10 concorrentesDoSite: as opções do formulário, com o mesmo critério do botão "Comparar com…"', () => {
  const w = proprioWorld()

  it('só concorrentes do conjunto da posição; o logo acima em inscritos primeiro, os outros por inscritos', () => {
    const { concorrenteAcima } = posicaoDoSite(w.obs, w.canalId)
    const ops = concorrentesDoSite(w.obs, w.canalId)
    expect(ops.length).toBeGreaterThan(1)
    expect(ops.every(o => !w.obs.channel(o.id)!.own)).toBe(true)
    expect(ops.some(o => o.id === w.canalId)).toBe(false)
    expect(concorrenteAcima).not.toBeNull()
    expect(ops[0]).toMatchObject({ id: concorrenteAcima!.id, name: concorrenteAcima!.name, acima: concorrenteAcima!.acima })
    // depois do primeiro: inscritos em ordem decrescente
    const subs = ops.slice(1).map(o => w.obs.channel(o.id)!.subs)
    for (let i = 1; i < subs.length; i++) expect(subs[i - 1]! >= (subs[i] ?? -1)).toBe(true)
    // só o primeiro pode levar a marca
    expect(ops.slice(1).every(o => !o.acima)).toBe(true)
  })

  it('canal que não é próprio ou não existe: lista vazia', () => {
    const concorrente = w.obs.channels.find(c => !c.own)!
    expect(concorrentesDoSite(w.obs, concorrente.id)).toEqual([])
    expect(concorrentesDoSite(w.obs, 'nao-existe')).toEqual([])
  })
})

describe('T10 montarComoEsta: a seção e o gráfico saem do mesmo dado, pela mesma regra', () => {
  const w = proprioWorld()
  const { posicao } = posicaoDoSite(w.obs, w.canalId)
  const header = buildProprioHeader(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm, posicao, muitosProprios: false })!
  const videos = w.obs.videos.filter(x => x.ch === w.canalId).map(x => ({ id: x.id, ytId: x.ytId, title: x.title, thumb: null }))
  const monta = (dados = w.dados, hoje = w.hoje) => montarComoEsta({
    dados, hoje, dm: w.dm, posicao, posicaoItens: header.posicaoItens, videos, concorrentes: concorrentesDoSite(w.obs, w.canalId), canalId: w.canalId,
  })

  it('série cheia: os números da seção batem com a soma do gráfico e com o alcance por vídeo da fixture', () => {
    const { view, grafico } = monta()
    expect(view.recolhida).toContain('187 impressões e 24 cliques estimados em 19 dos 21 dias.')
    expect(grafico.colunas).toHaveLength(21)
    expect(grafico.escopo).toBe('canal')
    expect(grafico.alturaArea).toBe(180)
    expect(grafico.vazio).toBeNull()
    // a fixture dá 11 dias com impressão para os 2 vídeos acompanhados; o 1º tem 12 por dia (132) e o 2º, 5 por dia (55)
    expect(view.top.map(t => t.imp)).toEqual(['132 impressões', '55 impressões'])
    const porVideo = alcancePorVideo((w.dados.alcance as { dado: Parameters<typeof alcancePorVideo>[0] }).dado)
    expect([...porVideo.values()].reduce((s, x) => s + x.imp, 0)).toBe(187)
  })

  it('sem permissão: o gráfico diz a frase de permissão e não traz coluna, e a seção nada privado', () => {
    const { view, grafico } = monta({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } })
    expect(grafico.vazio).toBe(SEM_PERMISSAO)
    expect(grafico.colunas).toEqual([])
    expect(view.frase).toBe(SEM_PERMISSAO)
    expect(view.top).toEqual([])
  })

  it('leitura que falhou: gráfico e seção dizem que falhou (nunca "sem relatório")', () => {
    const { view, grafico } = monta({ alcance: { acesso: 'erro' }, diario: { acesso: 'erro' } })
    expect(grafico.vazio).toBe('A leitura do alcance falhou agora; recarregue a página.')
    expect(grafico.colunas).toEqual([])
    expect(view.frase).toBe('A leitura do alcance falhou agora; recarregue a página.')
  })

  it('tabela vazia (banco local): "Ainda não há relatório de alcance deste canal." nas duas, sem número', () => {
    const { view, grafico } = monta({ alcance: { acesso: 'ok', dado: alcanceVazio(w.canalId) }, diario: w.dados.diario })
    expect(grafico.vazio).toBe(SEM_RELATORIO)
    expect(view.frase).toBe(SEM_RELATORIO)
    expect(view.top).toEqual([])
  })

  it('coleta parada: o gráfico e a seção dizem a mesma data', () => {
    const { view, grafico } = monta(w.dados, '2026-12-30')
    const dia = view.recolhida.match(/A coleta parou em (\d\d\/\d\d)\./)
    expect(dia).not.toBeNull()
    expect(grafico.avisos.join(' ')).toContain(`parou em ${dia![1]}`)
  })
})
