// E5a Tarefa 15: pequenos formatadores de texto que os modelos da página do canal dividem. Puro.
import { DAY, spDateOf } from '@/lib/youtube/observatorio/time'

/** "dd/mm" de uma data AAAA-MM-DD. */
export const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
/** "dd/mm/aaaa". */
export const dmy = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
export const dmDeMs = (ms: number): string => dm(spDateOf(ms))
/** "1 dia", "3 dias" (0 e 1 levam o singular só no 1: "0 dias"). */
export const ptn = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`
/** Em português 0 e 1 levam o singular ("0,9 vídeo", "1 vídeo"). */
export const ptz = (n: number, um: string, varios: string): string => `${n} ${n <= 1 ? um : varios}`
/** Um decimal, vírgula, sem ",0" na ponta quando `semZero`. */
export const dec1 = (x: number): string => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',')
export const dias = (de: string, ate: string): number => Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / DAY)
/** "hoje", "ontem" ou "há N dias" em dias completos de 24 h desde `ms`: a regra única de `daysAgo`, do Ritmo e do cabeçalho. */
export function quandoMs(ms: number, agoraMs: number): string {
  const d = Math.floor((agoraMs - ms) / DAY)
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`
}
/** "hoje", "ontem" ou "há N dias" entre duas datas de São Paulo. */
export function quando(dia: string, hojeSP: string): string {
  const d = dias(dia, hojeSP)
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`
}
