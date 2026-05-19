export const REFERENCE_GROUPS = [
  { id: 'pessoal',    label: 'Pessoal',    color: '#34d399' },
  { id: 'estrategia', label: 'Estratégia', color: '#a78bfa' },
  { id: 'craft',      label: 'Craft',      color: '#fbbf24' },
  { id: 'producao',   label: 'Produção',   color: '#22d3ee' },
  { id: 'memoria',    label: 'Memória',    color: '#38bdf8' },
  { id: 'sistema',    label: 'Sistema',    color: '#94a3b8' },
] as const

export type ReferenceGroup = (typeof REFERENCE_GROUPS)[number]['id']

export const REFERENCE_GROUP_IDS = REFERENCE_GROUPS.map((g) => g.id) as [ReferenceGroup, ...ReferenceGroup[]]

export function getGroupMeta(groupId: string) {
  return REFERENCE_GROUPS.find((g) => g.id === groupId) ?? REFERENCE_GROUPS[0]
}

export const REFERENCE_USAGE: Record<string, string[]> = {
  'personal-profile': ['Ideator', 'Writer', 'Producer', 'Product Eval', 'Perf Review'],
  'featured-convention': ['Ideator', 'Writer', 'Producer'],
  'ideator-memory': ['Ideator'],
  'ideator-generation-techniques': ['Ideator'],
  'ideator-channel-profiles': ['Ideator'],
  'ideator-content-angles': ['Ideator'],
  'ideator-formats-frameworks': ['Ideator'],
  'ideator-scoring-rubrics': ['Ideator'],
  'ideator-monetization-research': ['Ideator'],
  'writer-memory': ['Writer'],
  'writer-voice-guide': ['Writer'],
  'writer-article-craft': ['Writer'],
  'writer-newsletter-craft': ['Writer'],
  'writer-social-craft': ['Writer'],
  'producer-memory': ['Producer'],
  'producer-editing-patterns': ['Producer'],
  'producer-sound-design': ['Producer'],
  'producer-visual-style': ['Producer'],
  'producer-seo-metadata': ['Producer'],
  'producer-launch-strategy': ['Producer'],
  'product-eval-scoring': ['Product Eval'],
  'product-eval-memory': ['Product Eval'],
  'product-eval-catalog': ['Product Eval'],
  'product-eval-experience': ['Product Eval'],
  'product-eval-reference': ['Product Eval'],
  'perf-review-benchmarks': ['Perf Review'],
  'perf-review-memory': ['Perf Review'],
  'perf-review-feedback-templates': ['Perf Review'],
  'perf-review-analytics-guide': ['Perf Review'],
  'content-calendar-taxonomy': ['Ideator', 'Writer', 'Producer'],
  'content-curator-skill': ['Curator'],
  'curator-memory': ['Curator'],
  'curator-rules': ['Curator'],
  'playlist-architect-skill': ['Architect'],
  'architect-memory': ['Architect'],
  'architect-templates': ['Architect'],
}
