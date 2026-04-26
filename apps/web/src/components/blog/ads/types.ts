export interface AdCreativeData {
  campaignId: string | null
  slotKey: string
  type: 'house' | 'cpa'
  source: 'campaign' | 'placeholder'
  interaction: 'link' | 'form'
  title: string
  body: string
  ctaText: string
  ctaUrl: string
  imageUrl: string | null
  logoUrl: string | null
  brandColor: string
  dismissSeconds: number
}

export interface AdSlotProps {
  creative: AdCreativeData
  locale: 'en' | 'pt-BR'
}
