import { z } from 'zod'

export const RecommendationSchema = z.object({
  video_id: z.string().uuid(),
  action_type: z.enum([
    'thumbnail_test', 'title_test', 'description_test', 'combo_test',
    'retention_fix', 'seo_optimization', 'engagement_boost', 'distribution_expand',
    'content_series', 'publish_timing', 'community_post', 'end_screen_optimize',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
  suggested_variant_description: z.string().max(200).optional(),
})

export const CoachingSchema = z.object({
  summary: z.string().max(500),
  priorities: z.array(z.object({
    axis: z.enum(['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']),
    score: z.number().min(0).max(10),
    diagnosis: z.string().max(300),
    action: z.string().max(300),
  })).max(6),
})

export const NotificationSchema = z.object({
  type: z.enum([
    'grade_drop', 'ctr_drop', 'monitoring_alert', 'ab_test_completed',
    'retest_suggested', 'optimization_available', 'trending_viral', 'optimization_resolved',
  ]),
  video_id: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(5),
  title: z.string().max(100),
  message: z.string().max(500),
})

export const PatchPayloadSchema = z.object({
  task_id: z.string().uuid(),
  video_recommendations: z.array(RecommendationSchema).max(25).optional(),
  coaching: CoachingSchema.optional(),
  notifications: z.array(NotificationSchema).max(20).optional(),
  channel_insights: z.object({
    patterns_detected: z.array(z.object({
      pattern_id: z.string(),
      category: z.string(),
      finding: z.string().max(300),
      confidence: z.number().min(0).max(1),
      sample_size: z.number().int(),
    })).optional(),
    analysis_text: z.string().max(2000).optional(),
  }).optional(),
})
