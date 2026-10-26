/** Manutenção M5, Tarefa 5 (04 §14.1, itens 36, 84 e 85): peça 1, "desde dd/mm" e "no arquivo" nas telas de série. Puro: sem relógio (o `now` entra por parâmetro). */
import { DAY, spDateOf, spDateStart } from '../time'
import { JANELA_MINIMA_DIAS } from './online-desde'
import { MEASURE_RULES } from '../medidas/regras'

export type EstadoPeca1 =
  | { k: 'nada_saiu' }
  | { k: 'desde'; desde: number }
  | { k: 'no_arquivo'; de: number; ate: number }
  | { k: 'antes_da_coleta'; coleta: number }
  | { k: 'sem_registro'; conferidoEm: number }
  | { k: 'nao_medido' }

/** 1, 7 e 30 dias vêm de `competitor_video_marks`: ficam online, nunca "no arquivo". */
export const IDADES_DE_MARCA: readonly number[] = MEASURE_RULES.ages

const dm = (ms: number): string => { const d = spDateOf(ms); return d.slice(8, 10) + '/' + d.slice(5, 7) }
const dmy = (ms: number): string => dm(ms) + '/' + spDateOf(ms).slice(0, 4)
const my = (ms: number): string => { const d = spDateOf(ms); return d.slice(5, 7) + '/' + d.slice(0, 4) }
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function estadoDaIdade(o: { pub: number; idadeDias: number; deMarca: boolean; onlineDesde: number | null; lido: boolean; coleta: number; now: number }): EstadoPeca1 {
  if (o.deMarca) return { k: 'nada_saiu' }
  const ponto = o.pub + o.idadeDias * DAY
  if (ponto < o.coleta) return { k: 'antes_da_coleta', coleta: o.coleta }
  if (!o.lido && ponto < o.now - JANELA_MINIMA_DIAS.competitor_video_daily * DAY) return { k: 'nao_medido' }
  if (o.onlineDesde != null && ponto < o.onlineDesde) {
    return { k: 'no_arquivo', de: Math.max(spDateStart(spDateOf(ponto).slice(0, 7) + '-01'), o.coleta), ate: o.onlineDesde - DAY }
  }
  if (o.onlineDesde != null && o.onlineDesde > o.pub) return { k: 'desde', desde: o.onlineDesde }
  return { k: 'nada_saiu' }
}

/** Dia SP de início da coleta DESTE vídeo: o maior entre o começo da série e o dia em que o canal foi adicionado (Phil I8, D-M5-12). */
export function coletaDoVideo(o: { seriesStart: number; addedAt: number | null }): number {
  return o.addedAt == null ? o.seriesStart : Math.max(o.seriesStart, o.addedAt)
}

/** Começo REAL da leitura por hora: o `desde` do registro (M5); sem ele (função antiga, cache antigo), `min(hour_slot)`, que é o mesmo valor enquanto nada saiu do banco. */
export function comecoDaLeituraPorHora(h: { primeiraHoraDoSiteMs: number | null; comecouRealMs?: number | null }): number | null {
  return h.comecouRealMs ?? h.primeiraHoraDoSiteMs
}
/** "dd/mm" ou, com precisão de mês (um mês já saiu e o dia exato não existe mais), "mm/aaaa". */
export function textoDoComeco(h: { primeiraHoraDoSiteMs: number | null; comecouRealMs?: number | null; comecouRealPrecisao?: 'hora' | 'mes' }): string | null {
  const ms = comecoDaLeituraPorHora(h)
  if (ms === null) return null
  return h.comecouRealMs != null && h.comecouRealPrecisao === 'mes' ? my(ms) : dm(ms)
}

export type FormaPeca1 = 'nenhuma' | 'arquivo' | 'pontilhado' | 'zero' | 'hachura'

export function frasePeca1(e: EstadoPeca1, quem: 'edita' | 'so_le'): { texto: string; forma: FormaPeca1; portaVerAntigo: boolean } {
  // a porta "Ver antigo" é da peça 6 (M7): nesta etapa ninguém a vê; quem só lê vê a frase do trecho, com ponto final
  const fim = quem === 'so_le' ? '.' : ''
  switch (e.k) {
    case 'nada_saiu': return { texto: '', forma: 'nenhuma', portaVerAntigo: false }
    case 'desde': return { texto: `desde ${dm(e.desde)}`, forma: 'nenhuma', portaVerAntigo: false }
    case 'no_arquivo': return { texto: `${dm(e.de)} a ${dmy(e.ate)} no arquivo${fim}`, forma: 'arquivo', portaVerAntigo: false }
    case 'antes_da_coleta': return { texto: `A coleta começou em ${my(e.coleta)}${fim}`, forma: 'pontilhado', portaVerAntigo: false }
    case 'sem_registro': return { texto: `Sem registro neste mês (conferimos em ${dm(e.conferidoEm)})${fim}`, forma: 'zero', portaVerAntigo: false }
    case 'nao_medido': return { texto: 'Não foi possível ler desde quando há dado online.', forma: 'hachura', portaVerAntigo: false }
  }
}

/**
 * 72 horas de um vídeo cujas horas saíram do banco. `parcial`: a janela de 72 h começou antes do online desde e termina depois dele
 * (parte das horas está online, parte saiu: a curva não se desenha com as horas que sobraram).
 */
export function frase72h(o: { horasNoArquivoDesde: number | null; lido: boolean; parcial?: boolean }): { texto: string; forma: 'arquivo' | 'hachura' } | null {
  if (!o.lido) return { texto: 'Não foi possível ler desde quando há dado online.', forma: 'hachura' }
  if (o.horasNoArquivoDesde == null) return null
  const abre = o.parcial ? 'Parte das 72 primeiras horas deste vídeo está no arquivo' : 'As 72 primeiras horas deste vídeo estão no arquivo'
  return {
    texto: `${abre} (a leitura por hora online começa em ${dmy(o.horasNoArquivoDesde)}). A curva e o resumo "metade das views em N horas" não aparecem porque não dá para calcular sem as horas.`,
    forma: 'arquivo',
  }
}

export function fraseNormalDoCanal(o: { n: number; noArquivo: number; minimo: 3; desde: number | null }): string | null {
  if (o.n < o.minimo) {
    const ate = o.desde == null ? '' : `desde ${dmy(o.desde)} `
    if (o.n <= 0) return `Não medido: ${ate}não há nenhum vídeo com as 72 horas online.`
    const so = o.n === 1 ? 'só há 1 vídeo' : `só há ${o.n} vídeos`
    return `Não medido: ${ate}${so} com as 72 horas online.`
  }
  if (o.noArquivo <= 0) return null
  return `Calculado com ${o.n} vídeos; ${o.noArquivo} ${o.noArquivo === 1 ? 'está' : 'estão'} no arquivo.`
}

export function frasePeriodo(o: { pedidoDias: number; online: { desde: number; meses: number }; motivo: 'coleta_recente' | 'arquivo' }): string {
  const m = o.online.meses
  const quanto = m < 1 ? 'menos de 1 mês online' : `${m} ${m === 1 ? 'mês' : 'meses'} online`
  const cab = `Mostrando desde ${dmy(o.online.desde)} (${quanto}).`
  return o.motivo === 'arquivo' ? `${cab} Os meses anteriores estão no arquivo.` : `${cab} A coleta começou em ${dmy(o.online.desde)}.`
}

export function fraseComentarioSemTexto(mesAno: string): string {
  return `Comentário de ${mesAno}. O texto está no arquivo e não aparece aqui.`
}

/** O `desde` da leitura de hora em hora: precisão 'mes' (um mês saiu) diz o mês, nunca uma hora inventada (Phil I7). */
export function fraseDesdeDaHoraria(o: { desde: number; precisao: 'hora' | 'dia' | 'mes' }): string {
  const d = spDateOf(o.desde)
  if (o.precisao === 'dia') return `desde ${dmy(o.desde)}`
  if (o.precisao === 'mes') return `desde ${MESES[Number(d.slice(5, 7)) - 1]!} de ${d.slice(0, 4)}`
  const hm = new Date(o.desde - 3 * 3_600_000).toISOString().slice(11, 16)
  return `desde ${dm(o.desde)} às ${hm}`
}
