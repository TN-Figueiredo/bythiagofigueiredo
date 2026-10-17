// A5 E5a, Tarefa 14b: o ganho de views por dia do canal, para a Linha do tempo. Puro.
import type { RetratoDoCanal } from '../medidas/direcao'
import { somaDias } from './calendario'

export type GanhoDoDia = { dia: string } & ({ tipo: 'medido'; ganho: number } | { tipo: 'sem_registro' } | { tipo: 'diminuiu' })

/**
 * O ganho do dia é o retrato do dia menos o do dia anterior. Falta um dos dois retratos ou `view_count` nulo: `sem_registro`
 * (nunca zero). Diferença negativa: `diminuiu` (o YouTube corrige contagens para baixo), nunca ganho negativo. Zero é medido.
 * Um dia por posição de `de` a `ate`, inclusive.
 */
export function ganhosPorDia(retratos: readonly RetratoDoCanal[], de: string, ate: string): GanhoDoDia[] {
  const porDia = new Map<string, number | null>()
  for (const r of retratos) porDia.set(r.dia, r.views)
  const out: GanhoDoDia[] = []
  for (let dia = de; dia <= ate; dia = somaDias(dia, 1)) {
    const hoje = porDia.get(dia)
    const ontem = porDia.get(somaDias(dia, -1))
    if (hoje === undefined || hoje === null || ontem === undefined || ontem === null) { out.push({ dia, tipo: 'sem_registro' }); continue }
    const d = hoje - ontem
    out.push(d < 0 ? { dia, tipo: 'diminuiu' } : { dia, tipo: 'medido', ganho: d })
  }
  return out
}
