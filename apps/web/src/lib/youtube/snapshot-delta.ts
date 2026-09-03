export interface ChannelSnapshot {
  snapshot_date: string
  subscriber_count: number | null
  view_count: number | null
}

/**
 * Delta semanal. Exige snapshots ordenados ascendente por data.
 *
 * Menor 8 (docs/superpowers/plans/2026-09-02-falhas-silenciosas.md): sem
 * NENHUM snapshot com pelo menos 7 dias de idade (ex.: canal com so 2-3 dias
 * de historico coletado), o antigo fallback `?? snapshots[0]!` pegava o
 * snapshot mais antigo disponivel mesmo que ele so cobrisse 2 dias — e o
 * delta resultante era apresentado como "crescimento semanal" sem ressalva.
 * Numa tela que este pacote corrigiu justamente por honestidade de dados,
 * isso era desonestidade remanescente. Decisao: devolve `null` quando nao ha
 * uma janela real de 7 dias, em vez de inventar uma com o que tiver disponivel
 * — o unico consumidor (competitors/page.tsx) ja trata `null` como "sem dado"
 * (renderiza "—"), entao isso nao exige nenhuma mudanca de UI.
 */
export function computeSnapshotDelta(
  snapshots: ReadonlyArray<ChannelSnapshot>,
  field: 'subscriber_count' | 'view_count',
  now: number = Date.now(),
): number | null {
  if (snapshots.length < 2) return null
  const latest = snapshots[snapshots.length - 1]!
  const sevenDaysAgoStr = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10)
  const weekAgoSnap = snapshots.reduce<ChannelSnapshot | null>(
    (best, s) => (s.snapshot_date < sevenDaysAgoStr ? s : best),
    null,
  )
  if (!weekAgoSnap) return null
  if (weekAgoSnap.snapshot_date === latest.snapshot_date) return null
  return (latest[field] ?? 0) - (weekAgoSnap[field] ?? 0)
}
