import { z } from 'zod'
import type { Format } from './schemas'

export interface SectionDefinition {
  key: string
  label_pt: string
  label_en: string
  type: string
  shared: boolean
  subSections?: SectionDefinition[]
}

const SHARED_SECTIONS = new Set(['ideia', 'brolls', 'images'])

export function getSectionKey(sectionType: string, lang: string): string {
  if (SHARED_SECTIONS.has(sectionType)) return `${sectionType}_shared`
  const normalizedLang = lang === 'pt-br' ? 'pt' : lang
  return `${sectionType}_${normalizedLang}`
}

export const SECTION_DEFINITIONS: Record<Format, SectionDefinition[]> = {
  video: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'roteiro', label_pt: 'Roteiro', label_en: 'Script', type: 'roteiro', shared: false },
    { key: 'brolls', label_pt: 'B-Rolls', label_en: 'B-Rolls', type: 'brolls', shared: true },
    {
      key: 'postprod', label_pt: 'Pós-Produção', label_en: 'Post-Production', type: 'postprod', shared: false,
      subSections: [
        { key: 'postprod_crossref', label_pt: 'Cross-Reference', label_en: 'Cross-Reference', type: 'postprod_crossref', shared: false },
        { key: 'postprod_speedramps', label_pt: 'Speed Ramps', label_en: 'Speed Ramps', type: 'postprod_speedramps', shared: false },
        { key: 'postprod_scenes', label_pt: 'Cena × Cena', label_en: 'Scene × Scene', type: 'postprod_scenes', shared: false },
      ],
    },
    { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
  ],
  blog_post: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'draft', label_pt: 'Rascunho', label_en: 'Draft', type: 'draft', shared: false },
    { key: 'seo', label_pt: 'SEO', label_en: 'SEO', type: 'seo', shared: false },
    { key: 'images', label_pt: 'Imagens', label_en: 'Images', type: 'images', shared: true },
    { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
  ],
  newsletter: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'content', label_pt: 'Conteúdo', label_en: 'Content', type: 'content', shared: false },
    { key: 'layout', label_pt: 'Layout', label_en: 'Layout', type: 'layout', shared: false },
    { key: 'audience', label_pt: 'Audiência', label_en: 'Audience', type: 'audience', shared: false },
    { key: 'send', label_pt: 'Envio', label_en: 'Send', type: 'send', shared: false },
  ],
  course: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'curriculum', label_pt: 'Currículo', label_en: 'Curriculum', type: 'curriculum', shared: false },
    { key: 'lessons', label_pt: 'Aulas', label_en: 'Lessons', type: 'lessons', shared: false },
    { key: 'material', label_pt: 'Material', label_en: 'Material', type: 'material', shared: false },
    { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
  ],
  campaign: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'briefing', label_pt: 'Briefing', label_en: 'Briefing', type: 'briefing', shared: false },
    { key: 'assets', label_pt: 'Assets', label_en: 'Assets', type: 'assets', shared: false },
    { key: 'metrics', label_pt: 'Métricas', label_en: 'Metrics', type: 'metrics', shared: false },
    { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
  ],
}

export function getSectionsForFormat(format: Format): SectionDefinition[] {
  return SECTION_DEFINITIONS[format]
}

export function flattenSections(sections: SectionDefinition[]): SectionDefinition[] {
  return sections.flatMap(s => s.subSections ? [s, ...s.subSections] : [s])
}

export const SectionDataSchema = z.object({
  rev: z.number().int().min(0),
  cowork_rev: z.number().int().min(0).nullable().optional(),
  source: z.string().min(1),
  edited: z.boolean(),
  content: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
  updated_at: z.string().datetime(),
  modified_by: z.string().nullable().optional(),
})

export type SectionData = z.infer<typeof SectionDataSchema>

export const SectionPatchSchema = z.object({
  content: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
  rev: z.number().int().min(0),
  source: z.string().optional(),
  modified_by: z.string().optional(),
})

export type SectionPatch = z.infer<typeof SectionPatchSchema>

export const BatchSectionUpdateSchema = z.object({
  updates: z.array(z.object({
    item_id: z.string().uuid(),
    section: z.string().min(1),
    lang: z.string().default('en'),
    content: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
    source: z.string().default('cowork'),
    modified_by: z.string().optional(),
  })).min(1).max(50),
})
