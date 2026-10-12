// O mundo das tarefas da página do canal próprio e do vídeo próprio (A4): o oráculo com os canais próprios do preset e o dado
// privado (alcance e diário por vídeo) SINTÉTICO. Regras:
//  - o conjunto base é lido UMA vez por arquivo e por preset (a3-fixture guarda); cada chamada trabalha numa cópia;
//  - nenhuma data é fixa: tudo é relativo a `agora` (relógio injetado, por padrão Date.now()), no dia do YouTube (Pacífico);
//  - os presets de canal são os de a3-fixture ('1', '2', '5', 'mix', 'zero') e `semProprio` (0 canais próprios);
//  - os cenários de dado são `DADOS`: cheio, curto, vazio, parado, negado, erro; cada um é uma função pura de (canal, vídeos, hoje).
import { a3World } from './a3-fixture'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import { dmDia, longosAcompanhados } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { AlcanceCanal, AlcanceLinha, DiaYt, DiarioCanal, DiarioLinha, RelatorioDia, StatusRelatorio } from '@/lib/youtube/observatorio/proprio/tipos'
import type { OwnPreset } from '../../fixtures/observatorio/own-presets'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import type { Observatory } from '@/lib/youtube/observatorio'

const DIA_MS = 86_400_000

/* ---------------------------------------------------------------- mutações do dataset (rodam antes do motor) */

/** O primeiro canal próprio do dataset: o mesmo que `proprioWorld` devolve em `canalId`. */
export const primeiroProprio = (ds: Dataset) => {
  const c = ds.channels.find(x => x.own)
  if (!c) throw new Error('o preset não tem canal próprio')
  return c
}

/**
 * O canal próprio como a produção o carrega: sem série diária no motor (D2: `series: []`) e sem contagem diária de inscritos
 * (`snapshots: []`). O oráculo traz as duas coisas para o próprio; sem este ajuste "inscritos em 30 dias" apareceria medido.
 */
export function comoEmProducao(ds: Dataset): void {
  const ids = new Set(ds.channels.filter(c => c.own).map(c => c.id))
  for (const c of ds.channels) if (ids.has(c.id)) c.snapshots = []
  for (const v of ds.videos) if (ids.has(v.ch)) { v.series = []; v.firstIdx = null }
}

/** Canal novo, sem vídeo nenhum. */
export function semVideos(ds: Dataset): void {
  const id = primeiroProprio(ds).id
  for (let i = ds.videos.length - 1; i >= 0; i--) if (ds.videos[i]!.ch === id) ds.videos.splice(i, 1)
}

/** Canal parado: todos os vídeos publicados há mais de 91 dias (nenhum nas últimas 13 semanas). */
export function parado(ds: Dataset): void {
  const id = primeiroProprio(ds).id
  const vs = ds.videos.filter(v => v.ch === id)
  const maisNovo = Math.min(...vs.map(v => v.ageDays))
  const empurra = Math.max(0, 100 - maisNovo) // o mais novo passa a ter 100 dias
  for (const v of vs) { v.pub -= empurra * DIA_MS; v.ageDays += empurra }
}

/** O canal esconde a contagem de inscritos (null, nunca 0). */
export function inscritosOcultos(ds: Dataset): void { primeiroProprio(ds).subs = null }

/** Nenhum vídeo do canal tem a contagem de comentários. */
export function semComentarios(ds: Dataset): void {
  const id = primeiroProprio(ds).id
  for (const v of ds.videos) if (v.ch === id) v.comments = null
}

/** O site sem canal próprio: tira os canais próprios e os vídeos deles. */
export function semCanalProprio(ds: Dataset): void {
  const ids = new Set(ds.channels.filter(c => c.own).map(c => c.id))
  for (let i = ds.channels.length - 1; i >= 0; i--) if (ids.has(ds.channels[i]!.id)) ds.channels.splice(i, 1)
  for (let i = ds.videos.length - 1; i >= 0; i--) if (ids.has(ds.videos[i]!.ch)) ds.videos.splice(i, 1)
}

/** 0 canais próprios: o motor sem nenhum. */
export function mundoSemProprio(): Observatory {
  return a3World(semCanalProprio).obs
}

/* ---------------------------------------------------------------- dado privado sintético */

const rel = (dia: DiaYt, status: StatusRelatorio = 'baixado', normalizado = true): RelatorioDia => ({ dia, status, normalizado })
const alc = (canalId: string, relatorios: RelatorioDia[], linhas: AlcanceLinha[], extra: Partial<AlcanceCanal> = {}): AlcanceCanal => ({
  canalId, relatorios, linhas, ultimoRelatorio: relatorios.reduce<DiaYt | null>((m, r) => (m == null || r.dia > m ? r.dia : m), null), descartados: 0, ...extra,
})
const diarioDe = (canalId: string, linhas: DiarioLinha[], ultimoDia: DiaYt | null): DiarioCanal => ({ canalId, ultimoDia, linhas, descartados: 0 })

/** Os 11 dias (de 19 lidos) com impressão, em "dias atrás". */
export const DIAS_COM_IMPRESSAO = [3, 4, 6, 8, 9, 11, 13, 14, 16, 18, 21] as const
/** O que a série cheia soma, para os testes não recalcularem com a mesma fórmula do código: 19 dias lidos, 11 com impressão. */
export const CHEIO = { diasLidos: 19, diasCom: 11, diasNaoMedidos: 2, impPorDia: 17, imp: 187, cliquesPorDia: 2.2, cliques: 24.2, videosCom: 2 } as const

/**
 * Série cheia: 19 dias lidos (hoje-21 a hoje-3), 11 com impressão (17 impressões no dia: 12 do 1º vídeo com CTR 0,1 e 5 do 2º
 * com CTR 0,2 = 2,2 cliques), 8 vazios; hoje-2 e hoje-1 com relatório ainda por baixar (não medidos). Período: 21 dias.
 */
export function alcanceCheio(canalId: string, ytIds: readonly string[], hoje: DiaYt): AlcanceCanal {
  const d = (n: number) => addDays(hoje, -n)
  const relatorios: RelatorioDia[] = []
  for (let n = 3; n <= 21; n++) relatorios.push(rel(d(n), (DIAS_COM_IMPRESSAO as readonly number[]).includes(n) ? 'baixado' : 'vazio'))
  relatorios.push(rel(d(2), 'listado', false), rel(d(1), 'listado', false))
  const [a, b] = ytIds
  const linhas: AlcanceLinha[] = []
  for (const n of DIAS_COM_IMPRESSAO) {
    if (a) linhas.push({ ytId: a, dia: d(n), imp: 12, ctr: 0.1 })
    if (b) linhas.push({ ytId: b, dia: d(n), imp: 5, ctr: 0.2 })
  }
  return alc(canalId, relatorios, linhas)
}

/** Série curta: dois dias lidos (um com impressão, um vazio). */
export function alcanceCurto(canalId: string, ytIds: readonly string[], hoje: DiaYt): AlcanceCanal {
  const d = (n: number) => addDays(hoje, -n)
  const linhas: AlcanceLinha[] = ytIds[0] ? [{ ytId: ytIds[0], dia: d(3), imp: 9, ctr: 0.1 }] : []
  return alc(canalId, [rel(d(3)), rel(d(2), 'vazio')], linhas)
}

/** Os relatórios da série cheia (período de 21 dias, 19 lidos) com as linhas de alcance que o teste dita: para casos de um vídeo só. */
export function alcanceComLinhas(canalId: string, hoje: DiaYt, linhas: AlcanceLinha[]): AlcanceCanal {
  return { ...alcanceCheio(canalId, [], hoje), linhas }
}

/** Tabela vazia: nenhum relatório e nenhuma linha (canal novo; o banco local de hoje). */
export const alcanceVazio = (canalId: string): AlcanceCanal => alc(canalId, [], [])

/** Todos os dias lidos vieram vazios: zero medido, não ausência. */
export function alcanceSoVazios(canalId: string, hoje: DiaYt, dias = 10): AlcanceCanal {
  return alc(canalId, Array.from({ length: dias }, (_, i) => rel(addDays(hoje, -(i + 3)), i % 2 ? 'vazio' : 'baixado')), [])
}

/** Relatórios existem, mas nenhum foi lido (todos por baixar, com erro ou expirados). */
export function alcanceNadaLido(canalId: string, hoje: DiaYt): AlcanceCanal {
  return alc(canalId, [rel(addDays(hoje, -3), 'listado', false), rel(addDays(hoje, -2), 'erro', false), rel(addDays(hoje, -1), 'expirado_sem_baixar', false)], [])
}

/** Diário cheio: 30 dias seguidos que terminam em hoje-2, um valor fixo por vídeo (2, 4, 6…), então a mediana é conferível à mão. */
export function diarioCheio(canalId: string, longos: readonly string[], hoje: DiaYt): DiarioCanal {
  const ultimo = addDays(hoje, -2)
  const linhas: DiarioLinha[] = []
  longos.forEach((ytId, j) => { for (let n = 0; n < 30; n++) linhas.push({ ytId, dia: addDays(ultimo, -n), views: (j + 1) * 2 }) })
  return diarioDe(canalId, linhas, ultimo)
}

/** Diário curto: três dias (menos de 7 medidos). */
export function diarioCurto(canalId: string, longos: readonly string[], hoje: DiaYt): DiarioCanal {
  const ultimo = addDays(hoje, -1)
  const linhas: DiarioLinha[] = longos.flatMap(ytId => [0, 1, 2].map(n => ({ ytId, dia: addDays(ultimo, -n), views: 5 })))
  return diarioDe(canalId, linhas, ultimo)
}

/** Diário que parou: o último dia gravado tem mais de 7 dias. */
export function diarioParado(canalId: string, longos: readonly string[], hoje: DiaYt): DiarioCanal {
  const ultimo = addDays(hoje, -20)
  const linhas: DiarioLinha[] = longos.flatMap(ytId => Array.from({ length: 30 }, (_, n) => ({ ytId, dia: addDays(ultimo, -n), views: 7 })))
  return diarioDe(canalId, linhas, ultimo)
}

/** Tabela vazia: a coleta diária nunca gravou este canal. */
export const diarioVazio = (canalId: string): DiarioCanal => diarioDe(canalId, [], null)

export type CenarioDados = 'cheio' | 'curto' | 'vazio' | 'parado' | 'negado' | 'erro'
export const DADOS: Record<CenarioDados, (canalId: string, longos: readonly string[], hoje: DiaYt) => DadosDoCanal> = {
  cheio: (c, l, h) => ({ alcance: { acesso: 'ok', dado: alcanceCheio(c, l, h) }, diario: { acesso: 'ok', dado: diarioCheio(c, l, h) } }),
  curto: (c, l, h) => ({ alcance: { acesso: 'ok', dado: alcanceCurto(c, l, h) }, diario: { acesso: 'ok', dado: diarioCurto(c, l, h) } }),
  vazio: (c) => ({ alcance: { acesso: 'ok', dado: alcanceVazio(c) }, diario: { acesso: 'ok', dado: diarioVazio(c) } }),
  parado: (c, l, h) => ({ alcance: { acesso: 'ok', dado: alcanceCheio(c, l, addDays(h, -20)) }, diario: { acesso: 'ok', dado: diarioParado(c, l, h) } }),
  negado: () => ({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }),
  erro: () => ({ alcance: { acesso: 'erro' }, diario: { acesso: 'erro' } }),
}

/* ---------------------------------------------------------------- o mundo */

/**
 * O mundo de um canal próprio (o primeiro do preset) com dado privado sintético; a base é lida uma vez por arquivo.
 * `dados` substitui peças do cenário `cheio`; `cenario` troca o cenário inteiro; `agora` é o relógio do dado privado.
 */
export function proprioWorld(o: { preset?: OwnPreset; mut?: (ds: Dataset) => void; dados?: Partial<DadosDoCanal>; cenario?: CenarioDados; agora?: number } = {}): {
  obs: Observatory; canalId: string; ytIds: string[]; dados: DadosDoCanal; hoje: DiaYt; dm: (d: DiaYt) => string
} {
  const w = a3World(ds => { comoEmProducao(ds); o.mut?.(ds) }, o.preset ?? '2')
  const canalId = w.owns[0]
  if (!canalId) throw new Error('o preset não tem canal próprio: use mundoSemProprio()')
  const hoje = dayPt(new Date(o.agora ?? Date.now()))
  const ytIds = longosAcompanhados(w.obs, canalId)
  const dados: DadosDoCanal = { ...DADOS[o.cenario ?? 'cheio'](canalId, ytIds, hoje), ...o.dados }
  return { obs: w.obs, canalId, ytIds, dados, hoje, dm: dmDia }
}

