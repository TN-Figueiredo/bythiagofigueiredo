/**
 * Modo parcial da coleta (F0-c): a segunda entrada do cron roda só uma lista fechada de passos.
 * Qualquer outro valor é recusado (nunca vira silêncio).
 */
import { z } from 'zod'
import type { AttemptKind } from './kinds'

export const PASSOS_PARCIAIS = ['jobs', 'relatorios', 'alcance', 'normalizadores'] as const
export type PassoParcial = (typeof PASSOS_PARCIAIS)[number]

/** Os kinds de tentativa que cada passo parcial grava: o critério de orçamento da parcial olha só estes (Yannis M1). */
export const KINDS_DO_PASSO: Record<PassoParcial, readonly AttemptKind[]> = {
  jobs: ['sondagem'],
  relatorios: ['relatorio'],
  alcance: ['relatorio'],
  normalizadores: ['normalizador_trafego', 'normalizador_alcance_dim'],
}

const esquema = z.array(z.enum(PASSOS_PARCIAIS)).min(1)

/** `null` = sem parâmetro = execução completa. */
export function parsePassos(raw: string | null): { ok: true; passos: ReadonlySet<PassoParcial> | null } | { ok: false; motivo: string } {
  if (raw === null) return { ok: true, passos: null }
  const r = esquema.safeParse(raw.split(','))
  if (!r.success) return { ok: false, motivo: `passos inválidos: ${raw.slice(0, 80)}` }
  return { ok: true, passos: new Set(r.data) }
}
