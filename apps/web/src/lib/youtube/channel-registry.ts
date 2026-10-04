/**
 * Cadastro de canais próprios (/cms/youtube): tipos, textos de tela e regras puras, usados pelas actions e pela tela.
 * Puro: sem banco, sem relógio. Os textos são os do mockup aprovado (docs/superpowers/mockups/2026-10-04-multi-canal).
 */
import { z } from 'zod'
import type { ChannelLocale } from './channel-locales'
import { isNicheSlug } from './observatorio/niche'

/* ------------------------------------------------------------------ slug */

/** A forma do slug de um canal: a mesma do CHECK youtube_channels_slug_check. A normalização a partir do handle mora no banco. */
export const CHANNEL_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CHANNEL_SLUG_MIN = 2, CHANNEL_SLUG_MAX = 32
export function isChannelSlug(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.length >= CHANNEL_SLUG_MIN && raw.length <= CHANNEL_SLUG_MAX && CHANNEL_SLUG_RE.test(raw)
}

/**
 * O slug de um nicho novo, saído do nome: sem acento, minúsculo, hífens, no máximo 24 caracteres. Pode devolver algo
 * que não é um slug válido ('' para um nome só de símbolos, 'todos' para um reservado): quem chama confere com isNicheSlug.
 */
export function nicheSlugFromLabel(label: string): string {
  return label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/, '')
}
/**
 * O rótulo de um nicho como vai para o banco: aparado, espaços internos colapsados, 1 a 24 caracteres, e só letras
 * (com acento), números, espaço, hífen e &. Quebra de linha, tabulação, aspas e pontuação ficam de fora: o rótulo
 * entra em frases e em expressões regulares do Observatório. null = o nome não serve.
 */
const NICHE_LABEL_RE = /^[\p{L}\p{N}&-]+(?: [\p{L}\p{N}&-]+)*$/u
export function normalizeNicheLabel(raw: string): string | null {
  if (/[\r\n\t\f\v]/.test(raw)) return null
  const label = raw.trim().replace(/ +/g, ' ')
  return label.length >= 1 && label.length <= 24 && NICHE_LABEL_RE.test(label) ? label : null
}
/** O slug do nicho que este nome criaria, ou null quando o nome não serve. */
export function nicheSlugOrNull(label: string): string | null {
  const clean = normalizeNicheLabel(label)
  if (clean == null) return null
  const slug = nicheSlugFromLabel(clean)
  return isNicheSlug(slug) ? slug : null
}

/* ------------------------------------------------------------------ tipos que cruzam action ↔ tela */

/** Um nicho do site como a tela o mostra. competitors null = a contagem não pôde ser lida (não se inventa zero). */
export interface NicheView {
  slug: string
  label: string
  dark: string
  light: string
  builtin: boolean
  /** canais próprios neste nicho */
  channels: number
  competitors: number | null
}

/** O que o lookup do YouTube trouxe. Nada aqui é inventado pela tela. */
export interface ChannelLookup {
  channelId: string
  handle: string
  name: string
  description: string | null
  uploadsPlaylistId: string
  subscriberCount: number
  videoCount: number
  thumbnailUrl: string | null
  bannerUrl: string | null
  customUrl: string | null
}
export type LookupChannelResult =
  /** slug: o slug livre que o banco sugere para este handle; null quando o banco ainda não tem a coluna. */
  | { ok: true; channel: ChannelLookup; slug: string | null }
  | { ok: false; error: string }

export interface AddChannelInput extends ChannelLookup {
  locale: ChannelLocale
  niche: string | null
  /** null = o banco deriva do handle. */
  slug: string | null
}
export type AddChannelResult =
  | { ok: true; id: string; slug: string | null }
  /** field: embaixo de que campo o erro aparece. */
  | { ok: false; error: string; field?: 'slug' | 'niche' | 'handle' }

export interface ChannelIdentityInput { channel_id: string; locale: ChannelLocale; niche: string | null }
export type SimpleResult = { ok: true } | { ok: false; error: string }
export type CreateNicheResult = { ok: true; slug: string } | { ok: false; error: string }

/** Um teste A/B que impede a remoção: começou e não terminou. */
export interface RemovalBlocker {
  id: string
  name: string
  status: 'active' | 'paused'
  /** ISO; null quando o banco não tem a data. */
  since: string | null
  videoTitle: string
}
export interface RemovalImpact {
  name: string
  slug: string
  videos: number
  comments: number
  syncLogs: number
  /** Testes A/B que serão apagados junto (os que não bloqueiam). */
  abTests: number
  analyses: number
  tasks: number
  notes: number
  /** Itens do pipeline que ficam, sem o vínculo. */
  pipelineLinks: number
  blockers: RemovalBlocker[]
}
export type RemovalImpactResult = { ok: true; impact: RemovalImpact } | { ok: false; error: string }
export type RemoveChannelResult =
  | { ok: true }
  /** blockers presente = a remoção foi recusada por teste A/B rodando; nada foi apagado. */
  | { ok: false; error: string; blockers?: RemovalBlocker[] }

/* ------------------------------------------------------------------ o que as funções do banco devolvem */

const count = z.number().int().min(0)
const impactRow = z.object({
  status: z.enum(['ok', 'blocked', 'removed']),
  name: z.string(),
  slug: z.string(),
  videos: count, comments: count, sync_logs: count, ab_tests: count, analyses: count, tasks: count, notes: count, pipeline_links: count,
  blockers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['active', 'paused']),
    started_at: z.string().nullable(),
    paused_at: z.string().nullable(),
    video_title: z.string(),
  })),
})
export type RemovalRpc =
  | { status: 'ok' | 'blocked' | 'removed'; impact: RemovalImpact }
  | { status: 'not_found' | 'slug_mismatch' }
  /** O banco devolveu algo que este código não entende: nunca tratado como sucesso. */
  | { status: 'invalid' }

/** Lê o jsonb de youtube_channel_removal_impact / youtube_channel_remove. */
export function parseRemovalRpc(raw: unknown): RemovalRpc {
  const status = typeof raw === 'object' && raw !== null && 'status' in raw ? (raw as { status: unknown }).status : null
  if (status === 'not_found' || status === 'slug_mismatch') return { status }
  const p = impactRow.safeParse(raw)
  if (!p.success) return { status: 'invalid' }
  const r = p.data
  return {
    status: r.status,
    impact: {
      name: r.name, slug: r.slug, videos: r.videos, comments: r.comments, syncLogs: r.sync_logs, abTests: r.ab_tests,
      analyses: r.analyses, tasks: r.tasks, notes: r.notes, pipelineLinks: r.pipeline_links,
      blockers: r.blockers.map(b => ({
        id: b.id, name: b.name, status: b.status, videoTitle: b.video_title,
        since: b.status === 'paused' ? (b.paused_at ?? b.started_at) : b.started_at,
      })),
    },
  }
}

/* ------------------------------------------------------------------ textos */

export const CHANNEL_TEXT = {
  slugTaken: (slug: string, name: string) => `Slug “${slug}” is already used by “${name}”.`,
  alreadyRegistered: (slug: string) => `This channel is already registered as “${slug}”.`,
  nicheNotFound: 'Niche not found. Reload the page and try again.',
  nicheLabelTaken: (label: string) => `A niche named “${label}” already exists.`,
  nicheNameInvalid: 'Choose another name for this niche.',
  channelNotFound: 'Channel not found',
  /* fora do mockup (ver o relatório da Task 7) */
  slugInvalid: 'Use lowercase letters, numbers and hyphens (2 to 32 characters).',
  slugMismatch: 'Slug confirmation does not match',
  removalUnavailable: 'Channel removal is not available yet: a database update is pending. Nothing was deleted.',
  nichesUnavailable: 'Niches cannot be created yet: a database update is pending.',
  saveFailed: 'Error saving',
} as const

const s = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** As linhas "isto será apagado", na ordem do mockup. Todas aparecem, mesmo com zero: a lista é a mesma para todo canal. */
export function removalLines(i: RemovalImpact): Array<{ key: string; count: number; text: string }> {
  return [
    { key: 'videos', count: i.videos, text: `${s(i.videos, 'video', 'videos')}, with ${s(i.videos, 'its', 'their')} analytics, grades and optimization cycles` },
    { key: 'comments', count: i.comments, text: s(i.comments, 'curated comment', 'curated comments') },
    { key: 'syncLogs', count: i.syncLogs, text: s(i.syncLogs, 'sync log entry', 'sync log entries') },
    { key: 'abTests', count: i.abTests, text: `${s(i.abTests, 'finished A/B test', 'finished A/B tests')}, with ${s(i.abTests, 'its', 'their')} variants and results` },
    { key: 'analyses', count: i.analyses, text: `${s(i.analyses, 'intelligence analysis', 'intelligence analyses')} and ${i.tasks} ${s(i.tasks, 'queued task', 'queued tasks')}` },
    { key: 'notes', count: i.notes, text: s(i.notes, 'note', 'notes') },
  ]
}
/** "6 pipeline items" + " keep their content and lose the link to their video." */
export function removalKeepLine(i: RemovalImpact): { strong: string; rest: string } {
  const n = i.pipelineLinks
  return {
    strong: `${n} ${s(n, 'pipeline item', 'pipeline items')}`,
    rest: n === 1 ? ' keeps its content and loses the link to its video.' : ' keep their content and lose the link to their video.',
  }
}
export const removalTitle = (name: string) => `Remove “${name}”?`
export const blockedTitle = (name: string) => `“${name}” cannot be removed yet`
export const blockedLead = (n: number) =>
  n > 1 ? 'A/B tests are running on its videos. Stop them first:' : 'An A/B test is running on one of its videos. Stop it first:'
/** " · running since Oct 18, on “<vídeo>”"; sem a data quando o banco não a tem. */
export function blockerDetail(b: RemovalBlocker, fmt: (iso: string) => string): string {
  const when = b.since ? `${b.status === 'paused' ? 'paused' : 'running'} since ${fmt(b.since)}, ` : b.status === 'paused' ? 'paused, ' : ''
  return `· ${when}on “${b.videoTitle}”`
}

/** "no channels yet" / "1 channel" / "3 channels", e os concorrentes do nicho quando a contagem existe. */
export function nicheUsage(channels: number, competitors: number | null): string {
  const own = channels === 0 ? 'no channels yet' : `${channels} ${s(channels, 'channel', 'channels')}`
  return competitors == null ? own : `${own} · ${competitors} ${s(competitors, 'competitor', 'competitors')}`
}
