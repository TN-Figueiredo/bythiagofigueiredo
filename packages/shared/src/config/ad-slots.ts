import type { AdSlotDefinition } from '@tn-figueiredo/ad-engine'

/**
 * bythiagofigueiredo ad slot definitions — the ONLY project-specific ad engine file.
 *
 * Pass to AdEngineAdminProvider as `config.slots`.
 * Each slot key must have a matching kill switch in the kill_switches table
 * and a placeholder row in ad_placeholders.
 */
export const SITE_AD_SLOTS: readonly AdSlotDefinition[] = [
  {
    key: 'article_top',
    label: 'Topo do artigo',
    desc: 'Banner exibido antes do conteúdo do artigo. Alta visibilidade, visto por 100% dos leitores.',
    badge: 'Alto alcance',
    badgeColor: 'green',
    defaultLimits: {
      maxPerSession: 1,
      maxPerDay: 3,
      cooldownMs: 60 * 60 * 1000, // 1h
    },
  },
  {
    key: 'article_between_paras',
    label: 'Entre parágrafos',
    desc: 'Nativo inserido entre parágrafos do artigo. Contextual e de alta intenção.',
    badge: 'Contextual',
    badgeColor: 'blue',
    defaultLimits: {
      maxPerSession: 2,
      maxPerDay: 4,
      cooldownMs: 30 * 60 * 1000, // 30min
    },
  },
  {
    key: 'sidebar_right',
    label: 'Sidebar direita',
    desc: 'Slot fixo na coluna lateral. Acompanha a rolagem, alta visibilidade em desktop.',
    badge: 'Visibilidade',
    badgeColor: 'purple',
    defaultLimits: {
      maxPerSession: 3,
      maxPerDay: 6,
      cooldownMs: 15 * 60 * 1000, // 15min
    },
  },
  {
    key: 'below_fold',
    label: 'Abaixo da dobra',
    desc: 'Card exibido ao final do artigo. Ideal para retargeting após consumo completo do conteúdo.',
    badge: 'Retargeting',
    badgeColor: 'orange',
    defaultLimits: {
      maxPerSession: 1,
      maxPerDay: 2,
      cooldownMs: 2 * 60 * 60 * 1000, // 2h
    },
  },
] as const
