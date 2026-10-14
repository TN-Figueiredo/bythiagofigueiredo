// A5 · E5a, Tarefa 1: o calendário das medidas novas. Módulo puro (nada de servidor).
// Nenhum número de dias mora aqui: as janelas saem de `MEASURE_RULES` (E4), para a tela não prometer uma data que a medida não cumpre
// se um limiar mudar.
import { MEASURE_RULES } from '../medidas/regras'
import { cruzaMudancaDeContagem } from '../medidas/contagem'
import type { Janela } from '../medidas/tipos'
import { E1_E2_DEPLOY } from '@/lib/conferencias'

/** O dia (São Paulo) em que as marcas de idade (V1, V7, V30) começaram a ser guardadas. */
export const INICIO_DAS_MARCAS = '2026-10-03'

/** Só as regras que o calendário lê; o teste troca os limiares por aqui. */
export interface RegrasDoCalendario {
  readonly countChange: string
  readonly channelWindowDays: number
  readonly direction: { readonly windowDays: number }
  readonly decline: { readonly windows: number }
  readonly tail: { readonly minAgeDays: number }
}

const MS_DIA = 86_400_000

/** `AAAA-MM-DD` mais `n` dias (pode ser negativo), sem passar por fuso. */
export function somaDias(dia: string, n: number): string {
  return new Date(Date.parse(dia + 'T00:00:00Z') + n * MS_DIA).toISOString().slice(0, 10)
}

/** A queda sustentada pede (janelas + 1) períodos inteiros depois da mudança de contagem. */
export function quedaExisteEm(regras: RegrasDoCalendario = MEASURE_RULES): string {
  return somaDias(regras.countChange, regras.direction.windowDays * (regras.decline.windows + 1))
}

/** "Mesma idade" compara duas janelas do canal, a partir do início das marcas. */
export function mesmaIdadeExisteEm(regras: RegrasDoCalendario = MEASURE_RULES): string {
  return somaDias(INICIO_DAS_MARCAS, 2 * regras.channelWindowDays)
}

/** "Estourou e parou" pede a idade mínima da cauda, a partir do início das marcas. */
export function estourouExisteEm(regras: RegrasDoCalendario = MEASURE_RULES): string {
  return somaDias(INICIO_DAS_MARCAS, regras.tail.minAgeDays)
}

/** Dia (AAAA-MM-DD) desde o qual as primeiras 24 horas são lidas; nulo enquanto o envio não tem data. */
export function primeiras24hDesde(): string | null {
  return E1_E2_DEPLOY
}

const dataBR = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

// TEXTO-A-REVISAR (Logan/Naksu): a frase das primeiras 24 horas não está fixada no plano.
export function fraseDasPrimeiras24h(): string {
  const d = primeiras24hDesde()
  return d ? `Primeiras 24 horas medidas desde ${dataBR(d)}.` : 'Primeiras 24 horas: ainda sem data.'
}

/**
 * Se a janela ainda cruza a mudança de contagem de 24/08, o último dia (`ate`) em que ela cruza; senão nulo.
 * Uma janela de `dias` dias que termina em `ate` começa em `ate - dias`.
 */
export function avisoDeContagem(janela: Janela, regras: RegrasDoCalendario = MEASURE_RULES): { ate: string } | null {
  if (!janela.de || !janela.ate) return null
  if (!cruzaMudancaDeContagem(janela.de, janela.ate)) return null
  const dias = janela.dias ?? Math.round((Date.parse(janela.ate + 'T00:00:00Z') - Date.parse(janela.de + 'T00:00:00Z')) / MS_DIA)
  return { ate: somaDias(regras.countChange, dias - 1) }
}

export type LeituraDoCalendario = 'queda' | 'mesma_idade' | 'estourou'

/** A leitura ainda não existe no dia `hojeSP`? Devolve a data em que passa a existir; nulo se já existe. */
export function aindaNaoExiste(leitura: LeituraDoCalendario, hojeSP: string): { existeEm: string } | null {
  const existeEm = leitura === 'queda' ? quedaExisteEm() : leitura === 'mesma_idade' ? mesmaIdadeExisteEm() : estourouExisteEm()
  return hojeSP < existeEm ? { existeEm } : null
}
