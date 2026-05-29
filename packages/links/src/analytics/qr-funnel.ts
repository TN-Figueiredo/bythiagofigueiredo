export interface QrFunnelInput {
  scans: number
  clicks: number
  conversions: number
}

export interface FunnelStep {
  label: string
  value: number
  pct: number
}

export interface QrFunnelResult {
  steps: [FunnelStep, FunnelStep, FunnelStep]
  overallRate: number
}

export function computeQrFunnel(input: QrFunnelInput): QrFunnelResult {
  const { scans, clicks, conversions } = input
  const maxVal = Math.max(scans, 1)

  return {
    steps: [
      { label: 'Escaneamentos', value: scans, pct: scans > 0 ? 100 : 0 },
      { label: 'Cliques', value: clicks, pct: scans > 0 ? Math.min(Math.round((clicks / maxVal) * 100), 100) : 0 },
      { label: 'Conversoes', value: conversions, pct: scans > 0 ? Math.min(Math.round((conversions / maxVal) * 100), 100) : 0 },
    ],
    overallRate: scans > 0 ? Math.round((conversions / scans) * 1000) / 10 : 0,
  }
}
