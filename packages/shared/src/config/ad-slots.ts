import type { AdSlotDefinition } from '@tn-figueiredo/ad-engine'

export const SITE_AD_SLOTS: readonly AdSlotDefinition[] = [
  {
    key: 'banner_top',
    label: 'Banner — Topo',
    desc: 'Strip full-width acima do artigo. Dismissable, opt-in.',
    badge: 'Alto alcance',
    badgeColor: 'green',
    // @ts-expect-error — pending ad-engine@0.3.0
    zone: 'banner',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
  },
  {
    key: 'rail_left',
    label: 'Rail esquerdo',
    desc: 'Sidebar esquerda abaixo do TOC. Apenas house ads.',
    badge: 'Contextual',
    badgeColor: 'blue',
    // @ts-expect-error — pending ad-engine@0.3.0
    zone: 'rail',
    mobileBehavior: 'hide',
    acceptedAdTypes: ['house'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
  },
  {
    key: 'rail_right',
    label: 'Rail direito',
    desc: 'Sidebar direita sticky acima dos key-points.',
    badge: 'Visibilidade',
    badgeColor: 'purple',
    // @ts-expect-error — pending ad-engine@0.3.0
    zone: 'rail',
    mobileBehavior: 'stack',
    acceptedAdTypes: ['cpa'],
    defaultLimits: { maxPerSession: 3, maxPerDay: 6, cooldownMs: 900_000 },
  },
  {
    key: 'inline_mid',
    label: 'Inline — Meio',
    desc: 'Inserido entre seções do artigo, antes do 2º h2.',
    badge: 'Contextual',
    badgeColor: 'blue',
    // @ts-expect-error — pending ad-engine@0.3.0
    zone: 'inline',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['cpa'],
    defaultLimits: { maxPerSession: 2, maxPerDay: 4, cooldownMs: 1_800_000 },
  },
  {
    key: 'inline_end',
    label: 'Inline — Encerramento',
    desc: 'Dentro do fluxo, zona final do artigo. Form/CTA.',
    badge: 'Engajamento',
    badgeColor: 'orange',
    // @ts-expect-error — pending ad-engine@0.3.0
    zone: 'inline',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 2, cooldownMs: 3_600_000 },
  },
  {
    key: 'block_bottom',
    label: 'Block — Inferior',
    desc: 'Card standalone após o body do artigo.',
    badge: 'Retargeting',
    badgeColor: 'orange',
    // @ts-expect-error — pending ad-engine@0.3.0
    zone: 'block',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 2, cooldownMs: 7_200_000 },
  },
] as const
