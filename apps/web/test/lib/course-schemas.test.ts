import { describe, it, expect } from 'vitest'
import {
  CurriculumContentSchema,
  computeCourseProgress,
  computeModuleProgress,
  generateLessonId,
  generateModuleId,
} from '@/lib/pipeline/course-schemas'

describe('generateLessonId', () => {
  it('returns a string of 8 characters', () => {
    const id = generateLessonId()
    expect(typeof id).toBe('string')
    expect(id).toHaveLength(8)
  })

  it('generates unique IDs across 100 calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateLessonId()))
    expect(ids.size).toBe(100)
  })
})

describe('generateModuleId', () => {
  it('returns a string of 8 characters', () => {
    const id = generateModuleId()
    expect(typeof id).toBe('string')
    expect(id).toHaveLength(8)
  })

  it('generates unique IDs across 100 calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateModuleId()))
    expect(ids.size).toBe(100)
  })
})

describe('CurriculumContentSchema', () => {
  it('parses empty input and applies all defaults', () => {
    const result = CurriculumContentSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data!.modules).toEqual([])
    expect(result.data!.curriculum_mode).toBe('fixed')
    expect(result.data!.difficulty).toBe('beginner')
    expect(result.data!.estimated_hours).toBe(0)
    expect(result.data!.learning_outcomes).toEqual([])
    expect(result.data!.target_audience).toBe('')
  })

  it('parses full curriculum with all fields', () => {
    const result = CurriculumContentSchema.safeParse({
      curriculum_mode: 'progressive',
      target_audience: 'Devs',
      difficulty: 'intermediate',
      estimated_hours: 12,
      learning_outcomes: ['Build RAG systems'],
      modules: [{
        id: 'm1', title: 'Intro', description: '', sort_order: 0, is_preview: true,
        lessons: [{
          id: 'l1', title: 'What is AI', type: 'video', sort_order: 0,
          is_preview: true, estimated_minutes: 15, production_status: 'ready',
          pipeline_ref: null, resources: [],
        }],
      }],
    })
    expect(result.success).toBe(true)
    expect(result.data!.curriculum_mode).toBe('progressive')
    expect(result.data!.difficulty).toBe('intermediate')
    expect(result.data!.modules[0].title).toBe('Intro')
  })

  it('rejects invalid lesson production_status values', () => {
    const result = CurriculumContentSchema.safeParse({
      modules: [{
        id: 'm1', title: 'Module', sort_order: 0,
        lessons: [{
          id: 'l1', title: 'Lesson', type: 'video', sort_order: 0,
          production_status: 'not_a_real_status',
        }],
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid difficulty values', () => {
    const result = CurriculumContentSchema.safeParse({ difficulty: 'expert' })
    expect(result.success).toBe(false)
  })

  it('applies lesson defaults (estimated_minutes, is_preview, resources)', () => {
    const result = CurriculumContentSchema.parse({
      modules: [{
        id: 'm1', title: 'M', sort_order: 0,
        lessons: [{ id: 'l1', title: 'L', type: 'video', sort_order: 0 }],
      }],
    })
    const lesson = result.modules[0].lessons[0]
    expect(lesson.estimated_minutes).toBe(10)
    expect(lesson.is_preview).toBe(false)
    expect(lesson.resources).toEqual([])
    expect(lesson.production_status).toBe('outline')
    expect(lesson.pipeline_ref).toBeNull()
  })
})

describe('computeCourseProgress', () => {
  it('computes correct progress with mixed statuses', () => {
    const content = CurriculumContentSchema.parse({
      modules: [{
        id: 'm1', title: 'A', sort_order: 0,
        lessons: [
          { id: 'l1', title: 'a', type: 'video', sort_order: 0, production_status: 'ready' },
          { id: 'l2', title: 'b', type: 'video', sort_order: 1, production_status: 'scripted' },
          { id: 'l3', title: 'c', type: 'video', sort_order: 2, production_status: 'outline' },
        ],
      }],
    })
    const progress = computeCourseProgress(content)
    expect(progress.done).toBe(1)
    expect(progress.total).toBe(3)
    expect(progress.byStatus.ready).toBe(1)
    expect(progress.byStatus.scripted).toBe(1)
    expect(progress.byStatus.outline).toBe(1)
    expect(progress.byStatus.recorded).toBe(0)
    expect(progress.byStatus.edited).toBe(0)
  })

  it('returns zero counts for empty modules', () => {
    const content = CurriculumContentSchema.parse({ modules: [] })
    const progress = computeCourseProgress(content)
    expect(progress.done).toBe(0)
    expect(progress.total).toBe(0)
    expect(Object.values(progress.byStatus).every((v) => v === 0)).toBe(true)
  })

  it('counts all lessons as done when all are ready', () => {
    const content = CurriculumContentSchema.parse({
      modules: [
        {
          id: 'm1', title: 'A', sort_order: 0,
          lessons: [
            { id: 'l1', title: 'a', type: 'video', sort_order: 0, production_status: 'ready' },
            { id: 'l2', title: 'b', type: 'text', sort_order: 1, production_status: 'ready' },
          ],
        },
        {
          id: 'm2', title: 'B', sort_order: 1,
          lessons: [
            { id: 'l3', title: 'c', type: 'quiz', sort_order: 0, production_status: 'ready' },
          ],
        },
      ],
    })
    const progress = computeCourseProgress(content)
    expect(progress.done).toBe(3)
    expect(progress.total).toBe(3)
    expect(progress.byStatus.ready).toBe(3)
  })

  it('aggregates lessons across multiple modules', () => {
    const content = CurriculumContentSchema.parse({
      modules: [
        {
          id: 'm1', title: 'A', sort_order: 0,
          lessons: [
            { id: 'l1', title: 'a', type: 'video', sort_order: 0, production_status: 'ready' },
          ],
        },
        {
          id: 'm2', title: 'B', sort_order: 1,
          lessons: [
            { id: 'l2', title: 'b', type: 'video', sort_order: 0, production_status: 'scripted' },
            { id: 'l3', title: 'c', type: 'video', sort_order: 1, production_status: 'outline' },
          ],
        },
      ],
    })
    const progress = computeCourseProgress(content)
    expect(progress.total).toBe(3)
    expect(progress.done).toBe(1)
  })
})

describe('computeModuleProgress', () => {
  it('returns done/total for module with all ready lessons', () => {
    const mod = CurriculumContentSchema.parse({
      modules: [{ id: 'm1', title: 'A', sort_order: 0, lessons: [
        { id: 'l1', title: 'a', type: 'video', sort_order: 0, production_status: 'ready' },
        { id: 'l2', title: 'b', type: 'video', sort_order: 1, production_status: 'ready' },
      ]}],
    }).modules[0]
    expect(computeModuleProgress(mod)).toEqual({ done: 2, total: 2 })
  })

  it('handles module with no lessons', () => {
    const mod = CurriculumContentSchema.parse({
      modules: [{ id: 'm1', title: 'Empty', sort_order: 0, lessons: [] }],
    }).modules[0]
    expect(computeModuleProgress(mod)).toEqual({ done: 0, total: 0 })
  })

  it('counts only ready lessons as done', () => {
    const mod = CurriculumContentSchema.parse({
      modules: [{ id: 'm1', title: 'A', sort_order: 0, lessons: [
        { id: 'l1', title: 'a', type: 'video', sort_order: 0, production_status: 'ready' },
        { id: 'l2', title: 'b', type: 'video', sort_order: 1, production_status: 'edited' },
        { id: 'l3', title: 'c', type: 'video', sort_order: 2, production_status: 'outline' },
      ]}],
    }).modules[0]
    expect(computeModuleProgress(mod)).toEqual({ done: 1, total: 3 })
  })
})
