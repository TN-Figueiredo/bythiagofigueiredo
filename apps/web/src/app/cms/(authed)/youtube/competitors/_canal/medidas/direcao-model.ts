// E5a Tarefa 16: o bloco "Para onde o canal anda" da página do canal. Puro: relógio e medidas entram por parâmetro.
// Quatro estados que nunca trocam de aparência: medido (régua), não medido com data (barra de progresso), não medido sem data (hachura),
// ainda não existe (casas pontilhadas). Só o canal inteiro dá o veredito da frase do bloco.
import type { Fmt } from '@/lib/youtube/observatorio/fmt'
import type { MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { ValorDirecaoVideos } from '@/lib/youtube/observatorio/medidas/direcao'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import { direcaoExibida, posicaoNaRegua, type SimboloDeDirecao } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'
import { mesmaIdadeExisteEm, quedaExisteEm } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { FRASES, classeDoMotivo } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { progresso } from '@/lib/youtube/observatorio/medidas-telas/progresso'
import { celulaDeDirecao } from '../../_canais/direcao-model'
import type { EstadoDaPagina } from './estado-model'
import { dm, dmy } from './formatos'


const JANELA = MEASURE_RULES.direction.windowDays
export const TOTAL_CANAL = 2 * JANELA
export const TOTAL_JUSTA = 2 * MEASURE_RULES.channelWindowDays
export const TOTAL_QUEDA = JANELA * (MEASURE_RULES.decline.windows + 1)

const PALAVRA: Record<SimboloDeDirecao, string> = { sobe: 'Subindo', estavel: 'Sem mudança', desce: 'Descendo' }
export const DICA_DE_IDADE = 'descer pode ser só idade: os vídeos mais antigos tiveram mais tempo'

export type Base = { tipo: 'views'; recente: string; anterior: string } | { tipo: 'mediana'; recente: string; anterior: string; n: number }
export type ProgressoDaLinha = { feitos: number; total: number; fechaEm: string }

export type LinhaDeDirecao =
  | {
    estado: 'medido'; chave: 'canal' | 'hoje' | 'justa'; nome: string; sub: string; principal: boolean
    pct: number; simbolo: SimboloDeDirecao; texto: string; foraDaEscala: 'acima' | 'abaixo' | null; exato: number
    base: Base; aviso: string | null; dica: string | null
  }
  | { estado: 'progresso'; chave: 'canal' | 'hoje' | 'justa'; nome: string; sub: string; principal: boolean; motivo: string; progresso: ProgressoDaLinha }
  | { estado: 'hachura'; chave: 'canal' | 'hoje' | 'justa'; nome: string; sub: string; principal: boolean; motivo: string }
  | { estado: 'nao_carregou'; chave: 'canal' | 'hoje' | 'justa'; nome: string; sub: string; principal: boolean; motivo: string }

export type CasaDaQueda =
  | { estado: 'medida'; rotulo: string; pct: number; simbolo: SimboloDeDirecao; texto: string }
  | { estado: 'nao_medida'; rotulo: string }
  | { estado: 'ainda_nao_existe'; rotulo: string }

export type QuedaSustentada =
  | { estado: 'medida'; casas: CasaDaQueda[]; emQueda: boolean }
  | { estado: 'progresso'; casas: CasaDaQueda[]; progresso: ProgressoDaLinha; motivo: string }
  | { estado: 'hachura'; casas: CasaDaQueda[]; motivo: string }
  | { estado: 'nao_carregou'; casas: CasaDaQueda[]; motivo: string }

export interface FraseDoBloco { simbolo: SimboloDeDirecao | null; negrito: string; resto: string }
export interface BlocoDeDirecao { frase: FraseDoBloco; linhas: LinhaDeDirecao[]; queda: QuedaSustentada }

export interface EntradaDaDirecao {
  F: Pick<Fmt, 'num'>
  /** Nulo = as medidas não carregaram. */
  medidas: MedidasDoCanal | null
  soShorts: boolean
  estado: EstadoDaPagina
  hojeSP: string
}

const ROTULOS = ['janela atual', 'a anterior', 'antes dela']
const SUB_CANAL = `${JANELA} dias contra os ${JANELA} anteriores`
const SUB_HOJE = `valor do meio dos longos: ${MEASURE_RULES.channelWindowDays} dias contra os ${MEASURE_RULES.channelWindowDays} anteriores`
const SUB_JUSTA = 'a mesma conta, com as views dos 30 primeiros dias'

/** A leitura parou (erro ou fora do ar), ou a coleta está pausada: nenhuma barra promete uma data. */
const semData = (e: EstadoDaPagina): boolean => e.tipo === 'erro' || e.tipo === 'saiu' || e.tipo === 'pausado'

function motivoDe(m: Extract<Medida<unknown>, { estado: 'nao_medido' }>): { carregou: boolean; longa: string } {
  const f = FRASES[m.motivo]({ desde: m.desde, fechaEm: m.fechaEm, n: m.n, minimo: m.minimo }, 'canal')
  return { carregou: classeDoMotivo(m.motivo) !== 'nao_carregou', longa: f.longa }
}

function linhaDeVideos(
  chave: 'hoje' | 'justa', nome: string, sub: string, m: Medida<ValorDirecaoVideos>, e: EntradaDaDirecao, fechaEmCalendario: string | null, total: number,
): LinhaDeDirecao {
  const base = { chave, nome, sub, principal: false }
  if (m.estado === 'nao_medido') {
    const mt = motivoDe(m)
    if (!mt.carregou) return { estado: 'nao_carregou', ...base, motivo: mt.longa }
    // Só a leitura justa tem data de calendário (a primeira passa a existir quando as duas janelas de marcas fecham).
    if (chave === 'justa' && fechaEmCalendario !== null && !semData(e.estado) && e.hojeSP < fechaEmCalendario) {
      const p = progresso(total, fechaEmCalendario, e.hojeSP)
      if (p) return { estado: 'progresso', ...base, motivo: mt.longa, progresso: p }
    }
    return { estado: 'hachura', ...base, motivo: mt.longa }
  }
  const v = m.valor
  const x = direcaoExibida(v.variacao)
  const reg = posicaoNaRegua(x.pct, 50, v.variacao)
  return {
    estado: 'medido', ...base, pct: x.pct, simbolo: x.simbolo, texto: x.texto, foraDaEscala: reg.foraDaEscala, exato: v.variacao,
    base: { tipo: 'mediana', recente: e.F.num(v.medianaRecente), anterior: e.F.num(v.medianaAnterior), n: m.n },
    aviso: null, dica: chave === 'hoje' && x.simbolo === 'desce' ? DICA_DE_IDADE : null,
  }
}

function linhaDoCanal(e: EntradaDaDirecao): LinhaDeDirecao {
  const base = { chave: 'canal' as const, nome: 'Views do canal inteiro', sub: SUB_CANAL, principal: true }
  const m3a = e.medidas?.m3a ?? null
  const c = celulaDeDirecao(m3a, null)
  if (c.tipo === 'nao_carregou') return { estado: 'nao_carregou', ...base, motivo: 'a direção do canal não carregou' }
  if (c.tipo === 'medido') {
    const aviso = c.avisoDeContagem ? `a janela ainda cruza a mudança de contagem de ${dm(MEASURE_RULES.countChange)}; fica limpa em ${dmy(c.avisoDeContagem.ate)}` : null
    return {
      estado: 'medido', ...base, pct: c.pct, simbolo: c.simbolo, texto: c.texto, foraDaEscala: c.foraDaEscala,
      exato: (c.ganhoRecente - c.ganhoAnterior) / c.ganhoAnterior,
      base: { tipo: 'views', recente: e.F.num(c.ganhoRecente), anterior: e.F.num(c.ganhoAnterior) }, aviso, dica: null,
    }
  }
  if (c.tipo !== 'nao_medido') return { estado: 'hachura', ...base, motivo: 'a direção não se aplica' }
  if (m3a && m3a.estado === 'nao_medido' && m3a.motivo === 'pouco_registro' && c.fechaEm && !semData(e.estado)) {
    const p = progresso(TOTAL_CANAL, c.fechaEm, e.hojeSP)
    if (p) return { estado: 'progresso', ...base, motivo: c.longa, progresso: p }
  }
  const parou = semData(e.estado) && e.estado.ate ? `; a leitura parou em ${dm(e.estado.ate)}` : ''
  return { estado: 'hachura', ...base, motivo: c.longa + parou }
}

function casasDaQueda(janelas: number[] | null, existe: boolean): CasaDaQueda[] {
  return ROTULOS.map((rotulo, i): CasaDaQueda => {
    if (janelas === null) return existe ? { estado: 'nao_medida', rotulo } : { estado: 'ainda_nao_existe', rotulo }
    const v = janelas[i]
    if (v === undefined) return { estado: 'nao_medida', rotulo }
    const x = direcaoExibida(v)
    return { estado: 'medida', rotulo, pct: x.pct, simbolo: x.simbolo, texto: x.texto }
  })
}

export function quedaSustentada(e: EntradaDaDirecao): QuedaSustentada {
  const q = e.medidas?.m8.queda ?? null
  if (q === null) return { estado: 'nao_carregou', casas: casasDaQueda(null, true), motivo: 'a queda sustentada não carregou' }
  if (q.estado === 'medido') {
    const casas = casasDaQueda(q.valor.janelas, true)
    return { estado: 'medida', casas, emQueda: casas.length === 3 && casas.every(c => c.estado === 'medida' && c.simbolo === 'desce') }
  }
  const mt = motivoDe(q)
  if (!mt.carregou) return { estado: 'nao_carregou', casas: casasDaQueda(null, true), motivo: mt.longa }
  const existeEm = quedaExisteEm()
  const antes = e.hojeSP < existeEm
  if (antes && !semData(e.estado)) {
    const p = progresso(TOTAL_QUEDA, existeEm, e.hojeSP)
    if (p) return { estado: 'progresso', casas: casasDaQueda(null, false), progresso: p, motivo: mt.longa }
  }
  return { estado: 'hachura', casas: casasDaQueda(null, true), motivo: mt.longa }
}

function fraseDoBloco(e: EntradaDaDirecao, canal: LinhaDeDirecao): FraseDoBloco {
  if (e.medidas === null) return { simbolo: null, negrito: 'Sem veredito:', resto: ' as medidas do canal não carregaram.' }
  if (canal.estado === 'medido') {
    return {
      simbolo: canal.simbolo, negrito: `${PALAVRA[canal.simbolo]} ${canal.texto} em ${JANELA} dias.`,
      resto: e.soShorts ? '' : ' As linhas abaixo dizem se os vídeos novos vão na mesma direção.',
    }
  }
  if (canal.estado === 'progresso') {
    const falta = canal.progresso.total - canal.progresso.feitos
    return { simbolo: null, negrito: 'Sem veredito ainda:', resto: ` faltam ${falta} ${falta === 1 ? 'dia' : 'dias'} de registro para comparar ${JANELA} dias com os ${JANELA} anteriores.` }
  }
  return { simbolo: null, negrito: 'Sem veredito ainda:', resto: ` ${canal.motivo}.` }
}

export function blocoDeDirecao(e: EntradaDaDirecao): BlocoDeDirecao {
  const canal = linhaDoCanal(e)
  const m = e.medidas
  const hoje: LinhaDeDirecao = e.soShorts
    ? { estado: 'hachura', chave: 'hoje', nome: 'Vídeos novos, views de hoje', sub: SUB_HOJE, principal: false, motivo: 'este canal não tem vídeos longos' }
    : m === null ? { estado: 'nao_carregou', chave: 'hoje', nome: 'Vídeos novos, views de hoje', sub: SUB_HOJE, principal: false, motivo: 'a leitura não carregou' }
    : linhaDeVideos('hoje', 'Vídeos novos, views de hoje', SUB_HOJE, m.porFormato.long.m3b, e, null, 0)
  const justa: LinhaDeDirecao = e.soShorts
    ? { estado: 'hachura', chave: 'justa', nome: 'Vídeos novos, leitura justa', sub: SUB_JUSTA, principal: false, motivo: 'este canal não tem vídeos longos' }
    : m === null ? { estado: 'nao_carregou', chave: 'justa', nome: 'Vídeos novos, leitura justa', sub: SUB_JUSTA, principal: false, motivo: 'a leitura não carregou' }
    : linhaDeVideos('justa', 'Vídeos novos, leitura justa', SUB_JUSTA, m.porFormato.long.m3c, e, mesmaIdadeExisteEm(), TOTAL_JUSTA)
  return { frase: fraseDoBloco(e, canal), linhas: [canal, hoje, justa], queda: quedaSustentada(e) }
}
