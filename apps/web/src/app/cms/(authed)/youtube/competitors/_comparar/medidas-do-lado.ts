/**
 * A5 E5a, Tarefa 7 (tela 17a): as medidas novas de UM lado da comparação (M3 em três leituras, M1 nas três idades, M4, M7 e M8), já em
 * texto e em forma de célula. PURO: roda no navegador sobre o que veio no pacote (`MedidasDoCanalPack`); não lê relógio (usa o `hojeSP`
 * do pacote) nem faz pedido. Trocar o seletor para um terceiro canal usa as medidas DELE, que já estão no pacote.
 *
 * Quatro formas que nunca trocam de aparência (plano 4.2): `medido`, `nao_medido` (hachura, com o motivo), `nao_carregou` (erro) e
 * `ainda_nao_existe` (pontilhado: a leitura só nasce numa data). Canal próprio: o YouTube não dá esse número do seu canal.
 */
import type { M8DoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { ValorAcerto } from '@/lib/youtube/observatorio/medidas/acerto'
import type { ValorDirecaoCanal, ValorDirecaoVideos } from '@/lib/youtube/observatorio/medidas/direcao'
import type { Medida, MotivoNaoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import type { ExtrasDoCanal } from '@/lib/youtube/observatorio/medidas-telas/ler-extras-dos-canais'
import { avisoDeContagem, aindaNaoExiste, primeiras24hDesde } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { direcaoExibida, type SimboloDeDirecao } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'
import { FRASES, classeDoMotivo } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { celulaDeDirecao, FRASE_CANAL_PROPRIO } from '../_canais/direcao-model'
import { estadoDaLinha, type EstadoDaLinha } from '../_canais/estado-model'

/* ================================================================================================================== o que vem no pacote */

/** As medidas de um concorrente em dado simples (sem `Map`, sem função, sem `undefined`, sem `porVideo`). */
export interface MedidasPlanas {
  m3a: Medida<ValorDirecaoCanal>
  m3b: Medida<ValorDirecaoVideos>
  m3c: Medida<ValorDirecaoVideos>
  m1: { 1: Medida<number>; 7: Medida<number>; 30: Medida<number> }
  m4: Medida<ValorAcerto>
  m7: Medida<number>
  m8: M8DoCanal
}

export type FonteDeMedidas =
  | { tipo: 'medidas'; m: MedidasPlanas; extras: ExtrasDoCanal | null }
  | { tipo: 'canal_proprio' }
  | { tipo: 'nao_carregou'; causa: string }

/** Tudo o que a tela precisa de um canal além dos números antigos. */
export interface MedidasDoCanalPack {
  fonte: FonteDeMedidas
  /** Vídeos com data (zero = o estado "sem vídeos") e se o canal ainda está sendo buscado (1ª busca ou vídeos sem data). */
  videosN: number
  buscando: boolean
  /** "dd/mm" da última leitura boa do canal (só serve de "até dd/mm" para canal fora do ar). */
  ultimaBoa: string | null
  /** Longos publicados nos últimos 90 dias e nos 90 anteriores (contagem, não frequência). Só longos de formato confirmado, sem lives e sem estreias agendadas. */
  longos: {
    recente: number; anterior: number
    /** O histórico guardado alcança o começo do período anterior? Sem isso, "N contra 0" é falta de cobertura, não queda. `desde` = 'AAAA-MM-DD' do vídeo mais antigo guardado. */
    cobertura: { ok: true } | { ok: false; desde: string | null }
    /** Quantos vídeos ficaram fora da conta nos 180 dias (a célula diz). */
    fora: { semFormato: number; aoVivo: number; agendados: number }
  }
}

/** A forma mínima de `MedidasDoCanal` que o pacote guarda; o resto (porVideo, falhas) não vai ao navegador. */
export interface MedidasDoCanalCompleto {
  porFormato: { long: { m1: MedidasPlanas['m1']; m4: MedidasPlanas['m4']; m7: MedidasPlanas['m7']; m3b: MedidasPlanas['m3b']; m3c: MedidasPlanas['m3c'] } }
  m3a: MedidasPlanas['m3a']
  m8: M8DoCanal
}

/** Tira `undefined` e qualquer coisa que não seja JSON: o pacote é serializado para o navegador. */
const plano = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

export function planasDe(m: MedidasDoCanalCompleto): MedidasPlanas {
  const l = m.porFormato.long
  return plano({ m3a: m.m3a, m3b: l.m3b, m3c: l.m3c, m1: { 1: l.m1[1], 7: l.m1[7], 30: l.m1[30] }, m4: l.m4, m7: l.m7, m8: m.m8 })
}

/* ================================================================================================================== formatos */

const MENOS = '−'
const dec1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',')
/** "1,4 mi", "66,8 mil", "118": a mesma escrita do `fmt.num` do motor. */
export function vis(v: number): string {
  const a = Math.abs(v), s = v < 0 ? MENOS : ''
  const d = (x: number) => { const r = Math.round(x * 10) / 10; return (r % 1 === 0 ? String(r) : r.toFixed(1)).replace('.', ',') }
  if (a < 1000) return s + Math.round(a)
  if (a < 1e6) return s + d(a / 1e3) + ' mil'
  return s + d(a / 1e6) + ' mi'
}
export const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
export const longos = (n: number): string => `${n} ${n === 1 ? 'longo' : 'longos'}`

/* ================================================================================================================== as formas de célula */

export type Falta =
  | { tipo: 'nao_medido'; motivo: MotivoNaoMedido; porque: string }
  | { tipo: 'nao_carregou' }
  | { tipo: 'canal_proprio'; porque: string }
export type Ainda = { tipo: 'ainda_nao_existe'; existeEm: string }

export type CelulaDirecao =
  | {
    tipo: 'medido'; simbolo: SimboloDeDirecao; texto: string; pct: number; variacao: number; sub: string
    /** A janela cruza a mudança de contagem de 24/08: a marca diz até quando. */
    marca: { ate: string } | null
  }
  | Falta | Ainda

export type CelulaNumero = { tipo: 'medido'; x: number; texto: string; sub: string } | Falta
export type CelulaAcerto =
  | { tipo: 'medido'; acertos: number; fracassos: number; total: number; meio: number; pct: number | null }
  | Falta
export interface Reacao { x: number; texto: string; idade: '30' | 'hoje'; soCurtidas: boolean; soComentarios: boolean; n: number }
export type CelulaReacao = { tipo: 'medido' } & Reacao | Falta
export type CelulaContagem =
  | {
    tipo: 'medido'; simbolo: SimboloDeDirecao; recente: number; anterior: number
    /** Variação em %; null quando o período anterior tem 0 (dividir por 0 não dá percentual). */
    pct: number | null
    /** "Fora da conta: ..." quando há vídeos de formato não confirmado, ao vivo ou agendados; senão null. */
    fora: string | null
  }
  | Falta

export interface LadoMedidas {
  id: string
  proprio: boolean
  /** Nenhuma medida chegou deste lado (o cartão só mostra o nome e a pastilha "não carregou"). */
  naoCarregou: boolean
  estado: EstadoDaLinha
  /** "dd/mm": canal fora do ar; as linhas dizem "até dd/mm". */
  ate: string | null
  a: CelulaDirecao
  b: CelulaDirecao
  c: CelulaDirecao
  pub: CelulaContagem
  m1: { 1: CelulaNumero; 7: CelulaNumero; 30: CelulaNumero }
  acerto: CelulaAcerto
  reacao: CelulaReacao
}

/* ================================================================================================================== o motivo, em frase */

/** O motivo escrito: o contexto (n e mínimo da própria medida) vira a frase da linha; sem contexto, a curta da tabela única. */
function porque(m: Extract<Medida<unknown>, { estado: 'nao_medido' }>, o: { unidade?: string; idade?: 1 | 7 | 30 } = {}): string {
  if (m.motivo === 'poucos_videos' && typeof m.n === 'number' && typeof m.minimo === 'number' && o.unidade) {
    return `${m.n === 0 ? 'nenhum' : `só ${m.n}`} ${o.unidade}; precisa de ${m.minimo}`
  }
  if (o.idade === 1 && m.motivo === 'leitura_comecou_depois') {
    const d = primeiras24hDesde()
    return d ? `publicado antes de ${dm(d)}: as primeiras horas não foram contadas` : 'as primeiras horas ainda não foram contadas'
  }
  return FRASES[m.motivo]({ desde: m.desde, fechaEm: m.fechaEm, n: m.n, minimo: m.minimo }, 'comparar').curta
}

function falta(m: Extract<Medida<unknown>, { estado: 'nao_medido' }>, o?: { unidade?: string; idade?: 1 | 7 | 30 }): Falta {
  if (classeDoMotivo(m.motivo) === 'nao_carregou') return { tipo: 'nao_carregou' }
  return { tipo: 'nao_medido', motivo: m.motivo, porque: porque(m, o) }
}

const PROPRIO: Falta = { tipo: 'canal_proprio', porque: FRASE_CANAL_PROPRIO }
const NAO_CARREGOU: Falta = { tipo: 'nao_carregou' }

/* ================================================================================================================== uma leitura de cada vez */

function direcaoDeVideos(m: Medida<ValorDirecaoVideos>, hojeSP: string, leitura: 'mesma_idade' | null): CelulaDirecao {
  if (leitura) {
    const ainda = aindaNaoExiste(leitura, hojeSP)
    if (ainda) return { tipo: 'ainda_nao_existe', existeEm: ainda.existeEm }
  }
  if (m.estado === 'nao_medido') return falta(m, { unidade: 'longos num dos períodos de 90 dias' })
  const x = direcaoExibida(m.valor.variacao)
  return {
    tipo: 'medido', simbolo: x.simbolo, texto: x.texto, pct: x.pct, variacao: m.valor.variacao,
    sub: `${vis(m.valor.medianaRecente)} contra ${vis(m.valor.medianaAnterior)} de mediana`, marca: avisoDeContagem(m.janela),
  }
}

function numeroDeIdade(m: Medida<number>, idade: 1 | 7 | 30, ate: string | null): CelulaNumero {
  if (m.estado === 'nao_medido') {
    const un = idade === 1 ? 'longos com leitura das primeiras horas' : `longos com ${idade} dias de contagem`
    return falta(m, { unidade: un, idade })
  }
  return { tipo: 'medido', x: m.valor, texto: vis(m.valor), sub: `mediana de ${longos(m.n)}${ate ? `, até ${ate}` : ''}` }
}

function reacaoDe(m: Medida<number>): CelulaReacao {
  if (m.estado === 'nao_medido') return falta(m, { unidade: 'longos com 100 views ou mais' })
  const pct = Math.round(m.valor * 1000) / 10
  return {
    tipo: 'medido', x: m.valor, texto: `${dec1(pct)}%`.replace('.', ','), idade: m.notas.some(n => n.tipo === 'total_de_hoje') ? 'hoje' : '30',
    soCurtidas: m.notas.some(n => n.tipo === 'so_curtidas'), soComentarios: m.notas.some(n => n.tipo === 'so_comentarios'), n: m.n,
  }
}

function acertoDe(m: Medida<ValorAcerto>): CelulaAcerto {
  if (m.estado === 'nao_medido') return falta(m, { unidade: 'longos com 7 dias ou mais' })
  const v = m.valor
  return { tipo: 'medido', acertos: v.acertos, fracassos: v.fracassos, total: v.total, meio: v.total - v.acertos - v.fracassos, pct: v.pctAcerto === null ? null : Math.round(v.pctAcerto * 100) }
}

/** TEXTO-A-REVISAR (Logan): os vídeos que a conta deixa de fora. */
function textoFora(f: MedidasDoCanalPack['longos']['fora']): string | null {
  const partes = [
    f.semFormato ? `${f.semFormato} de formato não confirmado` : null,
    f.aoVivo ? `${f.aoVivo} ao vivo` : null,
    f.agendados ? `${f.agendados} ${f.agendados === 1 ? 'agendado' : 'agendados'}` : null,
  ].filter((x): x is string => x !== null)
  return partes.length ? `Fora da conta: ${partes.join(', ')}.` : null
}

/** M? "longos publicados": a mesma regra de ±10% das outras direções, sem piso escondido. Período anterior sem cobertura = não medido; base 0 = "subindo" sem percentual. */
function contagemDe(l: MedidasDoCanalPack['longos']): CelulaContagem {
  if (!l.cobertura.ok) {
    // TEXTO-A-REVISAR (Logan)
    const porque = l.cobertura.desde
      ? `os vídeos guardados deste canal só vão até ${dm(l.cobertura.desde)}; o período anterior ficaria incompleto`
      : 'ainda não há vídeos com data guardados deste canal'
    return { tipo: 'nao_medido', motivo: 'leitura_comecou_depois', porque }
  }
  const min = 3
  if (l.recente < min && l.anterior < min) {
    const porque = l.recente === 0 && l.anterior === 0 ? 'nenhum longo nos dois períodos' : `${longos(l.recente)} contra ${l.anterior}; precisa de ${min} em um dos períodos`
    return { tipo: 'nao_medido', motivo: 'poucos_videos', porque }
  }
  const d = l.recente - l.anterior
  const variacao = l.anterior > 0 ? d / l.anterior : d > 0 ? 1 : 0
  return {
    tipo: 'medido', simbolo: direcaoExibida(variacao).simbolo, recente: l.recente, anterior: l.anterior,
    pct: l.anterior > 0 ? pctDaContagem(l) : null, fora: textoFora(l.fora),
  }
}

/* ================================================================================================================== o lado inteiro */

export function medidasDoLado(c: { id: string; own: boolean; medidasDoLado?: MedidasDoCanalPack | undefined }, hojeSP: string): LadoMedidas {
  const mp = c.medidasDoLado
  const f = mp?.fonte ?? ({ tipo: 'nao_carregou', causa: 'leitura_falhou' } as const)
  const videosN = mp?.videosN ?? 0
  const buscando = mp?.buscando ?? false
  if (c.own || f.tipo === 'canal_proprio') {
    return {
      id: c.id, proprio: true, naoCarregou: false, ate: null,
      estado: estadoDaLinha(null, null, videosN, { proprio: true, hojeSP, buscando }),
      a: PROPRIO, b: PROPRIO, c: PROPRIO, pub: PROPRIO, m1: { 1: PROPRIO, 7: PROPRIO, 30: PROPRIO }, acerto: PROPRIO, reacao: PROPRIO,
    }
  }
  if (f.tipo === 'nao_carregou') {
    return {
      id: c.id, proprio: false, naoCarregou: true, ate: null,
      estado: estadoDaLinha(null, null, videosN, { hojeSP, buscando }),
      a: NAO_CARREGOU, b: NAO_CARREGOU, c: NAO_CARREGOU, pub: NAO_CARREGOU, m1: { 1: NAO_CARREGOU, 7: NAO_CARREGOU, 30: NAO_CARREGOU }, acerto: NAO_CARREGOU, reacao: NAO_CARREGOU,
    }
  }
  const { m, extras } = f
  const estado = estadoDaLinha(m.m8, extras, videosN, { hojeSP, buscando })
  const ate = estado.pastilha === 'fora_do_ar' ? mp?.ultimaBoa ?? (estado.dataOuDias !== null && typeof estado.dataOuDias === 'string' ? dm(estado.dataOuDias) : null) : null
  const dirA = celulaDeDirecao(m.m3a, extras, { semVideos: videosN === 0 && !buscando })
  let a: CelulaDirecao
  if (dirA.tipo === 'medido') {
    const x = direcaoExibida(dirA.pct / 100)
    a = {
      tipo: 'medido', simbolo: x.simbolo, texto: x.texto, pct: dirA.pct, variacao: m.m3a.estado === 'medido' ? m.m3a.valor.variacao : dirA.pct / 100,
      sub: `${vis(dirA.ganhoRecente)} contra ${vis(dirA.ganhoAnterior)} views ganhas${ate ? `, até ${ate}` : ''}`, marca: dirA.avisoDeContagem,
    }
  } else if (dirA.tipo === 'nao_carregou') a = NAO_CARREGOU
  else if (dirA.tipo === 'canal_proprio') a = PROPRIO
  else a = { tipo: 'nao_medido', motivo: dirA.motivo, porque: m.m3a.estado === 'nao_medido' && !extras?.missingSince ? porque(m.m3a) : dirA.curta }
  return {
    id: c.id, proprio: false, naoCarregou: false, estado, ate, a,
    b: direcaoDeVideos(m.m3b, hojeSP, null),
    c: direcaoDeVideos(m.m3c, hojeSP, 'mesma_idade'),
    pub: contagemDe(mp?.longos ?? { recente: 0, anterior: 0, cobertura: { ok: true }, fora: { semFormato: 0, aoVivo: 0, agendados: 0 } }),
    m1: { 1: numeroDeIdade(m.m1[1], 1, ate), 7: numeroDeIdade(m.m1[7], 7, ate), 30: numeroDeIdade(m.m1[30], 30, ate) },
    acerto: acertoDe(m.m4), reacao: reacaoDe(m.m7),
  }
}

/* ================================================================================================================== textos que a tela e o pacote escrevem igual */

/** A janela de uma direção cruza a mudança de contagem do YouTube de 24/08. */
export const textoDaMarca = (ate: string): string => `A janela cruza a mudança de contagem do YouTube de 24/08 (vale até ${ate}).`
/** A variação em % que o quadrado de direção mostra para a contagem de longos publicados (a mesma regra de ±10% das outras direções). */
export const pctDaContagem = (c: { recente: number; anterior: number }): number | null => (c.anterior > 0 ? Math.round(((c.recente - c.anterior) / c.anterior) * 100) : null)
