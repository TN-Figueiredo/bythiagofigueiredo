// A5 · E5a, Tarefa 5: o estado da linha (M8) e a contagem dos filtros. Puro: relógio e dados entram por parâmetro.
import type { ExtrasDoCanal } from '@/lib/youtube/observatorio/medidas-telas/ler-extras-dos-canais'
import type { M8DoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import { direcaoDe } from '@/lib/youtube/observatorio/medidas/direcao'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { MotivoNaoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import { aindaNaoExiste } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { FRASES, classeDoMotivo } from '@/lib/youtube/observatorio/medidas-telas/frases'

export type PastilhaDaLinha =
  | 'fora_do_ar' | 'pausado' | 'sem_videos' | 'parado' | 'em_queda' | 'ativo'
  | 'nao_carregou' | 'nao_medido' | 'canal_proprio'

export interface EstadoDaLinha {
  pastilha: PastilhaDaLinha
  /** A data (`AAAA-MM-DD`, "saiu do YouTube") ou os dias ("parado há N dias"); nulo quando não se aplica ou não foi lida. */
  dataOuDias: string | number | null
  /** Parado: o instante da última publicação, de M8. A data mostrada vem dele, nunca de agora menos os dias. */
  ultimaEm: number | null
  /** A frase sob a pastilha: "Ativo, publicou há N dias" no ativo; o motivo no não medido; vazia onde a pastilha basta. */
  linha: string | null
  apoio: string | null
  tambemEmQueda: boolean
  /** A queda não pôde ser medida (depois da data): o motivo e, se houver, quando fecha. */
  quedaNaoMedida: { motivo: MotivoNaoMedido; fechaEm?: string } | null
  /** `m8.queda` veio medido. */
  quedaMedida: boolean
  /** Os campos do canal (extras) não foram lidos: a pastilha de "saiu do YouTube" não é inventada. */
  extrasNaoLidos: boolean
  /** O motivo, quando a pastilha é `nao_medido`/`nao_carregou`, e a frase longa dele (FRASES_DE_MOTIVO[motivo]). */
  motivo: MotivoNaoMedido | null
  longa: string | null
  /** A linha da queda que não pôde ser medida (depois da data): o motivo escrito; nulo quando a queda foi medida ou ainda não existe. */
  quedaLinha: string | null
}

const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const diasTxt = (n: number): string => `${n} ${n === 1 ? 'dia' : 'dias'}`

const base: Omit<EstadoDaLinha, 'pastilha'> = {
  dataOuDias: null, ultimaEm: null, linha: null, apoio: null, tambemEmQueda: false, quedaNaoMedida: null, quedaMedida: false, extrasNaoLidos: false, motivo: null, longa: null, quedaLinha: null,
}

/**
 * `m8` nulo = a medida não chegou. `extras` nulo = os campos do canal não foram lidos. `hojeSP` é o dia de São Paulo (a queda só
 * "não foi medida" depois da data em que passa a existir).
 */
export function estadoDaLinha(
  m8: M8DoCanal | null, extras: ExtrasDoCanal | null, videosN: number,
  o: { proprio?: boolean; hojeSP: string; buscando?: boolean },
): EstadoDaLinha {
  if (o.proprio) {
    // TEXTO-A-REVISAR (Logan/Naksu)
    return { ...base, pastilha: 'canal_proprio', linha: 'O estado do seu canal não é medido aqui.' }
  }
  const extrasNaoLidos = extras === null
  if (m8 === null) return { ...base, pastilha: 'nao_carregou', motivo: 'leitura_falhou', extrasNaoLidos, linha: 'Não carregou' }
  const e = m8.estado
  // `missing_since` é coluna `date` (AAAA-MM-DD): é um dia de calendário, não um instante. Date.parse a leria como meia-noite UTC e São Paulo mostraria o dia anterior.
  const saiuEm = extras?.missingSince ? extras.missingSince.slice(0, 10) : null
  if (saiuEm !== null || (e.estado === 'medido' && e.valor === 'fora_do_ar')) {
    return { ...base, pastilha: 'fora_do_ar', dataOuDias: saiuEm, extrasNaoLidos, apoio: 'Sem resposta do YouTube em 2 leituras.' }
  }
  if (e.estado === 'medido' && e.valor === 'pausado') {
    return { ...base, pastilha: 'pausado', extrasNaoLidos, linha: 'Coleta pausada' } // TEXTO-A-REVISAR (pergunta 10)
  }
  if (videosN === 0) {
    // zero vídeos no banco não é zero no YouTube: canal na 1ª busca, ou só com vídeos sem data, ainda está sendo lido
    // TEXTO-A-REVISAR (Logan/Naksu)
    if (o.buscando) return { ...base, pastilha: 'nao_medido', extrasNaoLidos, linha: 'ainda buscando os vídeos', longa: 'O canal ainda está na primeira busca: os vídeos ainda não foram lidos por inteiro.' }
    return { ...base, pastilha: 'sem_videos', extrasNaoLidos, apoio: 'Ainda não publicou nada.' }
  }
  if (e.estado === 'nao_medido') {
    const m = e.motivo
    return {
      ...base, extrasNaoLidos, motivo: m, longa: FRASES[m]({}).longa, pastilha: classeDoMotivo(m) === 'nao_carregou' ? 'nao_carregou' : 'nao_medido',
      linha: classeDoMotivo(m) === 'nao_carregou' ? 'Não carregou' : FRASES[m]({}).curta,
    }
  }
  const queda = m8.queda
  const dataDaQueda = aindaNaoExiste('queda', o.hojeSP)
  const quedaNaoMedida = queda.estado === 'nao_medido' && !dataDaQueda
    ? { motivo: queda.motivo, ...(queda.fechaEm ? { fechaEm: queda.fechaEm } : {}) } : null
  const quedaMedida = queda.estado === 'medido'
  // TEXTO-A-REVISAR (Logan/Naksu): a linha do canal escreve o motivo da queda não medida
  const quedaLinha = quedaNaoMedida ? `Em queda: não medido (${FRASES[quedaNaoMedida.motivo]({ fechaEm: quedaNaoMedida.fechaEm }, 'canais').curta})` : null
  const emQueda = e.valor === 'em_queda'
  const parado = m8.parado
  const dias = parado.estado === 'medido' ? parado.valor.dias : null
  if (e.valor === 'parado') {
    const limite = parado.estado === 'medido' ? parado.valor.limite : null
    const passo = MEASURE_RULES.stalled.factor
    // TEXTO-A-REVISAR (Logan/Naksu): o intervalo habitual só é recuperável quando o limite passa do piso de 28 dias
    const apoio = limite !== null && limite > MEASURE_RULES.stalled.floorDays ? `Costuma publicar a cada ${diasTxt(Math.round(limite / passo))}.` : null
    const ultimaEm = parado.estado === 'medido' ? parado.valor.ultimaEm : null
    return { ...base, pastilha: 'parado', dataOuDias: dias, ultimaEm, apoio, extrasNaoLidos, quedaMedida, quedaNaoMedida, quedaLinha,
      // o canal parado que também está em queda: só a pastilha de parado, mais uma frase curta (o mockup 16, decisão 5)
      tambemEmQueda: quedaMedida && queda.valor.janelas.length > 0 && queda.valor.janelas.every(x => direcaoDe(x) === 'descendo') }
  }
  if (emQueda) {
    return { ...base, pastilha: 'em_queda', extrasNaoLidos, quedaMedida, quedaNaoMedida, quedaLinha,
      apoio: `${MEASURE_RULES.decline.windows} períodos de ${MEASURE_RULES.direction.windowDays} dias.` }
  }
  return {
    ...base, pastilha: 'ativo', dataOuDias: dias, extrasNaoLidos, quedaMedida, quedaNaoMedida, quedaLinha,
    linha: dias === null ? null : `Ativo, publicou há ${diasTxt(dias)}`,
  }
}

export type FiltroDeEstado = 'todos' | 'parados' | 'em-queda' | 'sairam' | 'sem-videos' | 'problemas'

export type ContagemDeQueda =
  | { tipo: 'ainda_nao_existe'; existeEm: string }
  | { tipo: 'nao_medido'; motivo: MotivoNaoMedido; data: string }
  /** Nenhuma linha teve o estado lido: erro, não "cálculo ainda não rodou". */
  | { tipo: 'nao_carregou' }
  | { tipo: 'numero'; emQueda: number; quedaMedidaEm: number; canais: number }

export interface LinhaParaContagem { proprio: boolean; estado: EstadoDaLinha; emErro: boolean }
export interface ContagemDosFiltros {
  /** `parados` e `saiu` são nulos quando o estado não carregou em nenhuma linha: nulo nunca vira zero. */
  todos: number; parados: number | null; saiu: number | null; emErro: number; queda: ContagemDeQueda
  /** Quantas linhas tiveram o estado lido (as que não estão em `nao_carregou`). Menor que `todos` = `parados` e `saiu` valem só para essas. */
  estadoMedidoEm: number
}

/** O canal próprio não entra em nenhuma contagem. O filtro "em queda" inclui o canal parado que também está em queda. */
export function contagemDosFiltros(linhas: readonly LinhaParaContagem[], hojeSP: string): ContagemDosFiltros {
  const ls = linhas.filter(l => !l.proprio)
  const ainda = aindaNaoExiste('queda', hojeSP)
  let queda: ContagemDeQueda
  if (ainda) queda = { tipo: 'ainda_nao_existe', existeEm: ainda.existeEm }
  else {
    const medidos = ls.filter(l => l.estado.quedaMedida).length
    if (medidos === 0) {
      const cont = new Map<MotivoNaoMedido, number>()
      for (const l of ls) if (l.estado.quedaNaoMedida) cont.set(l.estado.quedaNaoMedida.motivo, (cont.get(l.estado.quedaNaoMedida.motivo) ?? 0) + 1)
      const motivo = [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      // nenhum motivo de "não medido" e linha que não carregou: é erro, e não "cálculo ainda não rodou"; sem nenhuma linha elegível, é zero canais
      if (motivo !== undefined) queda = { tipo: 'nao_medido', motivo, data: hojeSP }
      else if (ls.some(l => l.estado.pastilha === 'nao_carregou')) queda = { tipo: 'nao_carregou' }
      else queda = { tipo: 'numero', emQueda: 0, quedaMedidaEm: 0, canais: ls.length }
    } else {
      queda = { tipo: 'numero', emQueda: ls.filter(l => l.estado.pastilha === 'em_queda' || l.estado.tambemEmQueda).length, quedaMedidaEm: medidos, canais: ls.length }
    }
  }
  // o estado não carregou em nenhuma linha: "0 parados" seria dado inventado
  const estadoMedidoEm = ls.filter(l => l.estado.pastilha !== 'nao_carregou').length
  const semEstado = ls.length > 0 && estadoMedidoEm === 0
  return {
    estadoMedidoEm,
    todos: ls.length, parados: semEstado ? null : ls.filter(l => l.estado.pastilha === 'parado').length,
    saiu: semEstado ? null : ls.filter(l => l.estado.pastilha === 'fora_do_ar').length, emErro: ls.filter(l => l.emErro).length, queda,
  }
}

/** A linha pertence ao filtro de estado? (o canal próprio só aparece em "todos") */
export function linhaNoFiltro(l: LinhaParaContagem, f: FiltroDeEstado): boolean {
  if (f === 'todos') return true
  if (l.proprio) return false
  if (f === 'parados') return l.estado.pastilha === 'parado'
  if (f === 'em-queda') return l.estado.pastilha === 'em_queda' || l.estado.tambemEmQueda
  if (f === 'sairam') return l.estado.pastilha === 'fora_do_ar'
  if (f === 'sem-videos') return l.estado.pastilha === 'sem_videos'
  return l.emErro
}
