import type { AvisoDeVolume } from '@/lib/youtube/ab-gravacao/aviso-volume'

/** D-M6-10: selo do aviso de volume. null = sem selo (linha neutra, como a original indisponível). */
export function seloDoAvisoDeVolume(estado: AvisoDeVolume['estado']): { selo: string; tom: 'ambar' | 'neutro' } | null {
  switch (estado) {
    case 'nao_chega': return { selo: 'Volume insuficiente', tom: 'ambar' }
    case 'so_decide_depois': return { selo: 'Decide mais tarde', tom: 'neutro' }
    case 'teto_justo': return { selo: 'Rotação apertada', tom: 'neutro' }
    case 'sem_medicao': return { selo: 'Sem medição', tom: 'neutro' }
    default: return null
  }
}
