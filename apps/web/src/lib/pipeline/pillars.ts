export const PILLARS = [
  { id: 'viagem', label: 'Viagem', color: '#22b8d6' },
  { id: 'ia', label: 'IA', color: '#8b8cf6' },
  { id: 'codigo', label: 'Código', color: '#fb7a52' },
  { id: 'games', label: 'Games', color: '#f43f5e' },
  { id: 'nas', label: 'NAS', color: '#22c55e' },
] as const

export type PillarId = (typeof PILLARS)[number]['id']

export function pillarById(id: PillarId | undefined) {
  if (!id) return undefined
  return PILLARS.find((p) => p.id === id)
}
