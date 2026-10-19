// Horários do vigia (puro, importável no cliente). Repete apps/web/vercel.json (um teste confere).
export const HORAS_DO_VIGIA_UTC = [10, 20] as const
// Maior intervalo entre execuções (14 h) mais 1 h.
export const ATRASO_DO_VIGIA_MS = 15 * 3_600_000

/** O primeiro 10:00 ou 20:00 UTC estritamente depois de `agora`. */
export function proximaVerificacao(agora: Date): Date {
  const t = agora.getTime()
  const dia = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
  for (const dd of [0, 1]) {
    for (const hora of HORAS_DO_VIGIA_UTC) {
      const c = dia + dd * 86_400_000 + hora * 3_600_000
      if (c > t) return new Date(c)
    }
  }
  return new Date(dia + 86_400_000 + HORAS_DO_VIGIA_UTC[0] * 3_600_000)
}

export function vigiaAtrasado(ultimaExecucaoIso: string | null, agora: Date): boolean {
  if (ultimaExecucaoIso === null) return true
  const t = Date.parse(ultimaExecucaoIso)
  if (!Number.isFinite(t)) return true
  return agora.getTime() - t > ATRASO_DO_VIGIA_MS
}
