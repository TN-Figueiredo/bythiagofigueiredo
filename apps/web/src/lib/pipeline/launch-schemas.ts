import { z } from 'zod'

export const PlcItemSchema = z.object({
  number: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string().default(''),
  theme: z.enum(['opportunity', 'teaching', 'ownership']),
  content_format: z.enum(['video', 'blog', 'email', 'live']).default('video'),
  pipeline_ref: z.string().uuid().nullable().default(null),
  campaign_ref: z.string().uuid().nullable().default(null),
  planned_date: z.string().nullable().default(null),
  status: z.enum(['planned', 'drafted', 'produced', 'published']).default('planned'),
  key_message: z.string().default(''),
  mental_triggers: z.array(z.string()).default([]),
})

export const BonusSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  deadline: z.string().nullable().default(null),
  type: z.enum(['content', 'access', 'tool', 'community', 'coaching']).default('content'),
})

export const MentalTriggersSchema = z.object({
  authority: z.string().nullable().default(null),
  social_proof: z.string().nullable().default(null),
  reciprocity: z.string().nullable().default(null),
  scarcity: z.string().nullable().default(null),
  community: z.string().nullable().default(null),
  anticipation: z.string().nullable().default(null),
})

export const LaunchContentSchema = z.object({
  launch_type: z.enum(['seed', 'internal', 'jv', 'evergreen']).default('seed'),
  plc_sequence: z.array(PlcItemSchema).default([
    { number: 1, title: '', theme: 'opportunity', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
    { number: 2, title: '', theme: 'teaching', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
    { number: 3, title: '', theme: 'ownership', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
  ]),
  cart_open_date: z.string().nullable().default(null),
  cart_close_date: z.string().nullable().default(null),
  early_bird_deadline: z.string().nullable().default(null),
  bonuses: z.array(BonusSchema).default([]),
  email_campaign_id: z.string().uuid().nullable().default(null),
  mental_triggers: MentalTriggersSchema.default({}),
  notes: z.string().default(''),
})

export type LaunchContent = z.infer<typeof LaunchContentSchema>

export const MENTAL_TRIGGER_KEYS = ['authority', 'social_proof', 'reciprocity', 'scarcity', 'community', 'anticipation'] as const

export const TRIGGER_LABELS: Record<string, string> = {
  authority: 'Autoridade',
  social_proof: 'Prova Social',
  reciprocity: 'Reciprocidade',
  scarcity: 'Escassez',
  community: 'Comunidade',
  anticipation: 'Antecipação',
}
