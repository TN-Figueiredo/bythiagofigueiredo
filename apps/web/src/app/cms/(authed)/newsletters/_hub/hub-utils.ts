const SHA256_RE = /^[a-f0-9]{64}$/

export function maskEmail(email: string): string {
  if (!email) return ''
  if (SHA256_RE.test(email)) return '[anonymized]'
  const [local, domain] = email.split('@')
  if (!domain || !local) return email
  const first = local[0]
  const last = local.length > 1 ? local[local.length - 1] : first
  return `${first}***${last}@${domain}`
}

export function calculateEngagementScore(input: {
  opens30d: number
  clicks30d: number
  editionsReceived30d: number
  daysSinceLastOpen: number
}): number {
  const { opens30d, clicks30d, editionsReceived30d, daysSinceLastOpen } = input
  const base = editionsReceived30d || 1
  const openRate = Math.min(opens30d / base, 1)
  const clickRate = Math.min(clicks30d / base, 1)
  const recency = Math.max(0, 1 - daysSinceLastOpen / 30)
  const raw = (openRate * 40 + clickRate * 40 + recency * 20)
  return Math.round(Math.min(100, Math.max(0, raw)))
}

export function calculateHealthScore(input: {
  spf: boolean; dkim: boolean; dmarc: boolean
  bounceRate: number; complaintRate: number
  avgOpenRate: number; subscriberGrowthRate: number
  lgpdConsentRate: number
}): number {
  const authScore = [input.spf, input.dkim, input.dmarc].filter(Boolean).length / 3
  const bounceScore = Math.max(0, 1 - input.bounceRate / 5)
  const complaintScore = Math.max(0, 1 - input.complaintRate / 1)
  const deliverability = (authScore * 0.5 + bounceScore * 0.3 + complaintScore * 0.2) * 25

  const engagement = Math.min(25, (input.avgOpenRate / 50) * 25)

  const growthClamped = Math.max(-10, Math.min(20, input.subscriberGrowthRate))
  const growth = ((growthClamped + 10) / 30) * 25

  const compliance = (input.lgpdConsentRate / 100) * 25

  const raw = deliverability + engagement + growth + compliance
  return Math.round(Math.min(100, Math.max(0, raw)))
}

export function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

export function formatDate(iso: string, locale = 'pt-BR'): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}m`
}
