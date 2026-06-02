/**
 * Performance fixtures — development-only mock data for the Performance dashboard.
 * Gated by NODE_ENV === 'development'.
 */

/** 6-axis health breakdown scores (0-100 each). */
export const FIXTURE_HEALTH_BREAKDOWN = {
  ctr: 72,
  retention: 58,
  engagement: 81,
  frequency: 45,
  growth: 63,
  seo: 77,
} as const satisfies Record<string, number>

export type HealthAxis = keyof typeof FIXTURE_HEALTH_BREAKDOWN

export const FIXTURE_HEALTH_AXES = [
  { key: 'ctr', label: 'CTR', max: 100 },
  { key: 'retention', label: 'Retenção', max: 100 },
  { key: 'engagement', label: 'Engajamento', max: 100 },
  { key: 'frequency', label: 'Frequência', max: 100 },
  { key: 'growth', label: 'Crescimento', max: 100 },
  { key: 'seo', label: 'SEO', max: 100 },
] as const satisfies ReadonlyArray<{ key: HealthAxis; label: string; max: number }>

/** 7 search terms from Search Console mock. */
export const FIXTURE_SEARCH_TERMS = [
  { term: 'nomade digital', clicks: 1_240, impressions: 18_500, ctr: 6.7, position: 3.2 },
  { term: 'trabalho remoto 2026', clicks: 890, impressions: 14_200, ctr: 6.3, position: 4.1 },
  { term: 'custo de vida tailandia', clicks: 720, impressions: 9_800, ctr: 7.3, position: 2.8 },
  { term: 'setup minimalista viagem', clicks: 540, impressions: 8_100, ctr: 6.7, position: 5.0 },
  { term: 'visto digital nomade', clicks: 410, impressions: 6_300, ctr: 6.5, position: 4.6 },
  { term: 'como ganhar dinheiro viajando', clicks: 380, impressions: 11_500, ctr: 3.3, position: 8.2 },
  { term: 'dev remoto salario', clicks: 310, impressions: 5_200, ctr: 6.0, position: 3.9 },
] as const satisfies ReadonlyArray<{ term: string; clicks: number; impressions: number; ctr: number; position: number }>

/** Demographics mock. */
export const FIXTURE_DEMOGRAPHICS = {
  age: [
    { range: '13-17', pct: 2.1 },
    { range: '18-24', pct: 18.4 },
    { range: '25-34', pct: 42.7 },
    { range: '35-44', pct: 24.3 },
    { range: '45-54', pct: 8.6 },
    { range: '55-64', pct: 3.1 },
    { range: '65+', pct: 0.8 },
  ],
  gender: [
    { label: 'Masculino', pct: 71.2 },
    { label: 'Feminino', pct: 26.5 },
    { label: 'Outro', pct: 2.3 },
  ],
  countries: [
    { code: 'BR', name: 'Brasil', pct: 64.8 },
    { code: 'PT', name: 'Portugal', pct: 12.1 },
    { code: 'US', name: 'Estados Unidos', pct: 5.4 },
    { code: 'AO', name: 'Angola', pct: 3.2 },
    { code: 'MZ', name: 'Moçambique', pct: 2.7 },
    { code: 'DE', name: 'Alemanha', pct: 1.9 },
    { code: 'JP', name: 'Japão', pct: 1.5 },
  ],
  devices: [
    { type: 'mobile', pct: 58.3 },
    { type: 'desktop', pct: 28.7 },
    { type: 'tablet', pct: 7.4 },
    { type: 'tv', pct: 5.6 },
  ],
} as const satisfies {
  age: ReadonlyArray<{ range: string; pct: number }>
  gender: ReadonlyArray<{ label: string; pct: number }>
  countries: ReadonlyArray<{ code: string; name: string; pct: number }>
  devices: ReadonlyArray<{ type: string; pct: number }>
}
