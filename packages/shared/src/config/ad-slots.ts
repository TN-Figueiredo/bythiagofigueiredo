export interface AdSlotDefinition {
  key: string
  area: 'post' | 'archive' | 'home' | 'youtube'
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
    key: 'post:top:banner',
    area: 'post',
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
    key: 'post:rail:anchor-left',
    area: 'post',
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
    key: 'post:rail:anchor',
    area: 'post',
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
    key: 'post:body:bookmark',
    area: 'post',
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
    key: 'post:footer:coda',
    area: 'post',
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
  {
    key: 'archive:top:doorman',
    area: 'archive',
    label: 'Banner — Topo Archive',
    desc: 'Strip full-width no topo da listagem do blog. Hidden mobile.',
    badge: 'Awareness',
    badgeColor: 'green',
    zone: 'banner',
    mobileBehavior: 'hide',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
    aspectRatio: '8:1',
    iabSize: '728x90',
  },
  {
    key: 'archive:break:anchor',
    area: 'archive',
    label: 'Âncora Horizontal',
    desc: 'Break horizontal entre cards do grid, 3 colunas.',
    badge: 'Contextual',
    badgeColor: 'blue',
    zone: 'inline',
    mobileBehavior: 'stack',
    acceptedAdTypes: ['cpa'],
    defaultLimits: { maxPerSession: 2, maxPerDay: 4, cooldownMs: 1_800_000 },
    aspectRatio: '16:3',
    iabSize: 'fluid',
  },
  {
    key: 'archive:grid:bookmark',
    area: 'archive',
    label: 'Card no Grid',
    desc: 'Card de anúncio integrado ao grid pinboard, tema escuro.',
    badge: 'Nativo',
    badgeColor: 'purple',
    zone: 'inline',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 3, maxPerDay: 6, cooldownMs: 900_000 },
    aspectRatio: '3:4',
    iabSize: 'grid-cell',
  },
  {
    key: 'archive:footer:marginalia',
    area: 'archive',
    label: 'Marginalia — Rodapé',
    desc: 'Bloco editorial no rodapé da listagem, max-w 720.',
    badge: 'Contextual',
    badgeColor: 'blue',
    zone: 'block',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 2, cooldownMs: 3_600_000 },
    aspectRatio: '16:3',
    iabSize: 'max-w-720',
  },
  {
    key: 'archive:footer:bowtie',
    area: 'archive',
    label: 'Newsletter CTA',
    desc: 'CTA de newsletter em Caveat cursive, form de email.',
    badge: 'Engajamento',
    badgeColor: 'orange',
    zone: 'block',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 1, cooldownMs: 7_200_000 },
    aspectRatio: '16:3',
    iabSize: 'full-width',
  },
] as const

export function getSlotsByArea(area: string): AdSlotDefinition[] {
  return SITE_AD_SLOTS.filter((s) => s.area === area)
}

export const AD_AREAS = [
  { key: 'post', label: 'Blog Post', route: '/blog/[slug]' },
  { key: 'archive', label: 'Blog Archive', route: '/blog' },
  { key: 'home', label: 'Home', route: '/' },
  { key: 'youtube', label: 'YouTube', route: '/youtube' },
] as const
