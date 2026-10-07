// Observatório — "trocas em sequência" (R121): the texts every screen prints about a run and the runs of a list of changes.
// The run itself is derived in changes.ts (ObsChange.testRun). Nothing here says "teste": the data shows rhythm, not intent.
import type { ObsChange, TestRun } from './changes'
import { DAY, type Clock } from './time'

/** Always printed next to the label: the caveat the owner asked for (2026-10-07). */
export const RUN_CAVEAT = 'Pode ser um teste; o YouTube não informa.'
const pl = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many)

/** Days from the first to the last change of the run, rounded, never below 1. */
export const runDays = (r: TestRun): number => Math.max(1, Math.round((r.to - r.from) / DAY))
/** "5 trocas em 9 dias" */
export const runCore = (r: TestRun): string => pl(r.n, 'troca', 'trocas') + ' em ' + pl(runDays(r), 'dia', 'dias')
/** "trocas em sequência: 5 trocas em 9 dias, ainda aberta" | "…, encerrada em 11/11" (the date of the LAST change: the observed fact). */
export const runText = (clock: Pick<Clock, 'dmOrDmy'>, r: TestRun): string =>
  'trocas em sequência: ' + runCore(r) + (r.open ? ', ainda aberta' : ', encerrada em ' + clock.dmOrDmy(r.to))
/** "5 trocas em sequência": what the lane bar prints when the whole text does not fit. */
export const runShort = (r: TestRun): string => r.n + ' trocas em sequência'
/** "parte de 5 trocas em sequência em 9 dias": the line of one change (Mudanças card, selected comparison). */
export const runCardText = (r: TestRun): string => 'parte de ' + r.n + ' trocas em sequência em ' + pl(runDays(r), 'dia', 'dias')
/** "Trocas em sequência: trocas do mesmo campo com até 14 dias entre uma e outra. Pode ser um teste; o YouTube não informa." */
export const runDefinition = (gapDays: number): string =>
  'Trocas em sequência: trocas do mesmo campo com até ' + gapDays + ' dias entre uma e outra. ' + RUN_CAVEAT

/** The distinct runs of one field, oldest first. A change without testRun (null = checked, undefined = unknown) adds nothing. */
export function runsOf(changes: readonly ObsChange[], type: 'title' | 'thumb'): TestRun[] {
  const seen = new Map<string, TestRun>()
  for (const c of changes) if (c.type === type && c.testRun && !seen.has(c.testRun.id)) seen.set(c.testRun.id, c.testRun)
  return [...seen.values()].sort((a, b) => a.from - b.from)
}
