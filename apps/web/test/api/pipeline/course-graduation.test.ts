import { describe, it, expect } from 'vitest'
import { GraduateSchema } from '@/lib/pipeline/schemas'
import { CurriculumContentSchema } from '@/lib/pipeline/course-schemas'

describe('course graduation schema validation', () => {
  it('accepts course as graduation target', () => {
    const result = GraduateSchema.safeParse({ target: 'course' })
    expect(result.success).toBe(true)
  })

  it('curriculum with ready lessons is graduation-eligible', () => {
    const curriculum = CurriculumContentSchema.parse({
      modules: [{
        id: 'm1', title: 'M1', sort_order: 0,
        lessons: [
          { id: 'l1', title: 'L1', type: 'video', sort_order: 0, production_status: 'ready' },
          { id: 'l2', title: 'L2', type: 'video', sort_order: 1, production_status: 'ready' },
        ],
      }],
    })
    const eligibleModules = curriculum.modules.filter((m) =>
      m.lessons.length > 0 && m.lessons.every((l) => l.production_status === 'ready')
    )
    expect(eligibleModules).toHaveLength(1)
  })

  it('modules with non-ready lessons are not eligible', () => {
    const curriculum = CurriculumContentSchema.parse({
      modules: [{
        id: 'm1', title: 'M1', sort_order: 0,
        lessons: [
          { id: 'l1', title: 'L1', type: 'video', sort_order: 0, production_status: 'ready' },
          { id: 'l2', title: 'L2', type: 'video', sort_order: 1, production_status: 'scripted' },
        ],
      }],
    })
    const eligibleModules = curriculum.modules.filter((m) =>
      m.lessons.length > 0 && m.lessons.every((l) => l.production_status === 'ready')
    )
    expect(eligibleModules).toHaveLength(0)
  })

  it('empty modules are not eligible', () => {
    const curriculum = CurriculumContentSchema.parse({
      modules: [{
        id: 'm1', title: 'Empty', sort_order: 0,
        lessons: [],
      }],
    })
    const eligibleModules = curriculum.modules.filter((m) =>
      m.lessons.length > 0 && m.lessons.every((l) => l.production_status === 'ready')
    )
    expect(eligibleModules).toHaveLength(0)
  })

  it('partial graduation: only ready modules are eligible', () => {
    const curriculum = CurriculumContentSchema.parse({
      modules: [
        {
          id: 'm1', title: 'Ready Module', sort_order: 0,
          lessons: [
            { id: 'l1', title: 'L1', type: 'video', sort_order: 0, production_status: 'ready' },
          ],
        },
        {
          id: 'm2', title: 'Not Ready Module', sort_order: 1,
          lessons: [
            { id: 'l2', title: 'L2', type: 'video', sort_order: 0, production_status: 'scripted' },
          ],
        },
      ],
    })
    const eligibleModules = curriculum.modules.filter((m) =>
      m.lessons.length > 0 && m.lessons.every((l) => l.production_status === 'ready')
    )
    expect(eligibleModules).toHaveLength(1)
    expect(eligibleModules[0].id).toBe('m1')
  })
})
