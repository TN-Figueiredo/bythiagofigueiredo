// @vitest-environment node
// Zero medido só é verdade com três condições (parecer do engenheiro de dados, portão MG1/MG2, seção 6). Aqui as duas que o código não cumpria:
//   2. ZERO SÓ A PARTIR DA PUBLICAÇÃO: o dia anterior ao dia em que o vídeo foi publicado NÃO existe para ele (não é zero, não é "não medido",
//      não entra em total, denominador nem frase) na régua, no cartão, na lista, no gráfico e nas frases com contagem de dias;
//   3. HOJE (D) E ONTEM (D-1) SEM LINHA SÃO "NÃO MEDIDO", nunca zero: o relatório do YouTube chega com atraso e pode vir vazio ou parcial.
//      Linha com valor nesses dias é mostrada (dado que existe não se esconde).
// A condição 1 (vale o relatório mais novo do dia) já estava cumprida. Datas sempre relativas a `HOJE` / `w.hoje`.
import { afterEach, describe, it, expect } from 'vitest'
import { addDays, dayPt, diffDias } from '@/lib/youtube/coleta/day-pt'
import {
  DIAS_DE_VIDA_MIN as MIN_DIAS_DE_VIDA, DIAS_RECENTES, alcancePorVideo, diaRecente, inicioDoVideo, montarDias, motivoDiaTexto, resumir, videoNovo,
} from '@/lib/youtube/observatorio/proprio/dias'
import { buildImpressoes } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'
import { DIAS_DE_VIDA_MIN, serieDoVideo } from '@/lib/youtube/observatorio/proprio/serie-video'
import type { AlcanceCanal, AlcanceLinha, DiaYt, DiarioCanal, Privado, RelatorioDia } from '@/lib/youtube/observatorio/proprio/tipos'
import { lerEstado } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { buildProprioVideos } from '@/app/cms/(authed)/youtube/competitors/_proprio/videos-model'
import { buildVideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { mundoVideo, type MundoVideo } from './proprio-video-fixture'

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))

const DIA_MS = 86_400_000
const TEXTO_RECENTE = 'dia recente: o YouTube ainda está entregando; não medido'
const FRASE_NOVO = 'vídeo novo: o alcance chega com 2 a 3 dias de atraso'

/* ================================================================ a função do dia (pura)  */

const HOJE: DiaYt = dayPt(new Date())
const d = (n: number): DiaYt => addDays(HOJE, -n)
const rel = (dia: DiaYt, status: RelatorioDia['status'] = 'vazio', normalizado = true): RelatorioDia => ({ dia, status, normalizado })
const lin = (ytId: string, dia: DiaYt, imp: number | null, ctr: number | null = 0.1): AlcanceLinha => ({ ytId, dia, imp, ctr })
const canal = (relatorios: RelatorioDia[], linhas: AlcanceLinha[] = []): AlcanceCanal => ({ canalId: 'c', relatorios, linhas, ultimoRelatorio: null, descartados: 0 })
/** Relatórios lidos de `de` a `ate` (em dias atrás: `de` é o mais antigo). */
const lidos = (de: number, ate: number, status: RelatorioDia['status'] = 'vazio'): RelatorioDia[] =>
  Array.from({ length: de - ate + 1 }, (_, i) => rel(d(de - i), status))

describe('D e D-1: a ausência de linha nunca é zero medido', () => {
  it('diaRecente: hoje e ontem são recentes; anteontem não (DIAS_RECENTES = 2)', () => {
    expect(DIAS_RECENTES).toBe(2)
    expect(diaRecente(d(0), HOJE)).toBe(true)
    expect(diaRecente(d(1), HOJE)).toBe(true)
    expect(diaRecente(d(2), HOJE)).toBe(false)
    expect(diaRecente(d(30), HOJE)).toBe(false)
  })

  it('relatório lido e VAZIO em D-1: não medido (motivo "recente"); em D-2: zero medido', () => {
    const { dias } = montarDias(canal(lidos(5, 1)), { hoje: HOJE })
    const de = (n: number) => dias.find(x => x.dia === d(n))!
    expect(de(1)).toEqual({ dia: d(1), situacao: 'nao-medido', motivo: 'recente', imp: null, cliques: null })
    expect(de(2)).toEqual({ dia: d(2), situacao: 'zero-medido', motivo: null, imp: 0, cliques: 0 })
    expect(de(5).situacao).toBe('zero-medido')
  })

  it('relatório lido e vazio em D (hoje): também não medido', () => {
    const { dias } = montarDias(canal(lidos(4, 0)), { hoje: HOJE })
    expect(dias.find(x => x.dia === d(0))).toMatchObject({ situacao: 'nao-medido', motivo: 'recente', imp: null, cliques: null })
    expect(dias.find(x => x.dia === d(1))).toMatchObject({ situacao: 'nao-medido', motivo: 'recente' })
    expect(dias.find(x => x.dia === d(2))).toMatchObject({ situacao: 'zero-medido' })
  })

  it('relatório "baixado" (com linhas de OUTRO vídeo) em D-1: para este vídeo a ausência de linha também é não medido', () => {
    const a = canal([...lidos(5, 2), rel(d(1), 'baixado')], [lin('outro', d(1), 7), lin('outro', d(3), 7)])
    const { dias } = montarDias(a, { hoje: HOJE, ytId: 'este' })
    expect(dias.find(x => x.dia === d(1))).toMatchObject({ situacao: 'nao-medido', motivo: 'recente' })
    expect(dias.find(x => x.dia === d(3))).toMatchObject({ situacao: 'zero-medido', imp: 0 })
  })

  it('relatório de D-1 que TROUXE linha com valor para o vídeo: o valor é mostrado (dado que existe não é escondido)', () => {
    const a = canal([...lidos(5, 2), rel(d(1), 'baixado')], [lin('este', d(1), 40, 0.25), lin('este', d(0), 8, 0.5)])
    const v = montarDias(a, { hoje: HOJE, ytId: 'este' }).dias
    expect(v.find(x => x.dia === d(1))).toEqual({ dia: d(1), situacao: 'com-impressoes', motivo: null, imp: 40, cliques: 10 })
    const c = montarDias(canal([...lidos(5, 2), rel(d(1), 'baixado')], [lin('este', d(1), 40, 0.25)]), { hoje: HOJE }).dias
    expect(c.find(x => x.dia === d(1))).toMatchObject({ situacao: 'com-impressoes', imp: 40 })
  })

  it('o canal (soma dos vídeos) segue a mesma regra nos mesmos dois dias', () => {
    const { dias } = montarDias(canal(lidos(6, 1), [lin('a', d(4), 3)]), { hoje: HOJE })
    expect(dias.map(x => x.situacao)).toEqual(['zero-medido', 'zero-medido', 'com-impressoes', 'zero-medido', 'nao-medido', 'nao-medido'].slice(0, 0).concat(
      // d(6), d(5) zero; d(4) com; d(3), d(2) zero; d(1) não medido
      ['zero-medido', 'zero-medido', 'com-impressoes', 'zero-medido', 'zero-medido', 'nao-medido']))
  })

  it('o resumo conta D-1 como dia não medido (não como dia lido): 4 lidos e 1 não medido', () => {
    const r = resumir(montarDias(canal(lidos(5, 1)), { hoje: HOJE }).dias)
    expect(r).toMatchObject({ diasLidos: 4, diasNaoMedidos: 1, imp: 0, diasComImpressao: 0 })
  })

  it('a regra não apaga os outros motivos: D-1 por baixar continua "nao-baixado", D sem relatório continua "sem-relatorio"', () => {
    const { dias } = montarDias(canal([...lidos(5, 2), rel(d(1), 'listado', false)]), { hoje: HOJE })
    expect(dias.find(x => x.dia === d(1))).toMatchObject({ situacao: 'nao-medido', motivo: 'nao-baixado' })
    const sem = montarDias(canal([...lidos(5, 2), rel(d(0), 'vazio')]), { hoje: HOJE }).dias
    expect(sem.find(x => x.dia === d(1))).toMatchObject({ situacao: 'nao-medido', motivo: 'sem-relatorio' })
  })

  it('lerEstado: o resumo do canal (que alimenta a manchete) conta só os dias fechados', () => {
    const l = lerEstado({ acesso: 'ok', dado: canal(lidos(5, 1)) }, HOJE)
    if (l.estado !== 'ok') throw new Error('devia ter lido')
    expect(l.resumo).toMatchObject({ diasLidos: 4, diasNaoMedidos: 1, imp: 0 })
  })

  it('o motivo "recente" tem UMA frase só (a mesma na dica e no texto da situação), que diz "não medido" e não promete download', () => {
    expect(motivoDiaTexto('recente')).toBe(TEXTO_RECENTE)
  })

  it('o "hoje" é parâmetro: a mesma entrada com outro hoje dá outra classificação', () => {
    const a = canal(lidos(5, 1))
    expect(montarDias(a, { hoje: HOJE }).dias.at(-1)!.situacao).toBe('nao-medido')
    expect(montarDias(a, { hoje: addDays(HOJE, 10) }).dias.at(-1)!.situacao).toBe('zero-medido')
  })
})

describe('zero só a partir da publicação', () => {
  it('inicioDoVideo: a publicação depois do início da janela vence; antes dele ou sem data (null), vale a janela', () => {
    expect(inicioDoVideo(d(20), d(8))).toBe(d(8))
    expect(inicioDoVideo(d(20), d(25))).toBe(d(20))
    expect(inicioDoVideo(d(20), null)).toBe(d(20))
    expect(inicioDoVideo(d(20), undefined)).toBe(d(20))
  })

  it('vídeo publicado no meio da janela: os dias antes da publicação NÃO existem (nem zero, nem não medido)', () => {
    const a = canal(lidos(15, 2))
    const todo = montarDias(a, { hoje: HOJE, ytId: 'v' })
    const cortado = montarDias(a, { hoje: HOJE, ytId: 'v', publicadoEm: d(8) })
    expect(todo.dias).toHaveLength(14)
    expect(cortado.dias.map(x => x.dia)).toEqual([d(8), d(7), d(6), d(5), d(4), d(3), d(2)])
    expect(cortado.dias.every(x => x.situacao === 'zero-medido')).toBe(true)
    expect(cortado.periodo).toEqual({ de: d(8), ate: d(2), dias: 7 })
    expect(resumir(cortado.dias)).toMatchObject({ diasLidos: 7, diasNaoMedidos: 0 })
    // o canal não é cortado por publicação nenhuma
    expect(montarDias(a, { hoje: HOJE }).dias).toHaveLength(14)
  })

  it('o corte e a regra de D-1 juntos: publicado em d(8), relatórios até D-1 vazio: 7 dias medidos (d8 a d2) e 1 sem relatório', () => {
    const r = resumir(montarDias(canal(lidos(15, 1)), { hoje: HOJE, ytId: 'v', publicadoEm: d(8) }).dias)
    expect(r).toMatchObject({ diasLidos: 7, diasNaoMedidos: 1 })
    const canalTodo = resumir(montarDias(canal(lidos(15, 1)), { hoje: HOJE }).dias)
    expect(canalTodo).toMatchObject({ diasLidos: 14, diasNaoMedidos: 1 })
  })

  it('linha de alcance ANTERIOR à publicação (dado ruim) não entra: o vídeo começa na publicação', () => {
    const a = canal(lidos(10, 2), [lin('v', d(9), 500), lin('v', d(5), 3)])
    const { dias } = montarDias(a, { hoje: HOJE, ytId: 'v', publicadoEm: d(6) })
    expect(dias[0]!.dia).toBe(d(6))
    expect(dias.map(x => x.imp)).toEqual([0, 3, 0, 0, 0].slice(0, 0).concat([0, 3, 0, 0, 0]))
  })

  it('vídeo publicado DEPOIS do último dia do período: nenhum dia vale (período nulo, dias vazios), nunca uma lista de zeros', () => {
    const x = montarDias(canal(lidos(10, 3)), { hoje: HOJE, ytId: 'v', publicadoEm: d(1) })
    expect(x).toEqual({ periodo: null, dias: [], avisos: [] })
  })

  it('publicação sem data (null): o que o código já fazia, sem corte (a janela inteira do canal vale)', () => {
    const a = canal(lidos(10, 3))
    expect(montarDias(a, { hoje: HOJE, ytId: 'v', publicadoEm: null }).dias).toHaveLength(8)
    expect(montarDias(a, { hoje: HOJE, ytId: 'v' }).dias).toHaveLength(8)
  })

  it('publicado no último dia medido: 1 dia, zero medido', () => {
    const x = montarDias(canal(lidos(10, 3)), { hoje: HOJE, ytId: 'v', publicadoEm: d(3) })
    expect(x.dias).toHaveLength(1)
    expect(x.dias[0]).toMatchObject({ dia: d(3), situacao: 'zero-medido', imp: 0 })
  })

  it('a série de views do vídeo usa a MESMA função de início (um vídeo de d(8) começa em d(8) no diário também)', () => {
    const diario: Privado<DiarioCanal> = { acesso: 'ok', dado: { canalId: 'c', ultimoDia: d(2), descartados: 0, linhas: [
      { ytId: 'v', dia: d(9), views: 5, pctAssistido: null, duracaoMediaSeg: null },
      { ytId: 'v', dia: d(8), views: 0, pctAssistido: null, duracaoMediaSeg: null },
    ] } }
    const s = serieDoVideo(diario, { ytId: 'v', publicadoEm: d(8), hoje: HOJE })
    expect(s.janela).toEqual({ de: d(8), ate: d(2) })
    expect(s.dias[0]).toMatchObject({ dia: d(8), estado: 'zero-medido' })
  })
})

/* ================================================================ os modelos (cartão, lista, régua, gráfico, frases)  */

/** Um vídeo longo acompanhado é "republicado" `idade` dias antes do relógio do dataset; os outros ficam como estão. */
function comVideoPublicadoHa(idade: number, horas = 0) {
  const alvo = { id: '', ytId: '' }
  const mut = (ds: Dataset): void => {
    const canalId = ds.channels.find(c => c.own)!.id
    const v = ds.videos.filter(x => x.ch === canalId && x.fmt === 'long' && x.tracked).sort((p, q) => q.ageDays - p.ageDays)[0]!
    v.pub = ds.now - idade * DIA_MS - horas * 3_600_000
    v.ageDays = idade
    alvo.id = v.id
    alvo.ytId = v.ytId
  }
  return { alvo, mut }
}

const dadosOk = (w: MundoVideo, alcance: AlcanceCanal): DadosDoCanal => {
  const diario = w.dados.diario
  if (diario.acesso !== 'ok') throw new Error('a fixture esperava diário lido')
  return { alcance: { acesso: 'ok', dado: alcance }, diario }
}
const blocosDe = (w: MundoVideo, alcance: AlcanceCanal, id: string) => {
  const diario = w.dados.diario
  if (diario.acesso !== 'ok') throw new Error('a fixture esperava diário lido')
  return buildVideoBlocos({ obs: w.obs, videoId: id, dados: { acesso: 'ok', dado: { alcance, diario: diario.dado } }, hoje: w.hoje, dm: dmDia })
}
/** Um vídeo longo antigo, que não é o alvo: dono da única linha de alcance dos cenários. */
const velhoQueNaoE = (w: MundoVideo, alvoYt: string): string => w.obs.videos.find(v => v.ch === w.canalId && v.ageDays > 60 && v.fmt === 'long' && v.ytId !== alvoYt)!.ytId
/** O dia da publicação como as telas o calculam. */
const diaDaPub = (w: MundoVideo, id: string): DiaYt => dayPt(new Date(w.obs.video(id)!.pub))

describe('vídeo publicado no meio da janela (10 dias de vida): régua, cartão, lista e gráfico', () => {
  const A = comVideoPublicadoHa(10)
  const W = mundoVideo({ mut: A.mut })
  const PUB = diaDaPub(W, A.alvo.id)
  const K = diffDias(PUB, W.hoje)   // dias de vida: o dia da publicação é d(K)
  const dd = (n: number) => addDays(W.hoje, -n)
  // um vídeo antigo com linha (para a régua ter base) e outro antigo SEM linha (zero medido de ponta a ponta)
  const antigos = W.obs.videos.filter(v => v.ch === W.canalId && v.ageDays > K + 40 && v.fmt === 'long' && v.tracked)
  const comLinha = antigos[0]!, antigoSem = antigos[1]!
  // relatórios lidos de (publicação - 6) até D-2 e o de D-1 também lido, mas VAZIO; só `comLinha` aparece, em d(5)
  const relatorios: RelatorioDia[] = Array.from({ length: K + 6 }, (_, i) => rel(dd(K + 6 - i), 'vazio'))
  const alcance: AlcanceCanal = { canalId: W.canalId, relatorios, linhas: [lin(comLinha.ytId, dd(5), 20)], ultimoRelatorio: dd(1), descartados: 0 }

  it('premissa do cenário: 10 dias de vida e o último relatório é o de D-1 (lido e vazio)', () => {
    expect(K).toBeGreaterThanOrEqual(9)
    expect(K).toBeLessThanOrEqual(11)
    expect(relatorios.at(-1)).toMatchObject({ dia: dd(1), status: 'vazio', normalizado: true })
  })

  it('RÉGUA do vídeo: "Nenhuma impressão nos N dias medidos (1 dia sem dado)" com N só dos dias desde a publicação e sem D-1', () => {
    const linha = blocosDe(W, alcance, A.alvo.id).canal.reguas.linhas.find(l => l.numero === 'impressoes')!
    expect(linha.zeroMedido).toBe(true)
    expect(linha.valor).toBe('0')
    expect(linha.semRegua).toBe(`Nenhuma impressão nos ${K - 1} dias medidos (1 dia sem dado). O 1 vídeo com impressão fica acima dele.`)
  })

  it('RÉGUA de um vídeo antigo sem linha: todos os dias do período, menos D-1 (que é não medido)', () => {
    const linha = blocosDe(W, alcance, antigoSem.id).canal.reguas.linhas.find(l => l.numero === 'impressoes')!
    expect(linha.zeroMedido).toBe(true)
    // período do canal: de (publicação - 6) a D-1 = K + 6 dias; os fechados são K + 5, o D-1 fica de fora
    expect(linha.semRegua).toBe(`Nenhuma impressão nos ${K + 5} dias medidos (1 dia sem dado). O 1 vídeo com impressão fica acima dele.`)
  })

  it('RÉGUA, rodapé "N sem impressão no período": só quem já tinha dia que valesse entra, o publicado depois do último dia vai para "sem medida"', () => {
    const jovem = comVideoPublicadoHa(1)
    const Wj = mundoVideo({ mut: jovem.mut })
    const rj: RelatorioDia[] = Array.from({ length: 8 }, (_, i) => rel(addDays(Wj.hoje, -(10 - i)), 'vazio')) // d(10) a d(3)
    const al: AlcanceCanal = { canalId: Wj.canalId, relatorios: rj, linhas: [lin(velhoQueNaoE(Wj, jovem.alvo.ytId), addDays(Wj.hoje, -5), 20)], ultimoRelatorio: addDays(Wj.hoje, -3), descartados: 0 }
    const l = blocosDe(Wj, al, jovem.alvo.id).canal.reguas.linhas.find(x => x.numero === 'impressoes')!
    // o vídeo de ontem: nenhum dia valeu ainda, então não é zero medido e a frase diz a verdade
    expect(l.zeroMedido).toBe(false)
    expect(l.valor).toBeNull()
    expect(l.semRegua).toBe(FRASE_NOVO)
    expect(l.semMedida).toMatch(/^\d+ sem impressão no período, [1-9]\d* sem medida$/)
  })

  it('CARTÃO e LISTA: o vídeo desse mundo diz "nenhuma nos N dias medidos" a partir da publicação, com o período do vídeo', () => {
    const v = buildProprioVideos(W.obs, W.canalId, dadosOk(W, alcance), { hoje: W.hoje, dm: dmDia })!
    const x = v.videos.find(y => y.ytId === A.alvo.ytId)!
    expect(x.semImpressao).toBe(true)
    expect(x.imp).toBeNull()
    expect(x.terceira).toBe('')
    expect(x.notas).toContain(`Impressões: nenhuma nos ${K - 1} dias medidos (1 dia sem dado), de ${dmDia(PUB)} a ${dmDia(dd(1))}.`)
    // um vídeo antigo: o período inteiro do canal, sem D-1
    const o = v.videos.find(y => y.ytId === antigoSem.ytId)!
    expect(o.semImpressao).toBe(true)
    expect(o.notas).toContain(`Impressões: nenhuma nos ${K + 5} dias medidos (1 dia sem dado), de ${dmDia(dd(K + 6))} a ${dmDia(dd(1))}.`)
  })

  it('GRÁFICO do vídeo: começa na publicação; D-1 é a única coluna não medida; a frase conta N e M certos', () => {
    const g = blocosDe(W, alcance, A.alvo.id).impressoes!.grafico!
    expect(g.colunas).toHaveLength(K)
    expect(g.colunas.slice(0, -1).every(c => c.situacao === 'zero-medido')).toBe(true)
    expect(g.colunas.at(-1)!.situacao).toBe('nao-medido')
    expect(g.resumo).toBe(`Nenhuma impressão nos ${K - 1} dias medidos (1 dia sem dado).`)
  })
})

describe('vídeo publicado depois do último dia medido (1 dia de vida)', () => {
  const A = comVideoPublicadoHa(1)
  const W = mundoVideo({ mut: A.mut })
  const dd = (n: number) => addDays(W.hoje, -n)
  // relatórios lidos de d(10) a d(3); o vídeo é de ontem
  const relatorios: RelatorioDia[] = Array.from({ length: 8 }, (_, i) => rel(dd(10 - i), 'vazio'))
  const alcance: AlcanceCanal = { canalId: W.canalId, relatorios, linhas: [lin(velhoQueNaoE(W, A.alvo.ytId), dd(5), 20)], ultimoRelatorio: dd(3), descartados: 0 }

  it('CARTÃO e LISTA: não é zero medido; a coluna diz "vídeo novo" e a terceira linha fica vazia', () => {
    const v = buildProprioVideos(W.obs, W.canalId, dadosOk(W, alcance), { hoje: W.hoje, dm: dmDia })!
    const x = v.videos.find(y => y.ytId === A.alvo.ytId)!
    expect(x.imp).toBeNull()
    expect(x.semImpressao).toBe(false)
    expect(x.impMissing).toBe('vídeo novo')
    expect(x.cliquesMissing).toBe('vídeo novo')
    expect(x.terceira).toBe('')
    expect(x.notas).toContain('Impressões e cliques: ' + FRASE_NOVO + '.')
  })

  it('o vídeo mais antigo do mesmo canal continua zero medido (a regra é por vídeo)', () => {
    const v = buildProprioVideos(W.obs, W.canalId, dadosOk(W, alcance), { hoje: W.hoje, dm: dmDia })!
    const velho = v.videos.filter(y => y.imp == null && y.ytId !== A.alvo.ytId && y.pub != null && y.pub < W.obs.NOW - 30 * DIA_MS)
    expect(velho.length).toBeGreaterThan(0)
    expect(velho.every(y => y.semImpressao && y.impMissing == null)).toBe(true)
  })
})

describe('dois dias de vida: publicado em D-2, relatórios até D-1 lidos e vazios', () => {
  const A = comVideoPublicadoHa(2)
  const W = mundoVideo({ mut: A.mut })
  const dd = (n: number) => addDays(W.hoje, -n)
  const relatorios: RelatorioDia[] = Array.from({ length: 10 }, (_, i) => rel(dd(10 - i), 'vazio')) // d(10) a d(1)
  const alcance: AlcanceCanal = { canalId: W.canalId, relatorios, linhas: [lin(velhoQueNaoE(W, A.alvo.ytId), dd(5), 20)], ultimoRelatorio: dd(1), descartados: 0 }

  it('2 dias de vida é "vídeo novo" (só D e D-1 de dados), nunca zero medido, mesmo com o dia da publicação já fechado', () => {
    const v = buildProprioVideos(W.obs, W.canalId, dadosOk(W, alcance), { hoje: W.hoje, dm: dmDia })!
    const x = v.videos.find(y => y.ytId === A.alvo.ytId)!
    const pub = dayPt(new Date(W.obs.video(A.alvo.id)!.pub))
    expect(diffDias(pub, W.hoje)).toBe(2)
    expect(x.semImpressao).toBe(false)
    expect(x.impMissing).toBe('vídeo novo')
  })
})

/* ================================================================ N1: "vídeo novo" diz a MESMA coisa na página, no cartão, na lista e na régua  */

describe('N1: um limite só para "vídeo novo" (menos de DIAS_DE_VIDA_MIN dias de vida)', () => {
  it('a constante é uma só (a da série de views da página) e vale 3; videoNovo corta nela', () => {
    expect(MIN_DIAS_DE_VIDA).toBe(3)
    expect(DIAS_DE_VIDA_MIN).toBe(MIN_DIAS_DE_VIDA)
    expect(videoNovo(d(0), HOJE)).toBe(true)
    expect(videoNovo(d(1), HOJE)).toBe(true)
    expect(videoNovo(d(2), HOJE)).toBe(true)
    expect(videoNovo(d(3), HOJE)).toBe(false)
    expect(videoNovo(null, HOJE)).toBe(false)   // sem data de publicação: nunca "novo" (o que o código já fazia)
  })

  // 17 h, 2 dias e 3 dias de vida; relatórios lidos de d(10) a d(3); só um vídeo antigo tem linha
  const CASOS = [
    { nome: '17 horas', mk: () => comVideoPublicadoHa(0, 17), novo: true },
    { nome: '2 dias', mk: () => comVideoPublicadoHa(2), novo: true },
    { nome: '3 dias', mk: () => comVideoPublicadoHa(3), novo: false },
  ] as const
  for (const c of CASOS) {
    describe(`vídeo de ${c.nome}, sem linha de alcance`, () => {
      const A = c.mk()
      const W = mundoVideo({ mut: A.mut })
      const dd = (n: number) => addDays(W.hoje, -n)
      const relatorios: RelatorioDia[] = Array.from({ length: 8 }, (_, i) => rel(dd(10 - i), 'vazio'))
      const alcance: AlcanceCanal = { canalId: W.canalId, relatorios, linhas: [lin(velhoQueNaoE(W, A.alvo.ytId), dd(5), 20)], ultimoRelatorio: dd(3), descartados: 0 }
      const cartao = () => buildProprioVideos(W.obs, W.canalId, dadosOk(W, alcance), { hoje: W.hoje, dm: dmDia })!.videos.find(y => y.ytId === A.alvo.ytId)!
      const blocos = () => blocosDe(W, alcance, A.alvo.id)
      const regua = () => blocos().canal.reguas.linhas.find(l => l.numero === 'impressoes')!

      if (c.novo) {
        it('PÁGINA: a seção diz "vídeo novo" e não desenha dia nenhum', () => {
          const b = blocos().impressoes!
          expect(b.medido).toBe(false)
          expect(b.grafico).toBeNull()
          expect(b.frase).toMatch(/^Vídeo novo: /)
        })
        it('CARTÃO e LISTA: a palavra da coluna é "vídeo novo"; não é zero, não é "0"; a terceira linha fica vazia e a nota diz o motivo', () => {
          const x = cartao()
          expect(x.imp).toBeNull()
          expect(x.semImpressao).toBe(false)
          expect(x.impMissing).toBe('vídeo novo')
          expect(x.cliquesMissing).toBe('vídeo novo')
          expect(x.terceira).toBe('')
          expect(x.notas).toContain('Impressões e cliques: ' + FRASE_NOVO + '.')
        })
        it('RÉGUA: sem valor, sem zero medido, e a frase é a do vídeo novo', () => {
          const l = regua()
          expect(l.valor).toBeNull()
          expect(l.zeroMedido).toBe(false)
          expect(l.semRegua).toBe(FRASE_NOVO)
        })
      } else {
        it('PÁGINA, CARTÃO, LISTA e RÉGUA concordam: 1 dia medido (o da publicação), zero medido', () => {
          const pub = diaDaPub(W, A.alvo.id)
          expect(diffDias(pub, W.hoje)).toBe(3)
          const g = blocos().impressoes!.grafico!
          expect(g.colunas).toHaveLength(1)
          expect(g.colunas[0]!.situacao).toBe('zero-medido')
          const x = cartao()
          expect(x.semImpressao).toBe(true)
          expect(x.impMissing).toBeNull()
          expect(x.notas).toContain(`Impressões: nenhuma em 1 dia medido, de ${dmDia(pub)} a ${dmDia(pub)}.`)
          expect(regua().zeroMedido).toBe(true)
          expect(regua().semRegua).toBe('Nenhuma impressão em 1 dia medido. O 1 vídeo com impressão fica acima dele.')
        })
      }
    })
  }

  describe('vídeo de 17 horas COM linha no relatório: o número aparece em todo lugar e nenhuma frase o nega', () => {
    const A = comVideoPublicadoHa(0, 17)
    const W = mundoVideo({ mut: A.mut })
    const pub = diaDaPub(W, A.alvo.id)
    const dd = (n: number) => addDays(W.hoje, -n)
    const ate = diffDias(pub, W.hoje) // 0 ou 1
    // relatórios lidos de d(10) até o dia anterior à publicação; o da publicação veio "baixado" com 40 impressões do vídeo
    const relatorios: RelatorioDia[] = [...Array.from({ length: 10 - ate - 1 }, (_, i) => rel(dd(10 - i), 'vazio')), rel(pub, 'baixado')]
    const alcance: AlcanceCanal = { canalId: W.canalId, relatorios, linhas: [lin(A.alvo.ytId, pub, 40, 0.1), lin(velhoQueNaoE(W, A.alvo.ytId), dd(5), 20)], ultimoRelatorio: pub, descartados: 0 }

    it('CARTÃO: 40 impressões; RÉGUA: valor "40"; PÁGINA: o gráfico existe e não diz "ainda não há dia deste vídeo"', () => {
      const x = buildProprioVideos(W.obs, W.canalId, dadosOk(W, alcance), { hoje: W.hoje, dm: dmDia })!.videos.find(y => y.ytId === A.alvo.ytId)!
      expect(x.imp).toBe(40)
      expect(x.impMissing).toBeNull()
      const b = blocosDe(W, alcance, A.alvo.id)
      expect(b.canal.reguas.linhas.find(l => l.numero === 'impressoes')!.valor).toBe('40')
      expect(b.impressoes!.medido).toBe(true)
      expect(b.impressoes!.frase).toBeNull()
      expect(b.impressoes!.grafico!.colunas.some(c => c.situacao === 'com-impressoes')).toBe(true)
    })
  })
})

/* ================================================================ N2: os textos de D e D-1 não mentem  */

describe('N2: legenda, resumo e dica não dizem que o relatório falhou quando o dia só ainda não chegou', () => {
  const O = { escopo: 'canal' as const, alturaArea: 180, dm: dmDia, acesso: 'ok' as const, hoje: HOJE }
  const mont = (a: AlcanceCanal) => { const m = montarDias(a, { hoje: HOJE }); return buildImpressoes(m.dias, m.periodo, O) }

  it('legenda do "não medido" do gráfico de impressões é a MESMA do gráfico de views (K3): "o YouTube não entregou o dia"', () => {
    const v = mont(canal(lidos(8, 1), [lin('a', d(5), 10)]))
    const t = v.legenda.find(l => l.situacao === 'nao-medido')!.texto
    expect(t).toBe('não medido (hachura): o YouTube não entregou o dia')
  })

  it('resumo com buraco: "(outro dia sem dado)", "(outros N sem dado)" e "(N dias sem dado)"', () => {
    // d(8) a d(2) lidos (7 dias), D-1 não medido; impressão em 2 dias
    expect(mont(canal(lidos(8, 1), [lin('a', d(5), 10), lin('a', d(4), 10)])).resumo)
      .toBe('20 impressões e 2 cliques estimados em 7 dias medidos (outro dia sem dado): 2 dias com impressão e 5 sem impressão.')
    expect(mont(canal(lidos(8, 0), [lin('a', d(5), 10)])).resumo).toContain('(outros 2 sem dado)')
    expect(mont(canal(lidos(8, 1))).resumo).toBe('Nenhuma impressão nos 7 dias medidos (1 dia sem dado).')
  })

  it('tudo medido com impressão em todos os dias: "em N dias medidos: impressão em todos"', () => {
    const linhas = [3, 4, 5].map(n => lin('a', d(n), 10))
    expect(mont(canal(lidos(5, 3), linhas)).resumo).toBe('30 impressões e 3 cliques estimados em 3 dias medidos: impressão em todos.')
  })

  it('a dica e o texto da situação do dia recente são UMA frase só', () => {
    const v = mont(canal(lidos(5, 1)))
    const ult = v.colunas.at(-1)!
    expect(ult.situacaoTexto).toBe(TEXTO_RECENTE)
    expect(ult.dica.endsWith(TEXTO_RECENTE)).toBe(true)
  })

  it('dia mais antigo SEM relatório lido continua com a frase de sem relatório', () => {
    const v = mont(canal([...lidos(8, 5), ...lidos(3, 1)]))   // d(4) sem relatório nenhum
    const col = v.colunas.find(c => c.dia === d(4))!
    expect(col.situacaoTexto).toBe('sem relatório: não medido')
  })
})

/* ================================================================ o TOTAL do vídeo também só começa na publicação (preocupação 4 do relatório do zero medido)  */

describe('linha de alcance ANTERIOR à publicação: nenhum total a soma (cartão, lista, régua, página e alcancePorVideo dão o mesmo número)', () => {
  const A = comVideoPublicadoHa(10)
  const W = mundoVideo({ mut: A.mut })
  const PUB = diaDaPub(W, A.alvo.id)
  const K = diffDias(PUB, W.hoje)
  const dd = (n: number) => addDays(W.hoje, -n)
  const outro = velhoQueNaoE(W, A.alvo.ytId)
  const relatorios: RelatorioDia[] = Array.from({ length: K + 6 - 2 + 1 }, (_, i) => rel(dd(K + 6 - i), 'baixado')) // d(K+6) a d(2)
  // 111 impressões em K+3 (antes da publicação: dado que em produção não existe) e 22 em K-2 (depois); o outro vídeo dá base à régua
  const alcance: AlcanceCanal = {
    canalId: W.canalId, relatorios, ultimoRelatorio: dd(2), descartados: 0,
    linhas: [lin(A.alvo.ytId, dd(K + 3), 111, 0.1), lin(A.alvo.ytId, dd(K - 2), 22, 0.5), lin(outro, dd(5), 20)],
  }
  const pubs = new Map<string, DiaYt | null>([[A.alvo.ytId, PUB]])

  it('premissa: a publicação é depois de duas das linhas e a janela do canal começa antes dela', () => {
    expect(dd(K + 3) < PUB).toBe(true)
    expect(relatorios[0]!.dia < PUB).toBe(true)
  })

  it('alcancePorVideo com a publicação: só a linha desde a publicação (22, 1 dia); sem a publicação do vídeo: nenhum corte (o que o vídeo sem data faz)', () => {
    const v = alcancePorVideo(alcance, pubs).get(A.alvo.ytId)!
    expect(v.imp).toBe(22)
    expect(v.diasComImpressao).toBe(1)
    expect(v.cliques).toBeCloseTo(11, 9)
    expect(alcancePorVideo(alcance, new Map()).get(A.alvo.ytId)!.imp).toBe(133)
    expect(alcancePorVideo(alcance, new Map([[A.alvo.ytId, null]])).get(A.alvo.ytId)!.imp).toBe(133)
    // o outro vídeo não é afetado
    expect(alcancePorVideo(alcance, pubs).get(outro)!.imp).toBe(20)
  })

  it('o vídeo só com linha ANTES da publicação deixa de ter impressão nenhuma', () => {
    const so = { ...alcance, linhas: [lin(A.alvo.ytId, dd(K + 3), 111, 0.1), lin(outro, dd(5), 20)] }
    expect(alcancePorVideo(so, pubs).has(A.alvo.ytId)).toBe(false)
  })

  it('CARTÃO e LISTA, RÉGUA e PÁGINA: o mesmo total, 22 (e a nota do cartão diz 1 dia)', () => {
    const x = buildProprioVideos(W.obs, W.canalId, dadosOk(W, alcance), { hoje: W.hoje, dm: dmDia })!.videos.find(y => y.ytId === A.alvo.ytId)!
    expect(x.imp).toBe(22)
    expect(x.notas.some(n => n.startsWith('Impressões: 22 em 1 dia, '))).toBe(true)
    const b = blocosDe(W, alcance, A.alvo.id)
    expect(b.canal.reguas.linhas.find(l => l.numero === 'impressoes')!.valor).toBe('22')
    const g = b.impressoes!.grafico!
    expect(g.colunas[0]!.dia).toBe(PUB)
    expect(g.colunas.filter(c => c.situacao === 'com-impressoes').map(c => c.imp)).toEqual(['22'])
  })

  it('o cabeçalho do canal e a lista de vídeos leem a mesma coisa de lerEstado (porVideo cortado pela publicação)', () => {
    const lido = lerEstado({ acesso: 'ok', dado: alcance }, W.hoje, pubs)
    expect(lido.estado === 'ok' && lido.porVideo.get(A.alvo.ytId)!.imp).toBe(22)
  })
})
