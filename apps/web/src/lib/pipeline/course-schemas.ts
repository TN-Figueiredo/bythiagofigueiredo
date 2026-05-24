import { z } from 'zod'

export const LessonResourceSchema = z.object({
  label: z.string().min(1),
  type: z.enum(['pdf', 'repo', 'link', 'template', 'tool']),
  url: z.string().nullable().default(null),
  media_id: z.string().uuid().nullable().default(null),
})

export const CurriculumLessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['video', 'text', 'quiz', 'exercise', 'pdf', 'live', 'mixed']),
  sort_order: z.number().int().nonnegative(),
  is_preview: z.boolean().default(false),
  estimated_minutes: z.number().int().positive().default(10),
  production_status: z.enum(['outline', 'scripted', 'recorded', 'edited', 'ready']).default('outline'),
  pipeline_ref: z.string().uuid().nullable().default(null),
  resources: z.array(LessonResourceSchema).default([]),
})

export const CurriculumModuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  sort_order: z.number().int().nonnegative(),
  is_preview: z.boolean().default(false),
  lessons: z.array(CurriculumLessonSchema).default([]),
})

export const CurriculumContentSchema = z.object({
  curriculum_mode: z.enum(['fixed', 'progressive']).default('fixed'),
  target_audience: z.string().default(''),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  estimated_hours: z.number().nonnegative().default(0),
  learning_outcomes: z.array(z.string()).default([]),
  modules: z.array(CurriculumModuleSchema).default([]),
})

export type CurriculumContent = z.infer<typeof CurriculumContentSchema>
export type CurriculumModule = z.infer<typeof CurriculumModuleSchema>
export type CurriculumLesson = z.infer<typeof CurriculumLessonSchema>

const PRODUCTION_ORDER = ['outline', 'scripted', 'recorded', 'edited', 'ready'] as const

export function computeModuleProgress(mod: CurriculumModule): { done: number; total: number } {
  const total = mod.lessons.length
  const done = mod.lessons.filter((l) => l.production_status === 'ready').length
  return { done, total }
}

export function computeCourseProgress(content: CurriculumContent): {
  done: number
  total: number
  byStatus: Record<string, number>
} {
  const allLessons = content.modules.flatMap((m) => m.lessons)
  const total = allLessons.length
  const done = allLessons.filter((l) => l.production_status === 'ready').length
  const byStatus: Record<string, number> = {}
  for (const s of PRODUCTION_ORDER) {
    byStatus[s] = allLessons.filter((l) => l.production_status === s).length
  }
  return { done, total, byStatus }
}

export function generateLessonId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function generateModuleId(): string {
  return Math.random().toString(36).slice(2, 10)
}
