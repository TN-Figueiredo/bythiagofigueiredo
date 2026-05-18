// apps/web/src/lib/social/pipeline.ts

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PipelineStep,
  PipelineStepName,
  PipelineStepStatus,
} from './types'

export function createInitialPipelineSteps(): PipelineStep[] {
  const now = new Date().toISOString()
  return [
    { step: 'post_created', status: 'completed', at: now },
    { step: 'short_link', status: 'completed', at: now },
    { step: 'platform_prepare', status: 'pending', at: '' },
    { step: 'deliver', status: 'pending', at: '' },
  ]
}

export async function updatePipelineStep(
  supabase: SupabaseClient,
  postId: string,
  stepName: PipelineStepName,
  status: PipelineStepStatus,
  data?: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString()
  const patch: PipelineStep = { step: stepName, status, at: now, ...(data ? { data } : {}) }

  const { error } = await supabase.rpc('update_pipeline_step', {
    p_post_id: postId,
    p_step_name: stepName,
    p_patch: patch,
  })

  if (error) {
    throw new Error(`Failed to update pipeline_steps for post ${postId}: ${error.message}`)
  }
}

export function getPipelineDuration(steps: PipelineStep[]): number {
  const completed = steps.filter(
    (s) => (s.status === 'completed' || s.status === 'warning') && s.at,
  )

  if (completed.length < 2) return 0

  const times = completed.map((s) => new Date(s.at).getTime())
  const min = Math.min(...times)
  const max = Math.max(...times)

  return max - min
}

export function isPipelineComplete(steps: PipelineStep[]): boolean {
  if (steps.length === 0) return false
  return steps.every((s) => s.status === 'completed' || s.status === 'warning')
}
