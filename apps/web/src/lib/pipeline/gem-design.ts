import type { Format, Language } from './schemas'

export const GEM_CSS_VARS: Record<string, string> = {
  '--gem-surface': '#161d2d',
  '--gem-surface-hi': '#1a2236',
  '--gem-border': '#222d40',
  '--gem-well': '#0c1222',
  '--gem-text': '#edf2f7',
  '--gem-muted': '#7a8ba3',
  '--gem-dim': '#5a6b7f',
  '--gem-faint': '#2a3650',
  '--gem-done': '#10b981',
  '--gem-warn': '#f59e0b',
  '--gem-danger': '#ef4444',
  '--gem-accent': '#6366f1',
}

interface PriorityConfig {
  accent: string
  accentDim: string
  accentBorder: string
  label: string
  className: string
}

const PRIORITY_MAP: Record<number, PriorityConfig> = {
  5: { accent: '#ef4444', accentDim: 'rgba(239,68,68,0.1)', accentBorder: 'rgba(239,68,68,0.3)', label: 'P5', className: 'priority-5' },
  4: { accent: '#f59e0b', accentDim: 'rgba(245,158,11,0.1)', accentBorder: 'rgba(245,158,11,0.3)', label: 'P4', className: 'priority-4' },
  3: { accent: '#6366f1', accentDim: 'rgba(99,102,241,0.1)', accentBorder: 'rgba(99,102,241,0.3)', label: 'P3', className: 'priority-3' },
  2: { accent: '#0ea5e9', accentDim: 'rgba(14,165,233,0.1)', accentBorder: 'rgba(14,165,233,0.3)', label: 'P2', className: 'priority-2' },
  1: { accent: '#64748b', accentDim: 'rgba(100,116,139,0.1)', accentBorder: 'rgba(100,116,139,0.3)', label: 'P1', className: 'priority-1' },
  0: { accent: '#64748b', accentDim: 'rgba(100,116,139,0.05)', accentBorder: 'rgba(100,116,139,0.2)', label: 'P0', className: 'priority-0' },
}

export function getPriorityConfig(priority: number): PriorityConfig {
  return PRIORITY_MAP[priority] ?? PRIORITY_MAP[0]!
}

interface StalenessResult {
  days: number
  tier: 'ok' | 'warn' | 'old'
  className: string
}

export function getStaleness(updatedAt: string): StalenessResult {
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24))
  if (days > 21) return { days, tier: 'old', className: 'staleness-old' }
  if (days >= 7) return { days, tier: 'warn', className: 'staleness-warn' }
  return { days, tier: 'ok', className: 'staleness-ok' }
}

interface VvsTierResult {
  tier: 'low' | 'mid' | 'high' | 'max'
  color: string
  strokeDashoffset: number
}

const VVS_CIRCUMFERENCE = 2 * Math.PI * 10

export function getVvsTier(score: number): VvsTierResult {
  const offset = VVS_CIRCUMFERENCE - (score / 100) * VVS_CIRCUMFERENCE
  if (score >= 91) return { tier: 'max', color: '#6366f1', strokeDashoffset: offset }
  if (score >= 61) return { tier: 'high', color: '#10b981', strokeDashoffset: offset }
  if (score >= 31) return { tier: 'mid', color: '#f59e0b', strokeDashoffset: offset }
  return { tier: 'low', color: '#ef4444', strokeDashoffset: offset }
}

interface FormatIconResult {
  icon: string
  bgClass: string
  label: string
}

const FORMAT_ICONS: Record<Format, FormatIconResult> = {
  video: { icon: '🎬', bgClass: 'bg-red-500/10', label: 'Video' },
  blog_post: { icon: '✍️', bgClass: 'bg-amber-500/10', label: 'Blog' },
  newsletter: { icon: '📧', bgClass: 'bg-indigo-500/10', label: 'Newsletter' },
  course: { icon: '🎓', bgClass: 'bg-emerald-500/10', label: 'Course' },
  campaign: { icon: '📣', bgClass: 'bg-pink-500/10', label: 'Campaign' },
}

export function getFormatIcon(format: string): FormatIconResult {
  return FORMAT_ICONS[format as Format] ?? { icon: '📄', bgClass: 'bg-slate-500/10', label: format }
}

interface LangConfig {
  label: string
  className: string
}

const LANG_MAP: Record<Language, LangConfig> = {
  'pt-br': { label: 'PT', className: 'bg-green-900/50 text-green-300' },
  'en': { label: 'EN', className: 'bg-blue-900/50 text-blue-300' },
  'both': { label: 'PT+EN', className: 'bg-indigo-900/50 text-indigo-300' },
}

export function getLangConfig(language: string): LangConfig {
  return LANG_MAP[language as Language] ?? { label: language, className: 'bg-slate-700 text-slate-300' }
}

interface CardStateInput {
  hook: string | null
  body_content: string | null
  youtube_video_id: string | null
  blog_post_id: string | null
  newsletter_edition_id: string | null
  campaign_id: string | null
  social_post_id: string | null
  is_archived: boolean
}

export type CardState = 'raw' | 'enriched' | 'graduated' | 'archived'

export function getCardState(item: CardStateInput): CardState {
  if (item.is_archived) return 'archived'
  if (item.youtube_video_id || item.blog_post_id || item.newsletter_edition_id || item.campaign_id || item.social_post_id) return 'graduated'
  if (item.hook || item.body_content) return 'enriched'
  return 'raw'
}

interface Dependency {
  dependency_type: string
  depends_on_pipeline: { code: string }
}

interface BlockedResult {
  blocked: boolean
  blockers: string[]
}

export function isBlocked(deps: Dependency[]): BlockedResult {
  const blockers = deps
    .filter((d) => d.dependency_type === 'hard')
    .map((d) => d.depends_on_pipeline.code)
  return { blocked: blockers.length > 0, blockers }
}

interface ChecklistItem {
  label: string
  done: boolean
}

interface ChecklistProgress {
  done: number
  total: number
  segments: boolean[]
}

export function getChecklistProgress(checklist: ChecklistItem[]): ChecklistProgress {
  const segments = checklist.map((c) => c.done)
  const done = segments.filter(Boolean).length
  return { done, total: checklist.length, segments }
}
