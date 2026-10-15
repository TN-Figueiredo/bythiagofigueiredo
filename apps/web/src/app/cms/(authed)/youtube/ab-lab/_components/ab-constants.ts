import type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'
import { brDec } from '@/lib/youtube/format'
export type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'

export const SEM_MEDICAO_DE_ENTREGA = 'CTR ainda não medido. Você decide o vencedor.'
/** Versão curta para cartões e linhas pequenas. */
export const SEM_MEDICAO_CURTA = 'CTR não medido'

export const VARIANT_COLORS = {
  A: '#8A8F98',
  B: '#E8823C',
  C: '#3FA9C0',
  D: '#A77CE8',
} as const satisfies Record<DisplayLabel, string>

export const ROTULO_TIPO_DESCONHECIDO = 'Teste de descrição (tipo retirado)'
/** Para frases corridas ("Testar tipo antigo"). */
export const ROTULO_TIPO_DESCONHECIDO_CURTO = 'tipo antigo'
export const DICA_TIPO_DESCONHECIDO = 'A descrição não é mais testada no A/B Lab. Este teste fica só para consulta.'
export const FRASE_COMBO = 'Se ganhar, você não vai saber se foi o título ou a thumbnail.'

export const TYPE_META: Record<TestType, { icon: string; label: string; hint: string }> = {
  thumbnail: { icon: 'Image', label: 'Thumbnail', hint: 'Test different thumbnail images' },
  title:     { icon: 'Type', label: 'Title', hint: 'Test different video titles' },
  combo:     { icon: 'Layers', label: 'Título + thumbnail', hint: FRASE_COMBO },
} as const

/** Tipo lido do banco pode estar fora dos três (teste antigo de descrição): nunca undefined. */
export function tipoMeta(t: string): { icon: string; label: string; hint: string } {
  return (TYPE_META as Record<string, { icon: string; label: string; hint: string }>)[t]
    ?? { icon: 'HelpCircle', label: ROTULO_TIPO_DESCONHECIDO, hint: DICA_TIPO_DESCONHECIDO }
}

export function toDisplayLabel(dbLabel: string, isOriginal?: boolean): DisplayLabel {
  if (isOriginal || dbLabel === 'original') return 'A'
  if (dbLabel === 'B' || dbLabel === 'C' || dbLabel === 'D') return dbLabel
  return 'B'
}

export function variantColor(dbLabel: string, isOriginal?: boolean): string {
  return VARIANT_COLORS[toDisplayLabel(dbLabel, isOriginal)]
}

const DASH = '—'

const numberFmt = new Intl.NumberFormat('pt-BR')
const dateFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return DASH
  return numberFmt.format(n)
}

export function formatPercent(n: number | null | undefined, decimals = 1): string {
  if (n == null || Number.isNaN(n)) return DASH
  return `${brDec(n, decimals)}%`
}

/** CTR de uma variante: sem impressões medidas (0/null) é "—", nunca "0,0%". */
export function formatCtr(ctr: number | null | undefined, impressions: number | null | undefined, decimals = 1): string {
  if (!impressions || impressions <= 0 || ctr == null || Number.isNaN(ctr)) return DASH
  return `${brDec(ctr * 100, decimals)}%`
}

/** true quando nenhuma variante tem impressões medidas. */
type CtrMedida = { label?: string; ctr: number; impressions?: number | null }

/** Diferença de CTR de `variant` contra A, em pontos percentuais relativos; null quando não há base medida. */
export function liftVsA(variantA: CtrMedida | null | undefined, variant: CtrMedida | null | undefined): number | null {
  if (!variantA || !variant || variant.label === 'A') return null
  if (!(variantA.ctr > 0) || !variantA.impressions || !variant.impressions) return null
  return ((variant.ctr - variantA.ctr) / variantA.ctr) * 100
}

export function semImpressoes(variants: ReadonlyArray<{ impressions?: number | null }>): boolean {
  return variants.every(v => !v.impressions || v.impressions <= 0)
}

export function formatDate(d: string | Date | null | undefined): string {
  if (d == null) return DASH
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return DASH
  return dateFmt.format(date)
}

export function formatCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs < 1_000) return String(n)
  if (abs < 1_000_000) return `${sign}${brDec(abs / 1_000, 1)}k`
  if (abs < 1_000_000_000) return `${sign}${brDec(abs / 1_000_000, 1)}M`
  return `${sign}${brDec(abs / 1_000_000_000, 1)}B`
}
