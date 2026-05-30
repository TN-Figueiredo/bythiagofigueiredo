interface InsightsInput {
  totalClicks: number
  totalLinks: number
  topLink: { title: string; clicks: number } | null
  unhealthyCount: number
  qrScans: number
}

interface InsightsPayload {
  context: string
  question: string
}

export function buildInsightsPayload(input: InsightsInput): InsightsPayload {
  const lines = [
    `Total de cliques: ${input.totalClicks.toLocaleString('pt-BR')}`,
    `Total de links: ${input.totalLinks}`,
    input.topLink ? `Top link: "${input.topLink.title}" com ${input.topLink.clicks.toLocaleString('pt-BR')} cliques` : null,
    input.unhealthyCount > 0 ? `Links com problema: ${input.unhealthyCount}` : null,
    input.qrScans > 0 ? `Escaneamentos QR: ${input.qrScans.toLocaleString('pt-BR')}` : null,
  ].filter(Boolean)

  return {
    context: lines.join('\n'),
    question: 'Com base nessas metricas de links, gere 3-5 insights acionaveis em portugues. Cada insight deve ter tipo (growth|decline|top_performer|health_warning|milestone|qr_surge), metrica, valor numerico e periodo quando aplicavel.',
  }
}
