export interface RawInsight {
  type: 'growth' | 'decline' | 'top_performer' | 'health_warning' | 'milestone' | 'qr_surge' | 'geo_concentration' | 'device_skew'
  metric: string
  value: number
  period?: string
  linkTitle?: string
}

export interface FormattedInsight {
  tone: 'up' | 'accent' | 'amber' | 'red'
  icon: string
  text: string
}

function fmt(n: number): string {
  return Math.abs(n).toLocaleString('pt-BR')
}

const METRIC_LABELS: Record<string, string> = {
  clicks: 'cliques',
  unique: 'visitantes unicos',
  scans: 'escaneamentos QR',
  health: 'links',
}

export function formatInsight(raw: RawInsight): FormattedInsight {
  const metricLabel = METRIC_LABELS[raw.metric] ?? raw.metric

  switch (raw.type) {
    case 'growth':
      return {
        tone: 'up',
        icon: 'trendingUp',
        text: `Tráfego de ${metricLabel} cresceu ${fmt(raw.value)}% ${raw.period ? `nos últimos ${raw.period}` : ''}`.trim(),
      }
    case 'decline':
      return {
        tone: 'red',
        icon: 'trendingDown',
        text: `Tráfego de ${metricLabel} caiu ${fmt(raw.value)}% ${raw.period ? `nos últimos ${raw.period}` : ''}`.trim(),
      }
    case 'top_performer':
      return {
        tone: 'accent',
        icon: 'trophy',
        text: `${raw.linkTitle ?? 'Top link'} lidera com ${fmt(raw.value)} ${metricLabel}`,
      }
    case 'health_warning':
      return {
        tone: 'amber',
        icon: 'alertTriangle',
        text: `${fmt(raw.value)} ${metricLabel} com problemas de saúde — verifique destinos`,
      }
    case 'milestone':
      return {
        tone: 'up',
        icon: 'award',
        text: `Marco atingido: ${fmt(raw.value)} ${metricLabel} totais!`,
      }
    case 'qr_surge':
      return {
        tone: 'accent',
        icon: 'qrCode',
        text: `Pico de ${metricLabel} QR: +${fmt(raw.value)}% ${raw.period ? `nas últimas ${raw.period}` : ''}`.trim(),
      }
    case 'geo_concentration':
      return {
        tone: 'amber',
        icon: 'globe',
        text: `${fmt(raw.value)}% do tráfego vem de ${raw.linkTitle ?? 'um único país'} — considere conteúdo localizado`,
      }
    case 'device_skew':
      return {
        tone: 'accent',
        icon: 'smartphone',
        text: raw.linkTitle === 'mobile'
          ? `Audiência ${fmt(raw.value)}% mobile — garanta otimização para dispositivos móveis`
          : `Audiência ${fmt(raw.value)}% desktop — conteúdo extenso tende a performar bem`,
      }
    default:
      return {
        tone: 'accent',
        icon: 'info',
        text: `${metricLabel}: ${fmt(raw.value)}`,
      }
  }
}
