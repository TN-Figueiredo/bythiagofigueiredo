import type { Format } from './schemas'
import { FORMAT_METADATA_SCHEMAS } from './schemas'

export interface ValidationScore {
  overall: number
  breakdown: {
    has_title: boolean
    has_hook: boolean
    has_synopsis: boolean
    has_body: boolean
    has_tags: boolean
    checklist_pct: number
    metadata_complete: boolean
  }
  computed_at: string
}

interface ValidationInput {
  title_pt: string | null
  title_en: string | null
  hook: string | null
  synopsis: string | null
  body_content: string | null
  tags: string[]
  production_checklist: Array<{ label: string; done: boolean }>
  format_metadata: Record<string, unknown>
  format: Format
}

const WEIGHTS = {
  has_title: 20,
  has_hook: 15,
  has_synopsis: 10,
  has_body: 20,
  has_tags: 10,
  checklist_pct: 15,
  metadata_complete: 10,
}

export function computeValidationScore(input: ValidationInput): ValidationScore {
  const has_title = Boolean(input.title_pt || input.title_en)
  const has_hook = Boolean(input.hook)
  const has_synopsis = Boolean(input.synopsis)
  const has_body = Boolean(input.body_content)
  const has_tags = input.tags.length > 0

  const doneCount = input.production_checklist.filter((c) => c.done).length
  const totalCount = input.production_checklist.length
  const checklist_pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const schema = FORMAT_METADATA_SCHEMAS[input.format]
  const metaResult = schema.safeParse(input.format_metadata)
  const hasMetaValues = Object.values(input.format_metadata).some((v) => v !== undefined && v !== null && v !== '')
  const metadata_complete = metaResult.success && hasMetaValues

  const breakdown = { has_title, has_hook, has_synopsis, has_body, has_tags, checklist_pct, metadata_complete }

  const overall = Math.round(
    (has_title ? WEIGHTS.has_title : 0) +
    (has_hook ? WEIGHTS.has_hook : 0) +
    (has_synopsis ? WEIGHTS.has_synopsis : 0) +
    (has_body ? WEIGHTS.has_body : 0) +
    (has_tags ? WEIGHTS.has_tags : 0) +
    (checklist_pct / 100) * WEIGHTS.checklist_pct +
    (metadata_complete ? WEIGHTS.metadata_complete : 0)
  )

  return { overall, breakdown, computed_at: new Date().toISOString() }
}
