export interface AdSlotDefinition {
  key: string
  label: string
  desc: string
  badge: string
  badgeColor: string
  zone: 'banner' | 'rail' | 'inline' | 'block'
  mobileBehavior: 'keep' | 'hide' | 'stack'
  acceptedAdTypes: readonly ('house' | 'cpa')[]
  defaultLimits: {
    maxPerSession: number
    maxPerDay: number
    cooldownMs: number
  }
  aspectRatio: string
  iabSize: string
}

export const SITE_AD_SLOTS: readonly AdSlotDefinition[] = [
  {
    key: 'banner_top',
    label: 'Banner — Topo',
    desc: 'Strip full-width acima do artigo. Dismissable, opt-in.',
    badge: 'Alto alcance',
    badgeColor: 'green',
    zone: 'banner',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
    aspectRatio: '8:1',
    iabSize: '728x90',
  },
  {
    key: 'rail_left',
    label: 'Rail esquerdo',
    desc: 'Sidebar esquerda abaixo do TOC. Apenas house ads.',
    badge: 'Contextual',
    badgeColor: 'blue',
    zone: 'rail',
    mobileBehavior: 'hide',
    acceptedAdTypes: ['house'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
    aspectRatio: '1:4',
    iabSize: '160x600',
  },
  {
    key: 'rail_right',
    label: 'Rail direito',
    desc: 'Sidebar direita sticky acima dos key-points.',
    badge: 'Visibilidade',
    badgeColor: 'purple',
    zone: 'rail',
    mobileBehavior: 'stack',
    acceptedAdTypes: ['cpa'],
    defaultLimits: { maxPerSession: 3, maxPerDay: 6, cooldownMs: 900_000 },
    aspectRatio: '6:5',
    iabSize: '300x250',
  },
  {
    key: 'inline_mid',
    label: 'Inline — Meio',
    desc: 'Inserido entre seções do artigo, antes do 2º h2.',
    badge: 'Contextual',
    badgeColor: 'blue',
    zone: 'inline',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['cpa'],
    defaultLimits: { maxPerSession: 2, maxPerDay: 4, cooldownMs: 1_800_000 },
    aspectRatio: '6:5',
    iabSize: '300x250',
  },
  {
    key: 'block_bottom',
    label: 'Block — Inferior',
    desc: 'Card standalone após o body do artigo.',
    badge: 'Retargeting',
    badgeColor: 'orange',
    zone: 'block',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 2, cooldownMs: 7_200_000 },
    aspectRatio: '4:1',
    iabSize: '970x250',
  },
] as const
