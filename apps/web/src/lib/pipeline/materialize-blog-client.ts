export interface MaterializeBlogPostParams {
  pipelineItemId: string
  targetStage: 'published' | 'scheduled'
  scheduledFor: string | null
  vvsScore: number
}

export interface MaterializeResult {
  ok: true
  message: string
  blogPostId: string
  targetStage: string
}

export interface MaterializeError {
  ok: false
  message: string
}

export async function materializeBlogPost(
  params: MaterializeBlogPostParams,
): Promise<MaterializeResult | MaterializeError> {
  const { pipelineItemId, targetStage, scheduledFor, vvsScore } = params

  try {
    const res = await fetch(`/api/pipeline/items/${pipelineItemId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStage, scheduledFor: scheduledFor ?? null, vvsScore }),
    })

    const json = (await res.json()) as { data?: { blogPostId?: string; targetStage?: string }; error?: { message?: string; code?: string } }

    if (!res.ok) {
      const message = json.error?.message ?? `HTTP ${res.status}`
      return { ok: false, message }
    }

    return {
      ok: true,
      message: targetStage === 'published' ? 'Post publicado com sucesso' : 'Post agendado com sucesso',
      blogPostId: json.data?.blogPostId ?? '',
      targetStage: json.data?.targetStage ?? targetStage,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return { ok: false, message }
  }
}
