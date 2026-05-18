import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const RecommendationSchema = z.object({
  video_id: z.string().uuid(),
  action_type: z.enum([
    'thumbnail_test', 'title_test', 'description_test', 'combo_test',
    'retention_fix', 'seo_optimization', 'engagement_boost', 'distribution_expand',
    'content_series', 'publish_timing', 'community_post', 'end_screen_optimize',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
})

const PatchPayloadSchema = z.object({
  task_id: z.string().uuid(),
  video_recommendations: z.array(RecommendationSchema).max(25).optional(),
  coaching: z.object({
    summary: z.string().max(500),
    priorities: z.array(z.object({
      axis: z.enum(['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']),
      score: z.number().min(0).max(10),
      diagnosis: z.string().max(300),
      action: z.string().max(300),
    })).max(6),
  }).optional(),
  notifications: z.array(z.object({
    type: z.enum([
      'grade_drop', 'ctr_drop', 'monitoring_alert', 'ab_test_completed',
      'retest_suggested', 'optimization_available', 'trending_viral', 'optimization_resolved',
    ]),
    video_id: z.string().uuid().optional(),
    priority: z.number().int().min(1).max(5),
    title: z.string().max(100),
    message: z.string().max(500),
  })).max(20).optional(),
})

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
      }],
      coaching: {
        summary: 'Focus on improving CTR through better thumbnails',
        priorities: [
          { axis: 'ctr', score: 3.2, diagnosis: 'CTR below benchmark', action: 'Test face close-ups' },
        ],
      },
    }
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
})
