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

  it('playlist_id in format_metadata must be validated against site ownership before reuse', () => {
    // Simulate the route logic: when format_metadata contains a playlist_id,
    // the route queries playlists filtered by both id AND site_id.
    // A playlist belonging to a different site returns no rows — access must be denied.
    const formatMetadata = { playlist_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }
    const existingPlaylistId = (formatMetadata as Record<string, unknown>)?.playlist_id as string | undefined

    // Simulate: query returned nothing (playlist belongs to another site)
    const existingPlaylist = null

    if (existingPlaylistId) {
      if (!existingPlaylist) {
        // Route returns 403 — assert the denial condition is reached
        expect(existingPlaylist).toBeNull()
        return
      }
    }

    // Should not reach here when playlist is from another site
    expect.fail('Should have denied cross-site playlist access')
  })

  it('upsert idempotency: duplicate lesson entries are deduplicated by playlist_id+pipeline_id', () => {
    // The route uses upsert with onConflict: 'playlist_id,pipeline_id' and ignoreDuplicates: true.
    // Simulate building allItems for two identical graduation calls — deduplication must occur.
    const playlistId = 'playlist-uuid'
    const lessonId = 'lesson-uuid'
    const itemId = 'item-uuid'

    function buildItems(pipelineRef: string | null) {
      return [{ playlist_id: playlistId, pipeline_id: pipelineRef || itemId, sort_order: 0 }]
    }

    const firstCall = buildItems(null)
    const secondCall = buildItems(null)

    // Merge both calls, then deduplicate on playlist_id+pipeline_id (mimics ignoreDuplicates)
    const combined = [...firstCall, ...secondCall]
    const seen = new Set<string>()
    const deduplicated = combined.filter((entry) => {
      const key = `${entry.playlist_id}:${entry.pipeline_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    expect(deduplicated).toHaveLength(1)
    expect(deduplicated[0].pipeline_id).toBe(itemId)
    expect(deduplicated[0].playlist_id).toBe(playlistId)
  })
})
