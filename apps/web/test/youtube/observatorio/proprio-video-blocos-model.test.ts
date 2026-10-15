// @vitest-environment node
// A4 13.4: o modelo dos blocos da tela do VÍDEO próprio (views por dia, impressões e cliques, taxa de clique, % assistido, retenção, "Este vídeo no
// canal", forja, "o que ainda não há"). Puro: recebe o dado privado JÁ LIDO. Cada estado de dado ausente tem a sua frase e nunca vira zero; com
// `negado` nenhum número privado entra no modelo (a regra 6 do brief).
import type { DiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/diario-periodo'
import { detalhe as detalheFx, entrada as entradaFx, per as perFx } from './proprio-origem-fixture'
import { buildOrigem } from '@/app/cms/(authed)/youtube/competitors/_proprio/origem-model'
import { ateDaOrigem, contagensDeCobertura, janelaDaOrigemDoVideo, nivelDaOrigem, periodosDaOrigemDoVideo } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { afterEach, describe, it, expect } from 'vitest'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { buildAssistidoDoVideo, buildVideoBlocos, fraseVeredito, type EntradaBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { DadosDoVideo, DiarioLongo } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { DiarioCanal, DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { DiarioDoPeriodo, DiarioPeriodoLinha } from '@/lib/youtube/observatorio/proprio/diario-periodo'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { mundoVideo, temSentinela, TEXTOS_PRIVADOS, type MundoVideo } from './proprio-video-fixture'

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))

const dadoDe = (w: MundoVideo): DadosDoVideo => {
  const { alcance, diario } = w.dados
  if (alcance.acesso !== 'ok' || diario.acesso !== 'ok') throw new Error('a fixture esperava dado lido')
  return { alcance: alcance.dado, diario: diario.dado }
}
const ok = (w: MundoVideo, troca: Partial<DadosDoVideo> = {}): Privado<DadosDoVideo> => ({ acesso: 'ok', dado: { ...dadoDe(w), ...troca } })
const entrada = (w: MundoVideo, dados: Privado<DadosDoVideo> = ok(w), id = w.foco.id): EntradaBlocos => ({ obs: w.obs, videoId: id, dados, hoje: w.hoje, dm: dmDia })
const blocos = (w: MundoVideo, dados?: Privado<DadosDoVideo>, id?: string) => buildVideoBlocos(entrada(w, dados, id))

/** Todos os longos do canal na faixa de 5 a 15 min (uma faixa só para o "normal"), com o foco em 600 s. */
const umaFaixa = (ds: Dataset) => { for (const v of ds.videos) if (v.fmt === 'long') v.dur = 600 }
/** O vídeo mais novo (2 dias de vida) publicado ontem: o "vídeo novo". */
const W = mundoVideo({ mut: umaFaixa })
const novoId = W.obs.videos.filter(v => v.ch === W.canalId).sort((a, b) => b.pub - a.pub)[0]!.id

describe('views por dia', () => {
  it('com dado: a frase de relance (total, dias medidos, por dia, melhor dia, dias sem medida) e o gráfico no escopo "views", sem faixa de cliques e com o dia da publicação', () => {
    const b = blocos(W).views!
    expect(b.medido).toBe(true)
    expect(b.frase).toMatch(/^24\.680 views em 20 dias medidos \(1\.234 por dia\)\. O melhor dia foi \d\d\/\d\d, com 1\.234\. 8 dias sem medida\.$/)
    const g = b.grafico!
    expect(g).toMatchObject({ unidade: 'views', escopo: 'video', faixaCliques: false })
    expect(g.colunas).toHaveLength(28)
    expect(g.colunas.filter(c => c.situacao === 'nao-medido')).toHaveLength(8)
    expect(g.colunas.filter(c => c.situacao === 'com-impressoes')).toHaveLength(20)
    expect(g.resumo).toBe(b.frase)
  })

  it('concordância: um único dia medido diz "em 1 dia medido" (zero ou não), nunca "no 1 dia medido"', () => {
    const zero = blocos(mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 0, diasFoco: 1 } })).views!
    expect(zero.frase).toMatch(/^Nenhuma view em 1 dia medido(, e \d+ dias sem medida)?\. É zero medido: o YouTube entregou os dias e ninguém viu\.$/)
    expect(zero.frase).not.toMatch(/\bno 1 /)
    const com = blocos(mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 5, diasFoco: 1 } })).views!
    expect(com.frase).toMatch(/^5 views em 1 dia medido \(5,0 por dia\)\./)
  })

  it('zero medido × não medido: os dias com linha de 0 views são "zero medido" (caixa vazada) e os sem linha são "não medido" (hachura); a frase de tudo zero diz que ninguém viu', () => {
    const w = mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 0 } })
    const b = blocos(w).views!
    expect(b.frase).toBe('Nenhuma view nos 20 dias medidos, e 8 dias sem medida. É zero medido: o YouTube entregou os dias e ninguém viu.')
    const g = b.grafico!
    expect(g.colunas.filter(c => c.situacao === 'zero-medido')).toHaveLength(20)
    expect(g.colunas.filter(c => c.situacao === 'nao-medido')).toHaveLength(8)
    expect(g.colunas.find(c => c.situacao === 'zero-medido')!.imp).toBe('0')
    expect(g.colunas.find(c => c.situacao === 'nao-medido')!.imp).toBeNull()
  })

  it('vídeo novo (menos de 3 dias): frase própria e nenhum gráfico', () => {
    const b = blocos(W, ok(W), novoId).views!
    expect(b).toMatchObject({ medido: false, grafico: null })
    expect(b.frase).toBe('Vídeo novo: o YouTube entrega as views de cada dia com 2 a 3 dias de atraso, então com menos de 3 dias de vida ainda não há dia fechado.')
  })

  it('coleta que não rodou (sem diário): frase própria, nenhum gráfico, nenhum zero', () => {
    const vazio = ok(W, { diario: { canalId: W.canalId, ultimoDia: null, linhas: [], descartados: 0 } })
    const b = blocos(W, vazio).views!
    expect(b).toMatchObject({ medido: false, grafico: null, frase: 'A coleta diária de views ainda não rodou para este canal. Nenhum dia é zero: falta medir.' })
  })

  it('o diário tem dias do canal mas nenhum deste vídeo: "sem dia medido", nunca zero', () => {
    const w = mundoVideo({ mut: umaFaixa, diario: { diasFoco: 0 } })
    const b = blocos(w).views!
    expect(b).toMatchObject({ medido: false, grafico: null })
    expect(b.frase).toMatch(/nenhum dia medido/i)
    expect(b.frase).not.toMatch(/\b0 views\b/)
  })
})

describe('impressões e cliques', () => {
  it('o gráfico é do escopo "video": o dia medido em que o relatório não trouxe o vídeo é zero medido, com a dica do motivo; a faixa de cliques existe', () => {
    const g = blocos(W).impressoes!.grafico!
    expect(g).toMatchObject({ escopo: 'video', unidade: 'impressoes', faixaCliques: true })
    expect(g.colunas).toHaveLength(19)
    const zero = g.colunas.find(c => c.situacao === 'zero-medido')!
    expect(zero.dica).toMatch(/o relatório do dia não trouxe este vídeo/)
    expect(g.colunas.filter(c => c.situacao === 'com-impressoes')).toHaveLength(1)
    expect(g.resumo).toBe('7.919 impressões e 1.584 cliques estimados em 19 dias: 1 dia com impressão e 18 sem impressão.')
  })

  it('abaixo de 100 impressões a frase acrescenta "É pouco para dizer se a capa funciona: leia como contagem."; de 100 em diante, não', () => {
    const poucas = blocos(mundoVideo({ mut: umaFaixa, alcance: { impFoco: 99, ctrFoco: 0.1 } })).impressoes!.grafico!.resumo!
    expect(poucas).toMatch(/ É pouco para dizer se a capa funciona: leia como contagem\.$/)
    expect(blocos(mundoVideo({ mut: umaFaixa, alcance: { impFoco: 100, ctrFoco: 0.1 } })).impressoes!.grafico!.resumo!).not.toMatch(/É pouco/)
    expect(blocos(W).impressoes!.grafico!.resumo!).not.toMatch(/É pouco/)
  })

  it('sem nenhum relatório: frase de não medido e nenhum gráfico nem taxa', () => {
    const vazio = ok(W, { alcance: { canalId: W.canalId, relatorios: [], linhas: [], ultimoRelatorio: null, descartados: 0 } })
    const b = blocos(W, vazio).impressoes!
    expect(b).toMatchObject({ medido: false, grafico: null, taxa: null })
    expect(b.frase).toBe('Ainda não há relatório de alcance deste canal.')
  })
})

/** O vídeo mais novo do canal passa a ter `dias` de vida (publicado há `dias` dias) e UMA linha de alcance por dia a partir da publicação (nunca antes). */
function comVidaDe(dias: number) {
  const DIA = 86_400_000
  let alvo = ''
  const w = mundoVideo({ mut: ds => {
    umaFaixa(ds)
    const dono = ds.channels.find(c => c.own)!.id
    const novo = ds.videos.filter(v => v.ch === dono).sort((a, b) => b.pub - a.pub)[0]!
    alvo = novo.id
    novo.pub = ds.now - dias * DIA
    novo.ageDays = dias
  } })
  const v = w.obs.videos.find(x => x.id === alvo)!
  const a = dadoDe(w).alcance
  const linhas = [...a.linhas]
  for (let n = dias; n >= 3; n--) linhas.push({ ytId: v.ytId, dia: addDays(w.hoje, -n), imp: 400, ctr: 0.05 })
  return { w, id: v.id, dados: ok(w, { alcance: { ...a, linhas } }) }
}

describe('impressões de vídeo recente: o dia anterior à publicação não existe (I1)', () => {
  it('vídeo de 1 dia (tela A): a faixa de 7 casas no lugar do gráfico, "Vídeo novo", nenhuma taxa e nenhuma casa em "zero medido"', () => {
    const { w, id, dados } = comVidaDe(1)
    const b = blocos(w, dados, id).impressoes!
    expect(b).toMatchObject({ medido: true, frase: null, taxa: null, semTaxa: null })
    const c = b.grafico!.cedo!
    expect(c.tipo).toBe('video-novo')
    expect(c.casas).toHaveLength(7)
    expect(c.casas.some(x => x.estado === 'zero-medido')).toBe(false)
    expect(c.frase).toMatch(/^Vídeo novo\. Publicado há 1 dia\. O YouTube entrega as impressões de cada dia 2 a 3 dias depois\. O gráfico volta .* \(faltam 5 dias\)/)
    expect(b.grafico!.colunas).toHaveLength(0)
  })

  it('vídeo de 1 dia com a coleta parada há 40 dias: a frase "parou em dd/mm", nenhum gráfico nem casa (a coleta do canal vem antes da faixa)', () => {
    const { w, id, dados } = comVidaDe(1)
    const parou = addDays(w.hoje, -40)
    const parada = ok(w, { alcance: { ...dadoDe(w).alcance, relatorios: [], linhas: [], ultimoRelatorio: parou } })
    const b = blocos(w, parada, id).impressoes!
    expect(b).toMatchObject({ medido: false, grafico: null, taxa: null, semTaxa: null })
    expect(b.frase).toContain(`parou em ${dmDia(parou)}`)
    // o par: o mesmo vídeo com relatórios em dia mostra a faixa
    expect(blocos(w, dados, id).impressoes!.grafico!.cedo).toMatchObject({ tipo: 'video-novo' })
  })

  it('vídeo de 2 dias (o "vídeo novo" da fixture): a mesma faixa (publicado ontem: faltam 5 dias)', () => {
    const b = blocos(W, ok(W), novoId).impressoes!
    expect(b).toMatchObject({ medido: true, frase: null })
    expect(b.grafico!.cedo).toMatchObject({ tipo: 'video-novo' })
    expect(b.grafico!.cedo!.frase).toContain('faltam 5 dias')
  })

  it('vídeo de 3 dias: um dia só no gráfico (o da publicação), o resto não existe; 400 impressões, 20 cliques', () => {
    const { w, id, dados } = comVidaDe(3)
    const b = blocos(w, dados, id).impressoes!
    expect(b.medido).toBe(true)
    const g = b.grafico!
    expect(g.colunas).toHaveLength(1)
    expect(g.colunas[0]!.situacao).toBe('com-impressoes')
    expect(g.resumo).toBe('400 impressões e 20 cliques estimados em 1 dia: 1 dia com impressão.')
    expect(g.periodoTexto).toMatch(/^de \d\d\/\d\d a \d\d\/\d\d · 1 dia/)
    expect(g.periodoTexto).toBe(`de ${dmDia(addDays(w.hoje, -3))} a ${dmDia(addDays(w.hoje, -3))} · 1 dia · dia do YouTube`)
  })

  it('vídeo de 5 dias: só os 3 dias desde a publicação (hoje-5 a hoje-3), nunca os 14 dias antes dele como "zero medido"', () => {
    const { w, id, dados } = comVidaDe(5)
    const g = blocos(w, dados, id).impressoes!.grafico!
    expect(g.colunas).toHaveLength(3)
    expect(g.colunas.every(c => c.situacao === 'com-impressoes')).toBe(true)
    expect(g.resumo).toBe('1.200 impressões e 60 cliques estimados em 3 dias medidos: impressão em todos.')
    expect(g.periodoTexto).toContain(`de ${dmDia(addDays(w.hoje, -5))} a ${dmDia(addDays(w.hoje, -3))} · 3 dias`)
    expect(g.legenda.map(l => l.situacao)).toContain('publicacao')
  })

  it('vídeo de 5 dias sem nenhuma impressão (tela A): "ainda cedo", a faixa com os 3 dias medidos em zero, a frase cita as views e a taxa não existe', () => {
    const { w, id } = comVidaDe(5)
    const v = w.obs.videos.find(x => x.id === id)!
    const sem = ok(w, { alcance: { ...dadoDe(w).alcance, linhas: dadoDe(w).alcance.linhas.filter(l => l.ytId !== v.ytId) } })
    const b = blocos(w, sem, id).impressoes!
    const c = b.grafico!.cedo!
    expect(c.tipo).toBe('ainda-cedo')
    expect(c.casas.filter(x => x.estado === 'zero-medido')).toHaveLength(3)
    expect(c.frase).toMatch(/^Ainda cedo para ler as impressões\. 3 dias medidos, todos com 0; /)
    expect(c.frase).toContain(`o vídeo já teve ${w.obs.fmt.int(v.views ?? 0)} views`)
    expect(b.taxa).toBeNull()
  })

  it('vídeo de 5 dias com impressão em algum dia: volta o gráfico (a faixa só vale com todos os dias medidos em 0)', () => {
    const { w, id, dados } = comVidaDe(5)
    expect(blocos(w, dados, id).impressoes!.grafico!.cedo).toBeNull()
  })

  it('vídeo de 7 dias com todos os dias medidos em 0 (tela A, dia 7): o gráfico volta só com a linha do 0, sem a faixa dos cliques, e o resumo cita as views', () => {
    const { w, id } = comVidaDe(7)
    const v = w.obs.videos.find(x => x.id === id)!
    const a0 = dadoDe(w).alcance
    const linhas = a0.linhas.filter(l => l.ytId !== v.ytId)
    const b = blocos(w, ok(w, { alcance: { ...a0, linhas } }), id).impressoes!
    const g = b.grafico!
    expect(g.cedo).toBeNull()
    expect(g).toMatchObject({ soZeros: true, faixaCliques: false, ticks: [0] })
    expect(g.resumo).toMatch(/^Nenhuma impressão nos \d+ dias medidos, mas o vídeo teve .* views\. O relatório de alcance do YouTube pode estar incompleto/)
    expect(b.taxa).toBeNull()
  })

  it('vídeo de 30 dias: nada muda, o período inteiro de 19 relatórios', () => {
    const { w, id, dados } = comVidaDe(30)
    const g = blocos(w, dados, id).impressoes!.grafico!
    expect(g.colunas).toHaveLength(19)
    expect(g.colunas.filter(c => c.situacao === 'com-impressoes')).toHaveLength(19)
  })
})

describe('taxa de clique deste vídeo', () => {
  it('caso cheio: "X% das impressões viraram clique (k de n)", o intervalo e o veredito "acima da taxa do canal… mesmo contando a incerteza"; a faixa do canal por baixo da do vídeo', () => {
    const t = blocos(W).impressoes!.taxa!
    const frase = t.partes.map(p => p.t).join('')
    expect(frase).toMatch(/^20,0% das impressões viraram clique \(1\.584 de 7\.919\)\. A taxa real fica entre 19,\d% e 20,\d%\. Fica acima da taxa do canal \(\d+,\d% a \d+,\d%\), mesmo contando a incerteza\.$/)
    expect(t.partes.filter(p => p.b).map(p => p.t)[0]).toBe('20,0%')
    expect(t.faixa.linhas.map(l => [l.rotulo, l.classe, l.nota])).toEqual([['O canal inteiro', 'ref', null], ['Este vídeo', 'proprio', null]])
    expect(t.inconclusiva).toBe(false)
    expect(t.metodo.join(' ')).toMatch(/intervalo de 95%/)
  })

  it('caso magro (2 de 18): 3,1% a 32,8%, "Pode ser igual", faixa do vídeo tracejada com a nota "faixa tracejada: ainda não conclui"', () => {
    const t = blocos(mundoVideo({ mut: umaFaixa, alcance: { impFoco: 18, ctrFoco: 2 / 18 } })).impressoes!.taxa!
    const frase = t.partes.map(p => p.t).join('')
    expect(frase).toMatch(/^11,1% das impressões viraram clique \(2 de 18\)\. A taxa real fica entre 3,1% e 32,8%\. Pode ser igual à taxa do canal \(.+\): com este volume, não dá para dizer que a capa funciona melhor ou pior\.$/)
    expect(t.inconclusiva).toBe(true)
    const meu = t.faixa.linhas.find(l => l.rotulo === 'Este vídeo')!
    expect(meu).toMatchObject({ classe: 'inc', nota: 'faixa tracejada: ainda não conclui', loTxt: '3,1%', hiTxt: '32,8%' })
  })

  it('a frase do veredito: acima/abaixo, "um pouco" quando as faixas quase se tocam, "pode ser igual"; sem a taxa do canal não há frase', () => {
    const c = '4,3% a 5,8%'
    expect(fraseVeredito({ direcao: 'acima', quaseSeTocam: false, inconclusivo: false }, c)).toBe('Fica acima da taxa do canal (4,3% a 5,8%), mesmo contando a incerteza.')
    expect(fraseVeredito({ direcao: 'abaixo', quaseSeTocam: false, inconclusivo: false }, c)).toBe('Fica abaixo da taxa do canal (4,3% a 5,8%), mesmo contando a incerteza.')
    expect(fraseVeredito({ direcao: 'acima', quaseSeTocam: true, inconclusivo: false }, c)).toBe('Fica um pouco acima da taxa do canal (4,3% a 5,8%): as duas faixas quase se tocam, então a diferença é pequena.')
    expect(fraseVeredito({ direcao: 'abaixo', quaseSeTocam: true, inconclusivo: false }, c)).toBe('Fica um pouco abaixo da taxa do canal (4,3% a 5,8%): as duas faixas quase se tocam, então a diferença é pequena.')
    expect(fraseVeredito({ direcao: 'igual', quaseSeTocam: false, inconclusivo: true }, c)).toBe('Pode ser igual à taxa do canal (4,3% a 5,8%): com este volume, não dá para dizer que a capa funciona melhor ou pior.')
    expect(fraseVeredito({ direcao: null, quaseSeTocam: false, inconclusivo: false }, c)).toBeNull()
  })

  it('nenhuma frase diz que a capa é boa ou ruim; nenhuma classe de direção (verde/âmbar) no bloco', () => {
    for (const w of [W, mundoVideo({ mut: umaFaixa, alcance: { impFoco: 18, ctrFoco: 2 / 18 } }), mundoVideo({ mut: umaFaixa, alcance: { impFoco: 100000, ctrFoco: 0.01 } })]) {
      const t = blocos(w).impressoes!.taxa!
      const texto = t.partes.map(p => p.t).join(' ') + ' ' + t.metodo.join(' ') + ' ' + t.faixa.alt
      expect(texto).not.toMatch(/capa (boa|ruim)|funciona bem|funciona mal|ganhou|perdeu/i)
      expect(JSON.stringify(t)).not.toMatch(/dir-up|dir-dn|dir-eq/)
    }
  })

  it('sem impressões do vídeo no período: o bloco da taxa não existe (e o gráfico fica, com zeros medidos)', () => {
    const w = mundoVideo({ mut: umaFaixa, alcance: { impFoco: 0 } })
    const b = blocos(w).impressoes!
    expect(b.taxa).toBeNull()
    expect(b.grafico!.colunas.every(c => c.situacao === 'zero-medido')).toBe(true)
  })

  it('CTR nulo em algum dia com impressão: a taxa é "não medida", nunca 0%', () => {
    const b = blocos(mundoVideo({ mut: umaFaixa, alcance: { impFoco: 500, ctrFoco: null } })).impressoes!
    expect(b.taxa).toBeNull()
    expect(b.semTaxa).toBe('Não dá para calcular a taxa de clique deste vídeo: o YouTube não informou a taxa de clique de 1 dia com impressões.')
    expect(JSON.stringify(b)).not.toMatch(/0,0%/)
  })
})

describe('% assistido', () => {
  it('com dado: "Quem assiste vê em média X% do vídeo (m:ss de m:ss). Baseado em N views.", barra e a marca do normal da faixa', () => {
    const a = blocos(W).assistido!
    expect(a.estado).toBe('ok')
    expect(a.partes.map(p => p.t).join('')).toBe('Quem assiste vê em média 78% do vídeo (07:46 de 10:00). Baseado em 24.680 views.')
    expect(a.barraPct).toBe(78)
    expect(a.normalPct).not.toBeNull()
    expect(a.marcas).toEqual(['0:00', '05:00', '10:00'])
  })

  it('abaixo de 10 views: valor cinza, barra tracejada, "São só N views…", sem comparar com o normal', () => {
    const w = mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 1, diasFoco: 4 } })
    const a = blocos(w).assistido!
    expect(a.estado).toBe('pouco')
    expect(a.partes.map(p => p.t).join('')).toMatch(/São só 4 views: cada pessoa muda o resultado e não dá para comparar com o normal do canal\.$/)
    expect(a).toMatchObject({ contra: null, normalPct: null })
  })

  it('exatamente 10 views já compara; 9 não', () => {
    expect(blocos(mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 10, diasFoco: 1 } })).assistido!.estado).toBe('ok')
    expect(blocos(mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 9, diasFoco: 1 } })).assistido!.estado).toBe('pouco')
  })

  it('acima de 100% é dado válido: o número real na frase, a frase diz que acontece quando muita gente revê trechos, a barra não estoura, e o ⓘ explica', () => {
    const a = blocos(mundoVideo({ mut: umaFaixa, diario: { pctFoco: 139.38 } })).assistido!
    expect(a.partes.map(p => p.t).join('')).toBe('Quem assiste vê em média 139% do vídeo (13:56 num vídeo de 10:00): acontece quando muita gente revê trechos. Baseado em 24.680 views.')
    expect(a.partes.map(p => p.t).join('')).not.toMatch(/\(13:56 de 10:00\)/)
    expect(a.barraPct).toBe(100)
    expect(a.metodo.join(' ')).toContain('Acima de 100%: trecho que muita gente voltou para rever.')
  })

  it('"Perto do normal do canal" só até 2 pontos; 3 pontos já diz acima ou abaixo (o normal do canal é 60%: os outros vídeos têm todos 60%)', () => {
    const com = (pct: number) => blocos(mundoVideo({ mut: umaFaixa, diario: { pctFoco: pct, pctOutros: 60 } })).assistido!
    expect(com(62).normalPct).toBe(60)
    expect(com(62).contra).toBe('Perto do normal do canal (60%).')
    expect(com(58).contra).toMatch(/^Perto do normal do canal/)
    expect(com(63).contra).toBe('Acima do normal do canal (60%): +3 pontos.')
    expect(com(57).contra).toBe('Abaixo do normal do canal (60%): −3 pontos.')
    expect([com(63).direcao, com(57).direcao, com(60).direcao, com(62).direcao]).toEqual(['acima', 'abaixo', 'na-media', 'na-media'])
  })

  it('o normal é o do CANAL, não o da faixa de duração: um vídeo de 3 min compara com a mediana de todos os outros, mesmo sozinho na faixa dele (I2)', () => {
    // todos os longos em 20 min (pct 40, 43, 46…), menos o foco (3 min), sozinho na faixa "até 5 min"
    const w = mundoVideo({ mut: ds => {
      const dono = ds.channels.find(c => c.own)!.id
      const longos = ds.videos.filter(x => x.ch === dono && x.fmt === 'long')
      for (const v of longos) v.dur = 1200
      longos.filter(x => x.tracked && x.ageDays >= 20).sort((a, b) => b.pub - a.pub)[0]!.dur = 180
    }, diario: { pctOutros: 60 } })
    const a = blocos(w).assistido!
    expect(a).toMatchObject({ normalPct: 60, semNormal: null, direcao: 'acima' })
    expect(a.contra).toBe('Acima do normal do canal (60%): +18 pontos.')
    expect(JSON.stringify(a)).not.toMatch(/faixa/i)
  })

  it('menos de 5 outros vídeos com % assistido: nada de normal e a frase diz quantos há (nunca um padrão)', () => {
    const w = mundoVideo({ mut: umaFaixa })
    const dado = dadoDe(w)
    const manter = new Set(w.outros.slice(0, 3))
    const diario = { ...dado.diario, linhas: dado.diario.linhas.filter(l => l.ytId === w.foco.ytId || manter.has(l.ytId)) }
    const a = blocos(w, ok(w, { diario })).assistido!
    expect(a).toMatchObject({ normalPct: null, contra: null, direcao: null, marcaPct: null })
    expect(a.semNormal).toBe('Poucos outros vídeos do canal com % assistido para comparar (3; precisa de 5).')
  })

  it('exatamente 5 outros vídeos com % assistido já tem normal; 4 não', () => {
    const w = mundoVideo({ mut: umaFaixa, diario: { pctOutros: 60 } })
    const dado = dadoDe(w)
    const com = (n: number) => {
      const manter = new Set(w.outros.slice(0, n))
      return blocos(w, ok(w, { diario: { ...dado.diario, linhas: dado.diario.linhas.filter(l => l.ytId === w.foco.ytId || manter.has(l.ytId)) } })).assistido!
    }
    expect(com(5).normalPct).toBe(60)
    expect(com(4).normalPct).toBeNull()
  })

  it('o vídeo não entra na própria mediana (só os outros)', () => {
    // foco 90%; cinco outros a 50%: a mediana é 50, não puxada para cima pelo foco
    const a = blocos(mundoVideo({ mut: umaFaixa, diario: { pctFoco: 90, pctOutros: 50 } })).assistido!
    expect(a.normalPct).toBe(50)
  })

  it('o rótulo da marca não passa da barra: perto de 0% ou de 100% ele ancora na ponta (inicio/fim); no meio fica sob a marca', () => {
    const lado = (outros: number) => blocos(mundoVideo({ mut: umaFaixa, diario: { pctOutros: outros } })).assistido!
    expect(lado(60).rotuloAncora).toBe('meio')
    expect(lado(3).rotuloAncora).toBe('inicio')
    expect(lado(97).rotuloAncora).toBe('fim')
    expect(lado(20).rotuloAncora).toBe('meio')
    expect(lado(80).rotuloAncora).toBe('meio')
  })

  it('sem views nos 28 dias, vídeo novo e coleta que não rodou: cada um com a sua frase de não medido', () => {
    const semViews = blocos(mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 0 } })).assistido!
    expect(semViews).toMatchObject({ estado: 'nao-medido', pctTexto: null })
    expect(semViews.partes.map(p => p.t).join('')).toMatch(/^Nenhum dia medido com % assistido nos 28 dias até \d\d\/\d\d: ainda não há valor\.$/)
    expect(blocos(W, ok(W), novoId).assistido!.partes.map(p => p.t).join('')).toBe('Vídeo novo: o YouTube só entrega o % assistido depois de fechar o dia, então com menos de 3 dias de vida ainda não há valor.')
    const vazio = ok(W, { diario: { canalId: W.canalId, ultimoDia: null, linhas: [], descartados: 0 } })
    expect(blocos(W, vazio).assistido!.partes.map(p => p.t).join('')).toBe('A coleta diária ainda não rodou: sem ela não há % assistido.')
  })
})

describe('retenção, forja e "o que ainda não há"', () => {
  it('retenção: só o estado "ainda não coletado" (pastilha, frase e ⓘ); nenhum número', () => {
    const r = blocos(W).retencao
    expect(r.frase).toBe('Ainda não coletamos esta curva. Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam.')
    expect(r.metodo.join(' ')).toContain('Acima de 100%: trecho que muita gente voltou para rever.')
    expect(JSON.stringify(r).replace('Acima de 100%: trecho que muita gente voltou para rever.', '')).not.toMatch(/\d/)
  })

  it('cartão da forja: ainda não disponível, botão apagado, o porquê, sem etapas', () => {
    const f = blocos(W).forja
    expect(f.titulo).toBe('Leitura da forja')
    expect(f.estado).toBe('ainda não disponível para o seu canal')
    expect(f.botao).toBe('Pedir leitura deste vídeo à forja')
    expect(f.porque).toBe('A forja só recebe dados públicos de concorrente; a leitura de vídeo do seu canal ainda não existe.')
    expect(JSON.stringify(f)).not.toMatch(/coleta diária ainda não está no ar/)
  })

  it('"O que ainda não há deste vídeo": só trocas de título e thumbnail (a origem agora tem a sua seção); nem views por dia nem % assistido', () => {
    const t = blocos(W).ainda
    expect(t).not.toMatch(/origem do tráfego/i)
    expect(t).toContain('Trocas de título e thumbnail')
    expect(t).toContain('gráfico sem marca não quer dizer que não houve troca')
    expect(t).not.toMatch(/views por dia|% assistido|retenção/i)
  })

  it('nada de troca fora do parágrafo "o que ainda não há": nenhum losango, triângulo nem "Trocas deste vídeo" nos blocos', () => {
    const b = blocos(W)
    const resto = JSON.stringify({ ...b, ainda: null })
    expect(resto).not.toMatch(/troca|losango|triângulo|Trocas deste/i)
  })
})

describe('"Este vídeo no canal"', () => {
  it('oito linhas (as seis da Tarefa 12 mais views por dia e % assistido), com a base e o período', () => {
    const c = blocos(W).canal
    expect(c.reguas.linhas.map(l => l.numero)).toEqual(['impressoes', 'views', 'vpd', 'engajamento', 'assistido', 'curtidas', 'comentarios', 'duracao'])
    expect(c.reguas.base).toMatch(/^Entre \d+ vídeos com impressões medidas de \d\d\/\d\d a \d\d\/\d\d\.$/)
    expect(c.notaDiario).toBeNull()
  })

  it('views por dia: o valor é a média dos 28 dias (24.680 ÷ 20 = 1.234) e fica fora da régua só se o vídeo não tem 7 dias medidos', () => {
    const l = blocos(W).canal.reguas.linhas.find(x => x.numero === 'vpd')!
    expect(l.valor).toBe('1.234')
    const curto = blocos(mundoVideo({ mut: umaFaixa, diario: { diasFoco: 6 } })).canal.reguas.linhas.find(x => x.numero === 'vpd')!
    expect(curto).toMatchObject({ valor: null, semRegua: 'sem 7 dias de medida', pos: null })
  })

  it('menos de 10 views em 28 dias: "Com N views em 28 dias não dá para posicionar este vídeo: K dos M outros também ficam abaixo de 1 view por dia."', () => {
    const w = mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 1, diasFoco: 8 } })
    const l = blocos(w).canal.reguas.linhas.find(x => x.numero === 'vpd')!
    expect(l.valor).toBe('1,0')
    expect(l.pos).toBeNull()
    expect(l.semRegua).toMatch(/^Com 8 views em 28 dias não dá para posicionar este vídeo: \d+ dos \d+ outros medidos ficam abaixo de 1 view por dia(; \d+ sem medida)?\.$/)
  })

  it('a trava conta só vídeo MEDIDO: zerado entra em K, sem medida (sem diário, short, curto demais) não é "abaixo de 1" e aparece à parte (I3)', () => {
    const w = mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 1, diasFoco: 8 } })
    const dado = dadoDe(w)
    const zerados = new Set(w.outros.slice(0, 2)), semLinha = new Set(w.outros.slice(2, 5))
    const linhas = dado.diario.linhas
      .filter(l => !semLinha.has(l.ytId))
      .map(l => (zerados.has(l.ytId) ? { ...l, views: 0 } : l))
    const total = w.obs.videos.filter(v => v.ch === w.canalId).length + (w.obs.channel(w.canalId)?.undated?.length ?? 0)
    const outros = total - 1
    const medidos = w.outros.length - semLinha.size            // os que têm diário com 7+ dias, menos os que tiraram a linha
    const semMedida = outros - medidos
    expect(semMedida).toBeGreaterThanOrEqual(3)
    const l = blocos(w, ok(w, { diario: { ...dado.diario, linhas } })).canal.reguas.linhas.find(x => x.numero === 'vpd')!
    expect(l.semRegua).toBe(`Com 8 views em 28 dias não dá para posicionar este vídeo: 2 dos ${medidos} outros medidos ficam abaixo de 1 view por dia; ${semMedida} sem medida.`)
  })

  it('sem nenhum outro vídeo medido: diz isso, em vez de "0 dos 0"', () => {
    const w = mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 1, diasFoco: 8 } })
    const dado = dadoDe(w)
    const linhas = dado.diario.linhas.filter(l => l.ytId === w.foco.ytId)
    const l = blocos(w, ok(w, { diario: { ...dado.diario, linhas } })).canal.reguas.linhas.find(x => x.numero === 'vpd')!
    expect(l.semRegua).toBe('Com 8 views em 28 dias não dá para posicionar este vídeo: nenhum outro vídeo do canal tem views por dia medidas.')
  })

  it('% assistido com poucas views: "Com só N views não dá para posicionar o % assistido."', () => {
    const w = mundoVideo({ mut: umaFaixa, diario: { viewsFoco: 1, diasFoco: 4 } })
    const l = blocos(w).canal.reguas.linhas.find(x => x.numero === 'assistido')!
    expect(l).toMatchObject({ pos: null, semRegua: 'Com só 4 views não dá para posicionar o % assistido.' })
  })

  it('vídeo novo ou sem diário: as duas linhas somem e uma frase de não medido ocupa o lugar', () => {
    const novo = blocos(W, ok(W), novoId).canal
    expect(novo.reguas.linhas.map(l => l.numero)).not.toContain('vpd')
    expect(novo.notaDiario).toBe('Vídeo novo: ainda não há leitura diária para posicionar este vídeo entre os outros em views por dia nem em % assistido.')
    const vazio = ok(W, { diario: { canalId: W.canalId, ultimoDia: null, linhas: [], descartados: 0 } })
    expect(blocos(W, vazio).canal.notaDiario).toBe('Sem a leitura diária não há como posicionar este vídeo entre os outros em views por dia nem em % assistido.')
  })
})

describe('segurança: acesso negado não leva nenhum número privado', () => {
  const negado = (): ReturnType<typeof blocos> => blocos(W, { acesso: 'negado' })
  it('os blocos privados são nulos, a nota única diz quem vê, e o modelo inteiro não tem nenhum texto privado', () => {
    const b = negado()
    expect(b).toMatchObject({ acesso: 'negado', views: null, impressoes: null, assistido: null })
    expect(b.nota).toBe('Só quem edita o site vê as views por dia, as impressões e cliques, o % assistido e a posição deste vídeo nessas medidas.')
    const json = JSON.stringify(b)
    for (const s of TEXTOS_PRIVADOS) expect(temSentinela(json, s), s).toBe(false)
  })

  it('controle positivo: com acesso o mesmo modelo TEM os textos privados (a negativa não passa em vazio)', () => {
    const json = JSON.stringify(blocos(W))
    for (const s of TEXTOS_PRIVADOS) expect(temSentinela(json, s), s).toBe(true)
  })

  it('as réguas públicas continuam; as linhas privadas dizem quem vê e não têm valor', () => {
    const l = negado().canal.reguas.linhas
    expect(l.find(x => x.numero === 'views')!.valor).not.toBeNull()
    expect(l.find(x => x.numero === 'impressoes')).toMatchObject({ valor: null, semRegua: 'só quem edita o site vê as impressões' })
    expect(l.map(x => x.numero)).not.toContain('vpd')
    expect(negado().canal.notaDiario).toBe('Só quem edita o site vê a posição deste vídeo em views por dia e em % assistido.')
  })

  it('leitura que falhou: a nota diz que falhou, nunca "sem dado"', () => {
    const b = blocos(W, { acesso: 'erro' })
    expect(b).toMatchObject({ acesso: 'erro', views: null, impressoes: null, assistido: null })
    expect(b.nota).toBe('A leitura dos números deste vídeo falhou agora; recarregue a página.')
  })
})

describe('relógio e datas', () => {
  it('nada fixo: com o relógio andando um dia a janela anda junto (o gráfico termina no último dia medido, não em "hoje")', () => {
    const g = blocos(W).views!.grafico!
    const ultimo = addDays(W.hoje, -2)
    expect(g.periodoTexto).toMatch(new RegExp(`a ${dmDia(ultimo)} · 28 dias`))
  })
})


/* ---------------------------------------------------------------- tela B: % assistido por período */

describe('buildAssistidoDoVideo (tela B)', () => {
  const ATE: DiaYt = '2026-09-30'
  const PUB = addDays(ATE, -199)
  const OUTROS = ['o1', 'o2', 'o3']
  /** Cada outro vídeo, 100 views por dia: 40% até 90 dias atrás, 50% de 89 a 28 dias atrás, 60% nos últimos 28 dias. */
  function linhas(ids: readonly string[], de: DiaYt, views = 100): DiarioPeriodoLinha[] {
    const out: DiarioPeriodoLinha[] = []
    for (const ytId of ids) for (let n = 199; n >= 0; n--) {
      const dia = addDays(ATE, -n)
      if (dia < de) continue
      out.push({ ytId, dia, views, pctAssistido: n >= 90 ? 40 : n >= 28 ? 50 : 60 })
    }
    return out
  }
  function periodo(ids: readonly string[], de: DiaYt | null, o: { conhecida?: boolean; views?: number; primeiro?: DiaYt } = {}): DiarioDoPeriodo {
    const ls = linhas(ids, de ?? PUB, o.views)
    return {
      canalId: 'c', de, ate: ATE, linhas: ls, foraDoTeto: [], descartados: 0,
      cobertura: {
        conhecida: o.conhecida ?? true, videosCompletos: ids.length, videosIncompletos: 0, primeiroDiaLido: o.primeiro ?? (ls[0]?.dia ?? null),
        intervalos: new Map(ids.map(id => [id, [{ de: de ?? PUB, ate: ATE }]] as const)), ytIds: ids, publicacoes: new Map(ids.map(id => [id, PUB] as const)),
      },
    }
  }
  const longo = (o: Partial<DiarioLongo> = {}): Privado<DiarioLongo> => ({ acesso: 'ok', dado: { d90: periodo(OUTROS, addDays(ATE, -89)), inteiro: periodo(OUTROS, null), ...o } })
  const diario28: DiarioCanal = {
    canalId: 'c', ultimoDia: ATE, descartados: 0,
    linhas: Array.from({ length: 28 }, (_, i) => ({ ytId: 'este', dia: addDays(ATE, -i), views: 50, pctAssistido: 55, duracaoMediaSeg: null })),
  }
  const monta = (l: Privado<DiarioLongo> | null, diario: DiarioCanal = diario28) => buildAssistidoDoVideo({ ytId: 'este', ytIds: OUTROS, diario, longo: l })

  it('os três cartões do exemplo (46, 53 e 60) com as setas contra o canal inteiro e a frase do vídeo: "Acima do normal do canal inteiro: 55% contra 46% (+9 pontos)"', () => {
    const v = monta(longo())
    expect(v.estado).toBe('ok')
    expect(v.cartoes.map(c => [c.id, c.valor, c.seta?.texto ?? null])).toEqual([['inteiro', '46%', null], ['90', '53%', '▲ +7'], ['28', '60%', '▲ +14']])
    expect(v.conteudos.inteiro.frase!.texto).toBe('Acima do normal do canal inteiro: 55% contra 46% (+9 pontos).')
    expect(v.conteudos['90'].frase!.texto).toBe('Na média dos últimos 90 dias: 55% contra 53% (+2 pontos).')
  })

  it('o vídeo da tela não entra na conta do normal: só os OUTROS vídeos (o leitor recebe a lista sem ele)', () => {
    const v = buildAssistidoDoVideo({ ytId: 'o1', ytIds: ['o2', 'o3'], diario: { ...diario28, linhas: [] }, longo: longo() })
    expect(v.cartoes[0]!.valor).toBe('46%')
    expect(v.conteudos.inteiro.frase).toBeNull() // sem % do vídeo não há comparação, e nada é inventado
  })

  it('canal sem diário (a página nem lê): os três cartões dizem "sem dado" e a frase diz que a coleta não rodou; nenhum número', () => {
    const v = monta(null, { ...diario28, ultimoDia: null, linhas: [] })
    expect(v.cartoes.every(c => c.estado === 'sem-numero' && c.valor === null && c.seta === null)).toBe(true)
    expect(v.conteudos.inteiro.frase!.texto).toMatch(/coleta diária ainda não rodou/)
  })

  it('sem acesso e leitura que falhou: nenhum cartão, a frase de acesso ou de erro, e nenhum número no modelo', () => {
    const negado = monta({ acesso: 'negado' })
    expect(negado).toMatchObject({ estado: 'negado', cartoes: [], vazio: 'Só quem edita o site vê o % assistido.' })
    const erro = monta({ acesso: 'erro' })
    expect(erro).toMatchObject({ estado: 'erro', cartoes: [] })
    expect(JSON.stringify([negado, erro])).not.toMatch(/\d+%/)
  })

  it('o diário inteiro passou do teto: o cartão do canal inteiro lê "não medido" e os de 90 e 28 dias continuam com número; falha do banco lê "não conseguimos ler"', () => {
    const teto = monta(longo({ inteiro: null, motivoInteiro: 'teto' }))
    expect(teto.cartoes.map(c => [c.id, c.valor])).toEqual([['inteiro', null], ['90', '53%'], ['28', '60%']])
    expect(teto.cartoes[0]).toMatchObject({ semNumero: 'não medido' })
    expect(JSON.stringify(teto)).toContain('o canal passou do tamanho que esta tela lê de uma vez')
    expect(JSON.stringify(teto)).not.toContain('não sabemos se')
    const erro = monta(longo({ inteiro: null, motivoInteiro: 'erro' }))
    expect(erro.cartoes[0]).toMatchObject({ valor: null, semNumero: 'não conseguimos ler' })
  })

  it('poucas views com a cobertura inteira diz "poucas views"; com a cobertura desconhecida diz "não medido", nunca "poucas views"', () => {
    const poucas = monta(longo({ d90: periodo(OUTROS, addDays(ATE, -89), { views: 1 }), inteiro: periodo(OUTROS, null, { views: 1 }) }))
    expect(poucas.cartoes.map(c => c.semNumero)).toEqual(['poucas views', 'poucas views', 'poucas views'])
    const desconhecida = monta(longo({ d90: periodo(OUTROS, addDays(ATE, -89), { views: 1, conhecida: false }), inteiro: periodo(OUTROS, null, { views: 1, conhecida: false }) }))
    expect(desconhecida.cartoes.map(c => c.semNumero)).toEqual(['não medido', 'não medido', 'não medido'])
    expect(JSON.stringify(desconhecida.cartoes)).not.toMatch(/poucas views/)
  })

  it('diário que começa depois da publicação mais antiga: o primeiro cartão se chama "Desde dd/mm/aaaa"; começando na publicação, "Canal inteiro"', () => {
    const tarde = addDays(PUB, 40)
    const comBuraco = monta(longo({ inteiro: periodo(OUTROS, tarde, { primeiro: tarde }) }))
    expect(comBuraco.cartoes[0]!.rotulo).toBe(`Desde ${tarde.slice(8)}/${tarde.slice(5, 7)}/${tarde.slice(0, 4)}`)
    expect(monta(longo()).cartoes[0]!.rotulo).toBe('Canal inteiro')
  })
})

/* ================================================================ E5b T16 (d): a entrada pura da origem do vídeo  */

describe('E5b T16 (d): entrada pura de "De onde vêm as views"', () => {
  const ATE = '2026-10-11'
  const diarioVazio = (conhecida: boolean): DiarioDoPeriodo => ({ canalId: 'c', de: '2026-10-05', ate: ATE, linhas: [], foraDoTeto: [], descartados: 0, cobertura: { conhecida, videosCompletos: 0, videosIncompletos: 0, primeiroDiaLido: null, intervalos: new Map(), ytIds: [], publicacoes: new Map() } })

  it('ateDaOrigem: o último dia do diário; sem diário, três dias antes de hoje', () => {
    expect(ateDaOrigem('2026-10-09', '2026-10-13')).toBe('2026-10-09')
    expect(ateDaOrigem(null, '2026-10-13')).toBe('2026-10-10')
  })

  it('nivelDaOrigem: sem prova só o aviso; termos negados para quem não edita é sem-termos; erro ou negado para quem edita continua tudo', () => {
    const ok = { acesso: 'ok' as const, dado: detalheFx() }
    expect(nivelDaOrigem({ temLeitura: false, termos: { acesso: 'negado' }, podeEditar: false })).toBe('so-aviso')
    expect(nivelDaOrigem({ temLeitura: true, termos: { acesso: 'negado' }, podeEditar: false })).toBe('sem-termos')
    expect(nivelDaOrigem({ temLeitura: true, termos: { acesso: 'negado' }, podeEditar: true })).toBe('tudo')
    expect(nivelDaOrigem({ temLeitura: true, termos: { acesso: 'erro' }, podeEditar: true })).toBe('tudo')
    expect(nivelDaOrigem({ temLeitura: true, termos: { acesso: 'erro' }, podeEditar: false })).toBe('tudo')
    expect(nivelDaOrigem({ temLeitura: true, termos: ok, podeEditar: true })).toBe('tudo')
  })

  it('janelaDaOrigemDoVideo: sempre 7 dias de diário; desde a publicação sem passar do começo da coleta; publicação nula ou depois do fim: só 7 dias', () => {
    expect(janelaDaOrigemDoVideo({ ate: ATE, publicadoEm: null, ligadoEm: '2026-10-04' })).toEqual({ de: '2026-10-05', diarioDesde: '2026-10-05' })
    expect(janelaDaOrigemDoVideo({ ate: ATE, publicadoEm: '2026-10-12', ligadoEm: '2026-10-04' })).toEqual({ de: '2026-10-05', diarioDesde: '2026-10-05' })
    expect(janelaDaOrigemDoVideo({ ate: ATE, publicadoEm: '2019-03-01', ligadoEm: '2026-10-04' })).toEqual({ de: '2026-10-04', diarioDesde: '2026-10-05' })
    expect(janelaDaOrigemDoVideo({ ate: ATE, publicadoEm: '2026-09-20', ligadoEm: '2026-10-04' })).toEqual({ de: '2026-10-04', diarioDesde: '2026-10-05' })
    expect(janelaDaOrigemDoVideo({ ate: ATE, publicadoEm: '2026-10-08', ligadoEm: '2026-10-04' })).toEqual({ de: '2026-10-05', diarioDesde: '2026-10-05' })
    // coleta ligada depois do começo da janela de 7 dias: a janela não passa de `ate - 6`
    expect(janelaDaOrigemDoVideo({ ate: ATE, publicadoEm: '2019-03-01', ligadoEm: '2026-10-09' })).toEqual({ de: '2026-10-05', diarioDesde: '2026-10-05' })
  })

  it('periodosDaOrigemDoVideo: 7 dias e "Desde a publicação" (só com data); o total vem do diário e é nulo com a cobertura desconhecida ou o diário inteiro ausente', () => {
    const sem = periodosDaOrigemDoVideo({ ate: ATE, publicadoEm: null, diario: diarioVazio(false), diarioInteiro: null })
    expect(sem.map(p => p.id)).toEqual(['7'])
    expect(sem[0]).toMatchObject({ rotulo: '7 dias', de: '2026-10-05', ate: ATE, totalDoPeriodo: null })
    const com = periodosDaOrigemDoVideo({ ate: ATE, publicadoEm: '2026-09-01', diario: diarioVazio(true), diarioInteiro: null })
    expect(com.map(p => p.id)).toEqual(['7', 'tudo'])
    expect(com[1]).toMatchObject({ rotulo: 'Desde a publicação', de: '2026-09-01', totalDoPeriodo: null, videosDoTotal: null })
    expect(com[0]!.videosDoTotal).toMatchObject({ naConta: 0 })
  })

  it('contagensDeCobertura: só contagens; nulo quando nenhum período tem vídeo fora ou parado e nenhum bloco traz a linha de contagem', () => {
    const limpo = buildOrigem(entradaFx({ periodos: [perFx('7', '7 dias', '2026-10-05', ATE)] }))
    expect(contagensDeCobertura(limpo, [perFx('7', '7 dias', '2026-10-05', ATE)])).toBeNull()
    const fora = perFx('7', '7 dias', '2026-10-05', ATE, 3185, { naConta: 34, fora: 1, parados: 0, paradosDesde: null, comBuraco: 0 })
    expect(contagensDeCobertura(limpo, [fora])).toEqual({ periodosComVideoForaOuParado: 1, blocosComContagem: 0 })
  })

  it('contagensDeCobertura: vídeo parado só no período "tudo" não avisa (estado permanente); parado em 90 dias conta 1 (Yannis I2)', () => {
    const limpo = buildOrigem(entradaFx({ periodos: [perFx('7', '7 dias', '2026-10-05', ATE)] }))
    const parado = { naConta: 34, fora: 0, parados: 1, paradosDesde: '2026-08-01', comBuraco: 0 }
    const tudo = perFx('tudo', 'Desde 2026', '2026-01-01', ATE, 3185, parado)
    expect(contagensDeCobertura(limpo, [tudo])).toBeNull()
    const noventa = perFx('90', '90 dias', '2026-07-14', ATE, 3185, parado)
    expect(contagensDeCobertura(limpo, [tudo, noventa])).toEqual({ periodosComVideoForaOuParado: 1, blocosComContagem: 0 })
  })
})
