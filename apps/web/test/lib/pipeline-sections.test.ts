import { describe, it, expect } from 'vitest'
import { SECTION_DEFINITIONS, getSectionsForFormat } from '../../src/lib/pipeline/sections'

describe('course section definitions', () => {
  const courseSections = getSectionsForFormat('course')

  it('has 6 sections', () => {
    expect(courseSections).toHaveLength(6)
  })

  it('has curriculum as shared', () => {
    const curriculum = courseSections.find((s) => s.key === 'curriculum')
    expect(curriculum).toBeDefined()
    expect(curriculum!.shared).toBe(true)
    expect(curriculum!.type).toBe('curriculum')
  })

  it('has launch as shared', () => {
    const launch = courseSections.find((s) => s.key === 'launch')
    expect(launch).toBeDefined()
    expect(launch!.shared).toBe(true)
    expect(launch!.type).toBe('launch')
  })

  it('has lessons as per-language', () => {
    const lessons = courseSections.find((s) => s.key === 'lessons')
    expect(lessons).toBeDefined()
    expect(lessons!.shared).toBe(false)
  })

  it('sections are ordered: ideia, curriculum, lessons, material, launch, publish', () => {
    const keys = courseSections.map((s) => s.key)
    expect(keys).toEqual(['ideia', 'curriculum', 'lessons', 'material', 'launch', 'publish'])
  })
})
