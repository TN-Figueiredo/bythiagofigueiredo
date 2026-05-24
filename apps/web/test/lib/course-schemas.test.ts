import { describe, it, expect } from 'vitest'
import {
  CurriculumContentSchema,
  computeCourseProgress,
  computeModuleProgress,
} from '@/lib/pipeline/course-schemas'

describe('CurriculumContentSchema', () => {
  it('parses empty curriculum', () => {
    const result = CurriculumContentSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data!.modules).toEqual([])
    expect(result.data!.curriculum_mode).toBe('fixed')
  })

  it('parses full curriculum', () => {
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
  })
})

describe('computeCourseProgress', () => {
  it('computes correct progress', () => {
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
  })
})

describe('computeModuleProgress', () => {
  it('returns done/total for module', () => {
    const mod = CurriculumContentSchema.parse({
      modules: [{ id: 'm1', title: 'A', sort_order: 0, lessons: [
        { id: 'l1', title: 'a', type: 'video', sort_order: 0, production_status: 'ready' },
        { id: 'l2', title: 'b', type: 'video', sort_order: 1, production_status: 'ready' },
      ]}],
    }).modules[0]
    expect(computeModuleProgress(mod)).toEqual({ done: 2, total: 2 })
  })
})
