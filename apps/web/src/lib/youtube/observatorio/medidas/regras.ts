/**
 * New (A5, E4): os números das medidas (spec do Observatório, seção das medidas M1 a M12). Mora aqui e `rules.ts` só a reexporta
 * em `RULES.measures`. Este arquivo NÃO importa `rules.ts` (ciclo): os limiares que já existem lá (`outlierMin`, `weakBase`,
 * `medianMinN`, `habit.weeks`, `series.weeklyMaxGapDays`, `series.dailyGraceDays`) não são duplicados, as medidas os leem de `RULES`.
 */
export const MEASURE_RULES = {
  ruleVersion: 1,
  ages: [1, 7, 30],
  maxGapHours: 36,
  maxGapHoursDay1: 8,
  weeklyGapHours: 192,
  /** Folga depois do limite antes de um motivo virar definitivo; é o mesmo `interval '1 hour'` de `competitor_marks_apply`. */
  lateReadingHours: 1,
  batch: 1500,
  discoveredLateHours: 24,
  equalPct: 0.10,
  channelWindowDays: 90,
  curve: { ages: [1, 2, 3, 5, 7, 14, 21, 30, 60, 90], windowDays: 180, weeklyFromAge: 60 },
  direction: { windowDays: 28, staleDays: 1 },
  decline: { windows: 3 },
  hit: { minAgeDays: 7, miss: 0.5, pctFromN: 10 },
  rise: { factor: 2, minGain: 1000, days: 7, lookbackDays: 14 },
  rhythm: { weeks: 13, gapWeeks: 26, minPosts: 4 },
  engagement: { minViews: 100, todayMaxAgeDays: 90 },
  stalled: { floorDays: 28, factor: 4 },
  tail: { minAgeDays: 90, stillDays: 28 },
  peak: { minV30: 1000, tailShare: 0.5, stillMax: 0.02, reactionShare: 0.5 },
  comments: { minVideos: 5, pctFromN: 10, minVideoLikes: 100, windowDays: 90 },
  /** Aviso `marcas_perdidas`: idades cuja perda deixa o disparo vermelho (a 1 fica fora até a e4-d7). */
  lost: { alarmAges: [7, 30], weeklyTier30Counts: true },
  countChange: '2026-08-24',
} as const
