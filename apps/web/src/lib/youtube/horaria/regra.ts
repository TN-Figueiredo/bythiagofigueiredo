// A regra pura do intervalo da leitura horária (A5 E16, Tarefa 14, parte 2 adiantada).
// Sem banco, sem rede, sem relógio: o instante de cada leitura e o da publicação entram por parâmetro.
// Ninguém a chama ainda; a soma no mapa e a prova diária (ordem 13) vão usá-la.
//
// Regras de dado ausente: contagem oculta (nula) de qualquer um dos lados dá diferença NULA, nunca zero;
// diferença negativa (o YouTube corrige contagens para baixo) fica negativa aqui, e quem soma decide.

/** Versão da regra: muda quando mudar o que é limpo, a fase ou a casa (a soma é refeita do bruto). */
export const RULE_VERSION = 1

export type Fase = 'lancamento' | 'depois'

export interface Leitura {
  takenAt: number
  views: number
  likes: number | null
  comments: number | null
}

export interface Intervalo {
  inicio: number
  fim: number
  limpo: boolean
  /** (dia da semana de São Paulo, 0 = domingo) x 24 + hora de São Paulo do início; 0 a 167. Nulo se não limpo. */
  casa: number | null
  fase: Fase | null
  d: { views: number | null; likes: number | null; comments: number | null }
}

export type Contador = 'views' | 'likes' | 'comments'

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

/** Um intervalo limpo começa até 5 min depois da hora cheia e dura de 50 a 70 min (inclusive nas pontas). */
const INICIO_MAX_APOS_HORA_MS = 5 * MINUTO
const DURACAO_MIN_MS = 50 * MINUTO
const DURACAO_MAX_MS = 70 * MINUTO
/** Idade do vídeo no começo do intervalo: até 72 h é lançamento; acima disso até 14 dias é depois. */
const LANCAMENTO_ATE_MS = 72 * HORA
const DEPOIS_ATE_MS = 14 * DIA

const DIAS_DA_SEMANA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

const formatoSp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
})

/** Casa (0 a 167) do instante, no horário de São Paulo. */
function casaDe(instante: number): number {
  let dia = -1
  let hora = -1
  for (const p of formatoSp.formatToParts(new Date(instante))) {
    if (p.type === 'weekday') dia = DIAS_DA_SEMANA[p.value] ?? -1
    else if (p.type === 'hour') hora = Number(p.value)
  }
  return dia * 24 + hora
}

function ehLimpo(inicio: number, fim: number): boolean {
  const apos = ((inicio % HORA) + HORA) % HORA
  const dur = fim - inicio
  return apos <= INICIO_MAX_APOS_HORA_MS && dur >= DURACAO_MIN_MS && dur <= DURACAO_MAX_MS
}

function faseDe(idade: number): Fase | null {
  if (idade < 0) return null
  if (idade <= LANCAMENTO_ATE_MS) return 'lancamento'
  if (idade <= DEPOIS_ATE_MS) return 'depois'
  return null
}

function diferenca(antes: number | null, depois: number | null): number | null {
  if (antes === null || depois === null) return null
  if (!Number.isFinite(antes) || !Number.isFinite(depois)) return null
  return depois - antes
}

/**
 * Um intervalo para cada par de leituras consecutivas (ordenadas por `takenAt`). Um buraco nunca é dividido:
 * vira um intervalo longo, sem casa. Dois instantes iguais dão um intervalo de duração zero (não limpo).
 */
export function intervalos(leituras: readonly Leitura[], publishedAt: number): Intervalo[] {
  const ordenadas = [...leituras].sort((a, b) => a.takenAt - b.takenAt)
  const out: Intervalo[] = []
  for (let i = 1; i < ordenadas.length; i++) {
    const a = ordenadas[i - 1] as Leitura
    const b = ordenadas[i] as Leitura
    const limpo = ehLimpo(a.takenAt, b.takenAt)
    out.push({
      inicio: a.takenAt,
      fim: b.takenAt,
      limpo,
      casa: limpo ? casaDe(a.takenAt) : null,
      fase: faseDe(a.takenAt - publishedAt),
      d: {
        views: diferenca(a.views, b.views),
        likes: diferenca(a.likes, b.likes),
        comments: diferenca(a.comments, b.comments),
      },
    })
  }
  return out
}

/**
 * A fatia do dia: 24 posições (a hora de São Paulo, 0 a 23) que somam 1. Nula se o dia não tem exatamente os
 * 24 intervalos limpos de um mesmo dia da semana, uma vez cada hora; se algum tem diferença nula ou negativa
 * NESTE contador; ou se a soma do dia é menor que `minimo` (ou zero, onde não há o que dividir).
 */
export function fatiaDoDia(
  intervalosDoDia: readonly Intervalo[],
  contador: Contador,
  minimo: number,
): number[] | null {
  if (intervalosDoDia.length !== 24) return null
  const porHora: number[] = new Array<number>(24).fill(Number.NaN)
  let diaDaSemana = -1
  let soma = 0
  for (const iv of intervalosDoDia) {
    if (!iv.limpo || iv.casa === null) return null
    const dia = Math.floor(iv.casa / 24)
    const hora = iv.casa % 24
    if (diaDaSemana === -1) diaDaSemana = dia
    else if (dia !== diaDaSemana) return null
    if (!Number.isNaN(porHora[hora])) return null
    const d = iv.d[contador]
    if (d === null || !Number.isFinite(d) || d < 0) return null
    porHora[hora] = d
    soma += d
  }
  if (soma < minimo || soma <= 0) return null
  return porHora.map((d) => d / soma)
}
