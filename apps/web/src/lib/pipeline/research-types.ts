import type { ResearchStatus, ResearchSource as ResearchSourceEnum, DecisionHorizon, DecisionStatus, FocoState, ThemeId } from './research-schemas'

// ---------------------------------------------------------------------------
// Re-export core enum types so consumers only need one import
// ---------------------------------------------------------------------------
export type { ResearchStatus, ResearchSource as ResearchSourceEnum, DecisionHorizon, DecisionStatus, FocoState, ThemeId }

export type FocoAuthor = 'thiago' | 'cowork'

// ---------------------------------------------------------------------------
// 1. STATUS — fresca | analise | aplicada | arquivada
// ---------------------------------------------------------------------------

export interface StatusMeta {
  label: string
  kind: 'info' | 'warn' | 'ok' | 'muted'
  dot: string
}

export const STATUS_META: Record<ResearchStatus, StatusMeta> = {
  fresca:    { label: 'Fresca',     kind: 'info',  dot: 'var(--info, #22b8d6)' },
  analise:   { label: 'Em análise', kind: 'warn',  dot: 'var(--warn, #f59e0b)' },
  aplicada:  { label: 'Aplicada',   kind: 'ok',    dot: 'var(--ok, #22c55e)' },
  arquivada: { label: 'Arquivada',  kind: 'muted', dot: 'var(--text-dim, #686a76)' },
}

/** Dot color keyed by status — kept as flat Record for legacy callers (e.g. research-picker). */
export const RESEARCH_STATUS_COLORS: Record<ResearchStatus, string> = {
  fresca:    STATUS_META.fresca.dot,
  analise:   STATUS_META.analise.dot,
  aplicada:  STATUS_META.aplicada.dot,
  arquivada: STATUS_META.arquivada.dot,
}

// ---------------------------------------------------------------------------
// 2. THEMES — 6 strategic content themes
// ---------------------------------------------------------------------------

export interface ThemeMeta {
  id: ThemeId
  label: string
  short: string
  color: string
  icon: string
}

export const THEME_META: Record<ThemeId, ThemeMeta> = {
  asia:  { id: 'asia',  label: 'Ásia & Nomadismo',  short: 'Ásia',  color: '#22b8d6', icon: 'globe' },
  ia:    { id: 'ia',    label: 'IA & Produção',      short: 'IA',    color: '#8b8cf6', icon: 'sparkles' },
  dev:   { id: 'dev',   label: 'Programação',        short: 'Dev',   color: '#22c55e', icon: 'blog' },
  games: { id: 'games', label: 'Games & Pedigree',   short: 'Games', color: '#ec4899', icon: 'trophy' },
  grana: { id: 'grana', label: 'Monetização',         short: 'Grana', color: '#f59e0b', icon: 'dollar' },
  canal: { id: 'canal', label: 'Canal & Audiência',   short: 'Canal', color: '#a855f7', icon: 'youtube' },
}

export const THEMES = Object.values(THEME_META)

export interface ResearchTheme {
  id: ThemeId
  site_id: string
  label: string
  short: string
  color: string
  icon: string
  sort_order: number
  created_at: string
}

// ---------------------------------------------------------------------------
// 3. SOURCE / AUTHORSHIP — cowork | thiago | dupla
// ---------------------------------------------------------------------------

export interface SourceMeta {
  label: string
  short: string
  icon: string
  tone: string
}

export const SOURCE_META: Record<ResearchSourceEnum, SourceMeta> = {
  cowork: { label: 'Claude Cowork',  short: 'Cowork', icon: 'sparkles', tone: 'var(--c-courses, #8b8cf6)' },
  thiago: { label: 'Você',           short: 'Você',   icon: 'edit',     tone: 'var(--accent, #fb7a52)' },
  dupla:  { label: 'Cowork + você',  short: 'Dupla',  icon: 'authors',  tone: 'var(--c-pipeline, #22b8d6)' },
}

// ---------------------------------------------------------------------------
// 4. DECISIONS — horizon + status
// ---------------------------------------------------------------------------

export interface HorizonMeta {
  label: string
  sub: string
  icon: string
  color: string
}

export const HORIZON_META: Record<DecisionHorizon, HorizonMeta> = {
  agora:    { label: 'Agora',    sub: 'Próximos 3 meses',  icon: 'target',     color: 'var(--accent, #fb7a52)' },
  proximo:  { label: 'Próximo',  sub: '3 a 6 meses',       icon: 'arrowright', color: 'var(--c-pipeline, #22b8d6)' },
  explorar: { label: 'Explorar', sub: 'Apostas / backlog', icon: 'flask',      color: 'var(--c-courses, #8b8cf6)' },
}

export interface DecisionStatusMeta {
  label: string
  kind: 'ok' | 'warn' | 'info' | 'muted'
  icon: string
  dot: string
}

export const DECISION_STATUS_META: Record<DecisionStatus, DecisionStatusMeta> = {
  decidido:  { label: 'Decidido',  kind: 'ok',    icon: 'checkcircle', dot: 'var(--ok, #22c55e)' },
  testando:  { label: 'Testando',  kind: 'warn',  icon: 'flask',       dot: 'var(--warn, #f59e0b)' },
  revisar:   { label: 'Revisar',   kind: 'info',  icon: 'refresh',     dot: 'var(--info, #22b8d6)' },
  arquivado: { label: 'Arquivado', kind: 'muted', icon: 'archive',     dot: 'var(--text-dim, #686a76)' },
}

export interface ResearchDecision {
  id: string
  site_id: string
  title: string
  rationale: string | null
  horizon: DecisionHorizon
  status: DecisionStatus
  theme_id: ThemeId | null
  date_label: string | null
  drives: string[]
  context: string | null
  consequences: string[]
  metric: string | null
  revisit: string | null
  history: Array<{ label: string; date: string; note: string | null }>
  created_at: string
  updated_at: string
}

export interface DecisionWithSources extends ResearchDecision {
  sources: Array<{
    research_id: string
    research_title: string
    note: string | null
  }>
}

export interface ResearchDecisionSourceRow {
  id: string
  decision_id: string
  research_id: string
  note: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// 5. FOCO — strategic focus state
// ---------------------------------------------------------------------------

export interface FocoStateMeta {
  label: string
  kind: 'ok' | 'info' | 'muted'
  tone: string
}

export const FOCO_STATE_META: Record<FocoState, FocoStateMeta> = {
  ativo:     { label: 'No ar',                 kind: 'ok',    tone: 'var(--accent, #fb7a52)' },
  proposto:  { label: 'Proposto pelo Cowork',  kind: 'info',  tone: 'var(--c-courses, #8b8cf6)' },
  rascunho:  { label: 'Rascunho',              kind: 'muted', tone: 'var(--text-dim, #686a76)' },
  arquivado: { label: 'Arquivado',             kind: 'muted', tone: 'var(--text-dim, #686a76)' },
}

export interface ResearchFoco {
  id: string
  site_id: string
  title: string
  description: string | null
  state: FocoState
  horizon: DecisionHorizon
  active: boolean
  author: FocoAuthor
  rationale: string | null
  metric: string | null
  window_label: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface FocoWithRelations extends ResearchFoco {
  themes: ThemeId[]
  pinned_research: Array<{
    item_id: string
    title: string
    note: string | null
  }>
  decisions: Array<{
    decision_id: string
    decision_title: string
    horizon: DecisionHorizon
    status: DecisionStatus
  }>
}

export interface ResearchFocoThemeRow {
  foco_id: string
  theme_id: ThemeId
  site_id: string
  created_at: string
}

export interface ResearchFocoSourceRow {
  foco_id: string
  item_id: string
  note: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// 6. RESEARCH ITEM — updated with new fields
// ---------------------------------------------------------------------------

export interface ResearchSource {
  url: string
  title: string
  accessed_at?: string
}

export interface ResearchItemSummary {
  id: string
  title: string
  topic_id: string | null
  theme_id: ThemeId
  source: ResearchSourceEnum
  summary: string | null
  status: ResearchStatus
  word_count: number
  read_min: number
  pinned: boolean
  takeaways: string[]
  sources: ResearchSource[]
  version: number
  created_at: string
  updated_at: string
}

export interface ResearchItemFull extends ResearchItemSummary {
  content_json: Record<string, unknown> | null
  content_md: string | null
  content_html: string | null
  topic_path?: string
  topic_name?: string
  topic_icon?: string
  linked_items?: ResearchLinkedItem[]
}

export interface ResearchLinkedItem {
  link_id: string
  pipeline_item_id: string
  note: string | null
  title: string
  format?: string
  stage?: string
}

// ---------------------------------------------------------------------------
// 7. STATS
// ---------------------------------------------------------------------------

export interface ResearchStats {
  total: number
  fresca: number
  analise: number
  aplicada: number
  arquivada: number
  /** @deprecated Use fresca instead */
  unread?: number
  /** @deprecated Use aplicada instead */
  starred?: number
  /** @deprecated Use aplicada instead */
  reviewed?: number
  /** @deprecated Use arquivada instead */
  archived?: number
}

export interface TopicItemCounts {
  [topicId: string]: { total: number; unread: number }
}

// ---------------------------------------------------------------------------
// 8. LEGACY / BACKWARD-COMPAT — keep for research-picker.tsx and topic-tree
// ---------------------------------------------------------------------------

/**
 * @deprecated The topic-tree hierarchy is being replaced by the 3-tab strategic
 * system (Foco / Pesquisas / Decisões). ResearchTopic is kept for backward
 * compatibility with research-picker.tsx and the existing topic CRUD actions.
 * Do not introduce new usages — use ThemeId instead.
 */
export interface ResearchTopic {
  id: string
  parent_id: string | null
  name: string
  slug: string
  path: string
  depth: number
  color: string
  icon: string
  sort_order: number
}
