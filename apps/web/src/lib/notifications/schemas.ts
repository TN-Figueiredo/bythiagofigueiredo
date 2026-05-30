import { z } from 'zod'

// --- PII blocklist — never allow PII in payload ---
const PII_PATTERNS = [
  /\b[\w.-]+@[\w.-]+\.\w{2,}\b/,  // email
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,  // CPF
  /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/,  // CNPJ
  /(?:\+55\s?\(?\d{2}\)?\s?|\(\d{2}\)\s?)\d{4,5}-?\d{4}\b/,  // phone BR (requires +55 or area code in parens)
]

function containsPii(value: unknown): boolean {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  return PII_PATTERNS.some(p => p.test(str))
}

const VALID_DOMAINS = ['pipeline', 'youtube', 'newsletter', 'social', 'links', 'blog', 'media', 'system'] as const

const VALID_CHANNELS = ['email', 'push', 'telegram'] as const

// --- NotificationCreateSchema ---

export const NotificationCreateSchema = z.object({
  site_id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.string().min(1).max(100),
  domain: z.enum(VALID_DOMAINS),
  priority: z.number().int().min(1).max(5),
  title: z.string().min(1).max(500),
  message: z.string().max(2000).nullish(),
  payload: z
    .record(z.unknown())
    .nullish()
    .refine(
      (val) => !val || !containsPii(val),
      { message: 'payload must not contain PII (email, CPF, CNPJ, phone)' }
    ),
  dedup_key: z.string().max(500).nullish(),
  group_key: z.string().max(500).nullish(),
  suggested_action: z.string().max(200).nullish(),
  action_href: z
    .string()
    .max(2000)
    .nullish()
    .refine(
      (val) => !val || val.startsWith('/') || val.startsWith('https://'),
      { message: 'action_href must be a relative path or HTTPS URL' }
    ),
  channels: z.array(z.enum(VALID_CHANNELS)).optional(),
  actor_id: z.string().uuid().optional(),  // for self-action suppression
})

export type NotificationCreateInput = z.infer<typeof NotificationCreateSchema>

// --- PreferencesUpdateSchema ---

export const PreferencesUpdateSchema = z.object({
  category: z.enum([...VALID_DOMAINS, '' as const]).nullish().transform(v => v || null),
  channel_in_app: z.boolean().optional(),
  channel_email: z.boolean().optional(),
  channel_push: z.boolean().optional(),
  channel_telegram: z.boolean().optional(),
  frequency_mode: z.enum(['calm', 'regular', 'power']).optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  quiet_hours_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  quiet_hours_timezone: z.string().min(1).max(100).optional(),
})

export type PreferencesUpdateInput = z.infer<typeof PreferencesUpdateSchema>

// --- Domain-specific payload schemas (for type-safe payloads) ---

export const PipelinePayloadSchema = z.object({
  itemId: z.string().uuid().optional(),
  title: z.string().optional(),
  stage: z.string().optional(),
  gate: z.string().optional(),
  score: z.number().optional(),
  hours: z.number().optional(),
  days: z.number().optional(),
  count: z.number().optional(),
  destination: z.string().optional(),
  suggestion: z.string().optional(),
  depth: z.string().optional(),
  playlistId: z.string().uuid().optional(),
  name: z.string().optional(),
  deadline: z.string().optional(),
})

export const YoutubePayloadSchema = z.object({
  videoId: z.string().optional(),
  testId: z.string().uuid().optional(),
  title: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  variant: z.string().optional(),
  direction: z.string().optional(),
  delta: z.number().optional(),
  count: z.number().optional(),
  milestone: z.string().optional(),
})

export const SystemPayloadSchema = z.object({
  count: z.number().optional(),
  service: z.string().optional(),
  job: z.string().optional(),
  detail: z.string().optional(),
  error: z.string().optional(),
  summary: z.string().optional(),
  pct: z.number().optional(),
  name: z.string().optional(),
  date: z.string().optional(),
  deployId: z.string().optional(),
  weekIso: z.string().optional(),
})

export { containsPii }
