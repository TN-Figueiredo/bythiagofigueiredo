import { describe, it, expect } from 'vitest'
import { PatchPayloadSchema } from '@/lib/youtube/intelligence-schemas'

describe('PATCH payload validation', () => {
  it('validates a complete valid payload', () => {
    const payload = {
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      video_recommendations: [{
        video_id: '123e4567-e89b-12d3-a456-426614174001',
        action_type: 'thumbnail_test',
        priority: 'high',
        confidence: 0.85,
        reasoning: 'CTR below channel average, face close-ups work better',
        suggested_variant_description: 'Close-up face with text overlay',
      }],
      coaching: {
        summary: 'Focus on improving CTR through better thumbnails',
        priorities: [
          { axis: 'ctr', score: 3.2, diagnosis: 'CTR below benchmark', action: 'Test face close-ups' },
        ],
      },
      channel_insights: {
        patterns_detected: [{
          pattern_id: 'pat_test1234',
          category: 'thumbnail_style',
          finding: 'Face close-ups perform 40% better',
          confidence: 0.82,
          sample_size: 15,
        }],
        analysis_text: 'Channel shows strong potential for CTR improvement',
      },
    }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('validates minimal payload (task_id only)', () => {
    const payload = { task_id: '123e4567-e89b-12d3-a456-426614174000' }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('rejects missing task_id', () => {
    const payload = { video_recommendations: [] }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects invalid action_type', () => {
    const payload = {
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      video_recommendations: [{
        video_id: '123e4567-e89b-12d3-a456-426614174001',
        action_type: 'invalid_action',
        priority: 'high',
        confidence: 0.85,
        reasoning: 'test',
      }],
    }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects confidence > 1', () => {
    const payload = {
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      video_recommendations: [{
        video_id: '123e4567-e89b-12d3-a456-426614174001',
        action_type: 'thumbnail_test',
        priority: 'high',
        confidence: 1.5,
        reasoning: 'test',
      }],
    }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects more than 25 recommendations', () => {
    const recs = Array.from({ length: 26 }, (_, i) => ({
      video_id: `123e4567-e89b-12d3-a456-42661417${String(i).padStart(4, '0')}`,
      action_type: 'thumbnail_test' as const,
      priority: 'medium' as const,
      confidence: 0.7,
      reasoning: 'test',
    }))
    const payload = { task_id: '123e4567-e89b-12d3-a456-426614174000', video_recommendations: recs }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects coaching axis score > 10', () => {
    const payload = {
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      coaching: {
        summary: 'test',
        priorities: [{ axis: 'ctr', score: 15, diagnosis: 'test', action: 'test' }],
      },
    }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects notification priority > 5', () => {
    const payload = {
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      notifications: [{
        type: 'grade_drop',
        priority: 10,
        title: 'test',
        message: 'test',
      }],
    }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(false)
  })
})
